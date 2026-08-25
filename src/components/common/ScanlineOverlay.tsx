import React, { useState, useEffect } from 'react';
import { GlitchIntensity } from '../../types';

interface ScanlineOverlayProps {
  enabled?: boolean;
  intensity?: GlitchIntensity;
  subtleNoise?: boolean;
}

export const ScanlineOverlay: React.FC<ScanlineOverlayProps> = ({
  enabled = true,
  intensity = 'moderate',
  subtleNoise = true,
}) => {
  const [flicker, setFlicker] = useState(false);
  const [glitchOffset, setGlitchOffset] = useState({ x: 0, y: 0, skew: 0 });

  useEffect(() => {
    if (!enabled || intensity === 'off') return;

    // Random CRT flash/flicker
    const flickerInterval = setInterval(() => {
      if (Math.random() < (intensity === 'heavy' ? 0.4 : 0.15)) {
        setFlicker(true);
        setTimeout(() => setFlicker(false), 60 + Math.random() * 80);
      }
    }, 2800);

    // Random brief glitch shift
    const shiftInterval = setInterval(() => {
      if (Math.random() < (intensity === 'heavy' ? 0.35 : 0.1)) {
        setGlitchOffset({
          x: (Math.random() - 0.5) * (intensity === 'heavy' ? 8 : 3),
          y: (Math.random() - 0.5) * (intensity === 'heavy' ? 4 : 2),
          skew: (Math.random() - 0.5) * 2,
        });
        setTimeout(() => {
          setGlitchOffset({ x: 0, y: 0, skew: 0 });
        }, 100);
      }
    }, 4000);

    return () => {
      clearInterval(flickerInterval);
      clearInterval(shiftInterval);
    };
  }, [enabled, intensity]);

  if (!enabled) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-50 overflow-hidden"
      style={{
        transform: `translate(${glitchOffset.x}px, ${glitchOffset.y}px) skewX(${glitchOffset.skew}deg)`,
      }}
    >
      {/* Scanline pattern */}
      <div className="absolute inset-0 crt-scanlines opacity-40 mix-blend-overlay" />

      {/* Screen Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_60%,rgba(0,0,0,0.6)_100%)]" />

      {/* CRT Corner borders */}
      <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-[#dcd8c0]/40" />
      <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-[#dcd8c0]/40" />
      <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-[#dcd8c0]/40" />
      <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-[#dcd8c0]/40" />

      {/* Random Screen Flash / Static flash */}
      {flicker && (
        <div className="absolute inset-0 bg-white/5 mix-blend-color-dodge backdrop-brightness-110 pointer-events-none" />
      )}

      {/* Micro-noise dots */}
      {subtleNoise && (
        <div className="absolute inset-0 nier-hex-dots opacity-25" />
      )}
    </div>
  );
};
