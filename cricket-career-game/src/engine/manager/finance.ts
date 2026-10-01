/**
 * The money: reports and forecasts from the ledger, and the season's income.
 * Every entry is booked once by id (`util.book`), so nothing is paid twice.
 */
import type { LedgerEntry, ManagerState } from '@/types/manager';
import { MANAGER } from './config';
import { staffCost } from './staff';
import { book, holds, produce } from './util';
import type { ActionResult } from './scouting';

export interface FinanceReport {
  season: number;
  income: number;
  spending: number;
  profit: number;
  byKind: Record<LedgerEntry['kind'], number>;
}

export function financeReport(state: ManagerState, season = state.season.year): FinanceReport {
  const entries = state.finances.ledger.filter((e) => e.season === season);
  const byKind = {} as Record<LedgerEntry['kind'], number>;
  for (const e of entries) byKind[e.kind] = (byKind[e.kind] ?? 0) + e.amount;
  const income = entries.filter((e) => e.amount > 0).reduce((n, e) => n + e.amount, 0);
  const spending = entries.filter((e) => e.amount < 0).reduce((n, e) => n - e.amount, 0);
  return { season, income, spending, profit: income - spending, byKind };
}

/** Where the season is heading if nothing changes. */
export function forecast(state: ManagerState): { income: number; spending: number; profit: number; endBalance: number } {
  const f = state.franchises[state.franchiseId];
  const report = financeReport(state);
  const booked = (kind: LedgerEntry['kind']) => state.finances.ledger.some((e) => e.season === state.season.year && e.kind === kind && e.id.includes('season'));
  const sponsorship = booked('SPONSORSHIP') ? 0 : sponsorshipFor(state);
  const media = booked('MEDIA') ? 0 : MANAGER.finance.mediaShare;
  const homeLeft = state.season.fixtures.filter((x) => !x.result && x.homeId === f.id).length || (state.season.fixtures.length === 0 ? 7 : 0);
  const gates = homeLeft * MANAGER.finance.gatePerHomeMatch;
  const wagesBooked = state.finances.ledger.some((e) => e.id === `wages-${state.season.year}`);
  const payroll = wagesBooked ? 0 : f.squadIds.reduce((n, id) => n + (state.players[id]?.contract?.salary ?? 0), 0) + staffCost(state);
  const income = report.income + sponsorship + media + gates;
  const spending = report.spending + payroll;
  return { income, spending, profit: income - spending, endBalance: state.finances.balance + sponsorship + media + gates - payroll };
}

export function sponsorshipFor(state: ManagerState): number {
  const f = state.franchises[state.franchiseId];
  return Math.round(MANAGER.finance.sponsorshipBase + f.brand * MANAGER.finance.sponsorshipPerBrand);
}

/** Sponsorship lands at the start of the league; the central media share at the end. */
export function bookSponsorship(draft: ManagerState): void {
  book(draft, { id: `sponsorship-season-${draft.season.year}`, kind: 'SPONSORSHIP', amount: sponsorshipFor(draft), note: `Sponsorship, ${draft.season.year}` });
}

export function bookMediaShare(draft: ManagerState): void {
  book(draft, { id: `media-season-${draft.season.year}`, kind: 'MEDIA', amount: MANAGER.finance.mediaShare, note: `Central media rights share, ${draft.season.year}` });
}

/** Move money between the scouting, development and staff budgets (Director of Cricket). */
export function setBudgets(state: ManagerState, budgets: ManagerState['finances']['budgets']): ActionResult {
  if (!holds(state, 'FINANCE')) return { ok: false, state, error: 'Budgets are set by the Director of Cricket.' };
  const total = budgets.scouting + budgets.development + budgets.staff;
  const current = state.finances.budgets.scouting + state.finances.budgets.development + state.finances.budgets.staff;
  if (Object.values(budgets).some((v) => v < 0)) return { ok: false, state, error: 'Budgets cannot be negative.' };
  if (total > current) return { ok: false, state, error: 'The board will not increase the total - move money between budgets instead.' };
  if (budgets.staff < staffCost(state)) return { ok: false, state, error: 'The staff budget must cover the current staff.' };
  return { ok: true, state: produce(state, (d) => void (d.finances.budgets = { ...budgets })) };
}
