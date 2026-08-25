import React, { useState, useEffect } from 'react';
import { StreamerConfig } from '../../types';
import { NierGlitchText } from '../common/NierGlitchText';
import { YorhaEmblem } from '../common/YorhaEmblem';
import { PodDiagnostics } from '../common/PodDiagnostics';
import { AudioVisualizer } from '../common/AudioVisualizer';
import { Music, Disc, BatteryCharging, Radio, Pause, Shield } from 'lucide-react';
import { SoundEngine } from '../../utils/audio';

interface BeRightBackSceneProps {
  config: StreamerConfig;
}

export const BeRightBackScene: React.FC<BeRightBackSceneProps> = ({ config }) => {
  const [rechargeProgress, setRechargeProgress] = useState(42);
  const [glitchTrigger, setGlitchTrigger] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setRechargeProgress((prev) => (prev >= 100 ? 15 : prev + 1));
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const triggerGlitchEffect = () => {
    setGlitchTrigger(true);
    if (config.soundEnabled) {
      SoundEngine.playGlitch(config.volume);
    }
    setTimeout(() => setGlitchTrigger(false), 200);
  };

  return (
    <div
      className={`relative w-full h-full min-h-screen flex flex-col justify-between p-6 md:p-12 text-[#BAB5A1] font-sans overflow-hidden ${
        glitchTrigger ? 'filter invert brightness-110' : ''
      }`}
    >
      {/* Top Header Bar */}
      <div className="flex justify-between items-start border-b border-[#BAB5A1]/20 pb-4 mb-6 z-10">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-[#121212] border border-[#BAB5A1]/30">
            <YorhaEmblem size={32} />
          </div>
          <div>
            <div className="text-[10px] uppercase font-mono tracking-[0.3em] opacity-60 flex items-center gap-1.5">
              <BatteryCharging className="w-3.5 h-3.5 text-[#E03C31] animate-pulse" />
              <span>RECHARGE CYCLE ACTIVE // OPERATIONAL SUSPENSION</span>
            </div>
            <div className="text-lg md:text-xl font-serif italic font-bold text-[#BAB5A1]">
              {config.streamerName} [{config.serialNumber}]
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="px-3 py-1.5 bg-[#121212] border border-[#BAB5A1]/30 text-xs font-mono font-bold text-[#BAB5A1] flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-[#E03C31] animate-ping" />
            <span>STANDBY MODE</span>
          </div>
        </div>
      </div>

      {/* Center Layout: Giant Be Right Back Title & Visual Core */}
      <div className="my-auto py-6 z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center max-w-6xl mx-auto w-full">
        {/* Left Col: Titles & Recharging Core */}
        <div className="lg:col-span-7 space-y-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 text-[10px] font-mono tracking-[0.3em] opacity-60 uppercase">
              <span className="w-6 h-[1px] bg-[#BAB5A1]" />
              <span>SYSTEM MEMORY SYNCHRONIZATION</span>
            </div>

            <h2 className="text-5xl sm:text-7xl md:text-8xl font-serif italic tracking-[-0.04em] text-[#BAB5A1] leading-none">
              <NierGlitchText
                text="BE RIGHT BACK"
                glitchFrequency={3500}
                intensity={config.glitchIntensity}
              />
            </h2>

            <p className="text-xs sm:text-sm text-[#BAB5A1]/70 max-w-lg leading-relaxed font-sans">
              Temporary suspension of stream broadcast for tactical recharge and data defragmentation. Hostile lifeform sensors remain active.
            </p>
          </div>

          {/* Recharge & Calibration Progress Gauge */}
          <div className="bg-[#121212]/90 border border-[#BAB5A1]/20 p-4 nier-corner-tl-br space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#BAB5A1] font-bold tracking-wider">
                CORE SYSTEM RECHARGE STATUS
              </span>
              <span className="text-[#BAB5A1] font-bold text-sm">{rechargeProgress}%</span>
            </div>

            <div className="w-full bg-[#1c1c1c] h-3 border border-[#BAB5A1]/25 overflow-hidden relative">
              <div
                className="h-full bg-gradient-to-r from-[#BAB5A1]/60 to-[#BAB5A1] transition-all duration-300"
                style={{ width: `${rechargeProgress}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-[#BAB5A1]/50 pt-1">
              <span>BATTERY PACK: LIQUID COOLED</span>
              <span>ESTIMATED RETURN: ~{config.brbEstimatedMinutes || 3} MIN</span>
            </div>
          </div>

          {/* Now Playing Music Module */}
          <div className="bg-[#121212]/90 border border-[#BAB5A1]/20 p-3.5 flex items-center space-x-4">
            <div className="p-3 bg-[#181818] border border-[#BAB5A1]/30 relative group">
              <Disc className="w-6 h-6 text-[#BAB5A1] animate-spin [animation-duration:8s]" />
            </div>

            <div className="flex-1 min-w-0 font-mono">
              <div className="flex items-center justify-between text-[10px] text-[#BAB5A1]/50 mb-0.5">
                <span className="flex items-center gap-1 font-bold text-[#BAB5A1]">
                  <Music className="w-3 h-3 text-[#E03C31]" /> AUDIO STREAM
                </span>
                <span className="text-[#BAB5A1]">TRANSMITTING</span>
              </div>
              <div className="text-sm font-bold text-[#BAB5A1] truncate font-serif italic">
                {config.nowPlaying.title || 'City Ruins (Rays of Light)'}
              </div>
              <div className="text-xs text-[#BAB5A1]/60 truncate font-sans">
                {config.nowPlaying.artist || 'Keiichi Okabe // NieR:Automata OST'}
              </div>
            </div>

            <AudioVisualizer barsCount={16} height={26} color="#BAB5A1" />
          </div>
        </div>

        {/* Right Col: Pod Tactical Support Box & Matrix */}
        <div className="lg:col-span-5 space-y-4">
          <PodDiagnostics
            podId={config.podDesignation}
            serialNumber={config.serialNumber}
            variant="full"
          />

          {/* Quick Glitch Test Button */}
          <div className="flex justify-end">
            <button
              onClick={triggerGlitchEffect}
              className="px-3 py-1.5 bg-[#161616] hover:bg-[#222222] border border-[#BAB5A1]/30 text-xs font-mono text-[#BAB5A1] flex items-center space-x-1.5 transition-colors"
            >
              <Shield className="w-3 h-3 text-[#E03C31]" />
              <span>TEST SIGNAL FLICKER</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Footer Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-4 z-10 pt-4 border-t border-[#BAB5A1]/20 text-xs font-mono text-[#BAB5A1]/60">
        <div className="flex items-center space-x-3">
          <Radio className="w-3.5 h-3.5 text-[#E03C31] animate-pulse" />
          <span>FREQUENCY 142.85 MHz // PLEASE STAND BY FOR RESUMPTION</span>
        </div>

        <div className="flex space-x-4">
          <span>TWITCH: <strong className="text-[#BAB5A1]">{config.socials.twitch}</strong></span>
          <span>X: <strong className="text-[#BAB5A1]">{config.socials.twitter}</strong></span>
        </div>
      </div>
    </div>
  );
};
