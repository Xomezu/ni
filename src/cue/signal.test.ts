import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FRAME,
  RATE,
  SlidingCueDetector,
  bandEnergies,
  buildTemplate,
  dominantBand,
  fft,
  resampleLinear,
  rms,
  synthesizeDemoCue,
  synthesizeOtherSound,
} from './signal.ts';

function tone(freq: number, seconds: number, amp = 0.5): Float32Array {
  const n = Math.floor(RATE * seconds);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = Math.sin((2 * Math.PI * freq * i) / RATE) * amp;
  }
  return out;
}

function noise(seconds: number, amp: number, seed = 1): Float32Array {
  let s = seed >>> 0;
  const n = Math.floor(RATE * seconds);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    out[i] = ((s / 4294967296) * 2 - 1) * amp;
  }
  return out;
}

function feedAll(det: SlidingCueDetector, pcm: Float32Array, chunk = 4096): number {
  let fires = 0;
  for (let i = 0; i < pcm.length; i += chunk) {
    const ev = det.push(pcm.subarray(i, Math.min(pcm.length, i + chunk)));
    if (ev) fires += 1;
  }
  return fires;
}

test('fft of an impulse is flat', () => {
  const real = new Float32Array(8);
  const imag = new Float32Array(8);
  real[0] = 1;
  fft(real, imag);
  for (let i = 0; i < 8; i++) {
    assert.ok(Math.abs(real[i] - 1) < 1e-6, `real[${i}]=${real[i]}`);
    assert.ok(Math.abs(imag[i]) < 1e-6, `imag[${i}]=${imag[i]}`);
  }
});

test('a 440 Hz tone lands in the expected band', () => {
  const frame = tone(440, FRAME / RATE).subarray(0, FRAME);
  const band = dominantBand(frame, RATE);
  assert.ok(band >= 7 && band <= 9, `band ${band}`);
  const bands = bandEnergies(frame, RATE);
  assert.ok(bands[band] > bands[0]);
});

test('the demo cue presses the button once', () => {
  const cue = synthesizeDemoCue();
  const template = buildTemplate(cue, RATE);
  assert.ok(template);
  const det = new SlidingCueDetector(template, 0.82, 1);
  const fires = feedAll(det, template.pcm);
  assert.equal(fires, 1, `fires=${fires} lastScore=${det.lastScore}`);
  assert.ok(det.lastScore >= 0.82);
});

test('the same cue in small chunks still presses once', () => {
  const template = buildTemplate(synthesizeDemoCue(), RATE);
  assert.ok(template);
  const det = new SlidingCueDetector(template, 0.82, 1);
  const fires = feedAll(det, template.pcm, 300);
  assert.equal(fires, 1);
});

test('a different sound does not press', () => {
  const template = buildTemplate(synthesizeDemoCue(), RATE);
  assert.ok(template);
  const det = new SlidingCueDetector(template, 0.82, 0.4);
  const fires = feedAll(det, synthesizeOtherSound());
  assert.equal(fires, 0, `lastScore=${det.lastScore.toFixed(3)}`);
  assert.ok(det.lastScore < 0.82);
});

test('noise does not press', () => {
  const template = buildTemplate(synthesizeDemoCue(), RATE);
  assert.ok(template);
  const det = new SlidingCueDetector(template, 0.82, 0.4);
  const fires = feedAll(det, noise(2, 0.2, 7));
  assert.equal(fires, 0, `lastScore=${det.lastScore.toFixed(3)}`);
});

test('two cues separated by a gap press twice', () => {
  const template = buildTemplate(synthesizeDemoCue(), RATE);
  assert.ok(template);
  const gap = new Float32Array(Math.floor(RATE * 1.2));
  const both = new Float32Array(template.pcm.length * 2 + gap.length);
  both.set(template.pcm, 0);
  both.set(gap, template.pcm.length);
  both.set(template.pcm, template.pcm.length + gap.length);
  const det = new SlidingCueDetector(template, 0.82, 0.5);
  assert.equal(feedAll(det, both), 2);
});

test('a quiet copy of the cue still matches and silence does not', () => {
  const template = buildTemplate(synthesizeDemoCue(), RATE);
  assert.ok(template);
  const quiet = template.pcm.map((s) => s * 0.2);
  const det = new SlidingCueDetector(template, 0.82, 1);
  assert.equal(feedAll(det, quiet), 1);

  det.reset();
  const silent = new Float32Array(RATE);
  assert.equal(feedAll(det, silent), 0);
  assert.ok(rms(silent) < 0.01);
});

test('resample keeps a tone in the same band', () => {
  const at44 = new Float32Array(Math.floor(44100 * 0.2));
  for (let i = 0; i < at44.length; i++) {
    at44[i] = Math.sin((2 * Math.PI * 440 * i) / 44100) * 0.5;
  }
  const at48 = resampleLinear(at44, 44100, RATE);
  const frame = at48.subarray(RATE * 0.05, RATE * 0.05 + FRAME);
  const band = dominantBand(frame, RATE);
  assert.ok(band >= 7 && band <= 9, `band ${band}`);
});

test('silence is not a cue', () => {
  assert.equal(buildTemplate(new Float32Array(RATE), RATE), null);
});
