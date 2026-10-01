/**
 * Contracts: renewals, releases and the end of a deal. One contract per
 * player, held by one franchise - a released player belongs to nobody until
 * he is signed again, so there is never a contradictory roster.
 */
import type { ManagerState, Negotiation } from '@/types/manager';
import { MANAGER } from './config';
import { isMegaAuction } from './auction';
import { marketValue } from './players';
import type { ActionResult } from './scouting';
import { addNews, book, clamp, holds, once, produce, rngFor } from './util';

const fail = (state: ManagerState, error: string): ActionResult => ({ ok: false, state, error });

/** Windows where squad changes may be made. */
export function contractsOpen(state: ManagerState): boolean {
  return ['SEASON_END', 'SCOUTING', 'TRIALS', 'RETENTION', 'AUCTION_PREP'].includes(state.season.phase);
}

/** Release a player. The rest of this season's salary is settled from the operating balance. */
export function releasePlayer(state: ManagerState, playerId: string): ActionResult {
  if (!holds(state, 'CONTRACTS')) return fail(state, 'Contract decisions are not part of your job yet.');
  if (!contractsOpen(state)) return fail(state, 'Players can only be released outside the auction and the season.');
  const p = state.players[playerId];
  if (!p?.contract || p.contract.franchiseId !== state.franchiseId) return fail(state, 'He is not under contract with you.');
  const squad = state.franchises[state.franchiseId].squadIds.length;
  if (squad <= 12 && state.season.phase === 'SEASON_END') return fail(state, 'Keep a core of players.');
  const settlement = Math.round(p.contract.salary * 0.5);
  if (state.finances.balance < settlement) return fail(state, 'Not enough money to settle his contract.');
  return {
    ok: true,
    state: produce(state, (d) => {
      if (!once(d, `release-${d.season.year}-${playerId}`)) return;
      const f = d.franchises[d.franchiseId];
      f.squadIds = f.squadIds.filter((id) => id !== playerId);
      // The salary comes off the books; at the next retention it frees purse.
      f.purse = Math.min(MANAGER.rules.purse, f.purse + (d.season.phase === 'AUCTION_PREP' ? d.players[playerId].contract!.salary : 0));
      d.players[playerId].contract = null;
      d.season.retentions = d.season.retentions.filter((id) => id !== playerId);
      book(d, { id: `release-fee-${d.season.year}-${playerId}`, kind: 'SALARY', amount: -settlement, note: `Contract settlement: ${p.name}` });
      addNews(d, { kind: 'CONTRACT', title: `${p.name} released`, body: `He goes back into the auction pool.`, route: '/manager/contracts' });
    }),
  };
}

/** What a player wants to stay, lakh a season. */
export function renewalAsking(state: ManagerState, playerId: string): number {
  const p = state.players[playerId];
  const value = marketValue(p);
  const happy = (p.condition.morale - 50) / 200;
  return Math.max(20, Math.round((value * (0.95 - happy)) / 5) * 5);
}

/** Players whose deals end this season. */
export function expiringContracts(state: ManagerState): string[] {
  return state.franchises[state.franchiseId].squadIds.filter((id) => (state.players[id]?.contract?.years ?? 0) <= 1);
}

/**
 * Offer a renewal. The player weighs the money against his market value, his
 * morale and other franchises' interest. In a mega-auction year everyone
 * goes back into the pool anyway, so renewals are not offered.
 */
export function offerRenewal(state: ManagerState, playerId: string, salary: number, years: number): ActionResult {
  if (!holds(state, 'CONTRACTS')) return fail(state, 'Contract decisions are not part of your job yet.');
  if (state.season.phase !== 'SEASON_END') return fail(state, 'Renewals are agreed at the end of the season.');
  if (isMegaAuction(state.season.year + 1)) return fail(state, 'Next season is a mega auction: every contract ends. Retain players in the retention window instead.');
  const p = state.players[playerId];
  if (!p?.contract || p.contract.franchiseId !== state.franchiseId) return fail(state, 'He is not your player.');
  if (p.contract.years > 1) return fail(state, 'His contract still has time to run.');
  if (years < 1 || years > 3) return fail(state, 'Offer one to three years.');
  if (salary < 20) return fail(state, 'Offer at least ₹20 L.');
  const asking = renewalAsking(state, playerId);
  const round = state.negotiations.filter((n) => n.playerId === playerId && n.kind === 'RENEWAL' && n.id.includes(`${state.season.year}`)).length;
  if (round >= 3) return fail(state, 'He has heard enough offers - he will test the auction.');
  const id = `neg-renew-${state.season.year}-${playerId}-${round}`;
  return {
    ok: true,
    state: produce(state, (d) => {
      if (!once(d, id)) return;
      const rng = rngFor(d, id);
      const ratio = salary / asking;
      const chance = clamp(0.2 + (ratio - 0.85) * 1.6 + (p.condition.morale - 50) / 200 + d.franchises[d.franchiseId].brand / 400, 0.03, 0.97);
      const n: Negotiation = { id, playerId, kind: 'RENEWAL', offeredSalary: salary, years, status: 'PENDING', counterSalary: null, asking, note: '' };
      if (rng.chance(chance)) {
        n.status = 'ACCEPTED';
        n.note = `${p.name} signs on for ${years} more season${years === 1 ? '' : 's'}.`;
        const c = d.players[playerId].contract!;
        // The extension starts next season; this season's deal runs out first.
        c.years = 1 + years;
        c.salary = salary;
        c.via = 'RENEWAL';
      } else if (ratio < 0.92) {
        n.status = 'COUNTERED';
        n.counterSalary = asking;
        n.note = `${p.name} wants ${asking} lakh a season.`;
      } else {
        n.status = 'REJECTED';
        n.note = `${p.name} turns it down and will go to the auction.`;
      }
      d.negotiations.unshift(n);
      addNews(d, { kind: 'CONTRACT', title: `Renewal: ${p.name} - ${n.status.toLowerCase()}`, body: n.note, route: '/manager/contracts' });
    }),
  };
}

/** The new season: a year off every contract, and the finished ones end. */
export function rollContracts(draft: ManagerState): string[] {
  const ended: string[] = [];
  for (const p of Object.values(draft.players)) {
    if (!p.contract) continue;
    p.contract.years -= 1;
    if (p.contract.years <= 0) {
      const f = draft.franchises[p.contract.franchiseId];
      if (f) f.squadIds = f.squadIds.filter((id) => id !== p.id);
      if (f?.isUser) ended.push(p.id);
      p.contract = null;
    }
  }
  return ended;
}

/** Pay the season's wages from the operating balance, once. */
export function payWages(draft: ManagerState): void {
  const f = draft.franchises[draft.franchiseId];
  const payroll = f.squadIds.reduce((n, id) => n + (draft.players[id]?.contract?.salary ?? 0), 0);
  book(draft, { id: `wages-${draft.season.year}`, kind: 'SALARY', amount: -payroll, note: `Player salaries, ${draft.season.year}` });
  const staff = draft.staff.reduce((n, s) => n + s.salary, 0);
  book(draft, { id: `staff-wages-${draft.season.year}`, kind: 'STAFF', amount: -staff, note: `Staff salaries, ${draft.season.year}` });
}
