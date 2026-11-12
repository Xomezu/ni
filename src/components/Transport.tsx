import { Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';

interface TransportProps {
  playing: boolean;
  currentSec: number;
  durationSec: number;
  volume: number;
  muted: boolean;
  audioLabel?: string;
  onTogglePlay: () => void;
  onSeek: (sec: number) => void;
  onRestart: () => void;
  onVolume: (v: number) => void;
  onToggleMute: () => void;
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function Transport({
  playing,
  currentSec,
  durationSec,
  volume,
  muted,
  audioLabel,
  onTogglePlay,
  onSeek,
  onRestart,
  onVolume,
  onToggleMute,
}: TransportProps) {
  const progress = durationSec > 0 ? Math.min(1, currentSec / durationSec) : 0;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--line)] bg-[var(--paper)]/90 p-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onRestart}
          className="rounded-md p-2 text-[var(--ink)] transition hover:bg-[var(--paper-2)]"
          aria-label="Restart"
        >
          <RotateCcw size={18} />
        </button>
        <button
          type="button"
          onClick={onTogglePlay}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--paper)] transition hover:bg-[var(--ink-soft)]"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
        </button>
        <div className="min-w-0 flex-1">
          <input
            type="range"
            min={0}
            max={Math.max(durationSec, 0.01)}
            step={0.01}
            value={Math.min(currentSec, durationSec || 0)}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="seek-range w-full"
            style={{ ['--progress' as string]: `${progress * 100}%` }}
            aria-label="Seek"
          />
          <div className="mt-1 flex items-center justify-between text-xs text-[var(--muted)]">
            <span className="font-[family-name:var(--font-mono)] tabular-nums">
              {formatTime(currentSec)}
            </span>
            <span className="truncate px-2">{audioLabel || 'No audio loaded'}</span>
            <span className="font-[family-name:var(--font-mono)] tabular-nums">
              {formatTime(durationSec)}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleMute}
          className="rounded-md p-2 text-[var(--ink)] transition hover:bg-[var(--paper-2)]"
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={muted ? 0 : volume}
          onChange={(e) => onVolume(Number(e.target.value))}
          className="vol-range w-20"
          aria-label="Volume"
        />
      </div>
    </div>
  );
}
