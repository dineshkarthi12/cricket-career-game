/**
 * Retention, auction preparation and the live auction.
 *
 * Every sale goes through `sell`, guarded by `once`, so a player is sold
 * once and a purse is charged once whatever the screen does. Bids above the
 * purse (less the money held back to fill the minimum squad), past the squad
 * limit or past the overseas limit are rejected.
 */
import type { AuctionLot, AuctionState, Franchise, ManagedPlayer, ManagerState } from '@/types/manager';
import type { PlayerRole } from '@/types';
import { MANAGER } from './config';
import { marketValue } from './players';
import type { ActionResult } from './scouting';
import { addNews, clamp, holds, once, produce, rngFor, squadOf } from './util';

const fail = (state: ManagerState, error: string): ActionResult => ({ ok: false, state, error });

/** Mega auction every third season: everyone goes back in the pool bar the retained. */
export function isMegaAuction(year: number): boolean {
  return (year - MANAGER.firstSeason) % 3 === 0;
}

type RoleGroup = 'WK' | 'BAT' | 'AR' | 'PACE' | 'SPIN';
export function roleGroupOf(role: PlayerRole, bowling: string): RoleGroup {
  if (role === 'WICKET_KEEPER_BATTER') return 'WK';
  if (role === 'BATTER' || role === 'OPENING_BATTER') return 'BAT';
  if (role === 'BATTING_ALLROUNDER' || role === 'BOWLING_ALLROUNDER') return 'AR';
  return ['OFF_SPIN', 'LEG_SPIN', 'LEFT_ARM_ORTHODOX', 'LEFT_ARM_WRIST_SPIN'].includes(bowling) ? 'SPIN' : 'PACE';
}
const NEEDS: Record<RoleGroup, number> = { WK: 2, BAT: 7, AR: 4, PACE: 6, SPIN: 3 };

/** Money a franchise must keep back to complete a minimum squad at base prices. */
export function reserveFor(state: ManagerState, franchiseId: string, afterThisSigning = true): number {
  const size = state.franchises[franchiseId].squadIds.length + (afterThisSigning ? 1 : 0);
  return Math.max(0, MANAGER.rules.squadMin - size) * MANAGER.auction.basePrices[0];
}

/** Can this franchise legally pay `amount` for this player right now? */
export function bidProblem(state: ManagerState, franchiseId: string, player: ManagedPlayer, amount: number): string | null {
  const f = state.franchises[franchiseId];
  const r = MANAGER.rules;
  if (f.squadIds.length >= r.squadMax) return 'The squad is full.';
  if (player.overseas && squadOf(state, franchiseId).filter((p) => p.overseas).length >= r.overseasSquadMax) return 'No overseas slots left.';
  if (amount > f.purse) return 'That is more than the purse holds.';
  if (amount > f.purse - reserveFor(state, franchiseId)) return 'Keep enough back to complete a minimum squad.';
  return null;
}

/* ------------------------------ retention ------------------------------- */

export function toggleRetention(state: ManagerState, playerId: string): ActionResult {
  if (state.season.phase !== 'RETENTION') return fail(state, 'Retentions are made in the retention window.');
  if (!holds(state, 'AUCTION')) return fail(state, 'Retention decisions are made above your head this season.');
  if (!isMegaAuction(state.season.year)) return fail(state, 'This is a mini auction: contracts carry over. Release players from Contracts instead.');
  if (!state.franchises[state.franchiseId].squadIds.includes(playerId)) return fail(state, 'Only your own players can be retained.');
  const list = state.season.retentions;
  if (!list.includes(playerId) && list.length >= MANAGER.rules.maxRetentions) return fail(state, `At most ${MANAGER.rules.maxRetentions} retentions.`);
  return {
    ok: true,
    state: produce(state, (d) => {
      d.season.retentions = list.includes(playerId) ? list.filter((id) => id !== playerId) : [...list, playerId];
    }),
  };
}

/** What retaining these players costs, in order. */
export function retentionCost(count: number): number {
  return MANAGER.rules.retentionCost.slice(0, count).reduce((a, b) => a + b, 0);
}

function aiRetentions(state: ManagerState, f: Franchise): string[] {
  return squadOf(state, f.id)
    .filter((p) => !p.retired && p.age <= 34)
    .sort((a, b) => marketValue(b) - marketValue(a))
    .slice(0, MANAGER.rules.maxRetentions - (f.strategy.youth > 0.6 ? 1 : 0))
    .filter((p, i) => marketValue(p) >= MANAGER.rules.retentionCost[i] * 0.7)
    .map((p) => p.id);
}

/** Close the retention window: release everyone else (mega) and set every purse from the contracts kept. */
export function closeRetention(draft: ManagerState): void {
  if (!once(draft, `retention-${draft.season.year}`)) return;
  const mega = isMegaAuction(draft.season.year);
  for (const f of Object.values(draft.franchises)) {
    if (mega) {
      const keep = f.isUser && holds(draft, 'AUCTION') ? draft.season.retentions : aiRetentions(draft, f);
      if (f.isUser) draft.season.retentions = keep;
      keep.forEach((id, i) => {
        const p = draft.players[id];
        p.contract = { franchiseId: f.id, salary: MANAGER.rules.retentionCost[i], years: 3, signedSeason: draft.season.year, via: 'RETAINED' };
      });
      for (const id of f.squadIds) {
        const p = draft.players[id];
        // Development signings from this season's trials stay.
        const devThisSeason = p.contract?.via === 'TRIAL' && p.contract.signedSeason === draft.season.year;
        if (!keep.includes(id) && !devThisSeason) p.contract = null;
      }
      f.squadIds = f.squadIds.filter((id) => draft.players[id].contract?.franchiseId === f.id);
    }
    const committed = squadOf(draft, f.id).reduce((n, p) => n + (p.contract?.salary ?? 0), 0);
    f.purse = Math.max(0, MANAGER.rules.purse - committed);
  }
  const user = draft.franchises[draft.franchiseId];
  addNews(draft, {
    kind: 'AUCTION',
    title: mega ? 'Mega auction: retentions confirmed' : 'Mini auction: squads carried over',
    body: `${user.short} go to the auction with ${user.squadIds.length} players and a purse of ${(user.purse / 100).toFixed(2)} Cr.`,
    route: '/manager/auction-prep',
  });
}

/* ------------------------------ preparation ------------------------------ */

/** Who goes under the hammer: free agents, plus prospects someone has registered. */
export function auctionPool(state: ManagerState): ManagedPlayer[] {
  return Object.values(state.players).filter((p) => {
    if (p.retired || p.contract) return false;
    if (!p.prospect) return true;
    // A prospect is in the auction only if a franchise has scouted him: ours, or one with interest.
    const report = state.reports[p.id];
    return Boolean(report) || p.potential >= 82;
  });
}

export function setTarget(state: ManagerState, playerId: string, maxBid: number, priority: 'MUST' | 'HIGH' | 'BACKUP'): ActionResult {
  if (!state.players[playerId]) return fail(state, 'Unknown player.');
  if (maxBid < 20) return fail(state, 'Set a maximum of at least ₹20 L.');
  if (maxBid > MANAGER.rules.purse) return fail(state, 'That is more than any purse holds.');
  return {
    ok: true,
    state: produce(state, (d) => {
      d.auctionPlan.targets = [...d.auctionPlan.targets.filter((t) => t.playerId !== playerId), { playerId, maxBid: Math.round(maxBid), priority }];
    }),
  };
}

export function removeTarget(state: ManagerState, playerId: string): ManagerState {
  return produce(state, (d) => {
    d.auctionPlan.targets = d.auctionPlan.targets.filter((t) => t.playerId !== playerId);
  });
}

/** Sum of the maximum bids, against the purse: the plan's own sanity check. */
export function planSummary(state: ManagerState): { committed: number; purse: number; overBudget: boolean; overseas: number } {
  const purse = state.franchises[state.franchiseId].purse;
  const must = state.auctionPlan.targets.filter((t) => t.priority !== 'BACKUP');
  const committed = must.reduce((n, t) => n + t.maxBid, 0);
  const overseas = state.auctionPlan.targets.filter((t) => state.players[t.playerId]?.overseas).length;
  return { committed, purse, overBudget: committed > purse, overseas };
}

/* ------------------------------ the auction ------------------------------ */

export function startAuction(draft: ManagerState): void {
  if (draft.auction && !draft.auction.complete) return;
  if (!once(draft, `auction-start-${draft.season.year}`)) return;
  const rng = rngFor(draft, `auction-order-${draft.season.year}`);
  const pool = auctionPool(draft);
  // Marquee names first, then sets by value with a little shuffle inside each.
  const ranked = pool.map((p) => ({ p, v: marketValue(p) * (0.9 + rng.next() * 0.2) })).sort((a, b) => b.v - a.v);
  const slots = Object.values(draft.franchises).reduce((n, f) => n + Math.max(0, MANAGER.rules.squadMax - f.squadIds.length), 0);
  const queue = ranked.slice(0, Math.min(ranked.length, Math.round(slots * 1.25))).map((x) => x.p.id);
  for (const p of pool) p.basePrice = Math.min(p.basePrice, MANAGER.auction.basePrices[MANAGER.auction.basePrices.length - 1]);
  draft.auction = { round: 1, queue, index: -1, lot: null, sales: [], unsold: [], complete: false, log: [] };
  nextLot(draft);
}

/** How much a franchise's AI is prepared to pay for a player. */
export function aiValuation(state: ManagerState, franchiseId: string, player: ManagedPlayer): number {
  const f = state.franchises[franchiseId];
  const squad = squadOf(state, franchiseId);
  if (squad.length >= MANAGER.rules.squadMax) return 0;
  if (player.overseas && squad.filter((p) => p.overseas).length >= MANAGER.rules.overseasSquadMax) return 0;
  const group = roleGroupOf(player.role, player.bowlingStyle);
  const have = squad.filter((p) => roleGroupOf(p.role, p.bowlingStyle) === group).length;
  const gap = NEEDS[group] - have;
  let need = gap > 0 ? 1 + 0.18 * gap : gap < -1 ? 0.55 : 0.85;
  if (squad.length < MANAGER.rules.squadMin) need *= 1.08;
  const style = f.strategy.style;
  if ((style === 'SPIN' && group === 'SPIN') || (style === 'PACE' && group === 'PACE') || (style === 'BATTING' && (group === 'BAT' || group === 'WK'))) need *= 1.15;
  if (player.overseas) need *= 0.85 + f.strategy.overseasLean * 0.3;
  if (player.age <= 23) need *= 0.9 + f.strategy.youth * 0.25;
  const rng = rngFor(state, `val-${state.season.year}-${franchiseId}-${player.id}`);
  const frenzy = 1 + rng.spread() * MANAGER.auction.frenzy;
  // Their scouts have their own view of an uncapped player.
  const knownValue = player.prospect ? marketValue(player) * (0.7 + rng.next() * 0.6) : marketValue(player);
  let value = knownValue * need * frenzy * (0.85 + f.strategy.aggression * 0.3);

  // The user's franchise, when the auction is run by the AI head coach, leans on the user's plan.
  if (f.isUser) {
    const target = state.auctionPlan.targets.find((t) => t.playerId === player.id);
    if (target) value = target.maxBid;
    else if (state.shortlist.includes(player.id)) value *= 1.15;
  }
  // Spread the money: never so much on one player that the rest of the squad cannot be bought.
  const slotsLeft = Math.max(1, MANAGER.auction.plannedSquad - squad.length);
  const spendable = Math.max(0, f.purse - reserveFor(state, franchiseId));
  const cap = spendable * Math.min(1, MANAGER.auction.marqueeSlots / slotsLeft);
  if (!f.isUser || !state.auctionPlan.targets.some((t) => t.playerId === player.id)) value = Math.min(value, cap);
  return Math.max(0, Math.round(value));
}

function nextPrice(lot: AuctionLot, base: number): number {
  return lot.leaderId === null ? base : lot.currentBid + MANAGER.auction.increment(lot.currentBid);
}

/** AI franchises (and the user's, when it is on autopilot) that would pay `price`. */
function willingAis(state: ManagerState, lot: AuctionLot, price: number, includeUser: boolean): string[] {
  const player = state.players[lot.playerId];
  return Object.values(state.franchises)
    .filter((f) => (includeUser || !f.isUser) && f.id !== lot.leaderId && !lot.out.includes(f.id))
    .filter((f) => !bidProblem(state, f.id, player, price) && aiValuation(state, f.id, player) >= price)
    .map((f) => f.id);
}

function placeBid(draft: ManagerState, franchiseId: string, amount: number): void {
  const lot = draft.auction!.lot!;
  lot.currentBid = amount;
  lot.leaderId = franchiseId;
  lot.bids.push({ franchiseId, amount });
}

/**
 * Let the AI franchises bid against each other until at most one of them is
 * still interested. `includeUser` makes the user's franchise one of them
 * (autopilot, or the user has passed).
 */
function aiWar(draft: ManagerState, includeUser: boolean, stopAtUser = true): void {
  const a = draft.auction!;
  const lot = a.lot!;
  const player = draft.players[lot.playerId];
  let guard = 0;
  while (guard < 400) {
    guard += 1;
    const price = nextPrice(lot, player.basePrice);
    const willing = willingAis(draft, lot, price, includeUser);
    if (willing.length === 0) break;
    // When only one AI is still keen and it already... the strongest bids.
    const rng = rngFor(draft, `war-${draft.season.year}-${lot.playerId}-${lot.bids.length}`);
    const pick = rng.weighted(willing.map((id) => ({ item: id, weight: 1 + (aiValuation(draft, id, player) - price) / 50 })));
    placeBid(draft, pick, price);
    if (stopAtUser && !includeUser && willingAis(draft, lot, nextPrice(lot, player.basePrice), false).length === 0) break;
  }
}

function nextLot(draft: ManagerState): void {
  const a = draft.auction!;
  a.index += 1;
  if (a.index >= a.queue.length) {
    if (a.round === 1 && a.unsold.length > 0) {
      // Accelerated round: the unsold come back at a lower base for anyone still short.
      a.round = 2;
      a.queue = [...a.unsold];
      a.unsold = [];
      a.index = 0;
      for (const id of a.queue) {
        const p = draft.players[id];
        p.basePrice = Math.max(20, Math.round((p.basePrice * MANAGER.auction.secondRoundShare) / 5) * 5);
      }
      a.log.unshift('Accelerated round: the unsold players return at reduced base prices.');
    } else {
      finishAuction(draft);
      return;
    }
  }
  const playerId = a.queue[a.index];
  a.lot = { playerId, currentBid: 0, leaderId: null, bids: [], out: [] };
  const userInPlay = holds(draft, 'AUCTION');
  // The room opens: rivals bid until one is left holding it (or nobody wants him).
  aiWar(draft, !userInPlay);
  if (!userInPlay) resolveLot(draft);
}

function sell(draft: ManagerState, playerId: string, franchiseId: string, price: number): void {
  const a = draft.auction!;
  if (!once(draft, `sale-${draft.season.year}-${playerId}`)) return;
  const f = draft.franchises[franchiseId];
  const p = draft.players[playerId];
  f.purse -= price;
  if (!f.squadIds.includes(playerId)) f.squadIds.push(playerId);
  p.contract = { franchiseId, salary: price, years: isMegaAuction(draft.season.year) ? MANAGER.rules.auctionContractYears : 2, signedSeason: draft.season.year, via: 'AUCTION' };
  a.sales.push({ playerId, franchiseId, price, round: a.round });
  a.log.unshift(`${p.name} SOLD to ${f.short} for ${(price / 100).toFixed(2)} Cr.`);
  if (f.isUser) {
    addNews(draft, { kind: 'AUCTION', title: `${p.name} signed`, body: `${p.name} joins ${f.short} for ${(price / 100).toFixed(2)} Cr.`, route: '/manager/squad' });
    if (!draft.records.bestSigning || marketValue(p) - price > draft.records.bestSigning.value) {
      draft.records.bestSigning = { playerId, value: marketValue(p) - price, season: draft.season.year };
    }
  }
}

function resolveLot(draft: ManagerState): void {
  const a = draft.auction!;
  const lot = a.lot!;
  const p = draft.players[lot.playerId];
  if (lot.leaderId) sell(draft, lot.playerId, lot.leaderId, lot.currentBid);
  else {
    a.unsold.push(lot.playerId);
    a.sales.push({ playerId: lot.playerId, franchiseId: null, price: 0, round: a.round });
    a.log.unshift(`${p.name} unsold.`);
  }
  a.lot = null;
  nextLot(draft);
}

export function currentLotPlayer(state: ManagerState): ManagedPlayer | null {
  const id = state.auction?.lot?.playerId;
  return id ? state.players[id] : null;
}

/** The price the user would bid next. */
export function nextUserBid(state: ManagerState): number | null {
  const lot = state.auction?.lot;
  if (!lot) return null;
  return nextPrice(lot, state.players[lot.playerId].basePrice);
}

/** The user raises the bid by one step. Rivals answer if they still want him. */
export function userBid(state: ManagerState, expectedBid?: number): ActionResult {
  if (!holds(state, 'AUCTION')) return fail(state, 'The auction is run by the head coach this season.');
  const lot = state.auction?.lot;
  if (!lot || state.auction?.complete) return fail(state, 'No player is under the hammer.');
  if (lot.leaderId === state.franchiseId) return fail(state, 'You already hold the highest bid.');
  const amount = nextUserBid(state)!;
  // A stale click (the price has moved since the screen showed it) does nothing.
  if (expectedBid !== undefined && expectedBid !== amount) return fail(state, 'The bid has moved on - check the new price.');
  const problem = bidProblem(state, state.franchiseId, state.players[lot.playerId], amount);
  if (problem) return fail(state, problem);
  return {
    ok: true,
    state: produce(state, (d) => {
      if (!once(d, `bid-${d.season.year}-${lot.playerId}-${amount}-${d.franchiseId}`)) return;
      placeBid(d, d.franchiseId, amount);
      d.auction!.log.unshift(`You bid ${(amount / 100).toFixed(2)} Cr.`);
      // One rival answers at a time, so the user can respond.
      const player = d.players[lot.playerId];
      const willing = willingAis(d, d.auction!.lot!, nextPrice(d.auction!.lot!, player.basePrice), false);
      if (willing.length > 0) {
        const rng = rngFor(d, `answer-${d.season.year}-${lot.playerId}-${amount}`);
        const pick = rng.weighted(willing.map((id) => ({ item: id, weight: 1 + (aiValuation(d, id, player) - amount) / 50 })));
        const price = nextPrice(d.auction!.lot!, player.basePrice);
        placeBid(d, pick, price);
        d.auction!.log.unshift(`${d.franchises[pick].short} come back at ${(price / 100).toFixed(2)} Cr.`);
      }
    }),
  };
}

/** Bid automatically up to a ceiling: stops as soon as a rival goes past it. */
export function bidUpTo(state: ManagerState, max: number): ActionResult {
  let current = state;
  let guard = 0;
  while (guard < 200) {
    guard += 1;
    const lot = current.auction?.lot;
    if (!lot || lot.leaderId === current.franchiseId) break;
    const next = nextUserBid(current)!;
    if (next > max) break;
    const r = userBid(current);
    if (!r.ok) return guard === 1 ? r : { ok: true, state: current };
    current = r.state;
  }
  return { ok: true, state: current };
}

/** Sold to the highest bidder: the user stops bidding (or skips the player). */
export function hammer(state: ManagerState): ActionResult {
  const lot = state.auction?.lot;
  if (!lot) return fail(state, 'No player is under the hammer.');
  return {
    ok: true,
    state: produce(state, (d) => {
      const l = d.auction!.lot!;
      if (l.leaderId !== d.franchiseId) {
        // The user is out: rivals settle it between themselves.
        l.out.push(d.franchiseId);
        aiWar(d, false, false);
      }
      resolveLot(d);
    }),
  };
}

/** Skip the rest of the auction: the AI head coach bids on your behalf, following your plan. */
export function autoCompleteAuction(state: ManagerState): ManagerState {
  return produce(state, (d) => {
    let guard = 0;
    while (d.auction && !d.auction.complete && guard < 2000) {
      guard += 1;
      if (!d.auction.lot) break;
      aiWar(d, true, false);
      resolveLot(d);
    }
  });
}

/** Fill every franchise to the minimum squad, then close the auction. */
function finishAuction(draft: ManagerState): void {
  const a = draft.auction!;
  a.complete = true;
  a.lot = null;
  for (const f of Object.values(draft.franchises)) {
    if (f.isUser && holds(draft, 'AUCTION')) continue; // the user signs their own replacements
    fillToMinimum(draft, f.id);
  }
  const user = draft.franchises[draft.franchiseId];
  const bought = a.sales.filter((s) => s.franchiseId === user.id);
  addNews(draft, {
    kind: 'AUCTION',
    title: 'The auction is over',
    body: `${user.short} bought ${bought.length} player${bought.length === 1 ? '' : 's'} for ${(bought.reduce((n, s) => n + s.price, 0) / 100).toFixed(2)} Cr. Purse left: ${(user.purse / 100).toFixed(2)} Cr.${user.squadIds.length < MANAGER.rules.squadMin ? ` The squad needs ${MANAGER.rules.squadMin - user.squadIds.length} more - sign replacements from the unsold list.` : ''}`,
    route: '/manager/squad',
  });
}

/** Sign the cheapest suitable unsold players at base price until the squad reaches the minimum. */
export function fillToMinimum(draft: ManagerState, franchiseId: string): void {
  const f = draft.franchises[franchiseId];
  let guard = 0;
  while (f.squadIds.length < MANAGER.rules.squadMin && guard < 40) {
    guard += 1;
    const pool = Object.values(draft.players)
      .filter((p) => !p.contract && !p.retired && !p.prospect)
      .filter((p) => !bidProblem(draft, franchiseId, p, Math.min(p.basePrice, 30)))
      .sort((a, b) => marketValue(b) - marketValue(a));
    const pick = pool[0];
    if (!pick) break;
    const price = clamp(Math.min(pick.basePrice, f.purse), 0, f.purse);
    if (!once(draft, `fill-${draft.season.year}-${pick.id}`)) break;
    f.purse -= price;
    f.squadIds.push(pick.id);
    pick.contract = { franchiseId, salary: price, years: 1, signedSeason: draft.season.year, via: 'REPLACEMENT' };
  }
}

/** Replacement signing after the auction: an unsold player at his base price. */
export function signReplacement(state: ManagerState, playerId: string): ActionResult {
  if (!holds(state, 'AUCTION') && !holds(state, 'CONTRACTS')) return fail(state, 'Signings are not part of your job.');
  if (!state.auction?.complete && state.season.phase !== 'PRESEASON' && state.season.phase !== 'LEAGUE') return fail(state, 'Replacements are signed after the auction.');
  const p = state.players[playerId];
  if (!p || p.contract || p.retired) return fail(state, 'He is not available.');
  const price = Math.max(20, p.basePrice);
  const problem = bidProblem(state, state.franchiseId, p, price);
  if (problem) return fail(state, problem.replace('Keep enough back to complete a minimum squad.', 'Not enough purse left for the rest of the squad.'));
  return {
    ok: true,
    state: produce(state, (d) => {
      if (!once(d, `replacement-${d.season.year}-${playerId}`)) return;
      const f = d.franchises[d.franchiseId];
      f.purse -= price;
      f.squadIds.push(playerId);
      d.players[playerId].contract = { franchiseId: f.id, salary: price, years: 1, signedSeason: d.season.year, via: 'REPLACEMENT' };
      addNews(d, { kind: 'CONTRACT', title: `${p.name} signs as a replacement`, body: `One season at ${price} lakh.`, route: '/manager/squad' });
    }),
  };
}

export type { AuctionState };
