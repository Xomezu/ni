/**
 * Synthesizes a short backing track for the built-in demo chart.
 * Keeps the repo lightweight — no large audio assets needed.
 */
export async function createDemoAudioUrl(): Promise<{ url: string; revoke: () => void }> {
  const sampleRate = 44100;
  const durationSec = 32;
  const offline = new OfflineAudioContext(2, Math.floor(sampleRate * durationSec), sampleRate);

  const master = offline.createGain();
  master.gain.value = 0.85;
  master.connect(offline.destination);

  // Soft noise floor / room
  const noiseBuffer = offline.createBuffer(1, sampleRate * durationSec, sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = (Math.random() * 2 - 1) * 0.015;
  }
  const noise = offline.createBufferSource();
  noise.buffer = noiseBuffer;
  const noiseFilter = offline.createBiquadFilter();
  noiseFilter.type = 'lowpass';
  noiseFilter.frequency.value = 600;
  const noiseGain = offline.createGain();
  noiseGain.gain.value = 0.35;
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(master);
  noise.start(0);

  const scheduleKick = (t: number) => {
    const osc = offline.createOscillator();
    const gain = offline.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    gain.gain.setValueAtTime(0.9, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + 0.25);
  };

  const scheduleSnare = (t: number) => {
    const buffer = offline.createBuffer(1, Math.floor(sampleRate * 0.18), sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleRate * 0.04));
    }
    const src = offline.createBufferSource();
    src.buffer = buffer;
    const filter = offline.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1800;
    const gain = offline.createGain();
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
  };

  const scheduleHat = (t: number) => {
    const buffer = offline.createBuffer(1, Math.floor(sampleRate * 0.05), sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleRate * 0.01));
    }
    const src = offline.createBufferSource();
    src.buffer = buffer;
    const filter = offline.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    const gain = offline.createGain();
    gain.gain.value = 0.12;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
  };

  const scheduleBass = (t: number, freq: number, len = 0.35) => {
    const osc = offline.createOscillator();
    const gain = offline.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.28, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + len);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + len + 0.02);
  };

  const scheduleLead = (t: number, freq: number, len = 0.2) => {
    const osc = offline.createOscillator();
    const gain = offline.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    const filter = offline.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, t);
    filter.frequency.exponentialRampToValueAtTime(500, t + len);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + len);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + len + 0.02);
  };

  // Tempo map matching sample chart: 120 -> 140 @ 16s -> 120 @ 22.857s
  const bassNotes = [82.41, 82.41, 98.0, 110.0]; // E2 A2 A2 A2-ish cycle
  const leadScale = [164.81, 196.0, 220.0, 246.94, 293.66, 329.63];

  let t = 0;
  let beat = 0;
  while (t < durationSec - 0.3) {
    const bpm = t < 16 ? 120 : t < 22.857 ? 140 : 120;
    const beatLen = 60 / bpm;

    if (beat % 2 === 0) scheduleKick(t);
    if (beat % 2 === 1) scheduleSnare(t);
    scheduleHat(t);
    scheduleHat(t + beatLen * 0.5);

    if (beat % 4 === 0) {
      scheduleBass(t, bassNotes[(beat / 4) % bassNotes.length], beatLen * 1.6);
    }
    if (beat % 2 === 0) {
      const note = leadScale[(beat / 2) % leadScale.length];
      scheduleLead(t + beatLen * 0.5, note, beatLen * 0.45);
    }

    t += beatLen;
    beat += 1;
  }

  const rendered = await offline.startRendering();
  const wav = audioBufferToWav(rendered);
  const blob = new Blob([wav], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  return { url, revoke: () => URL.revokeObjectURL(url) };
}

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1;
  const bitDepth = 16;
  const samples = buffer.length;
  const blockAlign = (numChannels * bitDepth) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));

  let offset = 44;
  for (let i = 0; i < samples; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return arrayBuffer;
}
