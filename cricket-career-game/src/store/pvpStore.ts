/**
 * Live PvP state for the UI: which authority we talk to (offline demo or the
 * online server), the player's profile, the live match's events, queue and
 * room status. Separate from the career and IPL Manager stores and saves.
 */
import { create } from 'zustand';
import { auditProfile, type MatchAction, type MatchEvent, type MatchMode, type PvpProfile, type RuleIssue } from '@/engine/pvp';
import type { RequestArgs, RequestOp } from '@/engine/pvp/protocol';
import { newRequestId, type BackendMode, type CallResult, type PvpBackend } from '@/pvp/backend';
import { OfflineBackend } from '@/pvp/offline';
import { OnlineBackend } from '@/pvp/online';
import { useGameStore } from './gameStore';

const SERVER_KEY = 'cc26-pvp-server';

const toast = (tone: 'error' | 'info' | 'success', message: string) => useGameStore.getState().pushToast({ tone, message });

export function configuredServerUrl(): string | null {
  try {
    const saved = localStorage.getItem(SERVER_KEY);
    if (saved !== null) return saved || null;
  } catch {
    /* fall through to the build setting */
  }
  const env = (import.meta.env.VITE_PVP_SERVER_URL as string | undefined) ?? '';
  return env.trim() || null;
}

export interface LiveMatch {
  id: string;
  mode: MatchMode;
  mySide: 0 | 1;
  opponent: string;
  events: MatchEvent[];
}

interface PvpState {
  backend: PvpBackend | null;
  mode: BackendMode | null;
  label: string;
  status: 'idle' | 'connecting' | 'ready' | 'error';
  message: string | null;
  profile: PvpProfile | null;
  issues: RuleIssue[];
  match: LiveMatch | null;
  searching: boolean;
  room: string | null;
  invites: { from: string; fromName: string; code: string }[];
  serverUrl: string | null;
  init(): Promise<void>;
  /** Switch authority: a server URL for online play, or null for the offline demo. */
  useServer(url: string | null): Promise<void>;
  call(op: RequestOp, args?: RequestArgs): Promise<CallResult>;
  economy(op: RequestOp, args?: RequestArgs): Promise<CallResult>;
  startPractice(): Promise<string | null>;
  joinQueue(): Promise<void>;
  leaveQueue(): Promise<void>;
  createRoom(): Promise<void>;
  joinRoom(code: string): Promise<void>;
  sendAction(action: MatchAction): Promise<CallResult>;
  leaveMatch(): void;
  dismissInvite(code: string): void;
}

let unsubscribe: (() => void) | null = null;
let initialising: Promise<void> | null = null;

export const usePvpStore = create<PvpState>((set, get) => ({
  backend: null,
  mode: null,
  label: '',
  status: 'idle',
  message: null,
  profile: null,
  issues: [],
  match: null,
  searching: false,
  room: null,
  invites: [],
  serverUrl: null,

  init() {
    if (get().backend) return Promise.resolve();
    initialising ??= get().useServer(configuredServerUrl()).finally(() => (initialising = null));
    return initialising;
  },

  async useServer(url) {
    unsubscribe?.();
    get().backend?.dispose();
    const backend: PvpBackend = url ? new OnlineBackend(url, get().profile?.displayName ?? 'Player') : new OfflineBackend();
    try {
      localStorage.setItem(SERVER_KEY, url ?? '');
    } catch {
      /* the choice then lasts for this session */
    }
    set({ backend, mode: backend.mode, label: backend.label, status: 'connecting', message: null, serverUrl: url, match: null, searching: false, room: null });
    unsubscribe = backend.on((e) => {
      switch (e.type) {
        case 'profile':
          set({ profile: e.profile, issues: auditProfile(e.profile) });
          break;
        case 'events': {
          const m = get().match;
          // Only the match on screen takes events: a match the player has left
          // (a forfeit's final events, a late tick) must not reopen it.
          if (m && m.id === e.matchId) {
            const seen = new Set(m.events.map((x) => x.seq));
            set({ match: { ...m, events: [...m.events, ...e.events.filter((x) => !seen.has(x.seq))] } });
          }
          break;
        }
        case 'matchFound':
          set({ match: { id: e.matchId, mode: e.mode, mySide: e.side, opponent: e.opponent, events: [] }, searching: false, room: null });
          break;
        case 'queue':
          set({ searching: e.searching });
          break;
        case 'invite':
          set({ invites: [...get().invites.filter((i) => i.code !== e.code), { from: e.from, fromName: e.fromName, code: e.code }] });
          toast('info', `${e.fromName} invited you to a private match.`);
          break;
        case 'connection':
          if (e.status === 'online') set({ status: 'ready', message: null });
          else if (e.status === 'error') {
            set({ status: get().profile ? 'ready' : 'error', message: e.message ?? 'Connection error.' });
            if (e.message) toast('error', e.message);
          } else set({ message: e.message ?? null });
          break;
      }
    });
    try {
      const profile = await backend.connect();
      set({ profile, issues: auditProfile(profile), status: 'ready' });
    } catch (err) {
      set({ status: 'error', message: err instanceof Error ? err.message : 'Could not connect.' });
    }
  },

  async call(op, args) {
    const backend = get().backend;
    if (!backend) return { ok: false, code: 'NOT_READY', message: 'Not connected.' };
    const r = await backend.call(op, args);
    if (!r.ok && r.code !== 'NEEDS_SERVER') toast('error', r.message);
    return r;
  },

  /** Economy requests get a fresh idempotency key; the authority applies each key once. */
  economy(op, args = {}) {
    return get().call(op, { requestId: newRequestId(op), ...args });
  },

  async startPractice() {
    const r = await get().call('practice');
    if (!r.ok) return null;
    const id = r.data.matchId ?? null;
    if (id) {
      const existing = get().match;
      set({ match: { id, mode: 'PRACTICE', mySide: 0, opponent: get().mode === 'ONLINE' ? 'Server AI XI' : 'AI Practice XI', events: existing?.id === id ? existing.events : (r.data.events ?? []) } });
    }
    return id;
  },

  async joinQueue() {
    const r = await get().call('queue.join');
    if (r.ok) set({ searching: true });
  },

  async leaveQueue() {
    await get().call('queue.leave');
    set({ searching: false });
  },

  async createRoom() {
    const r = await get().call('room.create');
    if (r.ok) set({ room: r.data.code ?? null });
  },

  async joinRoom(code) {
    await get().call('room.join', { code: code.trim().toUpperCase() });
  },

  async sendAction(action) {
    const { backend, match } = get();
    if (!backend || !match) return { ok: false, code: 'NO_MATCH', message: 'No match.' };
    return backend.sendAction(match.id, action);
  },

  leaveMatch() {
    set({ match: null });
  },

  dismissInvite(code) {
    set({ invites: get().invites.filter((i) => i.code !== code) });
  },
}));
