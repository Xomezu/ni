import React, { useState, useEffect } from 'react';
import { Bot, Shield, Zap, Radio, Activity } from 'lucide-react';
import { NierGlitchText } from './NierGlitchText';

interface PodDiagnosticsProps {
  podId?: string;
  serialNumber?: string;
  variant?: 'compact' | 'full' | 'floating';
  className?: string;
}

const POD_MESSAGES = [
  'REPORT: Black Box temperature is nominal. No critical anomalies detected.',
  'PROPOSAL: Stream transmission parameters are optimal. Maintain steady bandwidth.',
  'ALERT: Audience engagement metrics rising within predicted probability matrix.',
  'REPORT: Tactical radar scan complete. 0 hostile machine lifeforms detected.',
  'HYPOTHESIS: Chat reaction indicates heightened morale. Recommend acknowledging audience.',
  'SYSTEM: YoRHa Bunker encrypted uplink verified. Ping rate: 12ms.',
];

export const PodDiagnostics: React.FC<PodDiagnosticsProps> = ({
  podId = 'POD 042',
  serialNumber = 'YoRHa No.2 Type B',
  variant = 'full',
  className = '',
}) => {
  const [currentMsgIndex, setCurrentMsgIndex] = useState(0);
  const [podHealth] = useState(100);
  const [podLaserCharge, setPodLaserCharge] = useState(88);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMsgIndex((prev) => (prev + 1) % POD_MESSAGES.length);
      setPodLaserCharge(Math.floor(Math.random() * 20) + 80);
    }, 9000);
    return () => clearInterval(interval);
  }, []);

  if (variant === 'compact') {
    return (
      <div className={`flex items-center space-x-3 px-3 py-1.5 bg-[#121212]/90 border border-[#BAB5A1]/20 text-xs font-mono ${className}`}>
        <div className="flex items-center space-x-1.5 text-[#BAB5A1]">
          <Bot className="w-3.5 h-3.5 text-[#E03C31] animate-pulse" />
          <span className="font-bold tracking-wider">{podId}</span>
        </div>
        <div className="w-[1px] h-3 bg-[#BAB5A1]/30" />
        <div className="text-[11px] text-[#BAB5A1]/80 truncate max-w-[280px]">
          {POD_MESSAGES[currentMsgIndex]}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative bg-[#121212]/90 border border-[#BAB5A1]/25 p-4 text-[#BAB5A1] font-mono nier-corner-tl-br backdrop-blur-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#BAB5A1]/20 pb-2 mb-3">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-[#E03C31] animate-ping opacity-75" />
          <span className="font-bold text-xs tracking-widest uppercase text-[#BAB5A1]">
            {podId} // TACTICAL SUPPORT UNIT
          </span>
        </div>
        <span className="text-[10px] text-[#BAB5A1]/50 tracking-wider">
          OPERATOR: {serialNumber}
        </span>
      </div>

      {/* Main Body */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        {/* Left: Pod Wireframe / Reticle Graphic */}
        <div className="md:col-span-4 flex items-center justify-center p-2">
          <div className="relative w-24 h-24 flex items-center justify-center">
            {/* Outer rotating ring */}
            <div className="absolute inset-0 border border-[#BAB5A1]/30 rounded-full border-dashed animate-radar" />
            {/* Middle counter ring */}
            <div className="absolute inset-2 border border-[#BAB5A1]/20 rounded-full animate-spin [animation-duration:12s]" />
            {/* Central Pod Silhouette / Icon */}
            <div className="relative z-10 p-3 bg-[#181818] border border-[#BAB5A1]/40 rounded-full animate-float">
              <Bot className="w-7 h-7 text-[#BAB5A1]" />
            </div>
            {/* Target crosshairs */}
            <div className="absolute w-full h-[1px] bg-[#BAB5A1]/20" />
            <div className="absolute h-full w-[1px] bg-[#BAB5A1]/20" />
          </div>
        </div>

        {/* Right: Diagnostic Message & Stats */}
        <div className="md:col-span-8 space-y-2.5">
          {/* Message Box */}
          <div className="p-2.5 bg-[#0c0c0c] border border-[#BAB5A1]/20 text-xs leading-relaxed min-h-[54px] flex items-center">
            <span className="text-[#E03C31] mr-1.5 font-bold">{'>'}</span>
            <NierGlitchText
              key={currentMsgIndex}
              text={POD_MESSAGES[currentMsgIndex]}
              className="text-[#BAB5A1]/90 text-[11px]"
              decodeOnMount={true}
              intensity="subtle"
            />
          </div>

          {/* Gauges */}
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            {/* Integrity */}
            <div className="p-1.5 bg-[#161616] border border-[#BAB5A1]/20">
              <div className="flex items-center justify-between text-[#BAB5A1]/70 mb-1">
                <span className="flex items-center gap-1">
                  <Shield className="w-2.5 h-2.5 text-[#BAB5A1]" /> STATUS
                </span>
                <span className="text-[#BAB5A1] font-bold">100%</span>
              </div>
              <div className="w-full bg-[#222222] h-1.5 overflow-hidden">
                <div className="bg-[#BAB5A1] h-full" style={{ width: `${podHealth}%` }} />
              </div>
            </div>

            {/* Laser Charge */}
            <div className="p-1.5 bg-[#161616] border border-[#BAB5A1]/20">
              <div className="flex items-center justify-between text-[#BAB5A1]/70 mb-1">
                <span className="flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5 text-[#E03C31]" /> CHARGE
                </span>
                <span className="text-[#BAB5A1] font-bold">{podLaserCharge}%</span>
              </div>
              <div className="w-full bg-[#222222] h-1.5 overflow-hidden">
                <div className="bg-[#E03C31] h-full transition-all duration-500" style={{ width: `${podLaserCharge}%` }} />
              </div>
            </div>

            {/* Uplink */}
            <div className="p-1.5 bg-[#161616] border border-[#BAB5A1]/20">
              <div className="flex items-center justify-between text-[#BAB5A1]/70 mb-1">
                <span className="flex items-center gap-1">
                  <Radio className="w-2.5 h-2.5 text-[#BAB5A1]" /> UPLINK
                </span>
                <span className="text-[#BAB5A1] font-bold">ACTIVE</span>
              </div>
              <div className="w-full bg-[#222222] h-1.5 overflow-hidden">
                <div className="bg-[#BAB5A1] h-full animate-pulse" style={{ width: '95%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
