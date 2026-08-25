import React, { useState, useEffect } from 'react';
import { StreamerConfig, ChatMessage } from '../../types';
import { NierGlitchText } from '../common/NierGlitchText';
import { YorhaEmblem } from '../common/YorhaEmblem';
import { AudioVisualizer } from '../common/AudioVisualizer';
import {
  Heart,
  Sparkles,
  Gift,
  MessageSquare,
  Send,
  Video,
  Activity,
  Radio,
  Tv,
} from 'lucide-react';
import { SoundEngine } from '../../utils/audio';

interface GameplaySceneProps {
  config: StreamerConfig;
  chatMessages: ChatMessage[];
  onSendMessage?: (msg: string) => void;
}

const SAMPLE_RECENT_EVENTS = {
  latestFollower: '9S_Scanner',
  latestSub: 'Commander_White (Tier 3)',
  latestDonation: 'A2_Rebel ($50.00)',
  latestCheer: 'Pascal_Village (1,000 Bits)',
};

export const GameplayScene: React.FC<GameplaySceneProps> = ({
  config,
  chatMessages,
  onSendMessage,
}) => {
  const [activeSocialIndex, setActiveSocialIndex] = useState(0);
  const [chatInput, setChatInput] = useState('');
  const [previewGameplayVideo, setPreviewGameplayVideo] = useState(true);

  const socialsList = [
    { label: 'TWITCH', value: config.socials.twitch },
    { label: 'X / TWITTER', value: config.socials.twitter },
    { label: 'YOUTUBE', value: config.socials.youtube },
    { label: 'DISCORD', value: config.socials.discord },
  ].filter((s) => Boolean(s.value));

  useEffect(() => {
    if (socialsList.length === 0) return;
    const interval = setInterval(() => {
      setActiveSocialIndex((prev) => (prev + 1) % socialsList.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [socialsList.length]);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    if (onSendMessage) {
      onSendMessage(chatInput.trim());
    }
    if (config.soundEnabled) {
      SoundEngine.playTick(config.volume);
    }
    setChatInput('');
  };

  const goalPercent = Math.min(
    100,
    Math.round((config.goal.current / config.goal.target) * 100)
  );

  return (
    <div className="relative w-full h-full min-h-screen flex flex-col justify-between p-3 md:p-5 text-[#BAB5A1] font-sans overflow-hidden">
      {/* Top HUD Bar: Recent Events & Goals */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center z-10">
        {/* Left: Streamer Name & Unit Badge */}
        <div className="md:col-span-3 flex items-center space-x-3 bg-[#121212]/90 border border-[#BAB5A1]/25 px-3 py-1.5 nier-corner-tl-br">
          <YorhaEmblem size={26} />
          <div className="truncate">
            <div className="text-xs font-serif italic font-bold text-[#BAB5A1] tracking-wider truncate">
              {config.streamerName}
            </div>
            <div className="text-[9px] font-mono text-[#BAB5A1]/60 tracking-wider truncate">
              UNIT: {config.serialNumber}
            </div>
          </div>
        </div>

        {/* Center: Event Tickers */}
        <div className="md:col-span-6 grid grid-cols-3 gap-2 text-xs">
          {/* Latest Follower */}
          <div className="bg-[#121212]/90 border border-[#BAB5A1]/20 px-2.5 py-1 flex items-center space-x-2">
            <Heart className="w-3.5 h-3.5 text-[#E03C31]" />
            <div className="truncate font-mono">
              <div className="text-[9px] text-[#BAB5A1]/50 uppercase tracking-[0.2em] leading-none">
                LATEST SATELLITE
              </div>
              <div className="text-[11px] font-bold text-[#BAB5A1] truncate">
                {SAMPLE_RECENT_EVENTS.latestFollower}
              </div>
            </div>
          </div>

          {/* Latest Sub */}
          <div className="bg-[#121212]/90 border border-[#BAB5A1]/20 px-2.5 py-1 flex items-center space-x-2">
            <Sparkles className="w-3.5 h-3.5 text-[#c8a355]" />
            <div className="truncate font-mono">
              <div className="text-[9px] text-[#BAB5A1]/50 uppercase tracking-[0.2em] leading-none">
                LATEST RECRUIT
              </div>
              <div className="text-[11px] font-bold text-[#BAB5A1] truncate">
                {SAMPLE_RECENT_EVENTS.latestSub}
              </div>
            </div>
          </div>

          {/* Latest Donation */}
          <div className="bg-[#121212]/90 border border-[#BAB5A1]/20 px-2.5 py-1 flex items-center space-x-2">
            <Gift className="w-3.5 h-3.5 text-[#E03C31]" />
            <div className="truncate font-mono">
              <div className="text-[9px] text-[#BAB5A1]/50 uppercase tracking-[0.2em] leading-none">
                SUPPLY DROP
              </div>
              <div className="text-[11px] font-bold text-[#BAB5A1] truncate">
                {SAMPLE_RECENT_EVENTS.latestDonation}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Sub Goal Progress Gauge */}
        <div className="md:col-span-3 bg-[#121212]/90 border border-[#BAB5A1]/25 px-3 py-1.5">
          <div className="flex justify-between items-center text-[10px] font-mono mb-1">
            <span className="text-[#BAB5A1] font-bold tracking-wider uppercase">
              {config.goal.title}: {config.goal.current} / {config.goal.target} {config.goal.unit}
            </span>
            <span className="text-[#BAB5A1] font-bold">{goalPercent}%</span>
          </div>
          <div className="w-full bg-[#1a1a1a] h-2 relative overflow-hidden border border-[#BAB5A1]/30">
            <div
              className="h-full bg-[#BAB5A1] transition-all duration-500"
              style={{ width: `${goalPercent}%` }}
            />
            {/* Hash marks over the bar */}
            <div className="absolute inset-0 flex justify-between px-1 pointer-events-none">
              <div className="w-[1px] h-full bg-[#0c0c0c]" />
              <div className="w-[1px] h-full bg-[#0c0c0c]" />
              <div className="w-[1px] h-full bg-[#0c0c0c]" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Mid Section: Gameplay Frame (16:9) + Cam & Chat Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 my-2 flex-1 items-stretch z-10 min-h-[460px]">
        {/* Left: 16:9 In-Game Capture Window with YoRHa HUD Frame */}
        <div className="lg:col-span-9 relative flex flex-col bg-[#101010]/80 border-2 border-[#BAB5A1]/25 nier-corner-tl-br p-1 shadow-2xl">
          {/* Top Frame Telemetry */}
          <div className="flex items-center justify-between px-3 py-1 bg-[#0c0c0c] border-b border-[#BAB5A1]/20 text-[10px] font-mono text-[#BAB5A1]/70">
            <div className="flex items-center space-x-3">
              <span className="flex items-center gap-1 font-bold text-[#BAB5A1]">
                <Activity className="w-3 h-3 text-[#E03C31]" /> GAMEPLAY FEED: 1080p60
              </span>
              <span>BITRATE: 6,450 KBPS</span>
              <span>BLACK BOX SIGNAL: 100%</span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPreviewGameplayVideo(!previewGameplayVideo)}
                className="px-1.5 py-0.5 bg-[#161616] hover:bg-[#222222] border border-[#BAB5A1]/30 text-[9px] text-[#BAB5A1] flex items-center space-x-1"
                title="Toggle mockup canvas background vs clear screen for OBS window capture"
              >
                <Tv className="w-2.5 h-2.5" />
                <span>{previewGameplayVideo ? 'PREVIEW MODE' : 'OBS TRANSPARENT'}</span>
              </button>
            </div>
          </div>

          {/* Gameplay Content Area */}
          <div className="relative flex-1 w-full bg-[#080808] flex items-center justify-center overflow-hidden">
            {previewGameplayVideo ? (
              <div className="relative w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-[#161616] via-[#0c0c0c] to-[#121212]">
                {/* Simulated Game Graphic */}
                <div className="relative p-6 border border-[#BAB5A1]/20 bg-[#101010]/90 max-w-md w-full text-left font-mono">
                  <div className="flex items-center justify-between border-b border-[#BAB5A1]/20 pb-2 mb-3">
                    <span className="text-xs font-bold text-[#BAB5A1] tracking-wider">
                      // MAIN BROADCAST CANVAS
                    </span>
                    <span className="text-[10px] text-[#E03C31] animate-pulse">
                      ● LIVE INGESTION
                    </span>
                  </div>
                  <div className="text-sm font-serif italic text-[#BAB5A1] mb-1 font-bold">
                    NieR:Automata // Route C
                  </div>
                  <div className="text-xs text-[#BAB5A1]/70 leading-relaxed mb-4 font-sans">
                    Position your Game Capture / Window Capture source directly inside this 16:9 boundary in OBS Studio, or overlay this suite on top of your stream.
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-[#BAB5A1]/80">
                    <div className="p-1.5 bg-[#161616] border border-[#BAB5A1]/20">
                      HP: <strong className="text-[#BAB5A1]">4,820 / 4,820</strong>
                    </div>
                    <div className="p-1.5 bg-[#161616] border border-[#BAB5A1]/20">
                      EXP: <strong className="text-[#BAB5A1]">Lv. 60 [MAX]</strong>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-[#BAB5A1]/40 font-mono text-center p-4">
                [OBS TRANSPARENT CAPTURE REGION]
              </div>
            )}

            {/* In-Game Corner HUD Crosshairs */}
            <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-[#BAB5A1]/40 pointer-events-none" />
            <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-[#BAB5A1]/40 pointer-events-none" />
            <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-[#BAB5A1]/40 pointer-events-none" />
            <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-[#BAB5A1]/40 pointer-events-none" />
          </div>

          {/* Bottom HUD Bar on Game Frame */}
          <div className="flex items-center justify-between px-3 py-1 bg-[#0c0c0c] border-t border-[#BAB5A1]/20 text-[10px] font-mono">
            <div className="flex items-center space-x-2 text-[#BAB5A1]/60">
              <span>POD {config.podDesignation} LINK: STABLE</span>
              <span>//</span>
              <span>TACTICAL RADAR: ACTIVE</span>
            </div>
            <div className="text-[#BAB5A1] font-bold">
              MISSION: {config.gameTitle}
            </div>
          </div>
        </div>

        {/* Right Sidebar: Camera Frame + Live Chat Log */}
        <div className="lg:col-span-3 flex flex-col space-y-3">
          {/* Webcam Box */}
          <div className="relative bg-[#121212]/95 border-2 border-[#BAB5A1]/25 nier-corner-tl-br p-1 flex flex-col">
            {/* Cam Header */}
            <div className="flex items-center justify-between px-2 py-1 bg-[#1a1a1a] border-b border-[#BAB5A1]/20 text-[10px] font-mono">
              <div className="flex items-center space-x-1.5 text-[#BAB5A1] font-bold">
                <Video className="w-3 h-3 text-[#E03C31]" />
                <span>CAMERA FEED // {config.streamerName}</span>
              </div>
              <AudioVisualizer barsCount={10} height={12} color="#BAB5A1" />
            </div>

            {/* Cam Viewport Area */}
            <div className="relative aspect-video bg-[#080808] flex items-center justify-center overflow-hidden border border-[#BAB5A1]/20">
              {/* Simulated Camera Content / Placeholder */}
              <div className="text-center p-3">
                <div className="w-12 h-12 mx-auto mb-2 border border-[#BAB5A1]/30 rounded-full flex items-center justify-center bg-[#161616]">
                  <YorhaEmblem size={28} />
                </div>
                <div className="text-xs font-serif italic font-bold text-[#BAB5A1]">WEBCAM CAPTURE</div>
                <div className="text-[10px] font-mono text-[#BAB5A1]/50">16:9 Facecam Frame</div>
              </div>

              {/* Tactical Camera Corner Marks */}
              <div className="absolute top-1 left-1 w-3 h-3 border-t border-l border-[#BAB5A1]/60" />
              <div className="absolute top-1 right-1 w-3 h-3 border-t border-r border-[#BAB5A1]/60" />
              <div className="absolute bottom-1 left-1 w-3 h-3 border-b border-l border-[#BAB5A1]/60" />
              <div className="absolute bottom-1 right-1 w-3 h-3 border-b border-r border-[#BAB5A1]/60" />
            </div>
          </div>

          {/* YoRHa Live Chat Widget */}
          <div className="flex-1 flex flex-col bg-[#121212]/90 border border-[#BAB5A1]/25 nier-corner-tl-br min-h-[260px] overflow-hidden">
            {/* Chat Header */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#181818] border-b border-[#BAB5A1]/20 text-xs">
              <div className="flex items-center space-x-2 text-[#BAB5A1] font-bold font-mono">
                <MessageSquare className="w-3.5 h-3.5 text-[#E03C31]" />
                <span className="tracking-wider">TRANSMISSION LOG</span>
              </div>
              <span className="text-[10px] text-[#BAB5A1] font-mono font-bold">● LIVE</span>
            </div>

            {/* Message List */}
            <div className="flex-1 p-2.5 overflow-y-auto space-y-2 text-xs font-mono">
              {chatMessages.map((msg) => (
                <div key={msg.id} className="p-1.5 bg-[#0c0c0c]/80 border-l-2 border-[#BAB5A1]/30 hover:border-[#BAB5A1] transition-colors">
                  <div className="flex items-center justify-between text-[10px] text-[#BAB5A1]/60 mb-0.5">
                    <span className="font-bold text-[#BAB5A1] flex items-center gap-1">
                      {msg.role === 'mod' && <span className="px-1 bg-[#E03C31] text-[#0c0c0c] font-bold text-[8px]">MOD</span>}
                      {msg.role === 'sub' && <span className="px-1 bg-[#BAB5A1] text-[#0c0c0c] font-bold text-[8px]">SUB</span>}
                      {msg.user}
                    </span>
                    <span>{msg.timestamp}</span>
                  </div>
                  <p className="text-[#BAB5A1] text-[11px] leading-relaxed break-words font-sans">
                    {msg.message}
                  </p>
                </div>
              ))}
            </div>

            {/* Test Chat Input Bar */}
            <form onSubmit={handleSendChat} className="p-2 bg-[#0c0c0c] border-t border-[#BAB5A1]/20 flex space-x-1.5">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Send simulation message..."
                className="flex-1 bg-[#161616] border border-[#BAB5A1]/20 px-2 py-1 text-xs text-[#BAB5A1] placeholder-[#BAB5A1]/30 focus:outline-none focus:border-[#BAB5A1]"
              />
              <button
                type="submit"
                className="px-2.5 py-1 bg-[#1c1c1c] hover:bg-[#282828] border border-[#BAB5A1]/30 text-[#BAB5A1] text-xs transition-colors"
                title="Send test chat message"
              >
                <Send className="w-3 h-3" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Bottom Footer Ribbon: Cycling Socials & Pod Note */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center z-10 pt-2 border-t border-[#BAB5A1]/20 text-xs font-mono">
        {/* Left: Active Socials Rotator */}
        <div className="md:col-span-6 flex items-center space-x-3 bg-[#121212]/90 border border-[#BAB5A1]/25 px-3 py-1">
          <Radio className="w-3.5 h-3.5 text-[#E03C31] animate-pulse" />
          <span className="text-[10px] text-[#BAB5A1]/50 uppercase tracking-wider">NETWORK NODE:</span>
          {socialsList.length > 0 && (
            <div className="flex items-center space-x-2 font-bold">
              <span className="text-[#BAB5A1]/70">{socialsList[activeSocialIndex]?.label}:</span>
              <span className="text-[#BAB5A1]">
                <NierGlitchText
                  key={activeSocialIndex}
                  text={socialsList[activeSocialIndex]?.value || ''}
                  intensity="subtle"
                  decodeOnMount
                />
              </span>
            </div>
          )}
        </div>

        {/* Right: Broadcast Status Tag */}
        <div className="md:col-span-6 flex justify-end space-x-4 text-[10px] text-[#BAB5A1]/50">
          <span>YORHA RECON // OBS SUITE v1.04</span>
          <span>BUNKER LINK: ENCRYPTED</span>
        </div>
      </div>
    </div>
  );
};
