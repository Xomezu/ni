/**
 * Plays a cue and listens on the microphone. Matching audio clicks the page button.
 */

import {
  RATE,
  SlidingCueDetector,
  buildTemplate,
  mixToMono,
  resampleLinear,
  type CueTemplate,
} from './signal.ts';

type Meter = { score: number; level: number };

export class CueSession {
  onPress: ((score: number) => void) | null = null;
  onMeter: ((meter: Meter) => void) | null = null;
  onMiss: (() => void) | null = null;

  private ctx: AudioContext | null = null;
  private detector: SlidingCueDetector | null = null;
  private template: CueTemplate | null = null;
  private pcm: Float32Array | null = null;
  private processor: ScriptProcessorNode | null = null;
  private mute: GainNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micStream: MediaStream | null = null;
  private playTimer = 0;
  private injecting = false;
  private matchedThisPlay = false;
  suppress = false;
  threshold = 0.82;
  cooldownSec = 1;

  get armed(): boolean {
    return this.micStream !== null;
  }

  get cue(): CueTemplate | null {
    return this.template;
  }

  setCue(samples: Float32Array, sampleRate: number): CueTemplate | null {
    const template = buildTemplate(samples, sampleRate);
    if (!template) {
      this.template = null;
      this.pcm = null;
      this.detector = null;
      return null;
    }
    this.template = template;
    this.pcm = template.pcm;
    if (this.detector) this.detector.setTemplate(template);
    else this.detector = new SlidingCueDetector(template, this.threshold, this.cooldownSec);
    return template;
  }

  setThreshold(threshold: number): void {
    this.threshold = threshold;
    this.detector?.setThreshold(threshold);
  }

  setCooldown(cooldownSec: number): void {
    this.cooldownSec = cooldownSec;
    this.detector?.setCooldown(cooldownSec);
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      const processor = this.ctx.createScriptProcessor(4096, 1, 1);
      const mute = this.ctx.createGain();
      mute.gain.value = 0;
      processor.onaudioprocess = (event) => {
        if (this.injecting || this.suppress || !this.detector || !this.micStream) return;
        const input = event.inputBuffer.getChannelData(0);
        this.ingest(input, event.inputBuffer.sampleRate);
      };
      processor.connect(mute);
      mute.connect(this.ctx.destination);
      this.processor = processor;
      this.mute = mute;
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private ingest(chunk: Float32Array, sampleRate: number): void {
    if (!this.detector) return;
    const atRate = resampleLinear(new Float32Array(chunk), sampleRate, RATE);
    const match = this.detector.push(atRate);
    this.onMeter?.({ score: this.detector.lastScore, level: this.detector.lastLevel });
    if (match) this.onPress?.(match.score);
  }

  /** Play samples through the speakers and feed the detector in step with the audio clock. */
  private playSamples(samples: Float32Array, kind: 'cue' | 'other'): void {
    const ctx = this.ensureContext();
    if (!this.detector) return;
    if (this.playTimer) {
      window.clearInterval(this.playTimer);
      this.playTimer = 0;
    }
    this.injecting = true;
    this.matchedThisPlay = false;
    this.detector.reset();
    const pcm = new Float32Array(samples);

    const buffer = ctx.createBuffer(1, pcm.length, RATE);
    buffer.getChannelData(0).set(pcm);
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = 0.85;
    src.buffer = buffer;
    src.connect(gain);
    gain.connect(ctx.destination);
    const start = ctx.currentTime + 0.02;
    const startedAt = performance.now();
    src.start(start);

    let offset = 0;
    this.playTimer = window.setInterval(() => {
      const fromAudio = ctx.currentTime - start;
      const fromClock = (performance.now() - startedAt) / 1000 - 0.02;
      const heard = Math.floor(Math.max(0, fromAudio, fromClock) * RATE);
      while (offset < heard && offset < pcm.length) {
        const end = Math.min(pcm.length, offset + 2048);
        if (this.detector) {
          const match = this.detector.push(pcm.subarray(offset, end));
          this.onMeter?.({ score: this.detector.lastScore, level: this.detector.lastLevel });
          if (match) {
            this.matchedThisPlay = true;
            this.onPress?.(match.score);
          }
        }
        offset = end;
      }
      if (offset >= pcm.length) {
        window.clearInterval(this.playTimer);
        this.playTimer = 0;
        this.injecting = false;
        if (!this.matchedThisPlay && kind === 'other') this.onMiss?.();
      }
    }, 30);
  }

  playCue(): void {
    if (!this.pcm) return;
    this.playSamples(this.pcm, 'cue');
  }

  playOther(samples: Float32Array): void {
    this.playSamples(samples, 'other');
  }

  async arm(): Promise<void> {
    const ctx = this.ensureContext();
    if (this.micStream) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    const source = ctx.createMediaStreamSource(stream);
    if (this.processor) source.connect(this.processor);
    this.micSource = source;
    this.micStream = stream;
  }

  disarm(): void {
    this.micSource?.disconnect();
    this.micSource = null;
    this.micStream?.getTracks().forEach((track) => track.stop());
    this.micStream = null;
  }

  async record(seconds: number, onProgress: (ratio: number) => void): Promise<CueTemplate | null> {
    this.suppress = true;
    const wasArmed = this.armed;
    if (wasArmed) this.disarm();
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new Ctx();
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      const mute = ctx.createGain();
      mute.gain.value = 0;
      const chunks: Float32Array[] = [];
      processor.onaudioprocess = (event) => {
        chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      };
      source.connect(processor);
      processor.connect(mute);
      mute.connect(ctx.destination);
      const started = performance.now();
      await new Promise<void>((resolve) => {
        const timer = window.setInterval(() => {
          const ratio = (performance.now() - started) / (seconds * 1000);
          onProgress(Math.min(1, ratio));
          if (ratio >= 1) {
            window.clearInterval(timer);
            resolve();
          }
        }, 40);
      });
      processor.disconnect();
      source.disconnect();
      const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const mixed = new Float32Array(length);
      let pos = 0;
      for (const chunk of chunks) {
        mixed.set(chunk, pos);
        pos += chunk.length;
      }
      return this.setCue(mixed, ctx.sampleRate);
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
      if (ctx) await ctx.close();
      this.suppress = false;
      if (wasArmed) {
        try {
          await this.arm();
        } catch {
          // The recording permission was enough; re-arm can fail if the device is busy.
        }
      }
    }
  }

  async loadFile(file: Blob): Promise<CueTemplate | null> {
    const ctx = this.ensureContext();
    const encoded = await file.arrayBuffer();
    const decoded = await ctx.decodeAudioData(encoded.slice(0));
    return this.setCue(mixToMono(decoded), decoded.sampleRate);
  }

  dispose(): void {
    if (this.playTimer) window.clearInterval(this.playTimer);
    this.disarm();
    this.processor?.disconnect();
    this.mute?.disconnect();
    void this.ctx?.close();
    this.ctx = null;
  }
}
