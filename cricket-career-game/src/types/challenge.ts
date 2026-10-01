import type { Id } from './primitives';

/**
 * Daily and weekly challenges (`engine/career/challenges.ts`). Days are the
 * player's real local dates (yyyy-mm-dd), not the game calendar.
 */
export type ChallengeEvent =
  | {
      kind: 'MATCH';
      day: string;
      matchId: Id;
      runs: number;
      balls: number;
      fours: number;
      sixes: number;
      wickets: number;
      batted: boolean;
      out: boolean;
      won: boolean;
    }
  | { kind: 'TRAINING'; day: string; reportId: Id };

export interface ChallengeState {
  /** What happened, newest last; trimmed to the last ten days. */
  log: ChallengeEvent[];
  /** Ids of challenges already claimed ("d:2026-10-01:d-4s"); each pays once. */
  claimed: string[];
  /** All XP ever earned from challenges. */
  xpEarned: number;
}
