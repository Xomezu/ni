/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  SceneType,
  StreamerConfig,
  StreamAlert,
  ChatMessage,
  ThemeMode,
} from './types';
import { NierBackground } from './components/common/NierBackground';
import { ScanlineOverlay } from './components/common/ScanlineOverlay';
import { AlertBanner } from './components/common/AlertBanner';
import { StreamStartingScene } from './components/scenes/StreamStartingScene';
import { GameplayScene } from './components/scenes/GameplayScene';
import { BeRightBackScene } from './components/scenes/BeRightBackScene';
import { StreamEndingScene } from './components/scenes/StreamEndingScene';
import { IntermissionScene } from './components/scenes/IntermissionScene';
import { ControlDock } from './components/controls/ControlDock';
import { SoundEngine } from './utils/audio';
import {
  LiveAlertsManager,
  getSavedIntegrations,
} from './utils/streamIntegrations';
import {
  broadcastSceneChange,
  broadcastConfigChange,
  broadcastAlert,
  subscribeToRemoteControl,
} from './utils/remoteControlSync';

const INITIAL_CONFIG: StreamerConfig = {
  streamerName: '2B // YoRHa Recon',
  titleSuffix: 'NieR:Automata Master Run',
  podDesignation: 'POD 042',
  serialNumber: 'YoRHa No.2 Type B',
  gameTitle: 'NieR:Automata [Game of the YoRHa Edition]',
  socials: {
    twitch: 'twitch.tv/yorha_unit2b',
    twitter: '@yorha_recon',
    youtube: 'youtube.com/@yorha_broadcast',
    discord: 'discord.gg/bunker',
  },
  startingCountdownSeconds: 300, // 5:00
  brbEstimatedMinutes: 3,
  goal: {
    title: 'SUB GOAL',
    current: 442,
    target: 500,
    unit: 'Commanders',
  },
  theme: 'parchment',
  glitchIntensity: 'moderate',
  soundEnabled: true,
  volume: 0.35,
  podVoiceEnabled: true,
  scanlinesEnabled: true,
  particlesEnabled: true,
  customStatusMessage: 'BLACK BOX INTEGRITY: 100% // BUNKER SYNC OK',
  nowPlaying: {
    title: 'City Ruins (Rays of Light)',
    artist: 'Keiichi Okabe // NieR:Automata OST',
    album: 'NieR:Automata Original Soundtrack',
    isPlaying: true,
  },
};

const INITIAL_CHAT: ChatMessage[] = [
  {
    id: '1',
    user: 'Operator_6O',
    message: 'To 2B! Bunker satellite connection is clear today. Have a safe mission!',
    role: 'mod',
    timestamp: '19:42',
  },
  {
    id: '2',
    user: '9S_Scanner',
    message: 'I have verified the area scan. Pod 042 is linked with full laser capabilities.',
    role: 'sub',
    timestamp: '19:43',
  },
  {
    id: '3',
    user: 'Pascal_Village',
    message: 'Welcome everyone! Let us enjoy a peaceful broadcast together.',
    role: 'vip',
    timestamp: '19:44',
  },
  {
    id: '4',
    user: 'Emil_Specialist',
    message: 'I brought high-grade restorative items if anyone needs them!',
    role: 'viewer',
    timestamp: '19:45',
  },
];

export default function App() {
  const [config, setConfig] = useState<StreamerConfig>(INITIAL_CONFIG);
  const [currentScene, setCurrentScene] = useState<SceneType>('starting');
  const [activeAlert, setActiveAlert] = useState<StreamAlert | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(INITIAL_CHAT);
  const [cleanMode, setCleanMode] = useState(false);

  // Check URL parameters for OBS Browser Source direct loading
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const sceneParam = params.get('scene') as SceneType;
    if (sceneParam && ['starting', 'gameplay', 'brb', 'ending', 'intermission'].includes(sceneParam)) {
      setCurrentScene(sceneParam);
    }
    if (params.get('clean') === 'true' || params.get('obs') === 'true') {
      setCleanMode(true);
    }
    const themeParam = params.get('theme') as ThemeMode;
    if (themeParam && ['parchment', 'yorha-dark', 'corrupted-red', 'resistance-sand'].includes(themeParam)) {
      setConfig((prev) => ({ ...prev, theme: themeParam }));
    }
  }, []);

  // Connect live stream events (Twitch chat, Streamlabs, StreamElements)
  useEffect(() => {
    const manager = LiveAlertsManager.getInstance();
    const saved = getSavedIntegrations();
    manager.initFromConfig(saved);

    const unsubAlert = manager.onAlert((alert) => {
      setActiveAlert(alert);
    });

    const unsubChat = manager.onChatMessage((msg) => {
      setChatMessages((prev) => [...prev.slice(-40), msg]);
    });

    return () => {
      unsubAlert();
      unsubChat();
    };
  }, []);

  // Synchronize scene changes, alerts, and configs across windows/tabs/popups
  useEffect(() => {
    const unsub = subscribeToRemoteControl({
      onSceneChange: (newScene) => {
        setCurrentScene(newScene);
      },
      onConfigChange: (delta) => {
        setConfig((prev) => ({ ...prev, ...delta }));
      },
      onAlertTrigger: (alert) => {
        setActiveAlert(alert);
      },
    });
    return unsub;
  }, []);

  // Keyboard shortcut listener for streamers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === '1') {
        setCurrentScene('starting');
        broadcastSceneChange('starting');
        if (config.soundEnabled) SoundEngine.playConfirm(config.volume);
      } else if (e.key === '2') {
        setCurrentScene('gameplay');
        broadcastSceneChange('gameplay');
        if (config.soundEnabled) SoundEngine.playConfirm(config.volume);
      } else if (e.key === '3') {
        setCurrentScene('brb');
        broadcastSceneChange('brb');
        if (config.soundEnabled) SoundEngine.playConfirm(config.volume);
      } else if (e.key === '4') {
        setCurrentScene('ending');
        broadcastSceneChange('ending');
        if (config.soundEnabled) SoundEngine.playConfirm(config.volume);
      } else if (e.key === '5') {
        setCurrentScene('intermission');
        broadcastSceneChange('intermission');
        if (config.soundEnabled) SoundEngine.playConfirm(config.volume);
      } else if (e.key.toLowerCase() === 'h') {
        setCleanMode((prev) => !prev);
      } else if (e.key.toLowerCase() === 'g') {
        if (config.soundEnabled) SoundEngine.playGlitch(config.volume);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [config.soundEnabled, config.volume]);

  const handleSelectScene = (scene: SceneType) => {
    setCurrentScene(scene);
    broadcastSceneChange(scene);
  };

  const handleUpdateConfig = (newConfig: Partial<StreamerConfig>) => {
    setConfig((prev) => ({ ...prev, ...newConfig }));
    broadcastConfigChange(newConfig);
  };

  const handleSendMessage = (text: string) => {
    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      user: config.streamerName.split(' ')[0] || 'Operator',
      message: text,
      role: 'mod',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setChatMessages((prev) => [...prev, newMsg]);
  };

  const handleTriggerAlert = (alert: StreamAlert) => {
    setActiveAlert(alert);
    broadcastAlert(alert);
  };

  return (
    <div className="relative min-h-screen w-full bg-[#0c0c0c] text-[#BAB5A1] select-none overflow-x-hidden font-mono">
      {/* Dynamic Background Atmosphere */}
      <NierBackground theme={config.theme} particles={config.particlesEnabled} />

      {/* CRT Scanline & Glitch Distortion Layer */}
      <ScanlineOverlay
        enabled={config.scanlinesEnabled}
        intensity={config.glitchIntensity}
      />

      {/* Live YoRHa Alert Popup Banner */}
      <AlertBanner
        currentAlert={activeAlert}
        onDismiss={() => setActiveAlert(null)}
        soundEnabled={config.soundEnabled}
      />

      {/* Active OBS Scene Rendering */}
      <main className="relative z-10 w-full min-h-screen">
        {currentScene === 'starting' && (
          <StreamStartingScene
            config={config}
            onUpdateConfig={handleUpdateConfig}
          />
        )}
        {currentScene === 'gameplay' && (
          <GameplayScene
            config={config}
            chatMessages={chatMessages}
            onSendMessage={handleSendMessage}
          />
        )}
        {currentScene === 'brb' && (
          <BeRightBackScene config={config} />
        )}
        {currentScene === 'ending' && (
          <StreamEndingScene config={config} />
        )}
        {currentScene === 'intermission' && (
          <IntermissionScene
            config={config}
            chatMessages={chatMessages}
            onSendMessage={handleSendMessage}
          />
        )}
      </main>

      {/* Streamer Control Dock & OBS Link Generator */}
      <ControlDock
        currentScene={currentScene}
        onSelectScene={handleSelectScene}
        config={config}
        onUpdateConfig={handleUpdateConfig}
        onTriggerAlert={handleTriggerAlert}
        cleanMode={cleanMode}
        onToggleCleanMode={() => setCleanMode(!cleanMode)}
      />
    </div>
  );
}
