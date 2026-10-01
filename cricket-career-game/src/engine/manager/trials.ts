/**
 * Trials and recruitment. A trial shows far more than a scout's report -
 * nets against your bowlers, a fitness check, how he handles a bad day - and
 * an impressive triallist can be offered a development contract outside the
 * auction. He may say no: other franchises call too.
 */
import type { ManagerState, Negotiation, TrialResult } from '@/types/manager';
import { MANAGER } from './config';
import { observe, type ActionResult } from './scouting';
import { battingRating, bowlingRating } from './squad';
import { addNews, book, clamp, holds, once, produce, rngFor } from './util';

const fail = (state: ManagerState, error: string): ActionResult => ({ ok: false, state, error });

export function trialsLeft(state: ManagerState): number {
  return Math.max(0, MANAGER.rules.trialsPerSeason - state.season.trialsRun);
}

/** Trials are held in the scouting window and the trials week. */
export function trialsOpen(state: ManagerState): boolean {
  return state.season.phase === 'SCOUTING' || state.season.phase === 'TRIALS';
}

export function runTrial(state: ManagerState, playerIds: string[]): ActionResult {
  if (!holds(state, 'TRIALS')) return fail(state, 'Trials are not part of your job.');
  if (!trialsOpen(state)) return fail(state, 'Trials are held before the auction.');
  if (trialsLeft(state) <= 0) return fail(state, `All ${MANAGER.rules.trialsPerSeason} trial days this season are used.`);
  const ids = Array.from(new Set(playerIds)).filter((id) => state.players[id] && !state.players[id].contract);
  if (ids.length === 0) return fail(state, 'Pick unsigned players to invite.');
  if (ids.length > 4) return fail(state, 'At most four players per trial day.');
  const cost = MANAGER.rules.trialCost * ids.length;
  if (state.finances.balance < cost) return fail(state, 'Not enough money to stage the trial.');
  const trialId = `trial-${state.season.year}-${state.season.trialsRun}-${ids.join('.')}`;
  return {
    ok: true,
    state: produce(state, (d) => {
      if (!once(d, trialId)) return;
      const rng = rngFor(d, trialId);
      const coach = Math.max(40, ...d.staff.filter((s) => s.kind === 'BATTING_COACH' || s.kind === 'BOWLING_COACH').map((s) => s.quality));
      const results: TrialResult[] = ids.map((id) => {
        const p = d.players[id];
        const day = (100 - p.consistency) * 0.25;
        const batting = Math.round(clamp(battingRating(p) + rng.spread() * day, 1, 99));
        const bowling = Math.round(clamp(p.bowlingStyle === 'NONE' ? 1 : bowlingRating(p) + rng.spread() * day, 1, 99));
        const fielding = Math.round(clamp((p.attributes.fielding.catching + p.attributes.fielding.groundFielding) / 2 + rng.spread() * day, 1, 99));
        const fitness = Math.round(clamp(p.attributes.physical.stamina * 0.5 + p.attributes.physical.durability * 0.5 + rng.spread() * 6, 1, 99));
        const best = Math.max(batting, bowling);
        const verdict: TrialResult['verdict'] = best >= 68 ? 'IMPRESSIVE' : best >= 58 ? 'PROMISING' : best >= 48 ? 'ORDINARY' : 'POOR';
        observe(d, p, coach, rng, { trial: true });
        return { playerId: id, batting, bowling, fielding, fitness, verdict };
      });
      d.season.trials = [...d.season.trials.filter((t) => !ids.includes(t.playerId)), ...results];
      d.season.trialsRun += 1;
      book(d, { id: trialId, kind: 'TRIALS', amount: -cost, note: `Trial day: ${ids.length} player${ids.length === 1 ? '' : 's'}` });
      const star = results.find((r) => r.verdict === 'IMPRESSIVE');
      addNews(d, {
        kind: 'SCOUTING',
        title: 'Trial day complete',
        body: star ? `${d.players[star.playerId].name} was the standout. A development contract is possible.` : 'Nobody forced their way in, but the reports are sharper now.',
        route: '/manager/trials',
      });
    }),
  };
}

/** What a prospect hopes to be paid on a development deal, lakh. */
export function askingSalary(state: ManagerState, playerId: string): number {
  const report = state.reports[playerId];
  const interest = report?.rivalInterest.length ?? 0;
  return MANAGER.rules.developmentSalary + interest * 10;
}

/**
 * Offer a development contract to a triallist. Never guaranteed: the player
 * weighs the money, the franchise, and who else has called.
 */
export function offerDevelopmentContract(state: ManagerState, playerId: string, salary: number): ActionResult {
  if (!holds(state, 'TRIALS')) return fail(state, 'Recruitment is not part of your job.');
  if (!trialsOpen(state)) return fail(state, 'Development contracts are only offered before the auction.');
  const p = state.players[playerId];
  if (!p) return fail(state, 'Unknown player.');
  if (p.contract) return fail(state, `${p.name} is already under contract.`);
  if (p.capped) return fail(state, 'Capped players can only be signed at the auction.');
  if (!state.season.trials.some((t) => t.playerId === playerId)) return fail(state, 'Trial him first.');
  if (state.season.developmentSignings >= MANAGER.rules.developmentSignings) return fail(state, `Only ${MANAGER.rules.developmentSignings} development signings a season.`);
  const squad = state.franchises[state.franchiseId].squadIds.length;
  if (squad >= MANAGER.rules.squadMax) return fail(state, 'The squad is full.');
  if (salary < 20 || salary > 200) return fail(state, 'Offer between ₹20 L and ₹2 Cr.');
  if (state.negotiations.some((n) => n.playerId === playerId && n.status === 'PENDING')) return fail(state, 'An offer is already on the table.');

  const asking = askingSalary(state, playerId);
  const id = `neg-dev-${state.season.year}-${playerId}-${state.negotiations.filter((n) => n.playerId === playerId).length}`;
  return {
    ok: true,
    state: produce(state, (d) => {
      if (!once(d, id)) return;
      const rng = rngFor(d, id);
      const franchise = d.franchises[d.franchiseId];
      const rivals = d.reports[playerId]?.rivalInterest.length ?? 0;
      const money = salary / asking;
      const chance = clamp(0.35 + (money - 1) * 0.9 + franchise.brand / 250 - rivals * 0.09 + d.profile.reputation / 400, 0.05, 0.95);
      const negotiation: Negotiation = { id, playerId, kind: 'TRIAL_OFFER', offeredSalary: salary, years: 2, status: 'PENDING', counterSalary: null, asking, note: '' };
      if (money < 0.85 && rng.chance(0.6)) {
        negotiation.status = 'COUNTERED';
        negotiation.counterSalary = asking;
        negotiation.note = `${p.name}'s agent wants ${asking} lakh.`;
      } else if (rng.chance(chance)) {
        negotiation.status = 'ACCEPTED';
        negotiation.note = `${p.name} signs a two-year development contract.`;
        const player = d.players[playerId];
        player.contract = { franchiseId: d.franchiseId, salary, years: 2, signedSeason: d.season.year, via: 'TRIAL' };
        if (!franchise.squadIds.includes(playerId)) franchise.squadIds.push(playerId);
        d.season.developmentSignings += 1;
        book(d, { id: `${id}-fee`, kind: 'SIGNING', amount: -10, note: `Signing fee: ${player.name}` });
        if (!d.profile.discoveries.includes(playerId) && player.prospect) d.profile.discoveries.push(playerId);
      } else {
        negotiation.status = 'REJECTED';
        negotiation.note = rivals > 0 ? `${p.name} turns you down - another franchise has called.` : `${p.name} turns you down and will take his chances in the auction.`;
      }
      d.negotiations.unshift(negotiation);
      addNews(d, { kind: 'CONTRACT', title: `Offer to ${p.name}: ${negotiation.status.toLowerCase()}`, body: negotiation.note, route: '/manager/trials' });
    }),
  };
}

/** Accept a counter-offer at the price asked (one more roll, as the mood may have changed). */
export function acceptCounter(state: ManagerState, negotiationId: string): ActionResult {
  const n = state.negotiations.find((x) => x.id === negotiationId);
  if (!n || n.status !== 'COUNTERED' || n.counterSalary === null) return fail(state, 'No counter-offer to accept.');
  const withdrawn = produce(state, (d) => {
    const x = d.negotiations.find((y) => y.id === negotiationId)!;
    x.status = 'WITHDRAWN';
  });
  return offerDevelopmentContract(withdrawn, n.playerId, n.counterSalary);
}

