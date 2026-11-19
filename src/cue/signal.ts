/**
 * Recognizes a short audio cue and reports when a live stream matches it.
 * Detection always runs at 48 kHz so a file, a recording, and the mic compare the same way.
 */

export const RATE = 48000;
export const FRAME = 2048;
export const HOP = 1024;
export const BANDS = 24;
const FREQ_MIN = 80;
const FREQ_MAX = 8000;
const MAX_SECONDS = 2.5;
const MIN_FRAMES = 6;

export type CueTemplate = {
  frames: Float32Array[];
  weights: Float32Array;
  pcm: Float32Array;
  durationSec: number;
};

export type MatchEvent = {
  score: number;
};

export function resampleLinear(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate || input.length === 0) return input;
  const outLen = Math.max(1, Math.round((input.length * toRate) / fromRate));
  const out = new Float32Array(outLen);
  const ratio = fromRate / toRate;
  const last = input.length - 1;
  for (let i = 0; i < outLen; i++) {
    const x = i * ratio;
    const i0 = Math.min(last, Math.floor(x));
    const i1 = Math.min(last, i0 + 1);
    const frac = x - i0;
    out[i] = input[i0] * (1 - frac) + input[i1] * frac;
  }
  return out;
}

export function rms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}

/** In-place radix-2 FFT. real and imag must share a power-of-two length. */
export function fft(real: Float32Array, imag: Float32Array): void {
  const n = real.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = real[i];
      real[i] = real[j];
      real[j] = tr;
      const ti = imag[i];
      imag[i] = imag[j];
      imag[j] = ti;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const ang = (-2 * Math.PI) / len;
    const wlenRe = Math.cos(ang);
    const wlenIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wRe = 1;
      let wIm = 0;
      for (let k = 0; k < half; k++) {
        const uRe = real[i + k];
        const uIm = imag[i + k];
        const vRe = real[i + k + half] * wRe - imag[i + k + half] * wIm;
        const vIm = real[i + k + half] * wIm + imag[i + k + half] * wRe;
        real[i + k] = uRe + vRe;
        imag[i + k] = uIm + vIm;
        real[i + k + half] = uRe - vRe;
        imag[i + k + half] = uIm - vIm;
        const nextRe = wRe * wlenRe - wIm * wlenIm;
        wIm = wRe * wlenIm + wIm * wlenRe;
        wRe = nextRe;
      }
    }
  }
}

export function bandEnergies(frame: Float32Array, sampleRate: number): Float32Array {
  const real = new Float32Array(FRAME);
  const imag = new Float32Array(FRAME);
  for (let i = 0; i < FRAME; i++) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FRAME - 1)));
    real[i] = (frame[i] || 0) * w;
  }
  fft(real, imag);

  const bands = new Float32Array(BANDS);
  const counts = new Float32Array(BANDS);
  const nyquist = sampleRate / 2;
  const maxF = Math.min(FREQ_MAX, nyquist * 0.95);
  const logMin = Math.log(FREQ_MIN);
  const logMax = Math.log(maxF);
  const half = FRAME / 2;

  for (let bin = 1; bin < half; bin++) {
    const freq = (bin * sampleRate) / FRAME;
    if (freq < FREQ_MIN || freq > maxF) continue;
    const mag = Math.hypot(real[bin], imag[bin]) / FRAME;
    const t = (Math.log(freq) - logMin) / (logMax - logMin);
    const b = Math.min(BANDS - 1, Math.max(0, Math.floor(t * BANDS)));
    bands[b] += mag;
    counts[b] += 1;
  }

  for (let b = 0; b < BANDS; b++) {
    if (counts[b] > 0) bands[b] = Math.log1p(bands[b] / counts[b]);
  }
  return bands;
}

function unit(bands: Float32Array): { vector: Float32Array; energy: number } {
  let energySq = 0;
  for (let i = 0; i < bands.length; i++) energySq += bands[i] * bands[i];
  const energy = Math.sqrt(energySq);
  const vector = new Float32Array(bands.length);
  if (energy > 1e-8) {
    for (let i = 0; i < bands.length; i++) vector[i] = bands[i] / energy;
  }
  return { vector, energy };
}

export function dominantBand(frame: Float32Array, sampleRate: number): number {
  const bands = bandEnergies(frame, sampleRate);
  let best = 0;
  let bestVal = -1;
  for (let i = 0; i < bands.length; i++) {
    if (bands[i] > bestVal) {
      bestVal = bands[i];
      best = i;
    }
  }
  return best;
}

function trimSilence(samples: Float32Array): Float32Array {
  const frame = 512;
  const thresh = 0.02;
  let start = 0;
  let end = samples.length;
  let found = false;
  for (let i = 0; i + frame <= samples.length; i += frame) {
    if (rms(samples.subarray(i, i + frame)) > thresh) {
      start = i;
      found = true;
      break;
    }
  }
  for (let i = samples.length - frame; i >= 0; i -= frame) {
    if (rms(samples.subarray(i, i + frame)) > thresh) {
      end = Math.min(samples.length, i + frame);
      break;
    }
  }
  if (!found) return samples;
  const pad = Math.floor(RATE * 0.04);
  start = Math.max(0, start - pad);
  end = Math.min(samples.length, end + pad);
  if (end - start < FRAME + HOP) return samples;
  return samples.slice(start, end);
}

export function buildTemplate(samples: Float32Array, sampleRate: number): CueTemplate | null {
  let pcm = resampleLinear(samples, sampleRate, RATE);
  pcm = trimSilence(pcm);
  if (pcm.length > RATE * MAX_SECONDS) {
    pcm = pcm.slice(0, Math.floor(RATE * MAX_SECONDS));
  }
  if (rms(pcm) < 0.008 || pcm.length < FRAME + HOP * (MIN_FRAMES - 1)) return null;

  const frames: Float32Array[] = [];
  const weightList: number[] = [];
  for (let offset = 0; offset + FRAME <= pcm.length; offset += HOP) {
    const shaped = unit(bandEnergies(pcm.subarray(offset, offset + FRAME), RATE));
    frames.push(shaped.vector);
    weightList.push(shaped.energy);
  }
  if (frames.length < MIN_FRAMES) return null;

  const weights = Float32Array.from(weightList);
  let weightSum = 0;
  for (let i = 0; i < weights.length; i++) weightSum += weights[i];
  if (weightSum <= 0) return null;

  return {
    frames,
    weights,
    pcm,
    durationSec: pcm.length / RATE,
  };
}

function cosine(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

export function scoreFrames(
  live: Float32Array[],
  template: CueTemplate,
): number {
  const n = template.frames.length;
  if (live.length < n) return 0;
  const offset = live.length - n;
  let acc = 0;
  let wsum = 0;
  for (let i = 0; i < n; i++) {
    const w = template.weights[i];
    if (w <= 0) continue;
    acc += w * cosine(live[offset + i], template.frames[i]);
    wsum += w;
  }
  return wsum > 0 ? acc / wsum : 0;
}

export class SlidingCueDetector {
  lastScore = 0;
  lastLevel = 0;
  private carry = new Float32Array(0);
  private frames: Float32Array[] = [];
  private levelSmooth = 0;
  private cooldownLeft = 0;

  constructor(
    private template: CueTemplate,
    private threshold: number,
    private cooldownSec: number,
  ) {}

  setTemplate(template: CueTemplate): void {
    this.template = template;
    this.reset();
  }

  setThreshold(threshold: number): void {
    this.threshold = threshold;
  }

  setCooldown(cooldownSec: number): void {
    this.cooldownSec = cooldownSec;
  }

  reset(): void {
    this.carry = new Float32Array(0);
    this.frames = [];
    this.cooldownLeft = 0;
    this.lastScore = 0;
  }

  push(chunk: Float32Array): MatchEvent | null {
    const data = new Float32Array(this.carry.length + chunk.length);
    data.set(this.carry, 0);
    data.set(chunk, this.carry.length);

    let offset = 0;
    let fired: MatchEvent | null = null;
    const needed = this.template.frames.length;

    while (offset + FRAME <= data.length) {
      const slice = data.subarray(offset, offset + FRAME);
      const shaped = unit(bandEnergies(slice, RATE));
      this.frames.push(shaped.vector);
      if (this.frames.length > needed) this.frames.shift();

      const level = rms(slice);
      this.levelSmooth = this.levelSmooth * 0.65 + level * 0.35;
      this.lastLevel = this.levelSmooth;

      offset += HOP;
      if (this.cooldownLeft > 0) {
        this.cooldownLeft -= HOP;
        continue;
      }

      if (this.frames.length < needed) continue;
      const score = scoreFrames(this.frames, this.template);
      this.lastScore = score;
      if (score >= this.threshold && this.levelSmooth >= 0.01) {
        fired = { score };
        this.cooldownLeft = Math.round(this.cooldownSec * RATE);
      }
    }

    const tail = data.length - offset;
    this.carry = tail > 0 ? data.slice(offset) : new Float32Array(0);
    return fired;
  }
}

/** Three rising notes. This is the built-in cue until a recording replaces it. */
export function synthesizeDemoCue(): Float32Array {
  const n = Math.floor(RATE * 0.8);
  const out = new Float32Array(n);
  const notes = [
    { freq: 523.25, start: 0.04, end: 0.3 },
    { freq: 659.25, start: 0.26, end: 0.52 },
    { freq: 783.99, start: 0.48, end: 0.76 },
  ];
  writeNotes(out, notes, 0.5);
  return out;
}

/** A low buzz that should not match the demo cue. */
export function synthesizeOtherSound(): Float32Array {
  const n = Math.floor(RATE * 0.8);
  const out = new Float32Array(n);
  writeNotes(out, [{ freq: 196, start: 0.04, end: 0.76 }], 0.5);
  return out;
}

function writeNotes(
  out: Float32Array,
  notes: { freq: number; start: number; end: number }[],
  amp: number,
): void {
  for (const note of notes) {
    const i0 = Math.floor(note.start * RATE);
    const i1 = Math.min(out.length, Math.floor(note.end * RATE));
    const len = Math.max(1, i1 - i0);
    for (let i = i0; i < i1; i++) {
      const p = (i - i0) / len;
      const env = Math.sin(Math.PI * p);
      const t = i / RATE;
      out[i] += Math.sin(2 * Math.PI * note.freq * t) * amp * env;
    }
  }
}

export function waveformPeaks(samples: Float32Array, bars = 48): number[] {
  if (samples.length === 0) return Array.from({ length: bars }, () => 0);
  const size = Math.max(1, Math.floor(samples.length / bars));
  const peaks: number[] = [];
  let max = 0.001;
  for (let b = 0; b < bars; b++) {
    const start = b * size;
    let peak = 0;
    const end = Math.min(samples.length, start + size);
    for (let i = start; i < end; i++) peak = Math.max(peak, Math.abs(samples[i]));
    peaks.push(peak);
    if (peak > max) max = peak;
  }
  return peaks.map((p) => p / max);
}

export function mixToMono(buffer: { numberOfChannels: number; length: number; getChannelData: (c: number) => Float32Array }): Float32Array {
  const out = new Float32Array(buffer.length);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const ch = buffer.getChannelData(c);
    for (let i = 0; i < buffer.length; i++) out[i] += ch[i];
  }
  const scale = 1 / Math.max(1, buffer.numberOfChannels);
  for (let i = 0; i < out.length; i++) out[i] *= scale;
  return out;
}
