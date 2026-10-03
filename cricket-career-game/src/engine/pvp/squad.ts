/**
 * Squad rules for Live PvP: an XI of owned cards, a captain and a vice-captain
 * inside it, a keeper, and enough bowling to get through the overs.
 */
import { CATALOG_BY_ID, canBowl, type PlayerCard } from './catalog';
import { PVP_FORMAT } from './config';
import { effectiveOverall, type RuleIssue } from './rules';
import type { OwnedCard, SquadSelection } from './types';

export const XI_SIZE = 11;
/** Bowling options needed so nobody has to bowl twice in a row or beyond the limit. */
export const MIN_BOWLERS = Math.max(5, Math.ceil(PVP_FORMAT.overs / PVP_FORMAT.maxOversPerBowler) + 1);

export function validateSquad(squad: SquadSelection, inventory: OwnedCard[]): RuleIssue[] {
  const issues: RuleIssue[] = [];
  const byInstance = new Map(inventory.map((o) => [o.instanceId, o]));
  if (squad.xi.length !== XI_SIZE) issues.push({ code: 'XI_SIZE', message: `The XI needs ${XI_SIZE} players (has ${squad.xi.length}).` });
  if (new Set(squad.xi).size !== squad.xi.length) issues.push({ code: 'XI_DUPLICATE', message: 'A player is in the XI twice.' });
  const cards: PlayerCard[] = [];
  const cardIds = new Set<string>();
  for (const id of squad.xi) {
    const owned = byInstance.get(id);
    if (!owned) {
      issues.push({ code: 'NOT_OWNED', message: `Player ${id} is not in your collection.` });
      continue;
    }
    const card = CATALOG_BY_ID[owned.cardId];
    if (!card) {
      issues.push({ code: 'UNKNOWN_CARD', message: `Card ${owned.cardId} does not exist.` });
      continue;
    }
    if (cardIds.has(card.id)) issues.push({ code: 'SAME_PLAYER', message: `${card.name} is picked twice.` });
    cardIds.add(card.id);
    cards.push(card);
  }
  for (const id of squad.bench) {
    if (!byInstance.has(id)) issues.push({ code: 'NOT_OWNED', message: `Bench player ${id} is not in your collection.` });
    if (squad.xi.includes(id)) issues.push({ code: 'BENCH_IN_XI', message: 'A bench player is also in the XI.' });
  }
  if (!squad.xi.includes(squad.captain)) issues.push({ code: 'CAPTAIN', message: 'The captain must be in the XI.' });
  if (!squad.xi.includes(squad.viceCaptain)) issues.push({ code: 'VICE', message: 'The vice-captain must be in the XI.' });
  if (squad.captain === squad.viceCaptain) issues.push({ code: 'CAPTAIN_VICE', message: 'Captain and vice-captain must be different players.' });
  if (cards.length === squad.xi.length) {
    if (!cards.some((c) => c.role === 'WICKET_KEEPER')) issues.push({ code: 'KEEPER', message: 'The XI needs a wicketkeeper.' });
    const bowlers = cards.filter(canBowl).length;
    if (bowlers < MIN_BOWLERS) issues.push({ code: 'BOWLERS', message: `The XI needs at least ${MIN_BOWLERS} bowling options (has ${bowlers}).` });
  }
  return issues;
}

export function squadRating(squad: SquadSelection, inventory: OwnedCard[]): number {
  const byInstance = new Map(inventory.map((o) => [o.instanceId, o]));
  const values = squad.xi
    .map((id) => byInstance.get(id))
    .filter((o): o is OwnedCard => Boolean(o && CATALOG_BY_ID[o.cardId]))
    .map((o) => effectiveOverall(CATALOG_BY_ID[o.cardId], o.upgrades));
  if (values.length === 0) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

export interface RoleBalance {
  batters: number;
  bowlers: number;
  allRounders: number;
  keepers: number;
  bowlingOptions: number;
}

export function roleBalance(cards: PlayerCard[]): RoleBalance {
  return {
    batters: cards.filter((c) => c.role === 'BATTER').length,
    bowlers: cards.filter((c) => c.role === 'BOWLER').length,
    allRounders: cards.filter((c) => c.role === 'ALL_ROUNDER').length,
    keepers: cards.filter((c) => c.role === 'WICKET_KEEPER').length,
    bowlingOptions: cards.filter(canBowl).length,
  };
}

/**
 * A sensible XI from a collection: a keeper, the best bowlers, then the best
 * batters, in a batting order of batters, keeper, all-rounders, bowlers.
 */
export function autoPickSquad(inventory: OwnedCard[]): SquadSelection | null {
  const rated = inventory
    .filter((o) => CATALOG_BY_ID[o.cardId])
    .map((o) => ({ o, card: CATALOG_BY_ID[o.cardId], value: effectiveOverall(CATALOG_BY_ID[o.cardId], o.upgrades) }))
    .sort((a, b) => b.value - a.value);
  const seen = new Set<string>();
  const unique = rated.filter((r) => (seen.has(r.card.id) ? false : (seen.add(r.card.id), true)));
  const keeper = unique.find((r) => r.card.role === 'WICKET_KEEPER');
  if (!keeper) return null;
  const picked = [keeper];
  const bowlers = unique.filter((r) => canBowl(r.card) && r !== keeper);
  // Prefer two all-rounders among the bowling options.
  const allRounders = bowlers.filter((r) => r.card.role === 'ALL_ROUNDER').slice(0, 2);
  const specialists = bowlers.filter((r) => r.card.role === 'BOWLER').slice(0, Math.max(0, MIN_BOWLERS - allRounders.length));
  picked.push(...allRounders, ...specialists);
  if (picked.length < 1 + MIN_BOWLERS) {
    for (const r of bowlers) if (picked.length < 1 + MIN_BOWLERS && !picked.includes(r)) picked.push(r);
  }
  for (const r of unique) {
    if (picked.length >= XI_SIZE) break;
    if (!picked.includes(r) && r.card.role === 'BATTER') picked.push(r);
  }
  for (const r of unique) {
    if (picked.length >= XI_SIZE) break;
    if (!picked.includes(r)) picked.push(r);
  }
  if (picked.length < XI_SIZE) return null;
  const order: Record<string, number> = { BATTER: 0, WICKET_KEEPER: 1, ALL_ROUNDER: 2, BOWLER: 3 };
  picked.sort((a, b) => order[a.card.role] - order[b.card.role] || b.card.batting - a.card.batting);
  const xi = picked.map((r) => r.o.instanceId);
  const byValue = [...picked].sort((a, b) => b.value - a.value);
  const pickedIds = new Set(xi);
  return {
    xi,
    bench: inventory.filter((o) => !pickedIds.has(o.instanceId)).map((o) => o.instanceId).slice(0, 7),
    captain: byValue[0].o.instanceId,
    viceCaptain: byValue[1].o.instanceId,
  };
}
