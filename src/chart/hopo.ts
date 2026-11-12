import type { ChartNote } from './types';

type NoteWithForce = ChartNote & { forced?: boolean };

/**
 * Clone Hero / .chart HOPO threshold is floor((65/192) * resolution).
 * Notes become HOPOs when within threshold of the previous note, unless
 * same-fret single or a chord. Forced flag flips natural state. Tap wins.
 */
export function applyHopo(notes: NoteWithForce[], resolution: number): ChartNote[] {
  const threshold = Math.floor((65 / 192) * resolution);
  const result: ChartNote[] = [];

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    if (note.isOpen) {
      const kind = note.kind === 'tap' ? 'tap' : note.forced ? 'hopo' : 'strum';
      const { forced: _f, ...clean } = note;
      result.push({ ...clean, kind });
      continue;
    }

    if (note.kind === 'tap') {
      const { forced: _f, ...clean } = note;
      result.push({ ...clean, kind: 'tap' });
      continue;
    }

    let naturalHopo = false;
    if (i > 0) {
      const prev = notes[i - 1];
      const delta = note.tick - prev.tick;
      if (delta > 0 && delta <= threshold) {
        const isChord = note.frets.length > 1;
        const sameSingle =
          !isChord &&
          !prev.isOpen &&
          prev.frets.length === 1 &&
          note.frets.length === 1 &&
          prev.frets[0] === note.frets[0];
        naturalHopo = !isChord && !sameSingle && !prev.isOpen;
      }
    }

    const forced = Boolean(note.forced);
    const isHopo = forced ? !naturalHopo : naturalHopo;
    const { forced: _f, ...clean } = note;
    result.push({ ...clean, kind: isHopo ? 'hopo' : 'strum' });
  }

  return result;
}
