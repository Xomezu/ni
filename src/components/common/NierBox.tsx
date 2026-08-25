import React from 'react';

interface NierBoxProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  tag?: string;
  className?: string;
  headerRight?: React.ReactNode;
  cutout?: boolean;
  highlight?: boolean;
  variant?: 'default' | 'solid' | 'framed' | 'minimal';
}

export const NierBox: React.FC<NierBoxProps> = ({
  children,
  title,
  subtitle,
  tag,
  className = '',
  headerRight,
  cutout = true,
  highlight = false,
  variant = 'default',
}) => {
  return (
    <div
      className={`relative transition-all duration-200 ${
        variant === 'solid'
          ? 'bg-[#161616]/95 text-[#BAB5A1] border border-[#BAB5A1]/30 shadow-lg'
          : variant === 'framed'
          ? 'bg-[#121212]/85 text-[#BAB5A1] border border-[#BAB5A1]/20 backdrop-blur-sm shadow-md'
          : variant === 'minimal'
          ? 'bg-transparent text-[#BAB5A1] border-l-2 border-[#BAB5A1]/50 pl-3'
          : 'bg-[#101010]/90 text-[#BAB5A1] border border-[#BAB5A1]/20 backdrop-blur-md shadow-md'
      } ${cutout ? 'nier-corner-tl-br' : ''} ${
        highlight ? 'ring-1 ring-[#E03C31] border-[#E03C31]/80' : ''
      } ${className}`}
    >
      {/* Top Header if title is present */}
      {(title || tag || headerRight) && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#BAB5A1]/15 bg-[#0c0c0c]/80 text-xs">
          <div className="flex items-center space-x-2">
            {tag && (
              <span className="px-1.5 py-0.2 text-[9px] font-tech font-bold bg-[#BAB5A1] text-[#0c0c0c] uppercase tracking-wider">
                {tag}
              </span>
            )}
            {title && (
              <span className="font-tech font-bold tracking-[0.2em] text-[#BAB5A1] uppercase text-xs">
                {title}
              </span>
            )}
            {subtitle && (
              <span className="font-tech text-[10px] text-[#BAB5A1]/50">
                // {subtitle}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {headerRight}
            {/* Signature 4-notch barcode indicator */}
            <div className="w-8 h-2 nier-barcode text-[#BAB5A1]/40" />
          </div>
        </div>
      )}

      {/* Box Contents */}
      <div className="p-3.5">{children}</div>

      {/* Decorative mini corner accents */}
      <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-[#BAB5A1]/40 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-[#BAB5A1]/40 pointer-events-none" />
    </div>
  );
};
