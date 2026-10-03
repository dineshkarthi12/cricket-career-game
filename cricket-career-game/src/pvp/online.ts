/**
 * ONLINE backend: a WebSocket connection to the PvP server.
 *
 * - Authenticates with a server-issued token kept in localStorage (a guest
 *   account; the server holds the profile).
 * - Every request has an id; economy requests also carry an idempotency
 *   `requestId`, so a request resent after a reconnect is applied once.
 * - Reconnects with backoff and resumes the live match from the last event
 *   it saw (`match.resume`), so no event is lost or applied twice.
 * - Keeps an estimate of the server clock for countdowns.
 */
import { PROTOCOL_VERSION, type ClientMessage, type RequestArgs, type RequestOp, type ServerMessage } from '@/engine/pvp/protocol';
import type { MatchAction } from '@/engine/pvp/match';
import type { PvpProfile } from '@/engine/pvp/types';
import { Emitter, type CallResult, type PvpBackend } from './backend';

const TOKEN_KEY = 'cc26-pvp-token';

interface Pending {
  msg: ClientMessage;
  resolve: (r: CallResult) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class OnlineBackend implements PvpBackend {
  readonly mode = 'ONLINE' as const;
  readonly label: string;
  devGems = false;
  private emitter = new Emitter();
  private ws: WebSocket | null = null;
  private url: string;
  private name: string;
  private pending = new Map<string, Pending>();
  private seq = 0;
  private offset = 0;
  private retries = 0;
  private closed = false;
  private ready: Promise<PvpProfile> | null = null;
  private resolveReady: ((p: PvpProfile) => void) | null = null;
  private rejectReady: ((e: Error) => void) | null = null;
  /** The live match and the last event seq received, for resume after a reconnect. */
  private live: { matchId: string; seq: number } | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(url: string, name = 'Player') {
    this.url = url;
    this.name = name;
    this.label = `Online · ${url.replace(/^wss?:\/\//, '')}`;
  }

  connect(): Promise<PvpProfile> {
    if (this.ready) return this.ready;
    this.ready = new Promise((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
    this.open();
    return this.ready;
  }

  private open(): void {
    if (this.closed) return;
    this.emitter.emit({ type: 'connection', status: 'connecting' });
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url);
    } catch (e) {
      this.fail(e instanceof Error ? e.message : 'Could not open a connection.');
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      const token = safeGet(TOKEN_KEY);
      this.raw(token ? { t: 'auth', token, v: PROTOCOL_VERSION } : { t: 'register', name: this.name, v: PROTOCOL_VERSION });
    };
    ws.onmessage = (ev) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(String(ev.data)) as ServerMessage;
      } catch {
        return;
      }
      this.handle(msg);
    };
    ws.onclose = () => {
      this.ws = null;
      if (this.pingTimer) clearInterval(this.pingTimer);
      if (this.closed) return;
      this.emitter.emit({ type: 'connection', status: 'offline', message: 'Connection lost - reconnecting…' });
      const delay = Math.min(15_000, 500 * 2 ** this.retries);
      this.retries += 1;
      if (this.retries > 6 && this.rejectReady) this.fail('The PvP server cannot be reached.');
      setTimeout(() => this.open(), delay);
    };
    ws.onerror = () => {
      /* onclose follows and handles the retry */
    };
  }

  private fail(message: string): void {
    this.emitter.emit({ type: 'connection', status: 'error', message });
    this.rejectReady?.(new Error(message));
    this.rejectReady = null;
  }

  private handle(msg: ServerMessage): void {
    switch (msg.t) {
      case 'welcome': {
        this.retries = 0;
        safeSet(TOKEN_KEY, msg.token);
        this.offset = msg.serverTime - Date.now();
        this.devGems = msg.devGems;
        this.emitter.emit({ type: 'connection', status: 'online' });
        this.emitter.emit({ type: 'profile', profile: msg.profile });
        this.resolveReady?.(msg.profile);
        this.resolveReady = null;
        this.rejectReady = null;
        // Resend anything that was in flight when the line dropped.
        for (const p of this.pending.values()) this.raw(p.msg);
        if (this.live) void this.call('match.resume', { matchId: this.live.matchId, sinceSeq: this.live.seq });
        this.pingTimer = setInterval(() => this.raw({ t: 'ping', at: Date.now() }), 15_000);
        break;
      }
      case 'res': {
        const p = this.pending.get(msg.id);
        if (!p) return;
        clearTimeout(p.timer);
        this.pending.delete(msg.id);
        if (msg.ok) {
          if (msg.data.profile) this.emitter.emit({ type: 'profile', profile: msg.data.profile });
          if (msg.data.events?.length && msg.data.matchId) this.onEvents(msg.data.matchId, msg.data.events);
          p.resolve({ ok: true, data: msg.data });
        } else p.resolve({ ok: false, code: msg.error.code, message: msg.error.message });
        break;
      }
      case 'events':
        this.offset = msg.serverTime - Date.now();
        this.onEvents(msg.matchId, msg.events);
        break;
      case 'matchFound':
        this.live = { matchId: msg.matchId, seq: 0 };
        this.emitter.emit({ type: 'matchFound', matchId: msg.matchId, mode: msg.mode, opponent: msg.opponent, side: msg.side });
        break;
      case 'profile':
        this.emitter.emit({ type: 'profile', profile: msg.profile });
        break;
      case 'invite':
        this.emitter.emit({ type: 'invite', from: msg.from, fromName: msg.fromName, code: msg.code });
        break;
      case 'queue':
        this.emitter.emit({ type: 'queue', searching: msg.searching });
        break;
      case 'pong':
        this.offset = msg.serverTime - Date.now();
        break;
      case 'error':
        if (msg.code === 'BAD_TOKEN') {
          // The server no longer knows this account: start a fresh guest.
          safeRemove(TOKEN_KEY);
          this.raw({ t: 'register', name: this.name, v: PROTOCOL_VERSION });
          return;
        }
        this.emitter.emit({ type: 'connection', status: 'error', message: msg.message });
        break;
    }
  }

  private onEvents(matchId: string, events: import('@/engine/pvp/match').MatchEvent[]): void {
    if (!this.live || this.live.matchId !== matchId) this.live = { matchId, seq: 0 };
    // Drop anything already seen: resume and live pushes can overlap.
    const fresh = events.filter((e) => e.seq > this.live!.seq);
    if (!fresh.length) return;
    this.live.seq = fresh[fresh.length - 1].seq;
    this.emitter.emit({ type: 'events', matchId, events: fresh });
  }

  private raw(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  call(op: RequestOp, args?: RequestArgs): Promise<CallResult> {
    this.seq += 1;
    const id = `r${this.seq}-${Date.now().toString(36)}`;
    const msg: ClientMessage = { t: 'req', id, op, args };
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({ ok: false, code: 'TIMEOUT', message: 'The server did not answer in time.' });
      }, 15_000);
      this.pending.set(id, { msg, resolve, timer });
      this.raw(msg);
    });
  }

  sendAction(matchId: string, action: MatchAction): Promise<CallResult> {
    return this.call('match.action', { matchId, action });
  }

  serverNow(): number {
    return Date.now() + this.offset;
  }

  on(listener: Parameters<Emitter['on']>[0]): () => void {
    return this.emitter.on(listener);
  }

  dispose(): void {
    this.closed = true;
    if (this.pingTimer) clearInterval(this.pingTimer);
    for (const p of this.pending.values()) clearTimeout(p.timer);
    this.pending.clear();
    this.ws?.close();
    this.emitter.clear();
  }
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* the token then lives only for this session */
  }
}
function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* nothing to remove */
  }
}
