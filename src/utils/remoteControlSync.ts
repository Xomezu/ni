import { SceneType, StreamerConfig, StreamAlert } from '../types';

export interface RemoteControlMessage {
  type: 'SET_SCENE' | 'SET_CONFIG' | 'TRIGGER_ALERT' | 'TOGGLE_CLEAN_MODE';
  scene?: SceneType;
  configDelta?: Partial<StreamerConfig>;
  alert?: StreamAlert;
  cleanMode?: boolean;
  timestamp: number;
}

const CONTROL_CHANNEL_NAME = 'yorha_remote_control_channel';
const SCENE_STORAGE_KEY = 'yorha_active_scene';
const CONFIG_STORAGE_KEY = 'yorha_streamer_config_sync';

// Broadcast scene switch to all popups and OBS windows
export function broadcastSceneChange(scene: SceneType): void {
  try {
    localStorage.setItem(SCENE_STORAGE_KEY, scene);
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(CONTROL_CHANNEL_NAME);
      channel.postMessage({
        type: 'SET_SCENE',
        scene,
        timestamp: Date.now(),
      } as RemoteControlMessage);
      channel.close();
    }
  } catch {}
}

// Broadcast configuration changes
export function broadcastConfigChange(delta: Partial<StreamerConfig>): void {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    const existing = raw ? JSON.parse(raw) : {};
    const updated = { ...existing, ...delta };
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(updated));

    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(CONTROL_CHANNEL_NAME);
      channel.postMessage({
        type: 'SET_CONFIG',
        configDelta: delta,
        timestamp: Date.now(),
      } as RemoteControlMessage);
      channel.close();
    }
  } catch {}
}

// Broadcast trigger alert to all overlays
export function broadcastAlert(alert: StreamAlert): void {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(CONTROL_CHANNEL_NAME);
      channel.postMessage({
        type: 'TRIGGER_ALERT',
        alert,
        timestamp: Date.now(),
      } as RemoteControlMessage);
      channel.close();
    }
  } catch {}
}

// Listen for scene & config broadcasts from main dashboard
export function subscribeToRemoteControl(handlers: {
  onSceneChange: (scene: SceneType) => void;
  onConfigChange: (delta: Partial<StreamerConfig>) => void;
  onAlertTrigger: (alert: StreamAlert) => void;
}): () => void {
  const handleStorage = (e: StorageEvent) => {
    if (e.key === SCENE_STORAGE_KEY && e.newValue) {
      handlers.onSceneChange(e.newValue as SceneType);
    } else if (e.key === CONFIG_STORAGE_KEY && e.newValue) {
      try {
        const delta = JSON.parse(e.newValue);
        handlers.onConfigChange(delta);
      } catch {}
    }
  };

  window.addEventListener('storage', handleStorage);

  let channel: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(CONTROL_CHANNEL_NAME);
    channel.onmessage = (event) => {
      const data = event.data as RemoteControlMessage;
      if (!data) return;

      if (data.type === 'SET_SCENE' && data.scene) {
        handlers.onSceneChange(data.scene);
      } else if (data.type === 'SET_CONFIG' && data.configDelta) {
        handlers.onConfigChange(data.configDelta);
      } else if (data.type === 'TRIGGER_ALERT' && data.alert) {
        handlers.onAlertTrigger(data.alert);
      }
    };
  }

  return () => {
    window.removeEventListener('storage', handleStorage);
    if (channel) {
      channel.close();
    }
  };
}
