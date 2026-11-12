import { applyHopo } from './hopo';
import { parseSectionName } from './tracks';
import type {
  ChartNote,
  FretColor,
  ParsedChart,
  SectionMarker,
  SongMeta,
  SpecialPhrase,
  TempoEvent,
  TimeSigEvent,
  InstrumentTrack,
} from './types';

interface RawNoteBucket {
  frets: Map<number, number>;
  forced: boolean;
  tap: boolean;
  open: boolean;
}

const DEFAULT_META: SongMeta = {
  name: 'Untitled',
  artist: 'Unknown Artist',
  album: '',
  genre: '',
  year: '',
  charter: '',
  resolution: 192,
  offset: 0,
};

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseSections(text: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const sectionRe = /\[([^\]]+)\]\s*\{([^}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = sectionRe.exec(text)) !== null) {
    const name = match[1].trim();
    const body = match[2]
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    map.set(name, body);
  }
  return map;
}

function parseSongMeta(lines: string[] | undefined): SongMeta {
  const meta = { ...DEFAULT_META };
  if (!lines) return meta;

  for (const line of lines) {
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const raw = stripQuotes(line.slice(eq + 1));
    switch (key) {
      case 'Name':
        meta.name = raw || meta.name;
        break;
      case 'Artist':
        meta.artist = raw || meta.artist;
        break;
      case 'Album':
        meta.album = raw;
        break;
      case 'Genre':
        meta.genre = raw;
        break;
      case 'Year':
        meta.year = raw.replace(/^,\s*/, '');
        break;
      case 'Charter':
        meta.charter = raw;
        break;
      case 'Resolution':
        meta.resolution = Number(raw) || 192;
        break;
      case 'Offset':
        meta.offset = Number(raw) || 0;
        break;
      case 'Difficulty':
        meta.difficulty = Number(raw);
        break;
      default:
        break;
    }
  }
  return meta;
}

function parseSync(lines: string[] | undefined): { tempos: TempoEvent[]; timeSigs: TimeSigEvent[] } {
  const tempos: TempoEvent[] = [];
  const timeSigs: TimeSigEvent[] = [];
  if (!lines) {
    return {
      tempos: [{ tick: 0, bpm: 120 }],
      timeSigs: [{ tick: 0, numerator: 4, denominator: 4 }],
    };
  }

  for (const line of lines) {
    const m = line.match(/^(\d+)\s*=\s*(\S+)\s*(.*)$/);
    if (!m) continue;
    const tick = Number(m[1]);
    const type = m[2];
    const rest = m[3].trim().split(/\s+/).filter(Boolean);

    if (type === 'B' && rest[0] !== undefined) {
      tempos.push({ tick, bpm: Number(rest[0]) / 1000 });
    } else if (type === 'TS' && rest[0] !== undefined) {
      const numerator = Number(rest[0]);
      const denomExp = rest[1] !== undefined ? Number(rest[1]) : 2;
      timeSigs.push({
        tick,
        numerator,
        denominator: 2 ** denomExp,
      });
    }
  }

  if (!tempos.some((t) => t.tick === 0)) tempos.unshift({ tick: 0, bpm: 120 });
  if (!timeSigs.some((t) => t.tick === 0)) timeSigs.unshift({ tick: 0, numerator: 4, denominator: 4 });
  tempos.sort((a, b) => a.tick - b.tick);
  timeSigs.sort((a, b) => a.tick - b.tick);
  return { tempos, timeSigs };
}

function parseEvents(lines: string[] | undefined): SectionMarker[] {
  const sections: SectionMarker[] = [];
  if (!lines) return sections;

  for (const line of lines) {
    const m = line.match(/^(\d+)\s*=\s*E\s+(.*)$/);
    if (!m) continue;
    const tick = Number(m[1]);
    let text = stripQuotes(m[2].trim());
    text = text.replace(/^\[|\]$/g, '');

    if (text.startsWith('section ')) {
      sections.push({ tick, name: text.slice('section '.length).trim() });
    } else if (text.startsWith('section_')) {
      sections.push({ tick, name: text.slice('section_'.length).trim() });
    } else if (text.startsWith('prc_')) {
      sections.push({ tick, name: text.slice('prc_'.length).trim() });
    }
  }
  return sections.sort((a, b) => a.tick - b.tick);
}

function buildNotesFromBuckets(
  buckets: Map<number, RawNoteBucket>,
  resolution: number,
): ChartNote[] {
  const ticks = [...buckets.keys()].sort((a, b) => a - b);
  const notes: ChartNote[] = [];

  for (const tick of ticks) {
    const bucket = buckets.get(tick)!;
    if (bucket.open) {
      const sustain = Math.max(0, ...bucket.frets.values(), 0);
      notes.push({
        tick,
        frets: [],
        sustain,
        kind: bucket.tap ? 'tap' : 'strum',
        isOpen: true,
      });
      continue;
    }

    if (bucket.frets.size === 0) continue;

    const frets = [...bucket.frets.keys()]
      .filter((f): f is FretColor => f >= 0 && f <= 4)
      .sort((a, b) => a - b);

    if (frets.length === 0) continue;

    const sustain = Math.max(...frets.map((f) => bucket.frets.get(f) ?? 0), 0);
    notes.push({
      tick,
      frets,
      sustain,
      kind: bucket.tap ? 'tap' : 'strum',
      isOpen: false,
      // forced flag carried via temporary property for hopo pass
      ...(bucket.forced ? { forced: true } : {}),
    } as ChartNote & { forced?: boolean });
  }

  return applyHopo(notes as Array<ChartNote & { forced?: boolean }>, resolution);
}

function parseInstrumentTrack(
  sectionName: string,
  lines: string[],
  resolution: number,
): InstrumentTrack | null {
  const parsed = parseSectionName(sectionName);
  if (!parsed) return null;

  const buckets = new Map<number, RawNoteBucket>();
  const phrases: SpecialPhrase[] = [];

  const ensure = (tick: number): RawNoteBucket => {
    let bucket = buckets.get(tick);
    if (!bucket) {
      bucket = { frets: new Map(), forced: false, tap: false, open: false };
      buckets.set(tick, bucket);
    }
    return bucket;
  };

  for (const line of lines) {
    const m = line.match(/^(\d+)\s*=\s*([NS])\s+(\d+)\s+(\d+)\s*$/);
    if (!m) continue;
    const tick = Number(m[1]);
    const type = m[2];
    const noteType = Number(m[3]);
    const length = Number(m[4]);

    if (type === 'S') {
      phrases.push({ tick, length, type: noteType });
      continue;
    }

    const bucket = ensure(tick);
    if (noteType >= 0 && noteType <= 4) {
      bucket.frets.set(noteType, length);
    } else if (noteType === 5) {
      bucket.forced = true;
    } else if (noteType === 6) {
      bucket.tap = true;
    } else if (noteType === 7) {
      bucket.open = true;
      if (length > 0) bucket.frets.set(7, length);
    }
  }

  const notes = buildNotesFromBuckets(buckets, resolution);
  const maxTick = Math.max(
    0,
    ...notes.map((n) => n.tick + n.sustain),
    ...phrases.map((p) => p.tick + p.length),
  );

  return {
    sectionName,
    instrument: parsed.instrument,
    difficulty: parsed.difficulty,
    notes,
    phrases: phrases.sort((a, b) => a.tick - b.tick),
    noteCount: notes.length,
    maxTick,
  };
}

export function parseChart(text: string, sourceName = 'notes.chart'): ParsedChart {
  const sections = parseSections(text);
  const meta = parseSongMeta(sections.get('Song'));
  const { tempos, timeSigs } = parseSync(sections.get('SyncTrack'));
  const sectionMarkers = parseEvents(sections.get('Events'));

  const tracks: InstrumentTrack[] = [];
  for (const [name, lines] of sections) {
    if (name === 'Song' || name === 'SyncTrack' || name === 'Events') continue;
    const track = parseInstrumentTrack(name, lines, meta.resolution);
    if (track) tracks.push(track);
  }

  tracks.sort((a, b) => {
    const diffOrder = ['Easy', 'Medium', 'Hard', 'Expert'];
    const di = diffOrder.indexOf(a.difficulty) - diffOrder.indexOf(b.difficulty);
    if (di !== 0) return di;
    return a.instrument.localeCompare(b.instrument);
  });

  return {
    meta,
    tempos,
    timeSigs,
    sections: sectionMarkers,
    tracks,
    sourceName,
  };
}

export function ticksToApproxSeconds(
  tick: number,
  tempos: TempoEvent[],
  resolution: number,
): number {
  if (tempos.length === 0) return (tick / resolution) * (60 / 120);

  let seconds = 0;
  let cursor = 0;
  let bpm = tempos[0].bpm;

  for (let i = 0; i < tempos.length; i++) {
    const start = tempos[i].tick;
    const end = i + 1 < tempos.length ? tempos[i + 1].tick : Math.max(tick, start);
    bpm = tempos[i].bpm;
    const segmentEnd = Math.min(tick, end);
    if (segmentEnd > cursor) {
      const from = Math.max(cursor, start);
      if (segmentEnd > from) {
        seconds += ((segmentEnd - from) / resolution) * (60 / bpm);
      }
      cursor = segmentEnd;
    }
    if (cursor >= tick) break;
  }

  if (tick > cursor) {
    seconds += ((tick - cursor) / resolution) * (60 / bpm);
  }

  return seconds;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
