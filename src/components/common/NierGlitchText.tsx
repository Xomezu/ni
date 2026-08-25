import React, { useState, useEffect } from 'react';

interface NierGlitchTextProps {
  text: string;
  className?: string;
  glitchFrequency?: number; // ms
  decodeOnMount?: boolean;
  intensity?: 'subtle' | 'moderate' | 'heavy' | 'off';
  as?: 'h1' | 'h2' | 'h3' | 'span' | 'div' | 'p';
}

const GLITCH_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_#%&/\\<>[]{}~=+-*';

export const NierGlitchText: React.FC<NierGlitchTextProps> = ({
  text,
  className = '',
  glitchFrequency = 4500,
  decodeOnMount = true,
  intensity = 'moderate',
  as: Component = 'span',
}) => {
  const [displayText, setDisplayText] = useState(text);
  const [isGlitching, setIsGlitching] = useState(false);

  useEffect(() => {
    if (intensity === 'off') {
      setDisplayText(text);
      return;
    }

    if (decodeOnMount) {
      let iteration = 0;
      const interval = setInterval(() => {
        setDisplayText(
          text
            .split('')
            .map((char, index) => {
              if (char === ' ') return ' ';
              if (index < iteration) {
                return text[index];
              }
              return GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
            })
            .join('')
        );

        if (iteration >= text.length) {
          clearInterval(interval);
          setDisplayText(text);
        }

        iteration += 1 / 2;
      }, 25);

      return () => clearInterval(interval);
    } else {
      setDisplayText(text);
    }
  }, [text, decodeOnMount, intensity]);

  // Periodic random glitch flicker
  useEffect(() => {
    if (intensity === 'off') return;

    const glitchTimer = setInterval(() => {
      const chance = intensity === 'heavy' ? 0.8 : intensity === 'moderate' ? 0.45 : 0.25;
      if (Math.random() < chance) {
        setIsGlitching(true);

        // Scramble 1-3 random characters briefly
        const chars = text.split('');
        const scrambleCount = Math.floor(Math.random() * (intensity === 'heavy' ? 4 : 2)) + 1;
        for (let i = 0; i < scrambleCount; i++) {
          const idx = Math.floor(Math.random() * chars.length);
          if (chars[idx] !== ' ') {
            chars[idx] = GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
          }
        }
        setDisplayText(chars.join(''));

        setTimeout(() => {
          setDisplayText(text);
          setIsGlitching(false);
        }, 120);
      }
    }, glitchFrequency);

    return () => clearInterval(glitchTimer);
  }, [text, glitchFrequency, intensity]);

  return (
    <Component
      className={`relative inline-block ${className} ${
        isGlitching ? 'text-[#c8a355] filter contrast-125' : ''
      }`}
    >
      {displayText}
      {isGlitching && intensity !== 'off' && (
        <>
          <span
            aria-hidden="true"
            className="absolute top-0 left-0 text-[#ff003c] opacity-70 translate-x-[-1.5px] translate-y-[1px] select-none pointer-events-none"
          >
            {displayText}
          </span>
          <span
            aria-hidden="true"
            className="absolute top-0 left-0 text-[#00f0ff] opacity-70 translate-x-[1.5px] translate-y-[-1px] select-none pointer-events-none"
          >
            {displayText}
          </span>
        </>
      )}
    </Component>
  );
};
