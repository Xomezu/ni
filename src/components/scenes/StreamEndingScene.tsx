import React, { useState, useEffect } from 'react';
import { StreamerConfig } from '../../types';
import { NierGlitchText } from '../common/NierGlitchText';
import { YorhaEmblem } from '../common/YorhaEmblem';
import { Radio, Calendar, Heart, Shield, Award, Sparkles, Terminal } from 'lucide-react';
import { AudioVisualizer } from '../common/AudioVisualizer';

interface StreamEndingSceneProps {
  config: StreamerConfig;
}

const CREDITS_LIST = [
  { role: 'TOP RECON SATELLITE (DONOR)', names: ['A2_Rebel ($120.00)', 'Commander_White ($75.00)'] },
  { role: 'TIER 3 COMMANDERS (SUBS)', names: ['9S_Scanner', 'Pascal_Peacekeeper', 'Emil_Shop'] },
  { role: 'TACTICAL OPERATORS (MODS)', names: ['Operator_6O', 'Operator_21O', 'Resistance_Anemone'] },
  { role: 'SPECIAL THANKS', names: ['The Entire YorHa Squadron & Machine Lifeforms'] },
];

export const StreamEndingScene: React.FC<StreamEndingSceneProps> = ({ config }) => {
  const [activeQuoteIndex, setActiveQuoteIndex] = useState(0);

  const QUOTES = [
    '“Everything that lives is designed to end. We are perpetually trapped in a never-ending spiral of life and death.”',
    '“A future is not given to you. It is something you must take for yourself.”',
    '“Do not grieve for us. We were born into this battlefield, and here we found meaning.”',
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveQuoteIndex((prev) => (prev + 1) % QUOTES.length);
    }, 12000);
    return () => clearInterval(interval);
  }, [QUOTES.length]);

  return (
    <div className="relative w-full h-full min-h-screen flex flex-col justify-between p-6 md:p-12 text-[#BAB5A1] font-sans overflow-hidden">
      {/* Top Header */}
      <div className="flex justify-between items-start border-b border-[#BAB5A1]/20 pb-4 mb-6 z-10">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-[#121212] border border-[#BAB5A1]/30">
            <YorhaEmblem size={32} />
          </div>
          <div>
            <div className="text-[10px] uppercase font-mono tracking-[0.3em] opacity-60 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-[#E03C31]" />
              <span>MISSION ACCOMPLISHED // TRANSMISSION CONCLUDED</span>
            </div>
            <div className="text-lg md:text-xl font-serif italic font-bold text-[#BAB5A1]">
              {config.streamerName} [{config.serialNumber}]
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="px-3 py-1.5 bg-[#121212] border border-[#BAB5A1]/30 text-xs font-mono text-[#BAB5A1]/80 flex items-center space-x-2">
            <span>UPLINK DISSOLVING</span>
            <AudioVisualizer barsCount={8} height={14} color="#BAB5A1" />
          </div>
        </div>
      </div>

      {/* Center Layout: Thanks & Credits Section */}
      <div className="my-auto py-6 z-10 max-w-5xl mx-auto w-full grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
        {/* Left Col: Main Thanks & Philosophical Quote */}
        <div className="md:col-span-6 space-y-6">
          <div className="space-y-2">
            <div className="text-[10px] font-mono tracking-[0.3em] opacity-60 uppercase">
              BUNKER ARCHIVE SAVED
            </div>
            <h2 className="text-5xl sm:text-6xl md:text-7xl font-serif italic tracking-[-0.04em] text-[#BAB5A1] leading-none">
              <NierGlitchText
                text="STREAM ENDED"
                glitchFrequency={4000}
                intensity={config.glitchIntensity}
              />
            </h2>
            <div className="text-xs font-mono text-[#BAB5A1]/80 tracking-wider">
              THANK YOU FOR JOINING THE SQUADRON
            </div>
          </div>

          {/* Philosophical Quote Card */}
          <div className="p-4 bg-[#121212]/90 border-l-2 border-[#BAB5A1] border-t border-b border-r border-[#BAB5A1]/20 text-xs sm:text-sm italic leading-relaxed text-[#BAB5A1]/80 font-serif">
            <NierGlitchText
              key={activeQuoteIndex}
              text={QUOTES[activeQuoteIndex]}
              intensity="subtle"
              decodeOnMount
            />
            <div className="text-[9px] text-[#BAB5A1]/60 mt-2 font-mono not-italic uppercase font-bold tracking-[0.2em] text-right">
              — YoRHa Unit 2B // Record Entry
            </div>
          </div>

          {/* Next Stream Schedule */}
          <div className="p-3.5 bg-[#121212]/90 border border-[#BAB5A1]/20 nier-corner-tl-br">
            <div className="flex items-center space-x-2 text-[#BAB5A1] text-xs font-mono font-bold mb-2">
              <Calendar className="w-3.5 h-3.5 text-[#E03C31]" />
              <span className="tracking-wider">NEXT MISSION DEPLOYMENT</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2 bg-[#181818] border border-[#BAB5A1]/20">
                <div className="text-[9px] text-[#BAB5A1]/50 tracking-wider uppercase">NEXT BROADCAST</div>
                <div className="font-bold text-[#BAB5A1]">TOMORROW @ 7:00 PM EST</div>
              </div>
              <div className="p-2 bg-[#181818] border border-[#BAB5A1]/20">
                <div className="text-[9px] text-[#BAB5A1]/50 tracking-wider uppercase">TARGET TITLE</div>
                <div className="font-bold text-[#BAB5A1] truncate">{config.gameTitle}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Credits Scroll Panel */}
        <div className="md:col-span-6 bg-[#121212]/90 border border-[#BAB5A1]/25 p-5 nier-corner-tl-br shadow-xl">
          <div className="flex items-center justify-between border-b border-[#BAB5A1]/20 pb-2 mb-4">
            <div className="flex items-center space-x-2 text-xs font-mono font-bold text-[#BAB5A1]">
              <Sparkles className="w-3.5 h-3.5 text-[#E03C31]" />
              <span className="tracking-wider">HONOR ROLL // SPECIAL CONTRIBUTORS</span>
            </div>
            <div className="w-10 h-2 nier-barcode text-[#BAB5A1]/40" />
          </div>

          <div className="space-y-4 text-xs font-mono">
            {CREDITS_LIST.map((credit, idx) => (
              <div key={idx} className="border-b border-[#BAB5A1]/10 pb-3 last:border-0">
                <div className="text-[9px] text-[#BAB5A1]/60 font-bold uppercase tracking-[0.2em] mb-1">
                  {credit.role}
                </div>
                <div className="space-y-1">
                  {credit.names.map((name, nIdx) => (
                    <div key={nIdx} className="text-[#BAB5A1] flex items-center space-x-2">
                      <span className="text-[#E03C31]">◆</span>
                      <span className="font-bold">{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Glory to Mankind */}
          <div className="mt-4 pt-3 border-t border-[#BAB5A1]/20 text-center text-xs font-serif italic font-bold text-[#BAB5A1] tracking-widest">
            GLORY TO MANKIND // 人類に栄光あれ
          </div>
        </div>
      </div>

      {/* Bottom Footer Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-4 z-10 pt-4 border-t border-[#BAB5A1]/20 text-xs font-mono text-[#BAB5A1]/60">
        <div className="flex items-center space-x-2">
          <Radio className="w-3.5 h-3.5 text-[#E03C31]" />
          <span>JOIN THE BUNKER ON DISCORD & TWITTER TO STAY UPDATED</span>
        </div>

        <div className="flex space-x-4">
          <span>TWITCH: <strong className="text-[#BAB5A1]">{config.socials.twitch}</strong></span>
          <span>DISCORD: <strong className="text-[#BAB5A1]">{config.socials.discord}</strong></span>
        </div>
      </div>
    </div>
  );
};
