import { StreamAlert, ChatMessage } from '../types';

export interface IntegrationConfig {
  twitchChannel: string;
  streamlabsSocketToken: string;
  streamelementsJwt: string;
  enableTwitchChat: boolean;
  enableStreamlabs: boolean;
  enableStreamElements: boolean;
}

const STORAGE_KEY = 'yorha_live_integration_config';

export function getSavedIntegrations(): IntegrationConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return {
    twitchChannel: '',
    streamlabsSocketToken: '',
    streamelementsJwt: '',
    enableTwitchChat: true,
    enableStreamlabs: false,
    enableStreamElements: false,
  };
}

export function saveIntegrations(cfg: IntegrationConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {}
}

export class LiveAlertsManager {
  private static instance: LiveAlertsManager | null = null;
  private twitchWs: WebSocket | null = null;
  private streamlabsWs: WebSocket | null = null;
  private streamelementsWs: WebSocket | null = null;
  private alertListeners: ((alert: StreamAlert) => void)[] = [];
  private chatListeners: ((msg: ChatMessage) => void)[] = [];
  private statusListeners: ((status: { twitch: boolean; streamlabs: boolean; streamelements: boolean }) => void)[] = [];
  private connectionStatus = { twitch: false, streamlabs: false, streamelements: false };

  public static getInstance(): LiveAlertsManager {
    if (!this.instance) {
      this.instance = new LiveAlertsManager();
    }
    return this.instance;
  }

  public onAlert(cb: (alert: StreamAlert) => void): () => void {
    this.alertListeners.push(cb);
    return () => {
      this.alertListeners = this.alertListeners.filter((l) => l !== cb);
    };
  }

  public onChatMessage(cb: (msg: ChatMessage) => void): () => void {
    this.chatListeners.push(cb);
    return () => {
      this.chatListeners = this.chatListeners.filter((l) => l !== cb);
    };
  }

  public onStatusChange(cb: (status: { twitch: boolean; streamlabs: boolean; streamelements: boolean }) => void): () => void {
    this.statusListeners.push(cb);
    cb(this.connectionStatus);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== cb);
    };
  }

  private notifyStatus() {
    this.statusListeners.forEach((cb) => cb({ ...this.connectionStatus }));
  }

  private dispatchAlert(alert: StreamAlert) {
    this.alertListeners.forEach((cb) => cb(alert));
  }

  private dispatchChat(msg: ChatMessage) {
    this.chatListeners.forEach((cb) => cb(msg));
  }

  // Connect to Twitch IRC for real-time live chat & raid/sub notices (No OAuth required for reading public chat!)
  public connectTwitch(channelName: string) {
    if (this.twitchWs) {
      try {
        this.twitchWs.close();
      } catch {}
      this.twitchWs = null;
    }

    const cleanChannel = channelName.trim().toLowerCase().replace(/^#/, '');
    if (!cleanChannel) {
      this.connectionStatus.twitch = false;
      this.notifyStatus();
      return;
    }

    try {
      const ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
      this.twitchWs = ws;

      ws.onopen = () => {
        // Anonymous read-only connection
        const anonNick = `justinfan${Math.floor(Math.random() * 80000 + 10000)}`;
        ws.send(`CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership`);
        ws.send(`NICK ${anonNick}`);
        ws.send(`JOIN #${cleanChannel}`);
        this.connectionStatus.twitch = true;
        this.notifyStatus();
      };

      ws.onmessage = (event) => {
        const lines = (event.data as string).split('\r\n');
        for (const line of lines) {
          if (!line) continue;

          // Respond to keepalive PING
          if (line.startsWith('PING')) {
            ws.send('PONG :tmi.twitch.tv');
            continue;
          }

          // Parse PRIVMSG (Chat message)
          if (line.includes('PRIVMSG')) {
            const match = line.match(/^@([^ ]+) :([^!]+)![^ ]+ PRIVMSG #[^ ]+ :(.+)$/);
            if (match) {
              const tagsStr = match[1];
              const rawUser = match[2];
              const text = match[3];

              // Parse badges / displayName
              let displayName = rawUser;
              let role: 'mod' | 'sub' | 'vip' | 'viewer' = 'viewer';

              if (tagsStr.includes('badges=')) {
                if (tagsStr.includes('broadcaster/') || tagsStr.includes('moderator/')) {
                  role = 'mod';
                } else if (tagsStr.includes('vip/')) {
                  role = 'vip';
                } else if (tagsStr.includes('subscriber/')) {
                  role = 'sub';
                }
              }

              const dispMatch = tagsStr.match(/display-name=([^;]+)/);
              if (dispMatch && dispMatch[1]) {
                displayName = dispMatch[1];
              }

              this.dispatchChat({
                id: `twitch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                user: displayName,
                message: text,
                role,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              });
            }
          }

          // Parse USERNOTICE (Subscribers, Resubs, Raids, Rituals)
          if (line.includes('USERNOTICE')) {
            // Subscription / Resub
            if (line.includes('msg-id=sub') || line.includes('msg-id=resub') || line.includes('msg-id=subgift')) {
              const userMatch = line.match(/display-name=([^;]+)/) || line.match(/login=([^;]+)/);
              const tierMatch = line.match(/msg-param-sub-plan=([^;]+)/);
              const name = userMatch ? userMatch[1] : 'Android Ally';
              let tier = 'Tier 1';
              if (tierMatch) {
                if (tierMatch[1] === '2000') tier = 'Tier 2';
                if (tierMatch[1] === '3000') tier = 'Tier 3';
                if (tierMatch[1] === 'Prime') tier = 'Prime';
              }

              this.dispatchAlert({
                id: `alert-sub-${Date.now()}`,
                type: 'subscriber',
                username: name,
                tier,
                timestamp: Date.now(),
              });
            }

            // Raid
            if (line.includes('msg-id=raid')) {
              const userMatch = line.match(/msg-param-displayName=([^;]+)/) || line.match(/msg-param-login=([^;]+)/);
              const countMatch = line.match(/msg-param-viewerCount=([^;]+)/);
              const name = userMatch ? userMatch[1] : 'Incoming Fleet';
              const count = countMatch ? `${countMatch[1]} viewers` : 'Squadron';

              this.dispatchAlert({
                id: `alert-raid-${Date.now()}`,
                type: 'raid',
                username: name,
                amount: count,
                timestamp: Date.now(),
              });
            }
          }
        }
      };

      ws.onerror = () => {
        this.connectionStatus.twitch = false;
        this.notifyStatus();
      };

      ws.onclose = () => {
        this.connectionStatus.twitch = false;
        this.notifyStatus();
      };
    } catch {
      this.connectionStatus.twitch = false;
      this.notifyStatus();
    }
  }

  // Connect to Streamlabs Websocket for Live Followers, Tips/Donations, Subs, Bits
  public connectStreamlabs(socketToken: string) {
    if (this.streamlabsWs) {
      try {
        this.streamlabsWs.close();
      } catch {}
      this.streamlabsWs = null;
    }

    const token = socketToken.trim();
    if (!token) {
      this.connectionStatus.streamlabs = false;
      this.notifyStatus();
      return;
    }

    try {
      // Connect to Streamlabs socket.io API endpoint
      const wsUrl = `wss://sockets.streamlabs.com/socket.io/?token=${encodeURIComponent(token)}&EIO=3&transport=websocket`;
      const ws = new WebSocket(wsUrl);
      this.streamlabsWs = ws;

      ws.onopen = () => {
        this.connectionStatus.streamlabs = true;
        this.notifyStatus();
      };

      ws.onmessage = (event) => {
        const dataStr = event.data as string;
        // socket.io packet ping
        if (dataStr === '2') {
          ws.send('3'); // pong
          return;
        }

        // socket.io event payload begins with '42'
        if (dataStr.startsWith('42')) {
          try {
            const parsed = JSON.parse(dataStr.substring(2));
            const eventName = parsed[0];
            const eventPayload = parsed[1];

            if (eventName === 'event' && eventPayload?.type) {
              const type = eventPayload.type; // follow, subscription, donation, raid, cheer
              const message = eventPayload.message?.[0] || {};
              const name = message.name || message.from || 'YoRHa Unit';

              if (type === 'follow') {
                this.dispatchAlert({
                  id: `sl-follow-${Date.now()}`,
                  type: 'follower',
                  username: name,
                  timestamp: Date.now(),
                });
              } else if (type === 'subscription') {
                this.dispatchAlert({
                  id: `sl-sub-${Date.now()}`,
                  type: 'subscriber',
                  username: name,
                  tier: message.tier || 'Tier 1',
                  timestamp: Date.now(),
                });
              } else if (type === 'donation') {
                this.dispatchAlert({
                  id: `sl-don-${Date.now()}`,
                  type: 'donation',
                  username: name,
                  amount: message.formatted_amount || `$${message.amount}`,
                  message: message.message,
                  timestamp: Date.now(),
                });
              } else if (type === 'bits' || type === 'cheer') {
                this.dispatchAlert({
                  id: `sl-bits-${Date.now()}`,
                  type: 'cheer',
                  username: name,
                  amount: `${message.amount} Bits`,
                  message: message.message,
                  timestamp: Date.now(),
                });
              } else if (type === 'raid') {
                this.dispatchAlert({
                  id: `sl-raid-${Date.now()}`,
                  type: 'raid',
                  username: name,
                  amount: `${message.raiders || message.amount || ''} units`,
                  timestamp: Date.now(),
                });
              }
            }
          } catch {}
        }
      };

      ws.onerror = () => {
        this.connectionStatus.streamlabs = false;
        this.notifyStatus();
      };

      ws.onclose = () => {
        this.connectionStatus.streamlabs = false;
        this.notifyStatus();
      };
    } catch {
      this.connectionStatus.streamlabs = false;
      this.notifyStatus();
    }
  }

  // Connect to StreamElements Websocket for Live Followers, Tips, Subs
  public connectStreamElements(jwtToken: string) {
    if (this.streamelementsWs) {
      try {
        this.streamelementsWs.close();
      } catch {}
      this.streamelementsWs = null;
    }

    const token = jwtToken.trim();
    if (!token) {
      this.connectionStatus.streamelements = false;
      this.notifyStatus();
      return;
    }

    try {
      const ws = new WebSocket('wss://realtime.streamelements.com/socket.io/?cluster=main&EIO=3&transport=websocket');
      this.streamelementsWs = ws;

      ws.onopen = () => {
        // Authenticate with StreamElements token
        ws.send(`42["authenticate",{"method":"jwt","token":"${token}"}]`);
        this.connectionStatus.streamelements = true;
        this.notifyStatus();
      };

      ws.onmessage = (event) => {
        const dataStr = event.data as string;
        if (dataStr === '2') {
          ws.send('3');
          return;
        }

        if (dataStr.startsWith('42')) {
          try {
            const parsed = JSON.parse(dataStr.substring(2));
            const eventName = parsed[0];
            const eventData = parsed[1];

            if (eventName === 'event') {
              const type = eventData?.type;
              const data = eventData?.data || {};
              const name = data.username || data.displayName || 'Allied Android';

              if (type === 'follow') {
                this.dispatchAlert({
                  id: `se-follow-${Date.now()}`,
                  type: 'follower',
                  username: name,
                  timestamp: Date.now(),
                });
              } else if (type === 'subscriber') {
                this.dispatchAlert({
                  id: `se-sub-${Date.now()}`,
                  type: 'subscriber',
                  username: name,
                  tier: data.tier ? `Tier ${data.tier}` : 'Tier 1',
                  timestamp: Date.now(),
                });
              } else if (type === 'tip') {
                this.dispatchAlert({
                  id: `se-tip-${Date.now()}`,
                  type: 'donation',
                  username: name,
                  amount: data.amount ? `$${data.amount}` : '$5.00',
                  message: data.message,
                  timestamp: Date.now(),
                });
              } else if (type === 'cheer') {
                this.dispatchAlert({
                  id: `se-cheer-${Date.now()}`,
                  type: 'cheer',
                  username: name,
                  amount: `${data.amount} Bits`,
                  message: data.message,
                  timestamp: Date.now(),
                });
              } else if (type === 'raid') {
                this.dispatchAlert({
                  id: `se-raid-${Date.now()}`,
                  type: 'raid',
                  username: name,
                  amount: `${data.amount || 'Squad'} units`,
                  timestamp: Date.now(),
                });
              }
            }
          } catch {}
        }
      };

      ws.onerror = () => {
        this.connectionStatus.streamelements = false;
        this.notifyStatus();
      };

      ws.onclose = () => {
        this.connectionStatus.streamelements = false;
        this.notifyStatus();
      };
    } catch {
      this.connectionStatus.streamelements = false;
      this.notifyStatus();
    }
  }

  // Initialize all configured services
  public initFromConfig(cfg: IntegrationConfig) {
    if (cfg.twitchChannel && cfg.enableTwitchChat) {
      this.connectTwitch(cfg.twitchChannel);
    }
    if (cfg.streamlabsSocketToken && cfg.enableStreamlabs) {
      this.connectStreamlabs(cfg.streamlabsSocketToken);
    }
    if (cfg.streamelementsJwt && cfg.enableStreamElements) {
      this.connectStreamElements(cfg.streamelementsJwt);
    }
  }
}
