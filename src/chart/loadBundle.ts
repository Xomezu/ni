import { parseChart } from './parseChart';
import { mergeMeta, parseSongIni } from './parseSongIni';
import type { ParsedChart, SongBundle, SongMeta } from './types';

const CHART_EXTS = ['.chart'];
const AUDIO_EXTS = ['.ogg', '.mp3', '.opus', '.wav', '.m4a', '.flac'];
const ART_NAMES = ['album.png', 'album.jpg', 'album.jpeg', 'folder.png', 'folder.jpg', 'cover.png', 'cover.jpg'];

const AUDIO_PRIORITY = [
  'song',
  'guitar',
  'bass',
  'rhythm',
  'drums',
  'drums_1',
  'drums_2',
  'drums_3',
  'drums_4',
  'keys',
  'vocals',
  'crowd',
];

export interface LoadedAudio {
  url: string;
  name: string;
  revoke: () => void;
}

function basename(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || path;
}

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

function stemOf(name: string): string {
  const base = basename(name).toLowerCase();
  const i = base.lastIndexOf('.');
  return i >= 0 ? base.slice(0, i) : base;
}

function pickPreferredChart(files: File[]): File | null {
  const charts = files.filter((f) => CHART_EXTS.includes(extOf(f.name)));
  if (charts.length === 0) return null;

  const notes = charts.find((f) => stemOf(f.name) === 'notes');
  if (notes) return notes;

  const forced = charts.find((f) => /\[(y|f)\]|\((y|f)\)/i.test(f.name));
  if (forced) return forced;

  return charts[0];
}

function listAudio(files: File[]): File[] {
  return files.filter((f) => AUDIO_EXTS.includes(extOf(f.name)));
}

function pickSongMix(files: File[]): File | null {
  const audioFiles = listAudio(files);
  if (audioFiles.length === 0) return null;
  return audioFiles.find((f) => stemOf(f.name) === 'song') || null;
}

function pickStemFiles(files: File[]): File[] {
  const audioFiles = listAudio(files);
  const stems: File[] = [];
  for (const stem of AUDIO_PRIORITY) {
    if (stem === 'song') continue;
    const match = audioFiles.find((f) => stemOf(f.name) === stem);
    if (match) stems.push(match);
  }
  if (stems.length > 0) return stems;
  return audioFiles.filter((f) => stemOf(f.name) !== 'song');
}

function pickArt(files: File[]): File | null {
  return (
    files.find((f) => ART_NAMES.includes(basename(f.name).toLowerCase())) ||
    files.find((f) => /\.(png|jpe?g|webp)$/i.test(f.name) && /album|cover|folder/i.test(f.name)) ||
    null
  );
}

export async function loadBundleFromFiles(files: File[]): Promise<{
  bundle: SongBundle;
  audio: LoadedAudio | null;
}> {
  const list = [...files];
  const chartFile = pickPreferredChart(list);
  if (!chartFile) {
    throw new Error('Drop a .chart file (or a song folder that contains one).');
  }

  const chartText = await chartFile.text();
  let chart: ParsedChart = parseChart(chartText, basename(chartFile.name));

  const iniFile = list.find((f) => basename(f.name).toLowerCase() === 'song.ini');
  let iniMeta: (Partial<SongMeta> & Record<string, string>) | undefined;
  if (iniFile) {
    iniMeta = parseSongIni(await iniFile.text());
    chart = {
      ...chart,
      meta: mergeMeta(chart.meta, iniMeta),
    };
  }

  const artFile = pickArt(list);
  const albumArtUrl = artFile ? URL.createObjectURL(artFile) : undefined;

  let audio: LoadedAudio | null = null;
  const songFile = pickSongMix(list);
  if (songFile) {
    const url = URL.createObjectURL(songFile);
    audio = {
      url,
      name: basename(songFile.name),
      revoke: () => URL.revokeObjectURL(url),
    };
  } else {
    const stems = pickStemFiles(list);
    if (stems.length > 0) {
      const { mixAudioFiles } = await import('./mixStems');
      audio = await mixAudioFiles(stems);
    }
  }

  return {
    bundle: {
      chart,
      albumArtUrl,
      iniMeta,
    },
    audio,
  };
}

export async function collectDroppedFiles(dataTransfer: DataTransfer): Promise<File[]> {
  const items = [...(dataTransfer.items || [])];
  if (items.length === 0) return [...dataTransfer.files];

  const out: File[] = [];

  async function walkEntry(entry: FileSystemEntry): Promise<void> {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => {
        (entry as FileSystemFileEntry).file(resolve, reject);
      });
      out.push(file);
      return;
    }
    if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const readBatch = (): Promise<FileSystemEntry[]> =>
        new Promise((resolve, reject) => reader.readEntries(resolve, reject));
      let batch = await readBatch();
      while (batch.length > 0) {
        for (const child of batch) await walkEntry(child);
        batch = await readBatch();
      }
    }
  }

  const entries = items
    .map((item) => (item.webkitGetAsEntry ? item.webkitGetAsEntry() : null))
    .filter((e): e is FileSystemEntry => Boolean(e));

  if (entries.length === 0) return [...dataTransfer.files];

  for (const entry of entries) await walkEntry(entry);
  return out;
}
