import type { SongMeta } from './types';

export function parseSongIni(text: string): Partial<SongMeta> & Record<string, string> {
  const result: Record<string, string> = {};
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith(';') || line.startsWith('[') || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim().toLowerCase();
    const value = line.slice(eq + 1).trim();
    result[key] = value;
  }

  const meta: Partial<SongMeta> & Record<string, string> = { ...result };
  if (result.name) meta.name = result.name;
  if (result.artist) meta.artist = result.artist;
  if (result.album) meta.album = result.album;
  if (result.genre) meta.genre = result.genre;
  if (result.year) meta.year = result.year.replace(/^,\s*/, '');
  if (result.charter || result.frets) meta.charter = result.charter || result.frets;
  if (result.delay) {
    const delayMs = Number(result.delay);
    if (Number.isFinite(delayMs)) meta.offset = delayMs / 1000;
  }
  return meta;
}

export function mergeMeta(
  chartMeta: SongMeta,
  ini?: Partial<SongMeta> & Record<string, string>,
): SongMeta {
  if (!ini) return chartMeta;
  return {
    ...chartMeta,
    name: ini.name || chartMeta.name,
    artist: ini.artist || chartMeta.artist,
    album: ini.album || chartMeta.album,
    genre: ini.genre || chartMeta.genre,
    year: ini.year || chartMeta.year,
    charter: ini.charter || chartMeta.charter,
    offset: typeof ini.offset === 'number' ? ini.offset : chartMeta.offset,
  };
}
