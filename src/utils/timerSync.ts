// Persistent, timestamp-based countdown synchronizer across windows, tabs, and background/closed states
export interface CountdownState {
  targetTimestamp: number; // Unix timestamp in ms when the countdown hits 0
  durationMs: number;      // Original total duration in ms
  isRunning: boolean;     // Whether the timer is currently ticking
  remainingWhenPausedMs: number; // Stored remaining ms when paused
  lastUpdated: number;    // Last state update timestamp
}

const STORAGE_KEY = 'yorha_stream_countdown_sync';
const BROADCAST_CHANNEL_NAME = 'yorha_countdown_channel';

// Get current state from localStorage or create default
export function getSavedCountdownState(defaultDurationSeconds: number = 300): CountdownState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: CountdownState = JSON.parse(raw);
      if (typeof parsed.targetTimestamp === 'number' && typeof parsed.isRunning === 'boolean') {
        return parsed;
      }
    }
  } catch {
    // Ignore storage parse errors
  }

  // Default initial state: target set to now + default duration
  const durationMs = defaultDurationSeconds * 1000;
  return {
    targetTimestamp: Date.now() + durationMs,
    durationMs,
    isRunning: true,
    remainingWhenPausedMs: durationMs,
    lastUpdated: Date.now(),
  };
}

// Save state to localStorage and broadcast to other open tabs/OBS windows
export function saveCountdownState(state: CountdownState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    // Broadcast to other windows
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channel.postMessage({ type: 'COUNTDOWN_UPDATED', state });
      channel.close();
    }
  } catch {
    // Ignore storage write errors
  }
}

// Calculate remaining ms in real-time based on wall clock
export function calculateRemainingMs(state: CountdownState): number {
  if (!state.isRunning) {
    return Math.max(0, state.remainingWhenPausedMs);
  }
  const diff = state.targetTimestamp - Date.now();
  return Math.max(0, diff);
}

// Web Worker based background interval that resists browser tab throttling
export function createBackgroundTicker(callback: () => void, intervalMs: number = 40): () => void {
  if (typeof Worker !== 'undefined') {
    try {
      const blobCode = `
        let timer = null;
        self.onmessage = function(e) {
          if (e.data === 'start') {
            timer = setInterval(() => self.postMessage('tick'), ${intervalMs});
          } else if (e.data === 'stop') {
            if (timer) clearInterval(timer);
          }
        };
      `;
      const blob = new Blob([blobCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      const worker = new Worker(workerUrl);
      
      worker.onmessage = () => {
        callback();
      };
      worker.postMessage('start');

      return () => {
        worker.postMessage('stop');
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
      };
    } catch {
      // Fallback to standard setInterval
    }
  }

  const interval = setInterval(callback, intervalMs);
  return () => clearInterval(interval);
}

// Start / Resume timer
export function resumeCountdown(state: CountdownState): CountdownState {
  const remaining = state.remainingWhenPausedMs > 0 ? state.remainingWhenPausedMs : state.durationMs;
  const newState: CountdownState = {
    ...state,
    targetTimestamp: Date.now() + remaining,
    isRunning: true,
    remainingWhenPausedMs: remaining,
    lastUpdated: Date.now(),
  };
  saveCountdownState(newState);
  return newState;
}

// Pause timer
export function pauseCountdown(state: CountdownState): CountdownState {
  const remaining = calculateRemainingMs(state);
  const newState: CountdownState = {
    ...state,
    isRunning: false,
    remainingWhenPausedMs: remaining,
    lastUpdated: Date.now(),
  };
  saveCountdownState(newState);
  return newState;
}

// Reset timer to a new duration
export function resetCountdown(durationSeconds: number): CountdownState {
  const durationMs = durationSeconds * 1000;
  const newState: CountdownState = {
    targetTimestamp: Date.now() + durationMs,
    durationMs,
    isRunning: true,
    remainingWhenPausedMs: durationMs,
    lastUpdated: Date.now(),
  };
  saveCountdownState(newState);
  return newState;
}

// Add or subtract seconds to the ongoing countdown
export function adjustCountdown(deltaSeconds: number, currentState: CountdownState): CountdownState {
  const deltaMs = deltaSeconds * 1000;
  if (!currentState.isRunning) {
    const newRemaining = Math.max(0, currentState.remainingWhenPausedMs + deltaMs);
    const newState: CountdownState = {
      ...currentState,
      durationMs: Math.max(currentState.durationMs, newRemaining),
      remainingWhenPausedMs: newRemaining,
      lastUpdated: Date.now(),
    };
    saveCountdownState(newState);
    return newState;
  }

  const currentRemaining = calculateRemainingMs(currentState);
  const newRemaining = Math.max(0, currentRemaining + deltaMs);
  const newState: CountdownState = {
    ...currentState,
    targetTimestamp: Date.now() + newRemaining,
    durationMs: Math.max(currentState.durationMs, newRemaining),
    lastUpdated: Date.now(),
  };
  saveCountdownState(newState);
  return newState;
}

// Set target to an exact target time string (e.g. "19:30" or "07:30 PM")
export function setCountdownToClockTime(targetHours: number, targetMinutes: number): CountdownState {
  const now = new Date();
  const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), targetHours, targetMinutes, 0, 0);
  
  // If target time is earlier today, assume it's for tomorrow
  if (targetDate.getTime() <= now.getTime()) {
    targetDate.setDate(targetDate.getDate() + 1);
  }

  const durationMs = targetDate.getTime() - now.getTime();
  const newState: CountdownState = {
    targetTimestamp: targetDate.getTime(),
    durationMs,
    isRunning: true,
    remainingWhenPausedMs: durationMs,
    lastUpdated: Date.now(),
  };
  saveCountdownState(newState);
  return newState;
}

// Listen for updates from other tabs / windows
export function subscribeToCountdownUpdates(onUpdate: (state: CountdownState) => void): () => void {
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const parsed: CountdownState = JSON.parse(e.newValue);
        onUpdate(parsed);
      } catch {
        // Ignore
      }
    }
  };

  window.addEventListener('storage', handleStorage);

  let channel: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    channel.onmessage = (event) => {
      if (event.data?.type === 'COUNTDOWN_UPDATED' && event.data.state) {
        onUpdate(event.data.state);
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
