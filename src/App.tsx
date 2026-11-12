import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createDemoAudioUrl } from './chart/demoAudio';
import { formatDuration, parseChart } from './chart/parseChart';
import { loadBundleFromFiles, type LoadedAudio } from './chart/loadBundle';
import { SAMPLE_CHART_TEXT, SAMPLE_INI } from './chart/sampleChart';
import { parseSongIni, mergeMeta } from './chart/parseSongIni';
import { secondsToTick, tickToSeconds } from './chart/timeMap';
import {
  DIFFICULTIES,
  INSTRUMENTS,
  instrumentLabel,
  type Difficulty,
  type InstrumentCode,
} from './chart/tracks';
import type { InstrumentTrack, SongBundle } from './chart/types';
import { DropZone } from './components/DropZone';
import { Highway } from './components/Highway';
import { Transport } from './components/Transport';

function pickDefaultTrack(tracks: InstrumentTrack[]): InstrumentTrack | null {
  if (tracks.length === 0) return null;
  return (
    tracks.find((t) => t.difficulty === 'Expert' && t.instrument === 'Single') ||
    tracks.find((t) => t.difficulty === 'Expert') ||
    tracks[tracks.length - 1]
  );
}

function buildDemoBundle(): SongBundle {
  const chart = parseChart(SAMPLE_CHART_TEXT, 'practice-lane.chart');
  const iniMeta = parseSongIni(SAMPLE_INI);
  return {
    chart: { ...chart, meta: mergeMeta(chart.meta, iniMeta) },
    iniMeta,
  };
}

export default function App() {
  const [bundle, setBundle] = useState<SongBundle>(() => buildDemoBundle());
  const [audio, setAudio] = useState<LoadedAudio | null>(null);
  const [demoReady, setDemoReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>('Expert');
  const [instrument, setInstrument] = useState<InstrumentCode>('Single');
  const [playing, setPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [zoom, setZoom] = useState(1);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCleanupRef = useRef<(() => void) | null>(null);
  const artCleanupRef = useRef<string | null>(null);
  const rafRef = useRef(0);

  const chart = bundle.chart;

  const available = useMemo(() => {
    const diffs = new Set(chart.tracks.map((t) => t.difficulty));
    const insts = new Set(chart.tracks.map((t) => t.instrument));
    return {
      difficulties: DIFFICULTIES.filter((d) => diffs.has(d)),
      instruments: INSTRUMENTS.filter((i) => insts.has(i.code)),
    };
  }, [chart.tracks]);

  const track = useMemo(() => {
    return (
      chart.tracks.find((t) => t.difficulty === difficulty && t.instrument === instrument) ||
      pickDefaultTrack(chart.tracks)
    );
  }, [chart.tracks, difficulty, instrument]);

  const maxTick = track?.maxTick ?? 0;
  const chartDuration = tickToSeconds(maxTick, chart.tempos, chart.meta.resolution, 0);
  const effectiveDuration = Math.max(durationSec, chartDuration);

  const currentTick = secondsToTick(
    currentSec,
    chart.tempos,
    chart.meta.resolution,
    chart.meta.offset,
  );

  const visibleTicks = Math.round((chart.meta.resolution * 8) / zoom);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const demo = await createDemoAudioUrl();
        if (cancelled) {
          demo.revoke();
          return;
        }
        setAudio({ url: demo.url, name: 'demo-bed.wav', revoke: demo.revoke });
        setDemoReady(true);
      } catch {
        setDemoReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !audio) {
      setDurationSec(0);
      return;
    }

    el.src = audio.url;
    el.volume = muted ? 0 : volume;
    el.playbackRate = speed;

    const onLoaded = () => setDurationSec(el.duration || 0);
    const onEnded = () => setPlaying(false);
    el.addEventListener('loadedmetadata', onLoaded);
    el.addEventListener('ended', onEnded);
    el.load();

    return () => {
      el.removeEventListener('loadedmetadata', onLoaded);
      el.removeEventListener('ended', onEnded);
      el.pause();
    };
  }, [audio]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = muted ? 0 : volume;
  }, [volume, muted]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.playbackRate = speed;
  }, [speed]);

  useEffect(() => {
    const tick = () => {
      const el = audioRef.current;
      if (el && !el.paused) {
        setCurrentSec(el.currentTime);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    const preferred = pickDefaultTrack(chart.tracks);
    if (!preferred) return;
    const hasCurrent = chart.tracks.some(
      (t) => t.difficulty === difficulty && t.instrument === instrument,
    );
    if (!hasCurrent) {
      setDifficulty(preferred.difficulty as Difficulty);
      setInstrument(preferred.instrument as InstrumentCode);
    }
  }, [chart, difficulty, instrument]);

  const cleanupMedia = useCallback(() => {
    audioCleanupRef.current?.();
    audioCleanupRef.current = null;
    if (artCleanupRef.current) {
      URL.revokeObjectURL(artCleanupRef.current);
      artCleanupRef.current = null;
    }
  }, []);

  const handleFiles = useCallback(
    async (files: File[]) => {
      setBusy(true);
      setError(null);
      try {
        const { bundle: next, audio: nextAudio } = await loadBundleFromFiles(files);
        cleanupMedia();
        if (next.albumArtUrl) artCleanupRef.current = next.albumArtUrl;
        if (nextAudio) audioCleanupRef.current = nextAudio.revoke;

        setBundle(next);
        setAudio(nextAudio);
        setPlaying(false);
        setCurrentSec(0);

        const preferred = pickDefaultTrack(next.chart.tracks);
        if (preferred) {
          setDifficulty(preferred.difficulty as Difficulty);
          setInstrument(preferred.instrument as InstrumentCode);
        }

        if (!nextAudio) {
          setError(
            'Chart loaded, but no audio file was found. Drop song.ogg (or stems) with the chart.',
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load chart.');
      } finally {
        setBusy(false);
      }
    },
    [cleanupMedia],
  );

  const loadDemo = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      cleanupMedia();
      setBundle(buildDemoBundle());
      const demo = await createDemoAudioUrl();
      audioCleanupRef.current = demo.revoke;
      setAudio({ url: demo.url, name: 'demo-bed.wav', revoke: demo.revoke });
      setPlaying(false);
      setCurrentSec(0);
      setDifficulty('Expert');
      setInstrument('Single');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo failed to load.');
    } finally {
      setBusy(false);
    }
  }, [cleanupMedia]);

  const togglePlay = useCallback(async () => {
    const el = audioRef.current;
    if (!el || !audio) return;
    if (el.paused) {
      try {
        await el.play();
        setPlaying(true);
      } catch {
        setError('Audio playback was blocked. Click play again after interacting with the page.');
      }
    } else {
      el.pause();
      setPlaying(false);
    }
  }, [audio]);

  const seek = useCallback((sec: number) => {
    const el = audioRef.current;
    const clamped = Math.max(0, sec);
    if (el) el.currentTime = clamped;
    setCurrentSec(clamped);
  }, []);

  const restart = useCallback(() => {
    seek(0);
  }, [seek]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        void togglePlay();
      } else if (e.key === 'ArrowRight') {
        seek(currentSec + (e.shiftKey ? 5 : 1));
      } else if (e.key === 'ArrowLeft') {
        seek(Math.max(0, currentSec - (e.shiftKey ? 5 : 1)));
      } else if (e.key === '[' || e.key === '-') {
        setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))));
      } else if (e.key === ']' || e.key === '=' || e.key === '+') {
        setZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, seek, currentSec]);

  const noteCount = track?.noteCount ?? 0;
  const bpmNow = useMemo(() => {
    let bpm = chart.tempos[0]?.bpm ?? 120;
    for (const t of chart.tempos) {
      if (t.tick <= currentTick) bpm = t.bpm;
      else break;
    }
    return bpm;
  }, [chart.tempos, currentTick]);

  return (
    <div className="app-shell relative min-h-screen text-[var(--ink)]">
      <div className="pointer-events-none absolute inset-0 app-atmosphere" aria-hidden />

      <audio ref={audioRef} preload="auto" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-4 pb-8 pt-6 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">
              Clone Hero chart peek
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-4xl leading-none tracking-tight sm:text-5xl">
              Lane Peek
            </h1>
            <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">
              See the highway and hear the track — no Clone Hero install required.
            </p>
          </div>
          <DropZone onFiles={handleFiles} busy={busy} compact />
        </header>

        {!demoReady && (
          <p className="mt-4 text-sm text-[var(--muted)]">Warming up demo audio…</p>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950">
            {error}
          </div>
        )}

        <div className="mt-6 grid flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="flex min-h-[560px] flex-col gap-3">
            <div className="highway-frame relative min-h-[480px] flex-1 overflow-hidden rounded-2xl border border-[var(--line)] shadow-[0_20px_60px_rgba(15,23,32,0.18)]">
              {track ? (
                <Highway
                  chart={chart}
                  track={track}
                  currentTick={currentTick}
                  visibleTicks={visibleTicks}
                  className="absolute inset-0"
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-[#121820] text-sm text-slate-300">
                  No notes for this difficulty / instrument.
                </div>
              )}
              <div className="pointer-events-none absolute left-4 top-4 rounded-md bg-black/45 px-2 py-1 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wider text-white/90 backdrop-blur">
                {difficulty} · {instrumentLabel(instrument)} · {Math.round(bpmNow)} BPM
              </div>
            </div>

            <Transport
              playing={playing}
              currentSec={currentSec}
              durationSec={effectiveDuration}
              volume={volume}
              muted={muted}
              audioLabel={audio?.name}
              onTogglePlay={() => void togglePlay()}
              onSeek={seek}
              onRestart={restart}
              onVolume={(v) => {
                setVolume(v);
                if (v > 0) setMuted(false);
              }}
              onToggleMute={() => setMuted((m) => !m)}
            />
          </section>

          <aside className="relative z-20 flex flex-col gap-4">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper)]/90 p-4 backdrop-blur">
              <div className="flex gap-3">
                {bundle.albumArtUrl ? (
                  <img
                    src={bundle.albumArtUrl}
                    alt=""
                    className="h-20 w-20 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-[var(--paper-2)] font-[family-name:var(--font-display)] text-2xl text-[var(--muted)]">
                    LP
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="truncate font-[family-name:var(--font-display)] text-xl leading-tight">
                    {chart.meta.name}
                  </h2>
                  <p className="truncate text-sm text-[var(--muted)]">{chart.meta.artist}</p>
                  {chart.meta.album && (
                    <p className="truncate text-xs text-[var(--muted)]">{chart.meta.album}</p>
                  )}
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                <div>
                  <dt className="text-[var(--muted)]">Charter</dt>
                  <dd>{chart.meta.charter || '—'}</dd>
                </div>
                <div>
                  <dt className="text-[var(--muted)]">Length</dt>
                  <dd className="font-[family-name:var(--font-mono)]">
                    {formatDuration(effectiveDuration)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--muted)]">Notes</dt>
                  <dd className="font-[family-name:var(--font-mono)]">{noteCount}</dd>
                </div>
                <div>
                  <dt className="text-[var(--muted)]">Source</dt>
                  <dd className="truncate">{chart.sourceName}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper)]/90 p-4 backdrop-blur">
              <label className="block text-xs uppercase tracking-wider text-[var(--muted)]">
                Difficulty
              </label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {available.difficulties.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    className={`rounded-md px-2.5 py-1 text-sm transition ${
                      difficulty === d
                        ? 'bg-[var(--ink)] text-[var(--paper)]'
                        : 'bg-[var(--paper-2)] text-[var(--ink)] hover:bg-[var(--line)]'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>

              <label className="mt-4 block text-xs uppercase tracking-wider text-[var(--muted)]">
                Instrument
              </label>
              <select
                value={instrument}
                onChange={(e) => setInstrument(e.target.value as InstrumentCode)}
                className="mt-2 w-full rounded-md border border-[var(--line)] bg-[var(--paper-2)] px-2 py-2 text-sm"
              >
                {available.instruments.map((i) => (
                  <option key={i.code} value={i.code}>
                    {i.label}
                  </option>
                ))}
              </select>

              <label className="mt-4 block text-xs uppercase tracking-wider text-[var(--muted)]">
                Highway zoom
              </label>
              <input
                type="range"
                min={0.5}
                max={3}
                step={0.25}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="mt-2 w-full"
              />

              <label className="mt-4 block text-xs uppercase tracking-wider text-[var(--muted)]">
                Playback speed
              </label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[0.5, 0.75, 1, 1.25].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setSpeed(rate)}
                    className={`rounded-md px-2.5 py-1 font-[family-name:var(--font-mono)] text-sm transition ${
                      speed === rate
                        ? 'bg-[var(--ink)] text-[var(--paper)]'
                        : 'bg-[var(--paper-2)] text-[var(--ink)] hover:bg-[var(--line)]'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper)]/90 p-4 text-sm text-[var(--muted)] backdrop-blur">
              <p className="font-[family-name:var(--font-display)] text-base text-[var(--ink)]">
                Sections
              </p>
              <ul className="mt-2 max-h-40 space-y-1 overflow-auto font-[family-name:var(--font-mono)] text-xs">
                {chart.sections.length === 0 && <li>—</li>}
                {chart.sections.map((s) => (
                  <li key={`${s.tick}-${s.name}`}>
                    <button
                      type="button"
                      className="text-left hover:text-[var(--ink)]"
                      onClick={() =>
                        seek(
                          tickToSeconds(
                            s.tick,
                            chart.tempos,
                            chart.meta.resolution,
                            chart.meta.offset,
                          ),
                        )
                      }
                    >
                      {s.name}
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => void loadDemo()}
                className="mt-4 w-full rounded-md border border-[var(--line)] px-3 py-2 text-[var(--ink)] transition hover:bg-[var(--paper-2)]"
              >
                Reload demo song
              </button>
              <p className="mt-3 text-[11px] leading-relaxed">
                Space play/pause · ←/→ seek · [ ] zoom
              </p>
            </div>

            {!audio && <DropZone onFiles={handleFiles} busy={busy} />}
          </aside>
        </div>
      </div>
    </div>
  );
}
