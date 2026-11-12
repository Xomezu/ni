export type FretColor = 0 | 1 | 2 | 3 | 4;

export type NoteKind = 'strum' | 'hopo' | 'tap' | 'open';

export interface ChartNote {
  tick: number;
  frets: FretColor[];
  sustain: number;
  kind: NoteKind;
  isOpen: boolean;
}

export interface SpecialPhrase {
  tick: number;
  length: number;
  type: number;
}

export interface TempoEvent {
  tick: number;
  bpm: number;
}

export interface TimeSigEvent {
  tick: number;
  numerator: number;
  denominator: number;
}

export interface SectionMarker {
  tick: number;
  name: string;
}

export interface SongMeta {
  name: string;
  artist: string;
  album: string;
  genre: string;
  year: string;
  charter: string;
  resolution: number;
  offset: number;
  difficulty?: number;
}

export interface InstrumentTrack {
  sectionName: string;
  instrument: string;
  difficulty: string;
  notes: ChartNote[];
  phrases: SpecialPhrase[];
  noteCount: number;
  maxTick: number;
}

export interface ParsedChart {
  meta: SongMeta;
  tempos: TempoEvent[];
  timeSigs: TimeSigEvent[];
  sections: SectionMarker[];
  tracks: InstrumentTrack[];
  sourceName: string;
}

export interface SongBundle {
  chart: ParsedChart;
  albumArtUrl?: string;
  iniMeta?: Partial<SongMeta> & Record<string, string>;
}
