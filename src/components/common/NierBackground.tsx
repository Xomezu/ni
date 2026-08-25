import React, { useEffect, useRef } from 'react';
import { ThemeMode } from '../../types';
import { YorhaEmblem } from './YorhaEmblem';

interface NierBackgroundProps {
  theme?: ThemeMode;
  particles?: boolean;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  color: string;
  char?: string;
}

export const NierBackground: React.FC<NierBackgroundProps> = ({
  theme = 'parchment',
  particles = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Background colors per theme
  const getThemeBg = () => {
    switch (theme) {
      case 'parchment':
        return 'bg-[#0c0c0c]'; // Elegant Dark base
      case 'yorha-dark':
        return 'bg-[#080808]';
      case 'corrupted-red':
        return 'bg-[#140808]';
      case 'resistance-sand':
        return 'bg-[#181612]';
      default:
        return 'bg-[#0c0c0c]';
    }
  };

  const getAccentColor = () => {
    switch (theme) {
      case 'corrupted-red':
        return 'rgba(224, 60, 49, 0.2)';
      case 'resistance-sand':
        return 'rgba(200, 180, 140, 0.2)';
      default:
        return 'rgba(186, 181, 161, 0.2)';
    }
  };

  useEffect(() => {
    if (!particles) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Generate floating ash / digital motes
    const particleCount = 40;
    const particleList: Particle[] = [];
    const hexChars = ['0', '1', 'F', 'E', '4', 'A', '8', 'C', 'X', '+', '::', '§'];

    for (let i = 0; i < particleCount; i++) {
      const isChar = Math.random() > 0.85;
      particleList.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: isChar ? 10 : Math.random() * 2.2 + 0.6,
        speedX: (Math.random() - 0.5) * 0.3 + (Math.random() > 0.5 ? 0.15 : -0.15),
        speedY: -Math.random() * 0.5 - 0.15, // drifting upwards like ash
        opacity: Math.random() * 0.35 + 0.08,
        color:
          theme === 'corrupted-red'
            ? 'rgba(224, 60, 49, '
            : theme === 'resistance-sand'
            ? 'rgba(200, 180, 140, '
            : 'rgba(186, 181, 161, ',
        char: isChar ? hexChars[Math.floor(Math.random() * hexChars.length)] : undefined,
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      particleList.forEach((p) => {
        p.x += p.speedX;
        p.y += p.speedY;

        // Reset boundary
        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;

        if (p.char) {
          ctx.font = '9px "Share Tech Mono", monospace';
          ctx.fillStyle = `${p.color}${p.opacity * 0.6})`;
          ctx.fillText(p.char, p.x, p.y);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `${p.color}${p.opacity})`;
          ctx.fill();
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [particles, theme]);

  return (
    <div
      className={`fixed inset-0 pointer-events-none overflow-hidden ${getThemeBg()}`}
      style={{
        backgroundImage: 'radial-gradient(circle at 50% 50%, #1a1a1a 0%, #0c0c0c 100%)',
      }}
    >
      {/* Canvas for dynamic particles */}
      {particles && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none opacity-80"
        />
      )}

      {/* Repeating fine scanlines */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          background: 'repeating-linear-gradient(0deg, #fff, #fff 1px, transparent 1px, transparent 2px)',
          backgroundSize: '100% 2px',
        }}
      />

      {/* Angled geometric accent hairlines from Elegant Dark design */}
      <div className="absolute h-[1px] w-72 bg-[#BAB5A1] opacity-20 top-20 -left-20 rotate-45 pointer-events-none" />
      <div className="absolute h-[1px] w-96 bg-[#BAB5A1] opacity-10 bottom-32 -right-12 -rotate-12 pointer-events-none" />
      <div className="absolute h-[1px] w-48 bg-[#BAB5A1] opacity-15 top-1/3 right-10 pointer-events-none" />
      <div className="absolute h-[1px] w-64 bg-[#E03C31] opacity-10 bottom-1/4 left-16 pointer-events-none" />

      {/* Corner crosshairs and lines */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-1/4 left-10 w-36 h-[1px] bg-[#BAB5A1]" />
        <div className="absolute top-1/4 left-10 w-[1px] h-3 bg-[#BAB5A1]" />
        <div className="absolute bottom-1/4 right-10 w-36 h-[1px] bg-[#BAB5A1]" />
        <div className="absolute bottom-1/4 right-44 w-[1px] h-3 bg-[#BAB5A1]" />
      </div>

      {/* Grid Pattern overlay */}
      <div className="absolute inset-0 nier-grid-bg opacity-30 pointer-events-none" />

      {/* Center Large Watermark YoRHa Emblem */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-[0.035] transition-transform duration-1000">
        <YorhaEmblem size={700} />
      </div>

      {/* Tactical Radar / Target Reticle in top right corner */}
      <div className="absolute -top-24 -right-24 w-96 h-96 pointer-events-none opacity-10">
        <div className="w-full h-full border border-[#BAB5A1] rounded-full animate-radar flex items-center justify-center">
          <div className="w-3/4 h-3/4 border border-[#BAB5A1]/50 rounded-full border-dashed" />
          <div className="absolute w-full h-[1px] bg-gradient-to-r from-transparent via-[#BAB5A1] to-transparent" />
        </div>
      </div>

      {/* Hex matrix watermark sidebar */}
      <div className="absolute bottom-6 left-6 text-[9px] font-tech text-[#BAB5A1]/25 space-y-0.5 select-none leading-none">
        <div>SYS_IDENT: YORHA_OS_V1.04</div>
        <div>MEM_DUMP: 0x7FFF82A4_INIT</div>
        <div>POD_STATUS: LINKED_PASSIVE</div>
        <div>LOC_COORD: 35.6895° N, 139.6917° E</div>
        <div>SIGNAL_LOCK: 99.87% [STABLE]</div>
      </div>

      {/* Corner Decorative brackets */}
      <div
        className="absolute inset-4 pointer-events-none border border-transparent"
        style={{ borderColor: getAccentColor() }}
      />
    </div>
  );
};
