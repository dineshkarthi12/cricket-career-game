/**
 * Ranked rating and matchmaking. Pure, so the server's queue logic is tested
 * here without sockets.
 */
import { CATALOG_BY_ID } from './catalog';
import { MATCHMAKING, RANKED } from './config';
import { effectiveOverall } from './rules';

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
  /** The XI's strength (`squadStrength`), computed by the authority from the owned cards. */
  squad?: number;
  /** Matches played, for keeping newcomers apart from veterans. */
  played?: number;
  /** Measured round-trip time to the server, ms. */
  rttMs?: number | null;
}

/**
 * How strong an XI is: mostly its average overall, a little its best three.
 * Never the single highest card, so one premium star does not decide the pairing.
 */
export function squadStrength(xi: { cardId: string; upgrades: number }[]): number {
  const values = xi
    .map((e) => CATALOG_BY_ID[e.cardId])
    .map((card, i) => (card ? effectiveOverall(card, xi[i].upgrades) : 0))
    .sort((a, b) => b - a);
  if (!values.length) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const top = values.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(3, values.length);
  const w = MATCHMAKING.strength;
  return Math.round((avg * w.averageWeight + top * w.topThreeWeight) * 10) / 10;
}

/**
 * The cost of pairing two waiting players, or null if they must not be paired
 * yet. Lower is better. Rating and squad gaps are measured against windows
 * that widen while either player waits; experience and connection add cost.
 */
export function matchCost(a: QueueEntry, b: QueueEntry, nowMs: number): number | null {
  const waitA = nowMs - a.joinedAt;
  const waitB = nowMs - b.joinedAt;
  const ratingGap = Math.abs(a.rating - b.rating);
  const ratingWindow = Math.min(MatchQueue.window(waitA), MatchQueue.window(waitB));
  if (ratingGap > ratingWindow) return null;
  let cost = ratingGap / Math.max(1, ratingWindow);
  if (a.squad !== undefined && b.squad !== undefined) {
    const squadGap = Math.abs(a.squad - b.squad);
    const squadWindow = Math.min(squadWindowFor(waitA), squadWindowFor(waitB));
    if (squadGap > squadWindow) return null;
    cost += squadGap / Math.max(1, squadWindow);
  }
  const e = MATCHMAKING.experience;
  const newA = (a.played ?? 0) < e.newcomerBelow;
  const newB = (b.played ?? 0) < e.newcomerBelow;
  const vetA = (a.played ?? 0) >= e.veteranFrom;
  const vetB = (b.played ?? 0) >= e.veteranFrom;
  if ((newA && vetB) || (newB && vetA)) cost += e.mismatchCost;
  const c = MATCHMAKING.connection;
  const rtt = (a.rttMs ?? c.unknownMs) + (b.rttMs ?? c.unknownMs);
  if (rtt > c.maxPairMs) return null;
  cost += (rtt / 100) * c.costPer100Ms;
  return cost;
}

/** Allowed squad-strength gap for someone who has waited `waitedMs`. */
export function squadWindowFor(waitedMs: number): number {
  const m = MATCHMAKING.squad;
  return Math.min(m.maxWindow, m.baseWindow + (waitedMs / 1000) * m.growPerSecond);
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

  /** Update a waiting player's measured connection (it is re-measured while they wait). */
  setRtt(userId: string, rttMs: number | null): void {
    const e = this.entries.get(userId);
    if (e) e.rttMs = rttMs;
  }

  /**
   * Pair everyone who can be paired now: longest-waiting first, each with the
   * lowest-cost player both of them would accept (`matchCost`: rating, squad
   * strength, experience and connection).
   */
  pair(nowMs: number): [QueueEntry, QueueEntry][] {
    const waiting = [...this.entries.values()].sort((x, y) => x.joinedAt - y.joinedAt);
    const taken = new Set<string>();
    const pairs: [QueueEntry, QueueEntry][] = [];
    for (const a of waiting) {
      if (taken.has(a.userId)) continue;
      let best: QueueEntry | null = null;
      let bestCost = Infinity;
      for (const b of waiting) {
        if (b.userId === a.userId || taken.has(b.userId)) continue;
        const cost = matchCost(a, b, nowMs);
        if (cost !== null && cost < bestCost) {
          best = b;
          bestCost = cost;
        }
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
