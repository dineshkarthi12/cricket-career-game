/**
 * The Live PvP wire protocol (JSON over WebSocket). Shared by the browser
 * client and the Node server so both sides agree on every message.
 */
import type { MatchAction, MatchEvent, MatchMode } from './match';
import type { PvpProfile, SquadSelection, Transaction } from './types';

export const PROTOCOL_VERSION = 1;

export type EconomyOp = 'claimStarter' | 'openPack' | 'buyCard' | 'claimDaily' | 'claimWeekly' | 'upgrade' | 'devGems';

export type RequestOp =
  | EconomyOp
  | 'profile'
  | 'saveSquad'
  | 'rename'
  | 'practice'
  | 'queue.join'
  | 'queue.leave'
  | 'room.create'
  | 'room.join'
  | 'room.leave'
  | 'friends.list'
  | 'friends.add'
  | 'friends.invite'
  | 'leaderboard'
  | 'match.action'
  | 'match.resume';

export interface RequestArgs {
  requestId?: string;
  packId?: string;
  cardId?: string;
  instanceId?: string;
  squad?: SquadSelection;
  name?: string;
  code?: string;
  friendCode?: string;
  userId?: string;
  matchId?: string;
  action?: MatchAction;
  /** For match.resume: the last event seq the client has. */
  sinceSeq?: number;
}

export type ClientMessage =
  | { t: 'auth'; token: string; v: number }
  | { t: 'register'; name: string; v: number }
  | { t: 'req'; id: string; op: RequestOp; args?: RequestArgs }
  | { t: 'ping'; at: number };

export interface FriendView {
  userId: string;
  displayName: string;
  friendCode: string;
  online: boolean;
  rating: number | null;
}

export interface LeaderRow {
  rank: number;
  userId: string;
  displayName: string;
  rating: number;
  tier: string;
  won: number;
  played: number;
}

export interface OpData {
  profile?: PvpProfile;
  txn?: Transaction;
  replayed?: boolean;
  code?: string;
  matchId?: string;
  friends?: FriendView[];
  leaderboard?: LeaderRow[];
  events?: MatchEvent[];
  queued?: boolean;
}

export type ServerMessage =
  | { t: 'welcome'; userId: string; token: string; profile: PvpProfile; serverTime: number; devGems: boolean; v: number }
  | { t: 'res'; id: string; ok: true; data: OpData }
  | { t: 'res'; id: string; ok: false; error: { code: string; message: string } }
  | { t: 'events'; matchId: string; events: MatchEvent[]; serverTime: number }
  | { t: 'matchFound'; matchId: string; mode: MatchMode; opponent: string; side: 0 | 1 }
  | { t: 'profile'; profile: PvpProfile }
  | { t: 'invite'; from: string; fromName: string; code: string }
  | { t: 'queue'; searching: boolean }
  | { t: 'pong'; at: number; serverTime: number }
  | { t: 'error'; code: string; message: string };
