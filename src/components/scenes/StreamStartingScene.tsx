import React, { useState, useEffect } from 'react';
import { StreamerConfig } from '../../types';
import { NierGlitchText } from '../common/NierGlitchText';
import { YorhaEmblem } from '../common/YorhaEmblem';
import { PodDiagnostics } from '../common/PodDiagnostics';
import { Play, Pause, RotateCcw, ShieldAlert, Plus, Clock, Sparkles } from 'lucide-react';
import { SoundEngine } from '../../utils/audio';
import {
  CountdownState,
  getSavedCountdownState,
  calculateRemainingMs,
  resumeCountdown,
  pauseCountdown,
  resetCountdown,
  adjustCountdown,
  subscribeToCountdownUpdates,
  createBackgroundTicker,
} from '../../utils/timerSync';

interface StreamStartingSceneProps {
  config: StreamerConfig;
  onUpdateConfig?: (newConfig: Partial<StreamerConfig>) => void;
}

const BOOT_LOGS = [
  '[OK] Kernel modules loaded...',
  '[OK] Visual buffers initialized...',
  '[ERR] Emotions suppressed: FALSE',
  '[OK] Pod connectivity established...',
  '[OK] Black Box sync: 99.87%',
  '[OK] Bunker transmission locked',
];

export const StreamStartingScene: React.FC<StreamStartingSceneProps> = ({
  config,
}) => {
  const [countdownState, setCountdownState] = useState<CountdownState>(() =>
    getSavedCountdownState(config.startingCountdownSeconds || 300)
  );
  const [timeLeftMs, setTimeLeftMs] = useState<number>(() =>
    calculateRemainingMs(getSavedCountdownState(config.startingCountdownSeconds || 300))
  );
  const [glitchBurst, setGlitchBurst] = useState(false);
  const [utcTime, setUtcTime] = useState('');
  const [showCustomTime, setShowCustomTime] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('5');

  // Subscribe to real-time timer updates across other tabs/OBS captures
  useEffect(() => {
    const unsubscribe = subscribeToCountdownUpdates((updatedState) => {
      setCountdownState(updatedState);
      setTimeLeftMs(calculateRemainingMs(updatedState));
    });
    return unsubscribe;
  }, []);

  // Live UTC Clock
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      const h = String(d.getUTCHours()).padStart(2, '0');
      const m = String(d.getUTCMinutes()).padStart(2, '0');
      const s = String(d.getUTCSeconds()).padStart(2, '0');
      const ms = String(Math.floor(d.getUTCMilliseconds() / 10)).padStart(2, '0');
      setUtcTime(`${h}:${m}:${s}:${ms}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 40);
    return () => clearInterval(timer);
  }, []);

  // High-precision countdown based on real wall-clock timestamps with Web Worker ticker
  useEffect(() => {
    const updateTimer = () => {
      const remaining = calculateRemainingMs(countdownState);
      setTimeLeftMs(remaining);
    };

    updateTimer();
    const cleanupWorker = createBackgroundTicker(updateTimer, 40);

    const handleVisibilityOrFocus = () => {
      updateTimer();
    };

    window.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      cleanupWorker();
      window.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [countdownState]);

  const formatTime = (totalMs: number) => {
    const totalSeconds = Math.floor(totalMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const ms = Math.floor((totalMs % 1000) / 10);

    const pad = (n: number) => n.toString().padStart(2, '0');
    return {
      minutes: pad(minutes),
      seconds: pad(seconds),
      ms: pad(ms),
    };
  };

  const timeFormatted = formatTime(timeLeftMs);

  const handleManualGlitch = () => {
    setGlitchBurst(true);
    if (config.soundEnabled) {
      SoundEngine.playGlitch(config.volume);
    }
    setTimeout(() => setGlitchBurst(false), 250);
  };

  const handleTogglePlayPause = () => {
    if (countdownState.isRunning) {
      const newState = pauseCountdown(countdownState);
      setCountdownState(newState);
    } else {
      const newState = resumeCountdown(countdownState);
      setCountdownState(newState);
    }
    if (config.soundEnabled) {
      SoundEngine.playConfirm(config.volume);
    }
  };

  const handleResetTimer = (seconds: number) => {
    const newState = resetCountdown(seconds);
    setCountdownState(newState);
    if (config.soundEnabled) {
      SoundEngine.playConfirm(config.volume);
    }
  };

  const handleAddMinutes = (mins: number) => {
    const newState = adjustCountdown(mins * 60, countdownState);
    setCountdownState(newState);
    if (config.soundEnabled) {
      SoundEngine.playConfirm(config.volume);
    }
  };

  const handleApplyCustomTime = (e: React.FormEvent) => {
    e.preventDefault();
    const mins = parseFloat(customMinutes);
    if (!isNaN(mins) && mins > 0) {
      handleResetTimer(Math.round(mins * 60));
      setShowCustomTime(false);
    }
  };

  return (
    <div
      className={`relative w-full h-full min-h-screen flex flex-col justify-between p-6 md:p-12 text-[#BAB5A1] font-sans overflow-hidden ${
        glitchBurst ? 'filter invert brightness-125' : ''
      }`}
    >
      {/* Top Header Bar from Elegant Dark Theme */}
      <div className="flex justify-between items-start border-b border-[#BAB5A1]/20 pb-4 mb-6 z-10">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-[#121212] border border-[#BAB5A1]/30">
              <YorhaEmblem size={28} />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-[0.3em] opacity-50 font-mono">
                System Status
              </span>
              <span className="text-xs font-mono uppercase text-[#BAB5A1]">
                [ Initializing_Sequence ]
              </span>
            </div>
          </div>

          <div className="h-8 w-[1px] bg-[#BAB5A1]/30 hidden sm:block" />

          <div className="hidden sm:flex flex-col">
            <span className="text-[10px] uppercase tracking-[0.3em] opacity-50 font-mono">
              Model No.
            </span>
            <span className="text-xs font-mono text-[#BAB5A1]">
              {config.serialNumber || '2B_UNIT_09S'}
            </span>
          </div>

          <div className="h-8 w-[1px] bg-[#BAB5A1]/30 hidden md:block" />

          <div className="hidden md:flex flex-col">
            <span className="text-[10px] uppercase tracking-[0.3em] opacity-50 font-mono">
              Streamer
            </span>
            <span className="text-xs font-mono font-bold text-[#BAB5A1]">
              <NierGlitchText text={config.streamerName} intensity={config.glitchIntensity} />
            </span>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.3em] opacity-50 mb-1 font-mono">
            Global Time (UTC)
          </div>
          <div className="text-lg sm:text-xl font-mono tracking-tighter text-[#BAB5A1]">
            {utcTime || '12:44:03:92'}
          </div>
        </div>
      </div>

      {/* Centerpiece: Elegant Dark Display Typography & Countdown */}
      <div className="flex-grow flex flex-col justify-center items-center z-10 relative my-auto py-6">
        {/* Subtle decorative horizontal light bars */}
        <div className="absolute w-[500px] max-w-full h-[1px] bg-[#BAB5A1]/40 -top-4 mix-blend-screen pointer-events-none" />
        <div className="absolute w-[300px] max-w-full h-[2px] bg-[#E03C31]/60 -top-4 left-1/4 mix-blend-overlay blur-[1px] pointer-events-none" />

        {/* Display Typography */}
        <div className="text-center select-none">
          <h1 className="text-6xl sm:text-8xl md:text-[110px] font-serif italic tracking-[-0.05em] leading-none mb-1 relative inline-block text-[#BAB5A1]">
            <NierGlitchText text="STARTING" intensity={config.glitchIntensity} />
            <span className="absolute -right-12 top-2 sm:top-4 text-[10px] sm:text-xs font-mono tracking-normal not-italic opacity-60 bg-[#BAB5A1] text-[#0c0c0c] px-1 py-0.5 font-bold">
              v.1.04
            </span>
          </h1>

          <div className="flex items-baseline justify-center gap-4 sm:gap-8 mt-[-10px] sm:mt-[-20px] ml-8 sm:ml-24">
            <h1 className="text-6xl sm:text-8xl md:text-[110px] font-serif italic tracking-[-0.05em] leading-none text-[#BAB5A1]">
              <NierGlitchText text="SOON" intensity={config.glitchIntensity} />
            </h1>
            <div className="h-[2px] w-20 sm:w-32 bg-[#BAB5A1]/70 mb-4 sm:mb-8" />
          </div>
        </div>

        {/* Big Countdown Timer from Design */}
        <div className="flex flex-col items-center mt-6 sm:mt-10">
          <div className="flex items-baseline gap-1 font-mono text-5xl sm:text-7xl font-light tracking-tight text-[#BAB5A1]">
            <span>{timeFormatted.minutes}</span>
            <span className="text-[#E03C31] animate-pulse">:</span>
            <span>{timeFormatted.seconds}</span>
            <span className="text-lg sm:text-2xl font-mono text-[#BAB5A1]/60 self-end mb-1">
              .{timeFormatted.ms}
            </span>
          </div>
          {/* Est. Link Sync Label */}
          <div className="flex items-center gap-1.5 mt-2 text-[10px] font-mono tracking-[0.3em] uppercase opacity-70 text-[#BAB5A1]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E03C31] animate-pulse" />
            <span>EST. LINK SYNCHRONIZATION</span>
          </div>
        </div>
      </div>

      {/* Bottom 3-Column Grid from Elegant Dark Design */}
      <div className="mt-auto grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 border-t border-[#BAB5A1]/20 pt-6 z-10">
        {/* Column 1: System Logs */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-[#E03C31] animate-pulse rounded-full" />
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold font-mono text-[#BAB5A1]">
              System Logs
            </span>
          </div>
          <div className="font-mono text-[9px] leading-relaxed opacity-50 text-[#BAB5A1]">
            {BOOT_LOGS.map((log, i) => (
              <div key={i} className="truncate">
                {log}
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: Social Transmissions in Italic Serif */}
        <div className="flex flex-col items-center justify-center border-y sm:border-y-0 sm:border-x border-[#BAB5A1]/10 py-3 sm:py-0">
          <div className="flex gap-6 sm:gap-8">
            <div className="flex flex-col items-center">
              <span className="text-[10px] uppercase tracking-[0.3em] opacity-40 mb-1 font-mono">
                Twitter / X
              </span>
              <span className="text-xs italic font-serif text-[#BAB5A1]">
                @{config.socials.twitter || 'YoRHa_Stream'}
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[10px] uppercase tracking-[0.3em] opacity-40 mb-1 font-mono">
                YouTube
              </span>
              <span className="text-xs italic font-serif text-[#BAB5A1]">
                {config.socials.youtube || 'GloryToMankind'}
              </span>
            </div>
            {config.socials.twitch && (
              <div className="flex flex-col items-center">
                <span className="text-[10px] uppercase tracking-[0.3em] opacity-40 mb-1 font-mono">
                  Twitch
                </span>
                <span className="text-xs italic font-serif text-[#BAB5A1]">
                  {config.socials.twitch}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Column 3: Bunker Transmission Equalizer & Signal Strength */}
        <div className="flex flex-col text-right justify-end">
          <span className="text-[10px] uppercase tracking-[0.2em] opacity-50 mb-1 font-mono text-[#BAB5A1]">
            Bunker Transmission
          </span>
          <div className="flex items-end justify-end gap-1 h-7">
            <div className="w-[2px] bg-[#BAB5A1] h-2" />
            <div className="w-[2px] bg-[#BAB5A1] h-5 animate-pulse" />
            <div className="w-[2px] bg-[#BAB5A1] h-3" />
            <div className="w-[2px] bg-[#BAB5A1] h-6" />
            <div className="w-[2px] bg-[#BAB5A1] h-7" />
            <div className="w-[2px] bg-[#BAB5A1] h-4" />
            <div className="w-[2px] bg-[#E03C31] h-6 animate-pulse" />
            <div className="w-[2px] bg-[#BAB5A1] h-3" />
            <div className="w-[2px] bg-[#BAB5A1] h-5" />
            <div className="w-[2px] bg-[#BAB5A1] h-2" />
          </div>
          <span className="text-[9px] font-mono opacity-40 mt-1.5 text-[#BAB5A1]">
            ENCRYPTED_SIGNAL_STRENGTH: 99.87%
          </span>
        </div>
      </div>
    </div>
  );
};
