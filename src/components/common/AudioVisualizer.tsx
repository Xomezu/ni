import React, { useEffect, useState } from 'react';

interface AudioVisualizerProps {
  barsCount?: number;
  height?: number;
  color?: string;
  className?: string;
  active?: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  barsCount = 20,
  height = 24,
  color = '#dcd8c0',
  className = '',
  active = true,
}) => {
  const [levels, setLevels] = useState<number[]>(() =>
    Array.from({ length: barsCount }, () => Math.random() * 0.5 + 0.2)
  );

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      setLevels(
        Array.from({ length: barsCount }, (_, idx) => {
          // Bell curve distribution with random fluctuations
          const centerFactor = 1 - Math.abs(idx - barsCount / 2) / (barsCount / 2);
          const base = 0.15 + centerFactor * 0.5;
          const jitter = (Math.random() - 0.5) * 0.35;
          return Math.min(1, Math.max(0.08, base + jitter));
        })
      );
    }, 100);

    return () => clearInterval(interval);
  }, [active, barsCount]);

  return (
    <div className={`flex items-end space-x-[2px] ${className}`} style={{ height }}>
      {levels.map((level, i) => (
        <div
          key={i}
          className="w-[3px] transition-all duration-75 origin-bottom"
          style={{
            height: `${Math.round(level * height)}px`,
            backgroundColor: color,
            opacity: 0.3 + level * 0.7,
          }}
        />
      ))}
    </div>
  );
};
