import React from 'react';

interface YorhaEmblemProps {
  className?: string;
  size?: number;
  opacity?: number;
  glow?: boolean;
}

export const YorhaEmblem: React.FC<YorhaEmblemProps> = ({
  className = '',
  size = 48,
  opacity = 0.9,
  glow = false,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} ${glow ? 'drop-shadow-[0_0_8px_rgba(220,216,192,0.4)]' : ''}`}
      style={{ opacity }}
    >
      {/* Outer segmented ring */}
      <circle
        cx="50"
        cy="50"
        r="44"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="14 4 6 4"
        strokeOpacity="0.8"
      />
      <circle
        cx="50"
        cy="50"
        r="38"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="2 3"
        strokeOpacity="0.5"
      />
      
      {/* Outer Crosshair notches */}
      <line x1="50" y1="2" x2="50" y2="8" stroke="currentColor" strokeWidth="2" />
      <line x1="50" y1="92" x2="50" y2="98" stroke="currentColor" strokeWidth="2" />
      <line x1="2" y1="50" x2="8" y2="50" stroke="currentColor" strokeWidth="2" />
      <line x1="92" y1="50" x2="98" y2="50" stroke="currentColor" strokeWidth="2" />

      {/* YoRHa Angular Central Emblem */}
      {/* Central Diamond Core */}
      <polygon
        points="50,18 64,36 50,50 36,36"
        fill="currentColor"
        fillOpacity="0.15"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <polygon
        points="50,50 64,64 50,82 36,64"
        fill="currentColor"
        fillOpacity="0.15"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      {/* Inner geometric crossbars & wings */}
      <path
        d="M26 44 L50 30 L74 44 M26 56 L50 70 L74 56"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="square"
      />

      {/* Central eye / Black Box Core */}
      <circle cx="50" cy="50" r="5" fill="currentColor" fillOpacity="0.8" />
      <circle cx="50" cy="50" r="9" stroke="currentColor" strokeWidth="1" strokeDasharray="3 2" />

      {/* Side Chevron accents */}
      <polyline points="20,40 16,50 20,60" stroke="currentColor" strokeWidth="1.5" />
      <polyline points="80,40 84,50 80,60" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
};
