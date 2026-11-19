import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { CueSession } from './cue/session';
import { synthesizeDemoCue, synthesizeOtherSound, waveformPeaks } from './cue/signal';

const STORAGE_KEY = 'cue.button.v1';

type SavedCue = {
  label: string;
  threshold: number;
  cooldownSec: number;
  pcm?: string;
  sampleRate?: number;
  source?: 'demo' | 'recording' | 'file';
};

type LogLine = { id: number; at: string; text: string };

function loadSaved(): SavedCue | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedCue;
  } catch {
    return null;
  }
}

function persist(saved: SavedCue): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}

function encodePcm(samples: Float32Array): string {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, Math.round(clamped * 32767), true);
  }
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(bytes.length, i + step)));
  }
  return btoa(binary);
}

function decodePcm(encoded: string): Float32Array {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const view = new DataView(bytes.buffer);
  const samples = new Float32Array(Math.floor(bytes.length / 2));
  for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true) / 32767;
  return samples;
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

export default function CueApp() {
  const sessionRef = useRef<CueSession | null>(null);
  if (!sessionRef.current) sessionRef.current = new CueSession();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const scoreRef = useRef(0);
  const pressGen = useRef(0);
  const pressRef = useRef<(fromCue: boolean) => void>(() => {});
  const fileRef = useRef<HTMLInputElement>(null);
  const logId = useRef(0);

  const saved = useRef(loadSaved());
  const [label, setLabel] = useState(saved.current?.label || 'GO');
  const [threshold, setThreshold] = useState(saved.current?.threshold ?? 0.82);
  const [cooldownSec, setCooldownSec] = useState(saved.current?.cooldownSec ?? 1);
  const [source, setSource] = useState<'demo' | 'recording' | 'file'>(saved.current?.source || 'demo');
  const [peaks, setPeaks] = useState<number[]>(() => waveformPeaks(synthesizeDemoCue()));
  const [duration, setDuration] = useState(0.8);
  const [armed, setArmed] = useState(false);
  const [recording, setRecording] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(0);
  const [pressed, setPressed] = useState(false);
  const [count, setCount] = useState(0);
  const [error, setError] = useState('');
  const [log, setLog] = useState<LogLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const session = sessionRef.current!;
    session.threshold = threshold;
    session.cooldownSec = cooldownSec;

    let meterQueued = false;
    let latest = { score: 0, level: 0 };
    session.onMeter = (meter) => {
      latest = meter;
      scoreRef.current = meter.score;
      if (meterQueued) return;
      meterQueued = true;
      requestAnimationFrame(() => {
        meterQueued = false;
        setScore(latest.score);
        setLevel(latest.level);
      });
    };
    session.onPress = (matchScore) => {
      scoreRef.current = matchScore;
      setScore(matchScore);
      pressRef.current(true);
    };
    session.onMiss = () => {
      pushLogRef.current('Played a different sound. The button stayed up.');
    };

    let initial = synthesizeDemoCue();
    let initialRate = 48000;
    let initialSource: 'demo' | 'recording' | 'file' = 'demo';
    if (saved.current?.pcm && saved.current.sampleRate) {
      try {
        initial = decodePcm(saved.current.pcm);
        initialRate = saved.current.sampleRate;
        initialSource = saved.current.source || 'recording';
      } catch {
        initial = synthesizeDemoCue();
      }
    }
    const template = session.setCue(initial, initialRate);
    if (template) {
      setPeaks(waveformPeaks(template.pcm));
      setDuration(template.durationSec);
      setSource(initialSource);
      setReady(true);
    }

    return () => {
      session.onPress = null;
      session.onMeter = null;
      session.onMiss = null;
      session.dispose();
    };
    // Settings are pushed by their own handlers. The session is created once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const previous = loadSaved();
    persist({
      label,
      threshold,
      cooldownSec,
      pcm: previous?.pcm,
      sampleRate: previous?.sampleRate,
      source: previous?.source,
    });
  }, [label, threshold, cooldownSec]);

  const rememberCue = (pcm: Float32Array, sampleRate: number, nextSource: 'demo' | 'recording' | 'file') => {
    const next: SavedCue = {
      label,
      threshold,
      cooldownSec,
      source: nextSource,
    };
    if (nextSource !== 'demo') {
      next.pcm = encodePcm(pcm);
      next.sampleRate = sampleRate;
    }
    persist(next);
  };

  const applyCue = (samples: Float32Array, sampleRate: number, nextSource: 'demo' | 'recording' | 'file') => {
    const template = sessionRef.current!.setCue(samples, sampleRate);
    if (!template) {
      setError('That audio was too quiet to use as a cue.');
      setReady(false);
      return false;
    }
    setError('');
    setPeaks(waveformPeaks(template.pcm));
    setDuration(template.durationSec);
    setSource(nextSource);
    setReady(true);
    setScore(0);
    rememberCue(samples, sampleRate, nextSource);
    return true;
  };

  const pushLog = (text: string) => {
    logId.current += 1;
    const line = { id: logId.current, at: formatClock(new Date()), text };
    setLog((prev) => [line, ...prev].slice(0, 6));
  };
  const pushLogRef = useRef(pushLog);
  pushLogRef.current = pushLog;

  pressRef.current = (fromCue: boolean) => {
    const gen = ++pressGen.current;
    setCount((value) => value + 1);
    setPressed(true);
    setScore(scoreRef.current);
    const pct = Math.round(scoreRef.current * 100);
    pushLog(fromCue ? `Heard the cue (${pct}%). Button pressed.` : 'Button pressed by hand.');
    window.setTimeout(() => {
      if (pressGen.current === gen) setPressed(false);
    }, 2200);
  };

  const onButtonClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (!event.nativeEvent.isTrusted) return;
    pressRef.current(false);
  };

  const onPlayCue = () => {
    setError('');
    sessionRef.current?.playCue();
  };

  const onPlayOther = () => {
    setError('');
    sessionRef.current?.playOther(synthesizeOtherSound());
  };

  const onUseDemo = () => {
    applyCue(synthesizeDemoCue(), 48000, 'demo');
  };

  const onRecord = async () => {
    setError('');
    setRecording(0);
    try {
      const template = await sessionRef.current!.record(1.4, (ratio) => setRecording(ratio));
      if (!template) {
        setError('That recording was too quiet. Move closer and try again.');
        return;
      }
      setPeaks(waveformPeaks(template.pcm));
      setDuration(template.durationSec);
      setSource('recording');
      setReady(true);
      setScore(0);
      rememberCue(template.pcm, 48000, 'recording');
    } catch {
      setError('Microphone permission was blocked.');
    } finally {
      setRecording(null);
    }
  };

  const onArm = async () => {
    setError('');
    try {
      if (sessionRef.current!.armed) {
        sessionRef.current!.disarm();
        setArmed(false);
        setLevel(0);
        return;
      }
      await sessionRef.current!.arm();
      setArmed(true);
    } catch {
      setArmed(false);
      setError('Microphone permission was blocked.');
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    try {
      const template = await sessionRef.current!.loadFile(file);
      if (!template) {
        setError('That audio was too quiet to use as a cue.');
        setReady(false);
        return;
      }
      setPeaks(waveformPeaks(template.pcm));
      setDuration(template.durationSec);
      setSource('file');
      setReady(true);
      setScore(0);
      rememberCue(template.pcm, 48000, 'file');
    } catch {
      setError('Could not read that audio file.');
    }
  };

  const sourceLabel = source === 'demo' ? 'Demo chime' : source === 'recording' ? 'Recorded cue' : 'Loaded file';

  return (
    <div className="min-h-screen bg-[#1c1914] text-[#f6f0e4] antialiased">
      <div className="mx-auto grid min-h-screen w-full max-w-5xl items-center gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
        <section className="flex flex-col items-center gap-6">
          <div className="text-center">
            <p className="font-mono text-xs tracking-[0.35em] text-[#b3a790]">CUE</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Press on the sound</h1>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-[#b3a790]">
              Teach it a short sound. When that sound plays, this button is pressed.
            </p>
          </div>

          <button
            id="cue-target-button"
            ref={buttonRef}
            type="button"
            onClick={onButtonClick}
            data-pressed={pressed ? 'true' : 'false'}
            className="relative grid h-52 w-52 place-items-center rounded-full border text-[#1c1914] outline-none focus-visible:ring-2 focus-visible:ring-[#e39b2b] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1c1914]"
            style={{
              background: pressed ? '#e39b2b' : '#f4efe4',
              borderColor: pressed ? '#e39b2b' : '#d9d0c0',
              transform: pressed ? 'translateY(18px) scale(0.96)' : 'translateY(0)',
              boxShadow: pressed ? '0 0 0 8px rgba(227,155,43,0.45)' : '0 18px 0 #4a4338',
              transition: 'transform 80ms ease, box-shadow 80ms ease, background 80ms ease',
            }}
          >
            <span className="px-6 text-center font-serif text-4xl font-semibold tracking-wide">{label || 'GO'}</span>
          </button>

          <div className="text-center">
            <p id="press-count" className="font-mono text-3xl tabular-nums" aria-live="polite">
              {count}
            </p>
            <p className="mt-1 font-mono text-[11px] tracking-[0.2em] text-[#b3a790]">TIMES PRESSED</p>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="rounded-2xl border border-[#3f382c] bg-[#262219] p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-mono text-xs tracking-[0.22em] text-[#b3a790]">THE CUE</h2>
              <p className="font-mono text-xs text-[#b3a790]">
                {sourceLabel} · {duration.toFixed(1)}s
              </p>
            </div>
            <div className="mt-4 flex h-16 items-end gap-[3px]" aria-hidden="true">
              {peaks.map((peak, index) => (
                <span
                  key={index}
                  className="flex-1 rounded-sm bg-[#e39b2b]"
                  style={{ height: `${Math.max(8, peak * 100)}%`, opacity: 0.45 + peak * 0.55 }}
                />
              ))}
            </div>
            {recording !== null && (
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-[#3f382c]">
                <div className="h-full bg-[#d4572a]" style={{ width: `${recording * 100}%` }} />
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" id="play-cue" onClick={onPlayCue} disabled={!ready} className={primaryClass}>
                Play cue
              </button>
              <button type="button" id="record-cue" onClick={onRecord} disabled={recording !== null} className={ghostClass}>
                {recording !== null ? 'Recording…' : 'Record cue'}
              </button>
              <button type="button" id="use-demo" onClick={onUseDemo} className={ghostClass}>
                Use demo chime
              </button>
              <button type="button" id="load-file" onClick={() => fileRef.current?.click()} className={ghostClass}>
                Load file
              </button>
              <button type="button" id="play-other" onClick={onPlayOther} className={ghostClass}>
                Play other sound
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  void onFile(file);
                }}
              />
            </div>
            <label className="mt-4 block text-sm text-[#b3a790]">
              Button name
              <input
                value={label}
                onChange={(event) => setLabel(event.target.value.slice(0, 18))}
                className="mt-1 w-full rounded-lg border border-[#3f382c] bg-[#1c1914] px-3 py-2 text-[#f6f0e4] outline-none focus:border-[#e39b2b]"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-[#3f382c] bg-[#262219] p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-mono text-xs tracking-[0.22em] text-[#b3a790]">LISTEN</h2>
              <button
                type="button"
                id="arm-mic"
                onClick={() => void onArm()}
                aria-pressed={armed}
                className={armed ? primaryClass : ghostClass}
              >
                {armed ? 'Microphone on' : 'Arm microphone'}
              </button>
            </div>
            <Meter label="Match" value={score} marker={threshold} />
            <Meter label="Level" value={Math.min(1, level * 4)} />
            <label className="mt-4 block text-sm text-[#b3a790]">
              <span className="flex justify-between">
                Match needed
                <span id="threshold-readout" className="font-mono text-[#f6f0e4]">{Math.round(threshold * 100)}%</span>
              </span>
              <input
                id="threshold"
                type="range"
                min={0.6}
                max={0.95}
                step={0.01}
                value={threshold}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setThreshold(next);
                  sessionRef.current?.setThreshold(next);
                }}
                className="mt-2 w-full accent-[#e39b2b]"
              />
            </label>
            <label className="mt-3 block text-sm text-[#b3a790]">
              <span className="flex justify-between">
                Cooldown
                <span className="font-mono text-[#f6f0e4]">{cooldownSec.toFixed(1)}s</span>
              </span>
              <input
                id="cooldown"
                type="range"
                min={0.4}
                max={3}
                step={0.1}
                value={cooldownSec}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setCooldownSec(next);
                  sessionRef.current?.setCooldown(next);
                }}
                className="mt-2 w-full accent-[#e39b2b]"
              />
            </label>
            <p className="mt-3 text-sm leading-relaxed text-[#b3a790]">
              Arm the microphone to press the button when the cue is heard in the room. Play cue runs the sound here and presses as soon as it matches.
            </p>
          </div>

          {error && (
            <p id="cue-error" className="rounded-xl border border-[#d4572a] bg-[#3a2218] px-4 py-3 text-sm text-[#f6f0e4]">
              {error}
            </p>
          )}

          <ol id="press-log" className="space-y-1 font-mono text-xs text-[#b3a790]">
            {log.length === 0 && <li>Waiting for the cue.</li>}
            {log.map((line) => (
              <li key={line.id}>
                <span className="text-[#6f6758]">{line.at}</span> {line.text}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}

function Meter({ label, value, marker }: { label: string; value: number; marker?: number }) {
  const width = `${Math.max(0, Math.min(1, value)) * 100}%`;
  return (
    <div className="mt-4">
      <div className="mb-1 flex justify-between font-mono text-[11px] tracking-[0.16em] text-[#b3a790]">
        <span>{label.toUpperCase()}</span>
        <span id={label === 'Match' ? 'match-score' : undefined}>{Math.round(value * 100)}%</span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-[#1c1914]">
        <div className="h-full rounded-full bg-[#e39b2b]" style={{ width }} />
        {marker !== undefined && (
          <span
            className="absolute top-0 h-full w-px bg-[#f6f0e4]"
            style={{ left: `${marker * 100}%` }}
          />
        )}
      </div>
    </div>
  );
}

const primaryClass =
  'rounded-full bg-[#e39b2b] px-4 py-2 text-sm font-semibold text-[#1c1914] disabled:opacity-40';
const ghostClass =
  'rounded-full border border-[#3f382c] px-4 py-2 text-sm text-[#f6f0e4] disabled:opacity-40';
