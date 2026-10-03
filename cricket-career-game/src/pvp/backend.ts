/**
 * The Live PvP client talks to an authority through this interface. Two
 * implementations exist and the UI always says which one is in use:
 *
 * - `OfflineBackend` - an OFFLINE DEMO: practice matches against the AI and a
 *   local collection, run by the same authoritative engine in the browser.
 *   It is never presented as online play, and ranked rating never moves.
 * - `OnlineBackend` - a real server over WebSocket (`server/pvp-server.ts`):
 *   accounts, matchmaking, private rooms, friends, ranked, server-validated
 *   economy.
 */
import type { MatchAction, MatchEvent, MatchMode } from '@/engine/pvp/match';
import type { OpData, RequestArgs, RequestOp } from '@/engine/pvp/protocol';
import type { PvpProfile } from '@/engine/pvp/types';

export type BackendMode = 'OFFLINE_DEMO' | 'ONLINE';

export type BackendEvent =
  | { type: 'profile'; profile: PvpProfile }
  | { type: 'events'; matchId: string; events: MatchEvent[] }
  | { type: 'matchFound'; matchId: string; mode: MatchMode; opponent: string; side: 0 | 1 }
  | { type: 'queue'; searching: boolean }
  | { type: 'invite'; from: string; fromName: string; code: string }
  | { type: 'connection'; status: 'connecting' | 'online' | 'offline' | 'error'; message?: string };

export type CallResult = { ok: true; data: OpData } | { ok: false; code: string; message: string };

export interface PvpBackend {
  readonly mode: BackendMode;
  readonly label: string;
  /** Development gems allowed (offline demo always; online only if the server enables it). */
  readonly devGems: boolean;
  connect(): Promise<PvpProfile>;
  call(op: RequestOp, args?: RequestArgs): Promise<CallResult>;
  sendAction(matchId: string, action: MatchAction): Promise<CallResult>;
  /** The authority's clock, ms - event times are on this clock. */
  serverNow(): number;
  on(listener: (event: BackendEvent) => void): () => void;
  dispose(): void;
}

export function newRequestId(prefix: string): string {
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${rand}`.replace(/[^A-Za-z0-9:_-]/g, '').slice(0, 80);
}

export class Emitter {
  private listeners = new Set<(e: BackendEvent) => void>();
  on(l: (e: BackendEvent) => void): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
  emit(e: BackendEvent): void {
    for (const l of this.listeners) l(e);
  }
  clear(): void {
    this.listeners.clear();
  }
}
