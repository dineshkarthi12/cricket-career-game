/**
 * Ranked rating and matchmaking. Pure, so the server's queue logic is tested
 * here without sockets.
 */
import { RANKED } from './config';

/** Elo: the new ratings after a match. `score` is 1 for an A win, 0.5 tie, 0 loss. */
export function eloUpdate(a: number, b: number, score: 0 | 0.5 | 1): { a: number; b: number } {
  const expected = 1 / (1 + 10 ** ((b - a) / 400));
  const delta = Math.round(RANKED.kFactor * (score - expected));
  return { a: a + delta, b: b - delta };
}

export interface QueueEntry {
  userId: string;
  rating: number;
  joinedAt: number;
}

/**
 * The matchmaking queue. A player is in it at most once, and is taken out the
 * moment they are paired, so nobody can be assigned to two matches.
 */
export class MatchQueue {
  private entries = new Map<string, QueueEntry>();

  join(entry: QueueEntry): { ok: true } | { ok: false; code: string } {
    if (this.entries.has(entry.userId)) return { ok: false, code: 'ALREADY_QUEUED' };
    this.entries.set(entry.userId, entry);
    return { ok: true };
  }

  leave(userId: string): boolean {
    return this.entries.delete(userId);
  }

  has(userId: string): boolean {
    return this.entries.has(userId);
  }

  get size(): number {
    return this.entries.size;
  }

  /** Allowed rating gap for someone who has waited `waitedMs`. */
  static window(waitedMs: number): number {
    const m = RANKED.matchmaking;
    return Math.min(m.maxWindow, m.baseWindow + (waitedMs / 1000) * m.growPerSecond);
  }

  /**
   * Pair everyone who can be paired now: longest-waiting first, each with the
   * closest-rated player both of them would accept.
   */
  pair(nowMs: number): [QueueEntry, QueueEntry][] {
    const waiting = [...this.entries.values()].sort((x, y) => x.joinedAt - y.joinedAt);
    const taken = new Set<string>();
    const pairs: [QueueEntry, QueueEntry][] = [];
    for (const a of waiting) {
      if (taken.has(a.userId)) continue;
      let best: QueueEntry | null = null;
      for (const b of waiting) {
        if (b.userId === a.userId || taken.has(b.userId)) continue;
        const gap = Math.abs(a.rating - b.rating);
        if (gap > MatchQueue.window(nowMs - a.joinedAt) || gap > MatchQueue.window(nowMs - b.joinedAt)) continue;
        if (!best || gap < Math.abs(a.rating - best.rating)) best = b;
      }
      if (best) {
        taken.add(a.userId);
        taken.add(best.userId);
        pairs.push([a, best]);
      }
    }
    for (const id of taken) this.entries.delete(id);
    return pairs;
  }
}

/** Six-character private room codes without look-alike characters. */
export const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function isRoomCode(code: unknown): code is string {
  return typeof code === 'string' && code.length === 6 && [...code].every((c) => ROOM_ALPHABET.includes(c));
}
