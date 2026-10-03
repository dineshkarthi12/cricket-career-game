/** Saved and transmitted shapes for Live PvP. */
import type { AcquisitionMethod } from './catalog';

export interface OwnedCard {
  /** Unique per copy, assigned by the authority that granted it. */
  instanceId: string;
  cardId: string;
  /** Training levels; the effective rating is always computed, never stored. */
  upgrades: number;
  acquiredVia: AcquisitionMethod | 'REWARD';
  acquiredAt: string;
}

export interface SquadSelection {
  /** Instance ids in batting order. */
  xi: string[];
  bench: string[];
  captain: string;
  viceCaptain: string;
}

export type TxnKind =
  | 'STARTER'
  | 'PACK'
  | 'MARKET'
  | 'DAILY'
  | 'WEEKLY'
  | 'MATCH_REWARD'
  | 'UPGRADE'
  | 'DEV_GEMS'
  | 'MIGRATION';

export interface Transaction {
  id: string;
  /** The client's idempotency key: the same request never applies twice. */
  requestId: string;
  at: string;
  kind: TxnKind;
  coins: number;
  gems: number;
  eventTokens: number;
  /** Card ids granted (duplicates included, before conversion). */
  cards: string[];
  /** Card ids that were already owned and became coins. */
  duplicates: string[];
  note: string;
}

export interface MatchSummary {
  matchId: string;
  at: string;
  mode: 'RANKED' | 'PRIVATE' | 'PRACTICE';
  opponent: string;
  /** "Won by 12 runs", "Lost by 2 wickets". */
  result: string;
  outcome: 'WIN' | 'LOSS' | 'TIE';
  myScore: string;
  theirScore: string;
  ratingChange: number | null;
}

export interface PvpProfile {
  /** 2 since the Phase 14 rating tiers; `migrateProfile` upgrades version 1. */
  schema: 1 | 2;
  userId: string;
  displayName: string;
  /** Short code friends type to add each other. */
  friendCode: string;
  createdAt: string;
  coins: number;
  gems: number;
  eventTokens: number;
  inventory: OwnedCard[];
  squad: SquadSelection | null;
  ledger: Transaction[];
  /** requestId -> transaction id, for idempotency. */
  requests: Record<string, string>;
  starterClaimed: boolean;
  daily: { lastClaim: string | null };
  weekly: { week: string; wins: number; claimed: boolean };
  stats: { played: number; won: number; lost: number; tied: number };
  /** Ranked rating; null when this profile has never played a server match. */
  rankedRating: number | null;
  history: MatchSummary[];
  /** Instance counter so granted copies get unique ids. */
  nextInstance: number;
}
