/**
 * Small shared pieces for the manager engine: atomic updates, seeded random
 * streams per action, news, and once-only transactions.
 */
import { createRng, deriveSeed, type Rng } from '../match/rng';
import type { LedgerEntry, ManagerNews, ManagerState, Responsibility } from '@/types/manager';
import { MANAGER } from './config';

export function saltOf(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** A random stream for one named action: replaying the same action gives the same numbers. */
export function rngFor(state: Pick<ManagerState, 'seed'>, key: string): Rng {
  return createRng(deriveSeed(state.seed, saltOf(key)));
}

/**
 * Apply a change to a copy of the state. The original is never touched, so a
 * change that throws half way leaves nothing half-done: updates are atomic.
 */
export function produce(state: ManagerState, fn: (draft: ManagerState) => void): ManagerState {
  const draft = structuredClone(state);
  fn(draft);
  return draft;
}

/** Week stamp used for reports and the ledger: comparable across seasons. */
export function weekStamp(state: ManagerState): number {
  return state.season.year * 100 + phaseIndex(state) * 10 + state.season.week;
}

function phaseIndex(state: ManagerState): number {
  return ['SCOUTING', 'TRIALS', 'RETENTION', 'AUCTION_PREP', 'AUCTION', 'PRESEASON', 'LEAGUE', 'PLAYOFFS', 'SEASON_END'].indexOf(state.season.phase);
}

export function addNews(draft: ManagerState, news: Omit<ManagerNews, 'id' | 'season' | 'week' | 'read'>): void {
  const id = `news-${draft.season.year}-${draft.news.length}-${saltOf(news.title + news.body).toString(36)}`;
  draft.news.unshift({ id, season: draft.season.year, week: weekStamp(draft), read: false, ...news });
  if (draft.news.length > 120) draft.news.length = 120;
}

/**
 * Has this one-off action already happened? Marks it if not. Bids, signings,
 * prize money and rewards all go through here so a double click, a replayed
 * event or a re-render can never apply one twice.
 */
export function once(draft: ManagerState, id: string): boolean {
  if (draft.applied.includes(id)) return false;
  draft.applied.push(id);
  if (draft.applied.length > 4000) draft.applied.splice(0, draft.applied.length - 4000);
  return true;
}

/** Book a transaction exactly once. Returns false if it was already booked. */
export function book(draft: ManagerState, entry: Omit<LedgerEntry, 'season' | 'week'>): boolean {
  if (draft.finances.ledger.some((e) => e.id === entry.id)) return false;
  draft.finances.ledger.push({ ...entry, season: draft.season.year, week: weekStamp(draft) });
  draft.finances.balance += entry.amount;
  return true;
}

/** Whether the manager's current rank carries a responsibility. */
export function holds(state: Pick<ManagerState, 'profile'>, responsibility: Responsibility): boolean {
  if (state.profile.unemployed || state.profile.retired) return false;
  if (state.profile.fullControl) return true;
  return (MANAGER.ranks.responsibilities[state.profile.rank] as readonly Responsibility[]).includes(responsibility);
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function userFranchise(state: ManagerState) {
  return state.franchises[state.franchiseId];
}

export function squadOf(state: ManagerState, franchiseId: string) {
  return (state.franchises[franchiseId]?.squadIds ?? []).map((id) => state.players[id]).filter(Boolean);
}
