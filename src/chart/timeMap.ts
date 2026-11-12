import type { TempoEvent, TimeSigEvent } from './types';

/** Convert audio seconds → chart tick using tempo map + chart offset (seconds). */
export function secondsToTick(
  seconds: number,
  tempos: TempoEvent[],
  resolution: number,
  offsetSec = 0,
): number {
  const t = Math.max(0, seconds + offsetSec);
  if (tempos.length === 0) return t * resolution * (120 / 60);

  let remaining = t;
  let tick = 0;

  for (let i = 0; i < tempos.length; i++) {
    const bpm = tempos[i].bpm;
    const startTick = tempos[i].tick;
    const endTick = i + 1 < tempos.length ? tempos[i + 1].tick : Number.POSITIVE_INFINITY;
    const ticksInSegment = endTick - startTick;
    const secondsInSegment = (ticksInSegment / resolution) * (60 / bpm);

    if (remaining <= secondsInSegment || !Number.isFinite(secondsInSegment)) {
      tick = startTick + remaining * resolution * (bpm / 60);
      return Math.max(0, tick);
    }

    remaining -= secondsInSegment;
    tick = endTick;
  }

  const lastBpm = tempos[tempos.length - 1]?.bpm ?? 120;
  return tick + remaining * resolution * (lastBpm / 60);
}

/** Convert chart tick → audio seconds using tempo map + chart offset. */
export function tickToSeconds(
  tick: number,
  tempos: TempoEvent[],
  resolution: number,
  offsetSec = 0,
): number {
  if (tempos.length === 0) {
    return Math.max(0, (tick / resolution) * (60 / 120) - offsetSec);
  }

  let seconds = 0;
  let cursor = 0;

  for (let i = 0; i < tempos.length; i++) {
    const bpm = tempos[i].bpm;
    const start = tempos[i].tick;
    const end = i + 1 < tempos.length ? tempos[i + 1].tick : Math.max(tick, start);
    const segmentEnd = Math.min(tick, end);
    const from = Math.max(cursor, start);
    if (segmentEnd > from) {
      seconds += ((segmentEnd - from) / resolution) * (60 / bpm);
      cursor = segmentEnd;
    }
    if (cursor >= tick) break;
  }

  if (tick > cursor) {
    const bpm = tempos[tempos.length - 1]?.bpm ?? 120;
    seconds += ((tick - cursor) / resolution) * (60 / bpm);
  }

  return Math.max(0, seconds - offsetSec);
}

export function measureTickLength(timeSig: TimeSigEvent, resolution: number): number {
  // resolution = ticks per quarter note; measure length = numerator * (quarter notes per beat unit)
  // For x/4, beat is quarter → numerator * resolution
  // For x/8, beat is eighth → numerator * (resolution / 2)
  return timeSig.numerator * ((resolution * 4) / timeSig.denominator);
}

export function buildBeatLines(
  maxTick: number,
  timeSigs: TimeSigEvent[],
  resolution: number,
): { tick: number; isMeasure: boolean }[] {
  const lines: { tick: number; isMeasure: boolean }[] = [];
  if (maxTick <= 0) return lines;

  const sigs = timeSigs.length
    ? timeSigs
    : [{ tick: 0, numerator: 4, denominator: 4 }];

  for (let i = 0; i < sigs.length; i++) {
    const sig = sigs[i];
    const nextStart = i + 1 < sigs.length ? sigs[i + 1].tick : maxTick;
    const measureLen = measureTickLength(sig, resolution);
    const beatLen = measureLen / sig.numerator;
    let tick = sig.tick;
    let beatIndex = 0;
    while (tick < nextStart && tick <= maxTick) {
      lines.push({ tick, isMeasure: beatIndex % sig.numerator === 0 });
      tick += beatLen;
      beatIndex += 1;
    }
  }

  return lines;
}
