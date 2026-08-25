import React, { useState } from 'react';
import {
  SceneType,
  StreamerConfig,
  StreamAlert,
  ThemeMode,
  GlitchIntensity,
} from '../../types';
import {
  Monitor,
  Gamepad2,
  Coffee,
  CheckCircle2,
  Tv,
  Settings,
  Bell,
  Volume2,
  VolumeX,
  Share2,
  Maximize,
  Minimize,
  Sliders,
  Sparkles,
  Heart,
  Gift,
  Radio,
  Copy,
  ExternalLink,
  Check,
} from 'lucide-react';
import {
  CountdownState,
  getSavedCountdownState,
  calculateRemainingMs,
  resumeCountdown,
  pauseCountdown,
  resetCountdown,
  adjustCountdown,
  subscribeToCountdownUpdates,
} from '../../utils/timerSync';
import {
  LiveAlertsManager,
  IntegrationConfig,
  getSavedIntegrations,
  saveIntegrations,
} from '../../utils/streamIntegrations';
import { SoundEngine } from '../../utils/audio';
import { Play, Pause, RotateCcw, Clock, Plus, Wifi } from 'lucide-react';

interface ControlDockProps {
  currentScene: SceneType;
  onSelectScene: (scene: SceneType) => void;
  config: StreamerConfig;
  onUpdateConfig: (newConfig: Partial<StreamerConfig>) => void;
  onTriggerAlert: (alert: StreamAlert) => void;
  cleanMode: boolean;
  onToggleCleanMode: () => void;
}

export const ControlDock: React.FC<ControlDockProps> = ({
  currentScene,
  onSelectScene,
  config,
  onUpdateConfig,
  onTriggerAlert,
  cleanMode,
  onToggleCleanMode,
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isObsModalOpen, setIsObsModalOpen] = useState(false);
  const [copiedScene, setCopiedScene] = useState<string | null>(null);
  const [countdownState, setCountdownState] = useState<CountdownState>(() =>
    getSavedCountdownState(config.startingCountdownSeconds || 300)
  );
  const [integrations, setIntegrations] = useState<IntegrationConfig>(getSavedIntegrations);
  const [connectionStatus, setConnectionStatus] = useState({ twitch: false, streamlabs: false, streamelements: false });
  const [integrationSavedMsg, setIntegrationSavedMsg] = useState(false);

  // Subscribe to live connection statuses
  React.useEffect(() => {
    const manager = LiveAlertsManager.getInstance();
    const unsub = manager.onStatusChange((status) => {
      setConnectionStatus(status);
    });
    return unsub;
  }, []);

  const handleSaveIntegrations = (newIntegrations: IntegrationConfig) => {
    setIntegrations(newIntegrations);
    saveIntegrations(newIntegrations);
    const manager = LiveAlertsManager.getInstance();
    manager.initFromConfig(newIntegrations);
    setIntegrationSavedMsg(true);
    setTimeout(() => setIntegrationSavedMsg(false), 2500);
  };

  // Subscribe to real-time timer updates across windows
  React.useEffect(() => {
    const unsubscribe = subscribeToCountdownUpdates((updatedState) => {
      setCountdownState(updatedState);
    });
    return unsubscribe;
  }, []);

  const handleTogglePlayPauseTimer = () => {
    if (countdownState.isRunning) {
      const newState = pauseCountdown(countdownState);
      setCountdownState(newState);
    } else {
      const newState = resumeCountdown(countdownState);
      setCountdownState(newState);
    }
  };

  const handleResetTimerSeconds = (sec: number) => {
    const newState = resetCountdown(sec);
    setCountdownState(newState);
  };

  const handleAddMinutesToTimer = (mins: number) => {
    const newState = adjustCountdown(mins * 60, countdownState);
    setCountdownState(newState);
  };

  const scenes: { id: SceneType; label: string; icon: React.ReactNode }[] = [
    { id: 'starting', label: 'STREAM STARTING', icon: <Monitor className="w-4 h-4" /> },
    { id: 'gameplay', label: 'IN-GAME HUD', icon: <Gamepad2 className="w-4 h-4" /> },
    { id: 'brb', label: 'BE RIGHT BACK', icon: <Coffee className="w-4 h-4" /> },
    { id: 'ending', label: 'STREAM ENDING', icon: <CheckCircle2 className="w-4 h-4" /> },
    { id: 'intermission', label: 'JUST CHATTING', icon: <Tv className="w-4 h-4" /> },
  ];

  const handleSceneClick = (scene: SceneType) => {
    onSelectScene(scene);
    if (config.soundEnabled) {
      SoundEngine.playConfirm(config.volume);
    }
  };

  const triggerTestAlert = (type: StreamAlert['type']) => {
    const alertSamples: Record<StreamAlert['type'], StreamAlert> = {
      follower: {
        id: Math.random().toString(),
        type: 'follower',
        username: 'Operator_6O',
        message: 'Establishing live satellite reconnaissance link!',
        timestamp: Date.now(),
      },
      subscriber: {
        id: Math.random().toString(),
        type: 'subscriber',
        username: 'Pod_153',
        tier: 'Tier 3 Support Unit',
        message: 'HYPOTHESIS: Subscription renewal enhances combat morale.',
        timestamp: Date.now(),
      },
      donation: {
        id: Math.random().toString(),
        type: 'donation',
        username: 'Pascal_Village',
        amount: '$25.00',
        message: 'Supplies for your continuous journey. Please stay safe!',
        timestamp: Date.now(),
      },
      raid: {
        id: Math.random().toString(),
        type: 'raid',
        username: 'Anemone_Squadron',
        amount: '185 Raiders',
        message: 'Resistance forces joining the broadcast!',
        timestamp: Date.now(),
      },
      cheer: {
        id: Math.random().toString(),
        type: 'cheer',
        username: 'Emil_Shop',
        amount: '500 Bits',
        message: 'Every day is a sale, every day is a sale~!',
        timestamp: Date.now(),
      },
    };

    onTriggerAlert(alertSamples[type]);
  };

  const getObsUrl = (sceneName: string) => {
    let origin = window.location.origin;
    // If running in development sandbox (ais-dev-), automatically convert to public shared preview (ais-pre-)
    if (origin.includes('ais-dev-')) {
      origin = origin.replace('ais-dev-', 'ais-pre-');
    }
    const baseUrl = origin + window.location.pathname;
    return `${baseUrl}?scene=${sceneName}`;
  };

  const copyObsUrl = (sceneName: string) => {
    const url = getObsUrl(sceneName);
    navigator.clipboard.writeText(url).then(() => {
      setCopiedScene(sceneName);
      if (config.soundEnabled) {
        SoundEngine.playTick(config.volume);
      }
      setTimeout(() => setCopiedScene(null), 2500);
    });
  };

  if (cleanMode) {
    // In clean mode, the overlay is 100% clean with no onscreen buttons.
    // Press 'H' key anytime to toggle controls back on.
    return null;
  }

  return (
    <>
      {/* Floating Bottom Control Dock */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-4xl w-[95%] pointer-events-auto">
        <div className="bg-[#0c0c0c]/95 border border-[#BAB5A1]/25 text-[#BAB5A1] font-mono p-2.5 shadow-2xl nier-corner-all backdrop-blur-lg">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Scene Selector Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              {scenes.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSceneClick(s.id)}
                  className={`px-3 py-1.5 text-xs font-bold transition-all flex items-center space-x-1.5 ${
                    currentScene === s.id
                      ? 'bg-[#BAB5A1] text-[#0c0c0c] border border-[#BAB5A1]'
                      : 'bg-[#181818] hover:bg-[#242424] text-[#BAB5A1]/70 border border-[#BAB5A1]/20'
                  }`}
                >
                  {s.icon}
                  <span>{s.label}</span>
                </button>
              ))}
            </div>

            {/* Quick Timer Controls for Starting Scene */}
            {currentScene === 'starting' && (
              <div className="flex items-center gap-1 bg-[#141414] border border-[#BAB5A1]/20 p-1 text-xs">
                <span className="px-1 text-[9px] text-[#BAB5A1]/60 font-bold uppercase tracking-wider">TIMER:</span>
                <button
                  onClick={handleTogglePlayPauseTimer}
                  className={`px-1.5 py-0.5 border text-[10px] font-bold flex items-center gap-0.5 ${
                    countdownState.isRunning
                      ? 'bg-[#1c1c1c] text-[#BAB5A1] border-[#BAB5A1]/30 hover:bg-[#282828]'
                      : 'bg-[#BAB5A1] text-[#0c0c0c] border-[#BAB5A1]'
                  }`}
                  title={countdownState.isRunning ? 'Pause Countdown' : 'Resume Countdown'}
                >
                  {countdownState.isRunning ? <Pause className="w-2.5 h-2.5 text-[#E03C31]" /> : <Play className="w-2.5 h-2.5 fill-current" />}
                  <span>{countdownState.isRunning ? 'PAUSE' : 'PLAY'}</span>
                </button>
                <button
                  onClick={() => handleResetTimerSeconds(300)}
                  className="px-1.5 py-0.5 bg-[#181818] hover:bg-[#242424] text-[#BAB5A1] text-[10px] border border-[#BAB5A1]/20"
                  title="Reset timer to 5:00"
                >
                  5m
                </button>
                <button
                  onClick={() => handleResetTimerSeconds(600)}
                  className="px-1.5 py-0.5 bg-[#181818] hover:bg-[#242424] text-[#BAB5A1] text-[10px] border border-[#BAB5A1]/20"
                  title="Reset timer to 10:00"
                >
                  10m
                </button>
                <button
                  onClick={() => handleAddMinutesToTimer(1)}
                  className="px-1.5 py-0.5 bg-[#181818] hover:bg-[#242424] text-[#BAB5A1] text-[10px] border border-[#BAB5A1]/20"
                  title="Add 1 minute"
                >
                  +1m
                </button>
                <button
                  onClick={() => handleAddMinutesToTimer(5)}
                  className="px-1.5 py-0.5 bg-[#181818] hover:bg-[#242424] text-[#BAB5A1] text-[10px] border border-[#BAB5A1]/20"
                  title="Add 5 minutes"
                >
                  +5m
                </button>
              </div>
            )}

            {/* Right Quick Actions */}
            <div className="flex items-center space-x-1.5 text-xs">
              {/* Alert Simulator Trigger Menu */}
              <div className="flex items-center bg-[#141414] border border-[#BAB5A1]/20 p-0.5">
                <span className="px-1.5 text-[9px] text-[#BAB5A1]/60 font-bold uppercase tracking-wider">TEST:</span>
                <button
                  onClick={() => triggerTestAlert('follower')}
                  className="px-1.5 py-0.5 hover:bg-[#222222] text-[#BAB5A1] text-[10px]"
                  title="Test Follower Alert"
                >
                  Follow
                </button>
                <button
                  onClick={() => triggerTestAlert('subscriber')}
                  className="px-1.5 py-0.5 hover:bg-[#222222] text-[#BAB5A1] text-[10px]"
                  title="Test Sub Alert"
                >
                  Sub
                </button>
                <button
                  onClick={() => triggerTestAlert('donation')}
                  className="px-1.5 py-0.5 hover:bg-[#222222] text-[#E03C31] text-[10px]"
                  title="Test Donation Alert"
                >
                  Donation
                </button>
                <button
                  onClick={() => triggerTestAlert('raid')}
                  className="px-1.5 py-0.5 hover:bg-[#222222] text-[#BAB5A1] text-[10px]"
                  title="Test Raid Alert"
                >
                  Raid
                </button>
              </div>

              {/* Sound Toggle */}
              <button
                onClick={() =>
                  onUpdateConfig({ soundEnabled: !config.soundEnabled })
                }
                className={`p-1.5 border transition-colors ${
                  config.soundEnabled
                    ? 'bg-[#181818] border-[#BAB5A1] text-[#BAB5A1]'
                    : 'bg-[#181818] border-[#BAB5A1]/20 text-[#BAB5A1]/40'
                }`}
                title={config.soundEnabled ? 'Disable UI Chimes' : 'Enable UI Chimes'}
              >
                {config.soundEnabled ? (
                  <Volume2 className="w-3.5 h-3.5" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5" />
                )}
              </button>

              {/* OBS Integration Modal Button */}
              <button
                onClick={() => setIsObsModalOpen(true)}
                className="px-2.5 py-1.5 bg-[#181818] hover:bg-[#242424] border border-[#BAB5A1]/40 text-[#BAB5A1] text-xs font-bold flex items-center space-x-1"
                title="OBS Studio Browser Source URLs"
              >
                <Share2 className="w-3.5 h-3.5 text-[#E03C31]" />
                <span className="hidden sm:inline">OBS LINKS</span>
              </button>

              {/* Settings / Customize Modal */}
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-1.5 bg-[#181818] hover:bg-[#242424] border border-[#BAB5A1]/25 text-[#BAB5A1]"
                title="Configure Streamer Name & Settings"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>

              {/* Clean OBS Mode (Hides controls) */}
              <button
                onClick={onToggleCleanMode}
                className="p-1.5 bg-[#181818] hover:bg-[#242424] border border-[#BAB5A1]/25 text-[#BAB5A1]"
                title="Full Clean OBS View (Hide All Controls. Press 'H' to show again)"
              >
                <Maximize className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* OBS Studio Integration Modal */}
      {isObsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0c0c0c] border border-[#BAB5A1]/30 text-[#BAB5A1] font-mono max-w-2xl w-full p-6 nier-corner-all shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#BAB5A1]/20 pb-3 mb-4">
              <div className="flex items-center space-x-2">
                <Share2 className="w-5 h-5 text-[#E03C31]" />
                <h3 className="text-base font-serif italic font-bold text-[#BAB5A1]">
                  OBS STUDIO BROWSER SOURCE INTEGRATION
                </h3>
              </div>
              <button
                onClick={() => setIsObsModalOpen(false)}
                className="px-2 py-1 bg-[#181818] hover:bg-[#242424] text-xs border border-[#BAB5A1]/20"
              >
                CLOSE [X]
              </button>
            </div>

            <p className="text-xs text-[#BAB5A1]/70 leading-relaxed mb-4 font-sans">
              Google Cloud Run sandboxes require browser authentication that OBS Studio&apos;s internal browser cannot open popups for. Use either <strong>Window Capture (Recommended & 100% reliable)</strong> or export the build.
            </p>

            {/* Direct Pop-out / Clean Window Controls */}
            <div className="p-3.5 bg-[#121212] border border-[#BAB5A1]/30 mb-4 nier-corner-tl-br">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-[#BAB5A1] uppercase tracking-wider">
                    METHOD 1: OBS WINDOW CAPTURE (100% RECOMMENDED)
                  </div>
                  <div className="text-[11px] text-[#BAB5A1]/60 font-sans mt-0.5">
                    Opens overlay in a dedicated clean browser window for OBS Window Capture.
                  </div>
                </div>
                <button
                  onClick={() => {
                    const cleanUrl = `${window.location.origin}${window.location.pathname}?clean=true`;
                    window.open(cleanUrl, '_blank', 'width=1920,height=1080,menubar=no,toolbar=no,location=no,status=no');
                  }}
                  className="px-3 py-1.5 bg-[#BAB5A1] hover:bg-[#BAB5A1]/90 text-[#0c0c0c] text-xs font-bold flex items-center space-x-1.5 transition-colors shrink-0 ml-3"
                >
                  <Maximize className="w-3.5 h-3.5" />
                  <span>OPEN LIVE SYNCED POPUP</span>
                </button>
              </div>
              <div className="mt-2.5 pt-2 border-t border-[#BAB5A1]/10 text-[11px] text-[#BAB5A1]/80 font-sans space-y-1">
                <div>1. Click <strong>&quot;OPEN CLEAN POPUP&quot;</strong> above to launch the standalone 1920x1080 overlay window.</div>
                <div>2. In OBS Studio, click <strong>+ Add Source</strong> → <strong>Window Capture</strong>.</div>
                <div>3. Select your browser window. In Capture Method, select <strong>Windows 10 / 11 Graphics Capture</strong> for 60 FPS hardware acceleration.</div>
              </div>
            </div>

            <div className="text-xs font-bold text-[#BAB5A1] uppercase tracking-wider mb-2">
              METHOD 2: DIRECT SCENE URLS (FOR OBS BROWSER SOURCE / HOSTED)
            </div>

            {/* Direct Scene Links */}
            <div className="space-y-2 mb-4">
              {scenes.map((sc) => (
                <div
                  key={sc.id}
                  className="p-2.5 bg-[#141414] border border-[#BAB5A1]/20 flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-bold text-[#BAB5A1] flex items-center gap-1.5">
                      {sc.icon}
                      <span>{sc.label} SCENE</span>
                    </div>
                    <div className="text-[11px] text-[#BAB5A1]/50 font-mono mt-0.5 break-all">
                      {getObsUrl(sc.id)}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0 ml-3">
                    <button
                      onClick={() => {
                        window.open(`${window.location.origin}${window.location.pathname}?scene=${sc.id}&clean=true`, '_blank');
                      }}
                      className="px-2.5 py-1.5 bg-[#181818] hover:bg-[#242424] border border-[#BAB5A1]/20 text-[11px] text-[#BAB5A1]"
                      title="Open scene in new browser tab"
                    >
                      Open Tab
                    </button>
                    <button
                      onClick={() => copyObsUrl(sc.id)}
                      className="px-3 py-1.5 bg-[#1e1e1e] hover:bg-[#282828] border border-[#BAB5A1]/30 text-xs font-bold text-[#BAB5A1] flex items-center space-x-1.5 transition-colors"
                    >
                      {copiedScene === sc.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#E03C31]" />
                          <span className="text-[#E03C31]">COPIED!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>COPY URL</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Export / Self-Hosting Note */}
            <div className="p-3 bg-[#101010] border border-[#BAB5A1]/15 text-[11px] text-[#BAB5A1]/70 font-sans space-y-1">
              <div className="text-[#BAB5A1] font-bold font-mono">STANDALONE OBS BROWSER SOURCE SETUP:</div>
              <div>To use standard OBS Browser Source without any browser windows open, export this project (Settings menu → <strong>Export to ZIP</strong> or <strong>GitHub</strong>) and deploy to Vercel / Netlify / GitHub Pages for a 100% public custom domain that loads anywhere.</div>
            </div>
          </div>
        </div>
      )}

      {/* Settings & Customization Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0c0c0c] border border-[#BAB5A1]/30 text-[#BAB5A1] font-mono max-w-2xl w-full p-6 nier-corner-all shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#BAB5A1]/20 pb-3 mb-4">
              <div className="flex items-center space-x-2">
                <Sliders className="w-5 h-5 text-[#E03C31]" />
                <h3 className="text-base font-serif italic font-bold text-[#BAB5A1]">
                  STREAMER CONFIGURATION // YORHA TERMINAL
                </h3>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-2 py-1 bg-[#181818] hover:bg-[#242424] text-xs border border-[#BAB5A1]/20"
              >
                CLOSE [X]
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Identity Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#BAB5A1] font-bold mb-1">STREAMER NAME</label>
                  <input
                    type="text"
                    value={config.streamerName}
                    onChange={(e) => onUpdateConfig({ streamerName: e.target.value })}
                    className="w-full bg-[#161616] border border-[#BAB5A1]/20 p-2 text-[#BAB5A1] focus:outline-none focus:border-[#BAB5A1]"
                  />
                </div>
                <div>
                  <label className="block text-[#BAB5A1] font-bold mb-1">UNIT SERIAL NUMBER</label>
                  <input
                    type="text"
                    value={config.serialNumber}
                    onChange={(e) => onUpdateConfig({ serialNumber: e.target.value })}
                    className="w-full bg-[#161616] border border-[#BAB5A1]/20 p-2 text-[#BAB5A1] focus:outline-none focus:border-[#BAB5A1]"
                  />
                </div>
              </div>

              {/* Game Title & Pod */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#BAB5A1] font-bold mb-1">MISSION / GAME TITLE</label>
                  <input
                    type="text"
                    value={config.gameTitle}
                    onChange={(e) => onUpdateConfig({ gameTitle: e.target.value })}
                    className="w-full bg-[#161616] border border-[#BAB5A1]/20 p-2 text-[#BAB5A1] focus:outline-none focus:border-[#BAB5A1]"
                  />
                </div>
                <div>
                  <label className="block text-[#BAB5A1] font-bold mb-1">POD DESIGNATION</label>
                  <input
                    type="text"
                    value={config.podDesignation}
                    onChange={(e) => onUpdateConfig({ podDesignation: e.target.value })}
                    className="w-full bg-[#161616] border border-[#BAB5A1]/20 p-2 text-[#BAB5A1] focus:outline-none focus:border-[#BAB5A1]"
                  />
                </div>
              </div>

              {/* Social Channels */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="block text-[#BAB5A1]/60 mb-1">TWITCH</label>
                  <input
                    type="text"
                    value={config.socials.twitch}
                    onChange={(e) =>
                      onUpdateConfig({
                        socials: { ...config.socials, twitch: e.target.value },
                      })
                    }
                    className="w-full bg-[#161616] border border-[#BAB5A1]/20 p-1.5 text-xs text-[#BAB5A1]"
                  />
                </div>
                <div>
                  <label className="block text-[#BAB5A1]/60 mb-1">X / TWITTER</label>
                  <input
                    type="text"
                    value={config.socials.twitter}
                    onChange={(e) =>
                      onUpdateConfig({
                        socials: { ...config.socials, twitter: e.target.value },
                      })
                    }
                    className="w-full bg-[#161616] border border-[#BAB5A1]/20 p-1.5 text-xs text-[#BAB5A1]"
                  />
                </div>
                <div>
                  <label className="block text-[#BAB5A1]/60 mb-1">YOUTUBE</label>
                  <input
                    type="text"
                    value={config.socials.youtube}
                    onChange={(e) =>
                      onUpdateConfig({
                        socials: { ...config.socials, youtube: e.target.value },
                      })
                    }
                    className="w-full bg-[#161616] border border-[#BAB5A1]/20 p-1.5 text-xs text-[#BAB5A1]"
                  />
                </div>
                <div>
                  <label className="block text-[#BAB5A1]/60 mb-1">DISCORD</label>
                  <input
                    type="text"
                    value={config.socials.discord}
                    onChange={(e) =>
                      onUpdateConfig({
                        socials: { ...config.socials, discord: e.target.value },
                      })
                    }
                    className="w-full bg-[#161616] border border-[#BAB5A1]/20 p-1.5 text-xs text-[#BAB5A1]"
                  />
                </div>
              </div>

              {/* Live Alerts & Webhook Integrations Section */}
              <div className="p-3 bg-[#131313] border border-[#BAB5A1]/30 nier-corner-tl-br space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Radio className="w-4 h-4 text-[#E03C31] animate-pulse" />
                    <span className="font-bold text-[#BAB5A1] uppercase tracking-wider">
                      LIVE BROADCAST INTEGRATIONS (TWITCH / STREAMLABS / STREAMELEMENTS)
                    </span>
                  </div>
                  {integrationSavedMsg && (
                    <span className="text-[11px] text-green-400 font-bold animate-fade-in">
                      ✓ CONNECTED & SAVED
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-[#BAB5A1]/70 leading-relaxed font-sans">
                  Connect your live channel or token so real-time followers, subscriptions, donations, cheers, and raids automatically trigger the YoRHa alert banner and update HUD chat.
                </p>

                {/* Twitch Channel Direct Link */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-[#BAB5A1] flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${connectionStatus.twitch ? 'bg-green-500' : 'bg-[#BAB5A1]/40'}`} />
                      <span>TWITCH CHANNEL USERNAME (Real-time Public Chat & Subs)</span>
                    </label>
                    <span className="text-[10px] text-[#BAB5A1]/50">No password required</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. shisui_2b or your_twitch_name"
                      value={integrations.twitchChannel}
                      onChange={(e) => setIntegrations({ ...integrations, twitchChannel: e.target.value })}
                      className="flex-1 bg-[#1c1c1c] border border-[#BAB5A1]/25 p-1.5 text-xs text-[#BAB5A1] focus:outline-none focus:border-[#BAB5A1]"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveIntegrations(integrations)}
                      className="px-3 py-1.5 bg-[#BAB5A1] text-[#0c0c0c] font-bold text-xs hover:bg-white transition-colors"
                    >
                      CONNECT
                    </button>
                  </div>
                </div>

                {/* Streamlabs Socket Token */}
                <div className="space-y-1.5 pt-2 border-t border-[#BAB5A1]/15">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-[#BAB5A1] flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${connectionStatus.streamlabs ? 'bg-green-500' : 'bg-[#BAB5A1]/40'}`} />
                      <span>STREAMLABS API SOCKET TOKEN (Live Tips, Followers, Subs, Bits)</span>
                    </label>
                    <a
                      href="https://streamlabs.com/dashboard#/settings/api-settings"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-[#BAB5A1]/60 hover:text-[#BAB5A1] underline"
                    >
                      Get Token ↗
                    </a>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder="Paste Streamlabs Socket Token (Streamlabs API Settings → API Tokens)"
                      value={integrations.streamlabsSocketToken}
                      onChange={(e) =>
                        setIntegrations({
                          ...integrations,
                          streamlabsSocketToken: e.target.value,
                          enableStreamlabs: true,
                        })
                      }
                      className="flex-1 bg-[#1c1c1c] border border-[#BAB5A1]/25 p-1.5 text-xs text-[#BAB5A1] focus:outline-none focus:border-[#BAB5A1]"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveIntegrations({ ...integrations, enableStreamlabs: true })}
                      className="px-3 py-1.5 bg-[#BAB5A1] text-[#0c0c0c] font-bold text-xs hover:bg-white transition-colors"
                    >
                      LINK
                    </button>
                  </div>
                </div>

                {/* StreamElements JWT Token */}
                <div className="space-y-1.5 pt-2 border-t border-[#BAB5A1]/15">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-[#BAB5A1] flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${connectionStatus.streamelements ? 'bg-green-500' : 'bg-[#BAB5A1]/40'}`} />
                      <span>STREAMELEMENTS JWT TOKEN (Live Follows, Tips, Cheers)</span>
                    </label>
                    <a
                      href="https://streamelements.com/dashboard/account/channels"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-[#BAB5A1]/60 hover:text-[#BAB5A1] underline"
                    >
                      Get JWT ↗
                    </a>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder="Paste StreamElements JWT Token (Account Settings → Channels → Show Secrets)"
                      value={integrations.streamelementsJwt}
                      onChange={(e) =>
                        setIntegrations({
                          ...integrations,
                          streamelementsJwt: e.target.value,
                          enableStreamElements: true,
                        })
                      }
                      className="flex-1 bg-[#1c1c1c] border border-[#BAB5A1]/25 p-1.5 text-xs text-[#BAB5A1] focus:outline-none focus:border-[#BAB5A1]"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveIntegrations({ ...integrations, enableStreamElements: true })}
                      className="px-3 py-1.5 bg-[#BAB5A1] text-[#0c0c0c] font-bold text-xs hover:bg-white transition-colors"
                    >
                      LINK
                    </button>
                  </div>
                </div>
              </div>

              {/* Sub/Follower Goal Settings */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[#BAB5A1]/60 mb-1">GOAL TITLE</label>
                  <input
                    type="text"
                    value={config.goal.title}
                    onChange={(e) =>
                      onUpdateConfig({
                        goal: { ...config.goal, title: e.target.value },
                      })
                    }
                    className="w-full bg-[#161616] border border-[#BAB5A1]/20 p-1.5 text-xs text-[#BAB5A1]"
                  />
                </div>
                <div>
                  <label className="block text-[#BAB5A1]/60 mb-1">CURRENT</label>
                  <input
                    type="number"
                    value={config.goal.current}
                    onChange={(e) =>
                      onUpdateConfig({
                        goal: { ...config.goal, current: parseInt(e.target.value) || 0 },
                      })
                    }
                    className="w-full bg-[#161616] border border-[#BAB5A1]/20 p-1.5 text-xs text-[#BAB5A1]"
                  />
                </div>
                <div>
                  <label className="block text-[#BAB5A1]/60 mb-1">TARGET</label>
                  <input
                    type="number"
                    value={config.goal.target}
                    onChange={(e) =>
                      onUpdateConfig({
                        goal: { ...config.goal, target: parseInt(e.target.value) || 100 },
                      })
                    }
                    className="w-full bg-[#161616] border border-[#BAB5A1]/20 p-1.5 text-xs text-[#BAB5A1]"
                  />
                </div>
              </div>

              {/* Countdown Timer Config */}
              <div className="pt-2 border-t border-[#BAB5A1]/20">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[#BAB5A1] font-bold text-xs">
                    STARTING COUNTDOWN (REAL-TIME SYNCED)
                  </label>
                  <span className="text-[10px] text-[#BAB5A1]/60 font-mono">
                    Continues in background even when tab/window is closed
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: '3 MIN', sec: 180 },
                    { label: '5 MIN', sec: 300 },
                    { label: '10 MIN', sec: 600 },
                    { label: '15 MIN', sec: 900 },
                  ].map((t) => (
                    <button
                      key={t.sec}
                      type="button"
                      onClick={() => {
                        onUpdateConfig({ startingCountdownSeconds: t.sec });
                        // Also trigger timer reset
                        try {
                          const durationMs = t.sec * 1000;
                          const state = {
                            targetTimestamp: Date.now() + durationMs,
                            durationMs,
                            isRunning: true,
                            remainingWhenPausedMs: durationMs,
                            lastUpdated: Date.now(),
                          };
                          localStorage.setItem('yorha_stream_countdown_sync', JSON.stringify(state));
                          if (typeof BroadcastChannel !== 'undefined') {
                            const bc = new BroadcastChannel('yorha_countdown_channel');
                            bc.postMessage({ type: 'COUNTDOWN_UPDATED', state });
                            bc.close();
                          }
                        } catch {}
                      }}
                      className={`p-1.5 text-[11px] font-bold border transition-colors ${
                        config.startingCountdownSeconds === t.sec
                          ? 'bg-[#BAB5A1] text-[#0c0c0c] border-[#BAB5A1]'
                          : 'bg-[#181818] text-[#BAB5A1]/70 border-[#BAB5A1]/20 hover:bg-[#222222]'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Glitch Intensity */}
              <div className="pt-2 border-t border-[#BAB5A1]/20">
                <label className="block text-[#BAB5A1] font-bold mb-1">GLITCH INTENSITY</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['off', 'subtle', 'moderate', 'heavy'] as GlitchIntensity[]).map((level) => (
                    <button
                      key={level}
                      onClick={() => onUpdateConfig({ glitchIntensity: level })}
                      className={`p-1.5 text-[11px] font-bold uppercase text-center border ${
                        config.glitchIntensity === level
                          ? 'bg-[#BAB5A1] text-[#0c0c0c] border-[#BAB5A1]'
                          : 'bg-[#181818] text-[#BAB5A1]/70 border-[#BAB5A1]/20'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap gap-4 pt-2 border-t border-[#BAB5A1]/20">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.scanlinesEnabled}
                    onChange={(e) => onUpdateConfig({ scanlinesEnabled: e.target.checked })}
                    className="accent-[#BAB5A1]"
                  />
                  <span>CRT Scanlines & Flicker Overlay</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.particlesEnabled}
                    onChange={(e) => onUpdateConfig({ particlesEnabled: e.target.checked })}
                    className="accent-[#BAB5A1]"
                  />
                  <span>Ash / Particle Canvas Simulation</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.soundEnabled}
                    onChange={(e) => onUpdateConfig({ soundEnabled: e.target.checked })}
                    className="accent-[#BAB5A1]"
                  />
                  <span>YoRHa UI Sound Synthesizer</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
