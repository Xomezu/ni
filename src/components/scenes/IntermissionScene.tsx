import React, { useState } from 'react';
import { StreamerConfig, ChatMessage } from '../../types';
import { NierGlitchText } from '../common/NierGlitchText';
import { YorhaEmblem } from '../common/YorhaEmblem';
import { AudioVisualizer } from '../common/AudioVisualizer';
import { Video, MessageSquare, Send, CheckCircle2, HelpCircle, Layers, Sparkles } from 'lucide-react';
import { SoundEngine } from '../../utils/audio';

interface IntermissionSceneProps {
  config: StreamerConfig;
  chatMessages: ChatMessage[];
  onSendMessage?: (msg: string) => void;
}

export const IntermissionScene: React.FC<IntermissionSceneProps> = ({
  config,
  chatMessages,
  onSendMessage,
}) => {
  const [chatInput, setChatInput] = useState('');
  const [pollVotes, setPollVotes] = useState({ optionA: 142, optionB: 89 });
  const [hasVoted, setHasVoted] = useState<string | null>(null);

  const totalVotes = pollVotes.optionA + pollVotes.optionB;
  const percentA = Math.round((pollVotes.optionA / totalVotes) * 100);
  const percentB = 100 - percentA;

  const handleVote = (opt: 'optionA' | 'optionB') => {
    if (hasVoted) return;
    setPollVotes((prev) => ({ ...prev, [opt]: prev[opt] + 1 }));
    setHasVoted(opt);
    if (config.soundEnabled) {
      SoundEngine.playConfirm(config.volume);
    }
  };

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

  return (
    <div className="relative w-full h-full min-h-screen flex flex-col justify-between p-4 md:p-6 text-[#BAB5A1] font-sans overflow-hidden">
      {/* Top Bar */}
      <div className="flex justify-between items-center border-b border-[#BAB5A1]/20 pb-3 mb-3 z-10">
        <div className="flex items-center space-x-3">
          <div className="p-1.5 bg-[#121212] border border-[#BAB5A1]/30">
            <YorhaEmblem size={28} />
          </div>
          <div>
            <div className="text-xs font-serif italic font-bold text-[#BAB5A1]">
              <NierGlitchText text={config.streamerName} intensity={config.glitchIntensity} />
            </div>
            <div className="text-[10px] font-mono text-[#BAB5A1]/60 tracking-wider uppercase">
              TACTICAL INTERMISSION // JUST CHATTING
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4 font-mono">
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-[#BAB5A1] font-bold">VOICE COMS</span>
            <AudioVisualizer barsCount={14} height={14} color="#BAB5A1" />
          </div>
        </div>
      </div>

      {/* Main Mid Section: Large Camera + Interactive Chat & Community Poll */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 my-3 flex-1 items-stretch z-10 min-h-[460px]">
        {/* Left: Large Main Cam / Topic Screen Frame */}
        <div className="lg:col-span-8 flex flex-col space-y-3">
          {/* Main Large Webcam Area */}
          <div className="relative flex-1 bg-[#121212]/90 border-2 border-[#BAB5A1]/25 nier-corner-tl-br p-1 flex flex-col min-h-[340px]">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-1 bg-[#1a1a1a] border-b border-[#BAB5A1]/20 text-xs font-mono">
              <div className="flex items-center space-x-2 text-[#BAB5A1] font-bold">
                <Video className="w-3.5 h-3.5 text-[#E03C31]" />
                <span className="tracking-wider">PRIMARY OPTICAL SENSOR // WEBCAM CAPTURE</span>
              </div>
              <span className="text-[10px] text-[#BAB5A1]/70">HD 1080p</span>
            </div>

            {/* Viewport placeholder */}
            <div className="relative flex-1 bg-[#080808] flex items-center justify-center border border-[#BAB5A1]/20">
              <div className="text-center p-6">
                <div className="w-16 h-16 mx-auto mb-3 border border-[#BAB5A1]/30 rounded-full flex items-center justify-center bg-[#161616]">
                  <YorhaEmblem size={38} />
                </div>
                <div className="text-sm font-serif italic font-bold text-[#BAB5A1]">
                  PRIMARY CAMERA FEED
                </div>
                <div className="text-xs font-mono text-[#BAB5A1]/50">
                  Align camera or capture card source here in OBS
                </div>
              </div>

              {/* Corner brackets */}
              <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-[#BAB5A1]/40" />
              <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-[#BAB5A1]/40" />
              <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-[#BAB5A1]/40" />
              <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-[#BAB5A1]/40" />
            </div>
          </div>

          {/* Discussion Topic & Live Community Poll Bar */}
          <div className="bg-[#121212]/90 border border-[#BAB5A1]/25 p-3.5 nier-corner-tl-br">
            <div className="flex items-center justify-between border-b border-[#BAB5A1]/20 pb-2 mb-2 font-mono">
              <div className="flex items-center space-x-2 text-xs font-bold text-[#BAB5A1]">
                <HelpCircle className="w-3.5 h-3.5 text-[#E03C31]" />
                <span className="tracking-wider">COMMUNITY RECONNAISSANCE POLL</span>
              </div>
              <span className="text-[10px] text-[#BAB5A1]/50">{totalVotes} VOTES RECORDED</span>
            </div>

            <div className="text-xs font-bold text-[#BAB5A1] mb-2.5 font-serif italic text-sm">
              Which NieR ending has the most profound emotional impact?
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
              {/* Option A */}
              <button
                onClick={() => handleVote('optionA')}
                className={`p-2.5 border text-left transition-all relative overflow-hidden ${
                  hasVoted === 'optionA'
                    ? 'border-[#BAB5A1] bg-[#222222]'
                    : 'border-[#BAB5A1]/20 bg-[#161616] hover:border-[#BAB5A1]/50'
                }`}
              >
                <div className="flex justify-between items-center relative z-10">
                  <span className="font-bold text-[#BAB5A1]">Option [A]: Ending E [The End of YoRHa]</span>
                  <span className="text-[#BAB5A1] font-bold">{percentA}%</span>
                </div>
                {/* Background bar */}
                <div
                  className="absolute left-0 top-0 bottom-0 bg-[#BAB5A1]/15 transition-all duration-500"
                  style={{ width: `${percentA}%` }}
                />
              </button>

              {/* Option B */}
              <button
                onClick={() => handleVote('optionB')}
                className={`p-2.5 border text-left transition-all relative overflow-hidden ${
                  hasVoted === 'optionB'
                    ? 'border-[#BAB5A1] bg-[#222222]'
                    : 'border-[#BAB5A1]/20 bg-[#161616] hover:border-[#BAB5A1]/50'
                }`}
              >
                <div className="flex justify-between items-center relative z-10">
                  <span className="font-bold text-[#BAB5A1]">Option [B]: Ending C/D [Chiyo & 9S]</span>
                  <span className="text-[#BAB5A1] font-bold">{percentB}%</span>
                </div>
                {/* Background bar */}
                <div
                  className="absolute left-0 top-0 bottom-0 bg-[#BAB5A1]/15 transition-all duration-500"
                  style={{ width: `${percentB}%` }}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Live Chat & Event Logs */}
        <div className="lg:col-span-4 flex flex-col space-y-3">
          {/* Chat Container */}
          <div className="flex-1 flex flex-col bg-[#121212]/95 border border-[#BAB5A1]/25 nier-corner-tl-br overflow-hidden min-h-[380px]">
            <div className="flex items-center justify-between px-3 py-2 bg-[#181818] border-b border-[#BAB5A1]/20 text-xs font-mono">
              <div className="flex items-center space-x-2 text-[#BAB5A1] font-bold">
                <MessageSquare className="w-3.5 h-3.5 text-[#E03C31]" />
                <span className="tracking-wider">COMMUNITY TRANSMISSIONS</span>
              </div>
              <span className="text-[10px] text-[#BAB5A1] font-bold">● CONNECTED</span>
            </div>

            {/* Messages */}
            <div className="flex-1 p-3 overflow-y-auto space-y-2 text-xs font-mono">
              {chatMessages.map((msg) => (
                <div key={msg.id} className="p-2 bg-[#0c0c0c]/80 border-l-2 border-[#BAB5A1]/30 hover:border-[#BAB5A1] transition-colors">
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

            {/* Input */}
            <form onSubmit={handleSendChat} className="p-2.5 bg-[#0c0c0c] border-t border-[#BAB5A1]/20 flex space-x-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Participate in broadcast..."
                className="flex-1 bg-[#161616] border border-[#BAB5A1]/20 px-2.5 py-1.5 text-xs text-[#BAB5A1] placeholder-[#BAB5A1]/30 focus:outline-none focus:border-[#BAB5A1]"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-[#1c1c1c] hover:bg-[#282828] border border-[#BAB5A1]/30 text-[#BAB5A1] text-xs font-bold font-mono transition-colors flex items-center space-x-1"
              >
                <Send className="w-3 h-3" />
                <span>SEND</span>
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Bottom Social Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 z-10 pt-2 border-t border-[#BAB5A1]/20 text-xs font-mono text-[#BAB5A1]/60">
        <div className="flex items-center space-x-2">
          <span className="text-[#BAB5A1] font-bold">TOPIC:</span>
          <span className="text-[#BAB5A1]/80">{config.gameTitle} // Open Discussion & Q&A</span>
        </div>

        <div className="flex space-x-4">
          <span>TWITCH: <strong className="text-[#BAB5A1]">{config.socials.twitch}</strong></span>
          <span>DISCORD: <strong className="text-[#BAB5A1]">{config.socials.discord}</strong></span>
        </div>
      </div>
    </div>
  );
};
