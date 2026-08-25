import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { StreamAlert } from '../../types';
import { NierGlitchText } from './NierGlitchText';
import { YorhaEmblem } from './YorhaEmblem';
import { UserCheck, Sparkles, Gift, Heart, Radio } from 'lucide-react';
import { SoundEngine } from '../../utils/audio';

interface AlertBannerProps {
  currentAlert: StreamAlert | null;
  onDismiss?: () => void;
  soundEnabled?: boolean;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  currentAlert,
  onDismiss,
  soundEnabled = true,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (currentAlert) {
      setVisible(true);
      if (soundEnabled) {
        SoundEngine.playAlert(0.4);
      }
      const timer = setTimeout(() => {
        setVisible(false);
        if (onDismiss) onDismiss();
      }, 5500);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [currentAlert, soundEnabled, onDismiss]);

  if (!currentAlert || !visible) return null;

  const getAlertIcon = () => {
    switch (currentAlert.type) {
      case 'subscriber':
        return <Sparkles className="w-5 h-5 text-[#BAB5A1]" />;
      case 'donation':
        return <Gift className="w-5 h-5 text-[#E03C31]" />;
      case 'raid':
        return <Radio className="w-5 h-5 text-[#BAB5A1]" />;
      case 'cheer':
        return <Heart className="w-5 h-5 text-[#E03C31]" />;
      default:
        return <UserCheck className="w-5 h-5 text-[#BAB5A1]" />;
    }
  };

  const getAlertTitle = () => {
    switch (currentAlert.type) {
      case 'subscriber':
        return 'NEW ANDROID RECRUIT // SUBSCRIBER';
      case 'donation':
        return 'SUPPLY DROP RECEIVED // DONATION';
      case 'raid':
        return 'INCOMING SQUADRON // RAID';
      case 'cheer':
        return 'CORE RESONANCE // BITS CHEER';
      default:
        return 'NEW SATELLITE LINK // FOLLOWER';
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-8 left-1/2 -translate-x-1/2 z-50 pointer-events-auto"
      >
        <div className="relative bg-[#0c0c0c]/95 text-[#BAB5A1] border border-[#BAB5A1]/40 p-5 shadow-[0_0_30px_rgba(0,0,0,0.8)] min-w-[380px] max-w-[540px] nier-corner-all backdrop-blur-md">
          {/* Top Barcode Header */}
          <div className="flex items-center justify-between border-b border-[#BAB5A1]/20 pb-2 mb-3">
            <div className="flex items-center space-x-2">
              <span className="p-1 bg-[#181818] border border-[#BAB5A1]/30 text-[#BAB5A1] rounded-none">
                {getAlertIcon()}
              </span>
              <span className="font-mono text-xs font-bold tracking-widest text-[#BAB5A1]">
                {getAlertTitle()}
              </span>
            </div>
            <div className="w-12 h-3 nier-barcode text-[#BAB5A1]/50" />
          </div>

          {/* Alert Body */}
          <div className="flex items-center space-x-4">
            <div className="p-2 bg-[#161616] border border-[#BAB5A1]/30">
              <YorhaEmblem size={42} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-xl font-serif italic font-bold text-[#BAB5A1] tracking-wide truncate">
                <NierGlitchText text={currentAlert.username} intensity="moderate" />
              </div>

              {currentAlert.amount && (
                <div className="text-sm font-mono font-bold text-[#E03C31] mt-0.5">
                  {currentAlert.amount} {currentAlert.tier ? `// ${currentAlert.tier}` : ''}
                </div>
              )}

              {currentAlert.message && (
                <p className="text-xs font-mono text-[#BAB5A1]/80 mt-1 italic line-clamp-2 bg-[#121212] p-1.5 border-l-2 border-[#E03C31]">
                  &ldquo;{currentAlert.message}&rdquo;
                </p>
              )}
            </div>
          </div>

          {/* Bottom Diagnostics Bar */}
          <div className="mt-3 pt-2 border-t border-[#BAB5A1]/20 flex items-center justify-between text-[10px] font-mono text-[#BAB5A1]/50">
            <span>PACKET_CHECKSUM: 0x8F9A_OK</span>
            <span className="text-[#E03C31] animate-pulse">TRANSMISSION CONFIRMED</span>
          </div>

          {/* Corner Notch Accent */}
          <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[#BAB5A1]" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[#BAB5A1]" />
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
