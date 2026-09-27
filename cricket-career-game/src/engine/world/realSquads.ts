/**
 * Real squads for the professional and senior domestic sides: the ten IPL
 * franchises, the twelve nations' senior squads, the state sides' Ranji,
 * Vijay Hazare and Mushtaq Ali squads, and - built from the state players -
 * the five zones, the Rest of India and India A. Each returns null when the
 * real players are not loaded, and the caller generates the side as before.
 * Players who have retired by the season asked for are left out; the caller
 * tops the squad up with generated players (`fillSquad`).
 */
import { REAL_PLAYERS } from '../config';
import { ALL_SIDES } from '@/data/places';
import { generateSquad, SQUAD_ROLES, type SquadInput } from './teams';
import { ageOn, realData, realDateOfBirth, realHomeSide, realPlayerAt, realRatings, realRecord, realRetireAge, realRole, realSeason } from './realPlayers';
import type { Rng } from '../match/rng';
import type { PlayerRole, RealPlayerRecord, RivalPlayer } from '@/types';

/** The Ranji, Vijay Hazare and Mushtaq Ali tournaments a state side's squads are for. */
export const STATE_COMPETITIONS = { ranji: 'ranji-trophy', vht: 'vijay-hazare', smat: 'syed-mushtaq-ali' } as const;

/** The state (for names and climate) of a state or association side. */
export function stateOfSide(side: string): string {
  return ALL_SIDES.find((s) => s.team === side)?.state ?? 'Tamil Nadu';
}

function regionOf(rec: RealPlayerRecord, fallback: string): string {
  if (rec.c !== 'India') return rec.c;
  const side = realHomeSide(rec.id);
  return side ? stateOfSide(side) : fallback;
}

function materialise(ids: string[], teamId: string, seasonYear: number, region: string, overseasOf?: (rec: RealPlayerRecord) => boolean): RivalPlayer[] {
  const out: RivalPlayer[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const rec = realRecord(id);
    if (!rec) continue;
    const p = realPlayerAt(rec, { teamId, region: regionOf(rec, region), seasonYear, overseas: overseasOf?.(rec) });
    if (p) out.push(p);
  }
  return out;
}

/** The ten franchises by their game name. */
export function realFranchiseSquad(franchise: string, teamId: string, seasonYear: number, region: string): RivalPlayer[] | null {
  const ids = realData()?.ipl.squads[franchise];
  if (!ids) return null;
  return materialise(ids, teamId, seasonYear, region, (rec) => rec.c !== 'India');
}

export function realNationSquad(nation: string, teamId: string, seasonYear: number): RivalPlayer[] | null {
  const ids = realData()?.international.squads[nation];
  if (!ids) return null;
  return materialise(ids, teamId, seasonYear, nation).map((p) => ({ ...p, capped: true }));
}

export interface RealStateSide {
  /** Everyone in any of the side's squads. */
  squad: RivalPlayer[];
  /** Player ids per tournament id. */
  competitionSquads: Record<string, string[]>;
  captainId: string | null;
}

/** A state side's three squads (a player can be in several). */
export function realStateSide(side: string, teamId: string, seasonYear: number): RealStateSide | null {
  const lists = realData()?.domestic.squads[side];
  if (!lists) return null;
  const all = [...lists.ranji, ...lists.vht, ...lists.smat];
  const squad = materialise(all, teamId, seasonYear, stateOfSide(side));
  const idOf = new Map(squad.map((p) => [p.realId!, p.id]));
  const pick = (ids: string[]) => ids.map((id) => idOf.get(id)).filter((id): id is string => Boolean(id));
  const captain = lists.captains.ranji ?? lists.captains.vht ?? lists.captains.smat;
  return {
    squad,
    competitionSquads: {
      [STATE_COMPETITIONS.ranji]: pick(lists.ranji),
      [STATE_COMPETITIONS.vht]: pick(lists.vht),
      [STATE_COMPETITIONS.smat]: pick(lists.smat),
    },
    captainId: captain ? (idOf.get(captain) ?? null) : null,
  };
}

// --- Sides picked from the state players ------------------------------------------------------

/** A balanced squad of 17 by role: 5 batters, 2 keepers, 3 all-rounders, 4 seamers, 3 spinners. */
const BALANCE: Record<string, number> = { BAT: 5, WK: 2, AR: 3, PB: 4, SB: 3 };

function balanceGroup(role: PlayerRole): string {
  if (role === 'OPENING_BATTER' || role === 'BATTER') return 'BAT';
  if (role === 'WICKET_KEEPER_BATTER') return 'WK';
  if (role === 'BATTING_ALLROUNDER' || role === 'BOWLING_ALLROUNDER') return 'AR';
  return role === 'PACE_BOWLER' ? 'PB' : 'SB';
}

interface Ranked {
  id: string;
  rec: RealPlayerRecord;
  score: number;
}

/**
 * Real Indian players who will still be playing in `seasonYear`, ranked by
 * the overall their figures earn (less a little for age and decline).
 * `agePenaltyFrom` favours younger players (India A).
 */
function rankedIndians(seasonYear: number, filter: (rec: RealPlayerRecord) => boolean, agePenaltyFrom = 99): Ranked[] {
  const data = realData();
  if (!data) return [];
  const ids = new Set<string>();
  for (const s of Object.values(data.domestic.squads)) for (const id of [...s.ranji, ...s.vht, ...s.smat]) ids.add(id);
  for (const id of Object.values(data.ipl.squads).flat()) ids.add(id);
  const out: Ranked[] = [];
  for (const id of ids) {
    const rec = realRecord(id);
    if (!rec || rec.c !== 'India' || !filter(rec)) continue;
    const ageNow = ageOn(realDateOfBirth(rec), `${realSeason()}-06-01`);
    const age = ageNow + (seasonYear - realSeason());
    if (age >= realRetireAge(rec, ageNow)) continue;
    const decline = Math.max(0, age - 31) * 1.4;
    const score = realRatings(rec).overall - decline - Math.max(0, age - agePenaltyFrom) * 2;
    out.push({ id, rec, score });
  }
  return out.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

function balancedPick(ranked: Ranked[], size: number): string[] {
  const scale = size / 17;
  const want = Object.fromEntries(Object.entries(BALANCE).map(([g, n]) => [g, Math.max(1, Math.round(n * scale))]));
  const picked: string[] = [];
  const have: Record<string, number> = {};
  for (const r of ranked) {
    if (picked.length >= size) break;
    const g = balanceGroup(realRole(r.rec.r));
    if ((have[g] ?? 0) >= want[g]) continue;
    have[g] = (have[g] ?? 0) + 1;
    picked.push(r.id);
  }
  for (const r of ranked) {
    if (picked.length >= size) break;
    if (!picked.includes(r.id)) picked.push(r.id);
  }
  return picked;
}

/** India's senior squad: on international duty, so not in the zones or the Rest of India. */
function indiaSquadIds(): Set<string> {
  return new Set(realData()?.international.squads.India ?? []);
}

/** A zone: the best of its states' players. */
export function realZoneSquad(zone: string, teamId: string, seasonYear: number): RivalPlayer[] | null {
  if (!realData()) return null;
  const sides = new Set(ALL_SIDES.filter((s) => s.zone === zone).map((s) => s.team));
  const busy = indiaSquadIds();
  const ranked = rankedIndians(seasonYear, (rec) => !busy.has(rec.id) && sides.has(realHomeSide(rec.id) ?? ''));
  return materialise(balancedPick(ranked, REAL_PLAYERS.zoneSquad), teamId, seasonYear, stateOfSide([...sides][0] ?? 'Tamil Nadu'));
}

/** Rest of India: the best players outside the India squad. */
export function realRestOfIndiaSquad(teamId: string, seasonYear: number): RivalPlayer[] | null {
  if (!realData()) return null;
  const busy = indiaSquadIds();
  const ranked = rankedIndians(seasonYear, (rec) => !busy.has(rec.id));
  return materialise(balancedPick(ranked, REAL_PLAYERS.zoneSquad), teamId, seasonYear, 'Maharashtra');
}

/** India A: the best uncapped and fringe Indian players, younger ones first. */
export function realIndiaASquad(teamId: string, seasonYear: number): RivalPlayer[] | null {
  if (!realData()) return null;
  const busy = indiaSquadIds();
  const ranked = rankedIndians(seasonYear, (rec) => !busy.has(rec.id), 28);
  return materialise(balancedPick(ranked, REAL_PLAYERS.indiaASquad), teamId, seasonYear, 'Maharashtra');
}

// --- Topping up ---------------------------------------------------------------------------------

/**
 * Fill a squad to `size` with generated players in the roles it is short
 * of (against the usual balance), for a side whose real players have
 * retired or who are too few.
 */
export function fillSquad(squad: RivalPlayer[], size: number, input: Omit<SquadInput, 'size' | 'roles'>): RivalPlayer[] {
  const missing = size - squad.length;
  if (missing <= 0) return squad;
  const template = SQUAD_ROLES.slice(0, Math.max(size, 11));
  const count = (role: PlayerRole, list: { role: PlayerRole }[]) => list.filter((p) => p.role === role).length;
  const roles: PlayerRole[] = [];
  const planned: { role: PlayerRole }[] = [...squad];
  for (const role of template) {
    if (roles.length >= missing) break;
    if (count(role, planned) < count(role, template.map((r) => ({ role: r })))) {
      roles.push(role);
      planned.push({ role });
    }
  }
  for (const role of template) {
    if (roles.length >= missing) break;
    roles.push(role);
  }
  const taken = input.taken ?? new Set(squad.map((p) => p.name));
  const fresh = generateSquad({ ...input, size: roles.length, roles, taken });
  return [...squad, ...fresh];
}

/**
 * Real players for an IPL auction pool: Indians from the state squads and
 * overseas internationals not on a franchise's books (`taken`, by real id),
 * drawn from the best available. Fewer than asked when the data runs short.
 */
export function realAuctionPool(seasonYear: number, taken: Set<string>, teamId: string, counts: { domestic: number; overseas: number }, rng: Rng): RivalPlayer[] {
  const data = realData();
  if (!data) return [];
  const draw = (ranked: Ranked[], n: number): string[] => {
    const shortlist = ranked.slice(0, n * 3);
    const out: string[] = [];
    while (out.length < n && shortlist.length) out.push(shortlist.splice(rng.int(0, Math.min(shortlist.length - 1, n)), 1)[0].id);
    return out;
  };
  const indians = rankedIndians(seasonYear, (rec) => !taken.has(rec.id));
  const overseas: Ranked[] = [];
  for (const [nation, ids] of Object.entries(data.international.squads)) {
    if (nation === 'India') continue;
    for (const id of ids) {
      const rec = realRecord(id);
      if (!rec || taken.has(id)) continue;
      const ageNow = ageOn(realDateOfBirth(rec), `${realSeason()}-06-01`);
      if (ageNow + (seasonYear - realSeason()) >= realRetireAge(rec, ageNow)) continue;
      overseas.push({ id, rec, score: realRatings(rec).overall });
    }
  }
  overseas.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const domesticIds = draw(indians, counts.domestic);
  const overseasIds = draw(overseas, counts.overseas);
  return [
    ...materialise(domesticIds, teamId, seasonYear, 'Tamil Nadu'),
    ...materialise(overseasIds, teamId, seasonYear, 'Australia', () => true).map((p) => ({ ...p, overseas: true, capped: true })),
  ];
}

/**
 * The best real Indian players outside a side (by real id) in some roles:
 * the country's contenders for the national selectors, ahead of anyone
 * generated.
 */
export function realContenders(teamId: string, seasonYear: number, exclude: Set<string>, roles: PlayerRole[], count: number): RivalPlayer[] {
  if (!realData() || count <= 0) return [];
  const busy = indiaSquadIds();
  const ranked = rankedIndians(seasonYear, (rec) => !exclude.has(rec.id) && !busy.has(rec.id) && roles.includes(realRole(rec.r)));
  return materialise(ranked.slice(0, count).map((r) => r.id), teamId, seasonYear, 'Maharashtra');
}
