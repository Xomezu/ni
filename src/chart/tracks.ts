export const DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Expert'] as const;

export type Difficulty = (typeof DIFFICULTIES)[number];

export const INSTRUMENTS = [
  { code: 'Single', label: 'Lead Guitar', frets: 5 },
  { code: 'DoubleGuitar', label: 'Rhythm Guitar', frets: 5 },
  { code: 'DoubleBass', label: 'Bass', frets: 5 },
  { code: 'DoubleRhythm', label: 'Co-op Rhythm', frets: 5 },
  { code: 'Keyboard', label: 'Keys', frets: 5 },
  { code: 'Drums', label: 'Drums', frets: 5 },
  { code: 'GHLGuitar', label: 'GHL Guitar', frets: 6 },
  { code: 'GHLBass', label: 'GHL Bass', frets: 6 },
] as const;

export type InstrumentCode = (typeof INSTRUMENTS)[number]['code'];

export function sectionNameFor(difficulty: Difficulty, instrument: InstrumentCode): string {
  return `${difficulty}${instrument}`;
}

export function parseSectionName(section: string): { difficulty: Difficulty; instrument: InstrumentCode } | null {
  for (const diff of DIFFICULTIES) {
    if (!section.startsWith(diff)) continue;
    const code = section.slice(diff.length) as InstrumentCode;
    if (INSTRUMENTS.some((i) => i.code === code)) {
      return { difficulty: diff, instrument: code };
    }
  }
  return null;
}

export function instrumentLabel(code: string): string {
  return INSTRUMENTS.find((i) => i.code === code)?.label ?? code;
}

export const FRET_COLORS_5 = ['#22c55e', '#ef4444', '#eab308', '#3b82f6', '#f97316'] as const;
export const FRET_LABELS_5 = ['Green', 'Red', 'Yellow', 'Blue', 'Orange'] as const;
