export type SceneType = 'starting' | 'gameplay' | 'brb' | 'ending' | 'intermission';

export type ThemeMode = 'parchment' | 'yorha-dark' | 'corrupted-red' | 'resistance-sand';

export type GlitchIntensity = 'off' | 'subtle' | 'moderate' | 'heavy';

export interface SocialLinks {
  twitch: string;
  twitter: string;
  youtube: string;
  discord: string;
}

export interface StreamGoals {
  title: string;
  current: number;
  target: number;
  unit: string;
}

export interface StreamerConfig {
  streamerName: string;
  titleSuffix: string;
  podDesignation: string;
  serialNumber: string;
  gameTitle: string;
  socials: SocialLinks;
  startingCountdownSeconds: number;
  brbEstimatedMinutes: number;
  goal: StreamGoals;
  theme: ThemeMode;
  glitchIntensity: GlitchIntensity;
  soundEnabled: boolean;
  volume: number;
  podVoiceEnabled: boolean;
  scanlinesEnabled: boolean;
  particlesEnabled: boolean;
  customStatusMessage: string;
  nowPlaying: {
    title: string;
    artist: string;
    album: string;
    isPlaying: boolean;
  };
}

export interface StreamAlert {
  id: string;
  type: 'follower' | 'subscriber' | 'donation' | 'raid' | 'cheer';
  username: string;
  amount?: string;
  message?: string;
  tier?: string;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  user: string;
  message: string;
  role?: 'mod' | 'sub' | 'vip' | 'viewer';
  timestamp: string;
}
