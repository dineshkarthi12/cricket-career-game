/**
 * The IPL: scouts, franchise interest, trials, retention, the auction, the
 * contract, replacement signings and trades. The IPL is never automatic -
 * reputation earns a trial, a trial earns a shortlist, and the auction room
 * may still leave the player unsold.
 */
import { AUCTION, IPL_RULES } from '../config';
import { FRANCHISES, FRANCHISES_BY_ID, type FranchiseInfo } from '@/data/franchises';
import { TOURNAMENTS_BY_ID } from '@/data/tournaments';
import { formatOverall } from '../ratings';
import { generateWorldPlayer } from '../world/players';
import { LEVELS } from '../world/teams';
import { roleGroup, type RoleGroup } from '../career/squads';
import { tournamentOf } from '../tournament/live';
import { resolveClashes } from '../career/involvement';
import { INDIAN_REGIONS, OVERSEAS_NATIONS, OVERSEAS_PROFILE, bookSalary, rngFor, setUserFranchiseFlag } from './world';
import { realAuctionPool } from '../world/realSquads';
import { clamp, decision, formatLakh, message, navigate, withEvent, withInbox } from './common';
import type { Rng } from '../match/rng';
import type { AuctionBid, AuctionLot, AuctionRoomLot, AuctionSummary, GameState, IplContract, IplSeasonLine, IplStatus, Match, RivalPlayer, SquadPlace, Team } from '@/types';

export const AUCTION_POOL_ID = 'team-ipl-auction-pool';

// --- Seasons and cycles ----------------------------------------------------------------

/** The auction in December of `seasonYear` is a mega auction every third season. */
export function isMegaSeason(seasonYear: number): boolean {
  return seasonYear % 3 === 0;
}

/** The last season a contract signed in `seasonYear` covers (up to the next mega auction). */
export function contractEnd(seasonYear: number): number {
  let y = seasonYear + 1;
  while (!isMegaSeason(y)) y += 1;
  return Math.max(seasonYear, y - 1);
}

export function iplYearLabel(seasonYear: number): string {
  return `IPL ${seasonYear + 1}`;
}

// --- Value ---------------------------------------------------------------------------

/** What a T20 cricketer is worth at auction, lakh. */
export function t20Value(t20Overall: number, form: number, age: number): number {
  const base = AUCTION.valueBase * Math.exp((t20Overall - AUCTION.valueFrom) / AUCTION.valueScale);
  const formFactor = 0.8 + clamp(form, 0, 100) / 100 * 0.45;
  const ageFactor = age >= 33 ? 0.82 ** (age - 32) : age <= 23 ? 1.1 : 1;
  return clamp(Math.round(base * formFactor * ageFactor), 10, AUCTION.valueCap);
}

export function rivalValue(p: RivalPlayer): number {
  return t20Value(formatOverall(p.attributes, p.role, 'T20'), p.condition.form, p.age);
}

/** What an IPL season does to the player's auction value: x0.8 (poor) to x2.4 (huge). */
type SeasonFigures = Pick<IplSeasonLine, 'matches' | 'runs' | 'wickets'> & Partial<IplSeasonLine>;

/** An IPL season in points: runs x (strike rate / 130), plus 25 a wicket x (8 / economy). */
export function iplPoints(line: SeasonFigures): number {
  if (line.matches < AUCTION.iplImpact.minMatches) return 0;
  const sr = line.balls ? (line.runs / line.balls) * 100 : 130;
  const econ = line.ballsBowled ? (line.runsConceded ?? 0) / (line.ballsBowled / 6) : 8;
  return line.runs * clamp(sr / 130, 0.6, 1.5) + line.wickets * 25 * clamp(8 / Math.max(econ, 4), 0.6, 1.5);
}

/** What an IPL season does to the player's auction value: x0.8 (poor) to x2.4 (huge). */
export function iplImpact(line: SeasonFigures): number {
  const c = AUCTION.iplImpact;
  if (line.matches < c.minMatches) return 1;
  return Math.round(clamp(c.from + iplPoints(line) / c.per, c.min, c.max) * 100) / 100;
}

/** The last IPL season's effect on value, while it is fresh (this season or last). */
export function lastIplImpact(state: GameState): { impact: number; points: number; line: IplSeasonLine | null } {
  const line = state.pro.ipl.seasons.at(-1);
  if (!line || line.seasonYear < state.season.year - 1) return { impact: 1, points: 0, line: null };
  return { impact: line.impact ?? iplImpact(line), points: iplPoints(line), line };
}

/** The user's market value: ability, form, age, the last IPL season - and what the scouts think. */
export function userMarketValue(state: GameState): number {
  const p = state.player;
  const base = t20Value(formatOverall(p.attributes, p.role, 'T20'), p.condition.form, p.age);
  const rep = state.pro.scouting.reputation;
  const last = lastIplImpact(state);
  const rated = base * (0.55 + (rep / 100) * 0.9) * last.impact;
  // The numbers speak for themselves: a big season is paid for whatever the ratings say.
  const c = AUCTION.iplPerformanceValue;
  const proven = last.points > 0 ? c.base * Math.exp(last.points / c.scale) * (0.85 + (rep / 100) * 0.3) : 0;
  return Math.round(clamp(Math.max(rated, proven), 10, AUCTION.valueCap));
}

function capped(state: GameState): boolean {
  const caps = state.pro.national.caps;
  return caps.T20I + caps.ODI + caps.TEST > 0;
}

/** Base prices the player may register at. */
export function allowedBases(state: GameState): number[] {
  return capped(state) ? [...AUCTION.bases] : AUCTION.bases.filter((b) => b <= AUCTION.uncappedMaxBase);
}

/** The agent's choice: the highest band comfortably below the market value. */
export function defaultBase(state: GameState): number {
  const value = userMarketValue(state);
  const bands = allowedBases(state);
  return [...bands].reverse().find((b) => b <= value * 0.55) ?? bands[0];
}

export function increment(price: number): number {
  return AUCTION.increments.find((i) => price < i.upTo)?.step ?? 25;
}

// --- Scouting ------------------------------------------------------------------------

/** What one match does to the scouts' opinion. */
export function scoutingDelta(match: Match): { delta: number; reason: string } | null {
  const p = match.userPerformance;
  if (!p) return null;
  const weight = AUCTION.scoutingWeight[match.tournamentId];
  if (!weight) return null;
  const name = TOURNAMENTS_BY_ID[match.tournamentId]?.shortName ?? match.tournamentId;
  let delta = (p.rating - 5.5) * weight;
  const reasons: string[] = [];
  const t20 = match.format === 'T20';
  const sr = p.ballsFaced > 0 ? (p.runs / p.ballsFaced) * 100 : 0;
  if (t20 && p.runs >= 70) {
    delta += 3;
    reasons.push(`${p.runs} in a T20`);
  } else if (t20 && p.runs >= 45 && sr >= 150) {
    delta += 2;
    reasons.push(`${p.runs} off ${p.ballsFaced}`);
  }
  if (t20 && p.wickets >= 4) {
    delta += 3;
    reasons.push(`${p.wickets}/${p.runsConceded}`);
  }
  if (!t20 && p.runs >= 100 && weight >= 1) {
    delta += 1.5;
    reasons.push(`a hundred in the ${name}`);
  }
  if (Math.abs(delta) < 0.3) return null;
  return { delta, reason: reasons.length ? `${reasons.join(', ')} (${name})` : `${name}: match rating ${p.rating.toFixed(1)}` };
}

/** Fold a match into the scouting reputation and the franchises' interest. */
export function scoutMatch(state: GameState, match: Match): GameState {
  const change = scoutingDelta(match);
  if (!change || state.player.age < 16) return state;
  const s = state.pro.scouting;
  const reputation = clamp(Math.round((s.reputation + change.delta) * 10) / 10, 0, 100);
  const notes = [{ date: match.date, delta: Math.round(change.delta * 10) / 10, reason: change.reason }, ...s.notes].slice(0, 20);
  let next: GameState = { ...state, pro: { ...state.pro, scouting: { ...s, reputation, notes } } };
  next = refreshInterest(next);
  return scoutContacts(next, match.date);
}

/** Does this franchise need a player like the user? 0.6 (well stocked) to 1.3 (short). */
export function needFor(team: Team | undefined, group: RoleGroup): number {
  if (!team) return 1;
  const have = team.squad.filter((p) => roleGroup(p.role) === group).length;
  const want = AUCTION.roleTargets[group] ?? 4;
  return have < want ? 1.3 : have === want ? 1 : 0.65;
}

function styleFit(f: FranchiseInfo, group: RoleGroup): number {
  if (f.style === 'SPIN' && group === 'SPIN') return 1.15;
  if (f.style === 'PACE' && group === 'PACE') return 1.15;
  if (f.style === 'BATTING' && (group === 'BATTER' || group === 'KEEPER')) return 1.1;
  return 1;
}

/** Each franchise's interest, 0-100: reputation, their needs and their style. */
export function refreshInterest(state: GameState): GameState {
  const group = roleGroup(state.player.role);
  const rep = state.pro.scouting.reputation;
  const rng = rngFor(state, `interest-${state.season.year}`);
  // A big IPL season gets every franchise talking about the player.
  const ipl = clamp(lastIplImpact(state).impact, 1, 1.6);
  const interest: Record<string, number> = {};
  for (const f of FRANCHISES) {
    const fit = needFor(state.teams[f.id], group) * styleFit(f, group);
    const wobble = 0.9 + rng.next() * 0.2;
    const own = state.pro.ipl.franchiseId === f.id ? 1.1 : 1;
    interest[f.id] = Math.round(clamp(rep * fit * wobble * own * ipl, 0, 100));
  }
  return { ...state, pro: { ...state.pro, scouting: { ...state.pro.scouting, interest } } };
}

/** Scouts introduce themselves as interest crosses the line (once a season each). */
export function scoutContacts(state: GameState, date: string): GameState {
  const s = state.pro.scouting;
  const fresh = FRANCHISES.filter((f) => (s.interest[f.id] ?? 0) >= AUCTION.scoutedAt && !s.contacted.includes(f.id) && state.pro.ipl.franchiseId !== f.id);
  if (fresh.length === 0) return state;
  const f = fresh.sort((a, b) => (s.interest[b.id] ?? 0) - (s.interest[a.id] ?? 0))[0];
  const next: GameState = { ...state, pro: { ...state.pro, scouting: { ...s, contacted: [...s.contacted, ...fresh.map((x) => x.id)] } } };
  const body =
    (s.interest[f.id] ?? 0) >= AUCTION.trialAt
      ? `A ${f.name} scout was at your last match and has asked for your details. Expect an invitation to the franchise trials.`
      : `A ${f.name} scout watched you from the stands. They are keeping a file - keep the numbers coming in the Mushtaq Ali and the Vijay Hazare.`;
  return withInbox(next, message(date, 'FRANCHISE', `${f.name} scouting`, `IPL scouts: ${f.name} are watching`, body, 'CONTRACT', true, [navigate('Open IPL', '/auction')], f.id));
}

/** Best franchise for the user right now. */
export function keenest(state: GameState, exclude: string | null = null): FranchiseInfo | null {
  const s = state.pro.scouting;
  return [...FRANCHISES].filter((f) => f.id !== exclude).sort((a, b) => (s.interest[b.id] ?? 0) - (s.interest[a.id] ?? 0))[0] ?? null;
}

// --- Contracts and squads ------------------------------------------------------------------

function iplPlace(status: SquadPlace['status'], reason: string, since: string, teamId: string): SquadPlace {
  return { tournamentId: 'ipl', teamId, status, reason, since };
}

/** Point the season's IPL at the user's franchise (or none) and hand the fixtures over. */
export function syncIplInvolvement(state: GameState): GameState {
  const fid = state.pro.ipl.franchiseId;
  let next = setUserFranchiseFlag(state, fid);
  const t = tournamentOf(next, 'ipl');
  const inSquad = next.career.squads.ipl?.status === 'SQUAD' && !next.pro.retirement.retiredFrom.includes('IPL');
  if (t) {
    next = { ...next, season: { ...next.season, tournaments: next.season.tournaments.map((x) => (x === t ? { ...t, userTeamId: fid } : x)) } };
    const today = next.season.currentDate;
    const fixtures = { ...next.fixtures };
    let changed = false;
    for (const f of Object.values(next.fixtures)) {
      if (f.tournamentId !== 'ipl' || f.kind !== 'MATCH' || f.played || f.date <= today) continue;
      const mine = inSquad && Boolean(fid) && (f.homeTeamId === fid || f.awayTeamId === fid);
      if (f.involvesUser !== mine) {
        fixtures[f.id] = { ...f, involvesUser: mine };
        changed = true;
      }
    }
    if (changed) next = { ...next, fixtures };
  }
  const teamIds = next.player.currentTeamIds.filter((id) => !FRANCHISES_BY_ID[id]);
  next = { ...next, player: { ...next.player, currentTeamIds: fid && inSquad ? [fid, ...teamIds] : teamIds } };
  return resolveClashes(next);
}

export function joinFranchise(state: GameState, franchiseId: string, salary: number, how: IplContract['how'], date: string): GameState {
  const f = FRANCHISES_BY_ID[franchiseId];
  const year = state.season.year;
  const contract: IplContract = { franchiseId, salary, fromSeason: year, toSeason: contractEnd(year), how };
  const status: IplStatus = how === 'REPLACEMENT' ? 'REPLACEMENT' : how === 'RETAINED' ? 'RETAINED' : how === 'TRADE' ? 'TRADED' : 'BOUGHT';
  let next: GameState = {
    ...state,
    pro: { ...state.pro, ipl: { ...state.pro.ipl, franchiseId, contract, status, tradeOffer: null } },
    career: { ...state.career, squads: { ...state.career.squads, ipl: iplPlace('SQUAD', `Contracted to ${f?.name} at ${formatLakh(salary)} a season.`, date, franchiseId) } },
    player: { ...state.player, contracts: [...state.player.contracts.map((c) => (c.level === 'FRANCHISE' ? { ...c, active: false, toSeason: c.toSeason ?? year } : c)), { id: `ctr-${franchiseId}-${year}`, teamId: franchiseId, teamName: f?.name ?? franchiseId, level: 'FRANCHISE', fromSeason: year, toSeason: contract.toSeason, value: salary, role: 'PLAYER', active: true }] },
  };
  next = syncIplInvolvement(next);
  return withEvent(next, date, 'CONTRACT', `IPL contract: ${f?.name}`, `${how === 'REPLACEMENT' ? 'Signed as a replacement' : how === 'TRADE' ? 'Traded' : how === 'RETAINED' ? 'Retained' : 'Bought at the auction'} for ${formatLakh(salary)} a season.`, 'IPL_CAREER');
}

export function leaveFranchise(state: GameState, date: string, status: IplStatus, reason: string): GameState {
  const fid = state.pro.ipl.franchiseId;
  let next: GameState = {
    ...state,
    pro: { ...state.pro, ipl: { ...state.pro.ipl, franchiseId: null, contract: null, status } },
    career: { ...state.career, squads: { ...state.career.squads, ipl: iplPlace('NOT_SELECTED', reason, date, fid ?? '') } },
    player: { ...state.player, contracts: state.player.contracts.map((c) => (c.level === 'FRANCHISE' && c.active ? { ...c, active: false, toSeason: state.season.year } : c)) },
  };
  next = syncIplInvolvement(next);
  return next;
}

// --- Retention day ------------------------------------------------------------------------

function purseFor(state: GameState, f: string, squad: RivalPlayer[], mega: boolean): number {
  const cap = AUCTION.purse + AUCTION.purseGrowth * Math.max(0, state.season.year - 2026);
  const spent = squad.reduce((s, p) => s + (p.salary ?? 0), 0) + (state.pro.ipl.franchiseId === f ? (state.pro.ipl.contract?.salary ?? 0) : 0);
  return Math.max(mega ? AUCTION.purseFloor.mega : AUCTION.purseFloor.mini, cap - spent);
}

/**
 * November: franchises decide who stays. In a mega-auction year they keep at
 * most four (at slab prices); otherwise they release the players who are not
 * worth their salary any more. Released players go into the auction pool.
 */
export function retentionDay(state: GameState, date: string): GameState {
  const year = state.season.year;
  const mega = isMegaSeason(year);
  const rng = rngFor(state, `retention-${year}`);
  const released: RivalPlayer[] = [];
  const teams = { ...state.teams };
  const purses: Record<string, number> = {};
  for (const f of FRANCHISES) {
    const team = teams[f.id];
    if (!team) continue;
    let keep: RivalPlayer[];
    if (mega) {
      const ranked = [...team.squad].sort((a, b) => rivalValue(b) - rivalValue(a));
      keep = [];
      for (const p of ranked) {
        if (keep.length >= AUCTION.maxRetained - (state.pro.ipl.franchiseId === f.id && !state.pro.ipl.intoAuction && userRetained(state, team, true) ? 1 : 0)) break;
        if (p.overseas && keep.filter((k) => k.overseas).length >= 2) continue;
        keep.push({ ...p, salary: Math.max(AUCTION.retentionSlabs[keep.length] ?? 900, rivalValue(p)) });
      }
    } else {
      keep = team.squad.filter((p) => {
        const value = rivalValue(p);
        const tooDear = value < (p.salary ?? 20) * 0.55;
        const old = p.age >= 36;
        const dropped = rng.chance(0.08);
        return !(tooDear || old || dropped);
      });
    }
    for (const p of team.squad) if (!keep.some((k) => k.id === p.id)) released.push({ ...p, teamId: AUCTION_POOL_ID, salary: undefined });
    teams[f.id] = { ...team, squad: keep };
    purses[f.id] = purseFor(state, f.id, keep, mega);
  }
  teams[AUCTION_POOL_ID] = {
    ...(teams[AUCTION_POOL_ID] ?? poolTeam()),
    squad: released,
  };
  let next: GameState = { ...state, teams, pro: { ...state.pro, ipl: { ...state.pro.ipl, purses } } };

  // The user's own contract.
  const fid = next.pro.ipl.franchiseId;
  if (fid) {
    const team = next.teams[fid];
    const f = FRANCHISES_BY_ID[fid];
    const value = userMarketValue(next);
    const salary = next.pro.ipl.contract?.salary ?? 20;
    const wantsOut = Boolean(next.pro.ipl.intoAuction);
    const kept = !wantsOut && userRetained(next, team, mega);
    if (wantsOut) {
      next = leaveFranchise(next, date, 'RELEASED', `Released by ${f?.name} at your request - into the auction.`);
      next = { ...next, pro: { ...next.pro, ipl: { ...next.pro.ipl, intoAuction: false } } };
      next = withInbox(next, message(date, 'AGENT', 'Agent', `Into the auction: ${f?.name} let you go`, `${f?.name} have released you as you asked. Your market value is ${formatLakh(value)} - every franchise will see the numbers from last season on 16 December.`, 'CONTRACT', true, [navigate('Open IPL', '/auction')], fid));
      next = withEvent(next, date, 'CONTRACT', 'Into the auction', `Asked ${f?.name} for a release to go into the auction.`, 'IPL_CAREER');
    } else if (kept) {
      // A strong season earns a better deal (at worst the old one).
      const newSalary = mega ? Math.max(AUCTION.retentionSlabs[Math.min(3, team.squad.length)] ?? 900, value) : Math.max(salary, Math.round(value * 0.7));
      next = joinFranchise(next, fid, newSalary, 'RETAINED', date);
      next = withInbox(next, message(date, 'FRANCHISE', f?.name ?? 'Franchise', `Retained by ${f?.name}`, newSalary > salary ? `${f?.name} have kept you - on an improved deal of ${formatLakh(newSalary)} a season.` : `${f?.name} have kept you for next season at ${formatLakh(newSalary)}.`, 'CONTRACT', true, [navigate('Open IPL', '/auction')], fid));
      next = { ...next, pro: { ...next.pro, ipl: { ...next.pro.ipl, purses: { ...next.pro.ipl.purses, [fid]: Math.max(300, (next.pro.ipl.purses[fid] ?? 0) - (newSalary - salary)) } } } };
    } else {
      next = leaveFranchise(next, date, 'RELEASED', `Released by ${f?.name} - back into the auction.`);
      next = withInbox(next, message(date, 'FRANCHISE', f?.name ?? 'Franchise', `Released by ${f?.name}`, mega ? 'Every franchise starts again in a mega auction year, and you were not one of their four. You go back into the auction.' : 'The franchise wants the money for other players. You go back into the auction pool - a good domestic season can still get you a new home.', 'CONTRACT', true, [navigate('Open IPL', '/auction')], fid));
      next = withEvent(next, date, 'CONTRACT', 'Released by the franchise', `${f?.name} did not retain you.`, 'IPL_CAREER');
    }
  }
  return next;
}

function poolTeam(): Team {
  return {
    id: AUCTION_POOL_ID,
    name: 'IPL auction pool',
    shortName: 'Auction pool',
    kind: 'CLUB',
    level: 'FRANCHISE',
    crest: { monogram: 'AP', primaryColor: '#0F1B33', secondaryColor: '#F5C518', shape: 'DIAMOND' },
    homeVenueId: 'venue-chepauk',
    strength: 60,
    formats: ['T20'],
    squad: [],
    playingXiIds: [],
    captainId: null,
    needs: ['NONE'],
    isUserTeam: false,
    morale: 60,
  };
}

/** Does the franchise keep the user? */
function userRetained(state: GameState, team: Team | undefined, mega: boolean): boolean {
  if (!team || state.pro.retirement.retiredFrom.includes('IPL')) return false;
  const value = userMarketValue(state);
  const last = state.pro.ipl.seasons[state.pro.ipl.seasons.length - 1];
  const share = last && last.teamMatches > 0 ? last.matches / last.teamMatches : 0.5;
  if (mega) {
    const better = team.squad.filter((p) => rivalValue(p) > value).length;
    return better < AUCTION.maxRetained - 1 && share >= 0.5;
  }
  const salary = state.pro.ipl.contract?.salary ?? 20;
  if (state.player.age >= 36 && value < salary) return false;
  return value >= salary * 0.55 || share >= 0.5;
}

// --- The auction ------------------------------------------------------------------------------

interface Bidder {
  franchiseId: string;
  max: number;
}

/** What each franchise is prepared to pay for a player right now. */
function valuations(value: number, group: RoleGroup, overseas: boolean, purses: Record<string, number>, squads: Record<string, RivalPlayer[]>, rng: Rng, userBoost: Record<string, number> | null, hot = false): Bidder[] {
  const out: Bidder[] = [];
  for (const f of FRANCHISES) {
    const squad = squads[f.id] ?? [];
    const slots = IPL_RULES.squadSize - squad.length;
    // A full franchise still makes room (releasing a fringe player) for a player everyone wants.
    if (slots <= 0 && !hot) continue;
    if (overseas && squad.filter((p) => p.overseas).length >= IPL_RULES.maxOverseasSquad) continue;
    const purse = purses[f.id] ?? 0;
    const reserve = hot ? 0 : 20 * Math.max(0, slots - 1);
    // A player everyone saw dominate the IPL: no franchise thinks it is "well stocked".
    const need = hot ? Math.max(1, needFor({ squad } as Team, group)) : needFor({ squad } as Team, group);
    const noise = 0.8 + rng.next() * 0.4;
    const boost = userBoost ? Math.max(hot ? 0.95 : 0, 0.55 + (userBoost[f.id] ?? 0) / 100 * 0.9) : 1;
    const max = Math.min(value * need * styleFit(f, group) * noise * boost, purse - reserve);
    out.push({ franchiseId: f.id, max: Math.round(max) });
  }
  return out;
}

/**
 * An ascending auction: bids go up in steps until only one franchise is left.
 * In a bidding war (`war`) any franchise still willing may come in, not just
 * the keenest two, so the whole room raises its paddles.
 */
export function hammer(base: number, bidders: Bidder[], rng: Rng, war = false): { bids: AuctionBid[]; soldTo: string | null; price: number | null } {
  const active = bidders.filter((b) => b.max >= base).sort((a, b) => b.max - a.max);
  if (active.length === 0) return { bids: [], soldTo: null, price: null };
  const bids: AuctionBid[] = [];
  let price = base;
  let leader = rng.pick(active.slice(0, Math.min(3, active.length)));
  bids.push({ franchiseId: leader.franchiseId, amount: price });
  for (let guard = 0; guard < 400; guard += 1) {
    const next = price + increment(price);
    const challengers = active.filter((b) => b !== leader && b.max >= next);
    if (challengers.length === 0) break;
    leader = rng.pick(war ? challengers : challengers.slice(0, Math.min(2, challengers.length)));
    price = next;
    bids.push({ franchiseId: leader.franchiseId, amount: price });
  }
  return { bids: bids.length > 30 ? [...bids.slice(0, 6), ...bids.slice(-24)] : bids, soldTo: leader.franchiseId, price };
}

function lotOf(p: RivalPlayer, base: number, isUser: boolean): AuctionLot {
  return { playerId: p.id, name: p.name, role: p.role, age: p.age, overseas: Boolean(p.overseas), capped: Boolean(p.capped), basePrice: base, bids: [], soldTo: null, price: null, isUser };
}

function baseFor(value: number, isCapped: boolean): number {
  const bands = isCapped ? AUCTION.bases : AUCTION.bases.filter((b) => b <= AUCTION.uncappedMaxBase);
  return [...bands].reverse().find((b) => b <= value * 0.5) ?? bands[0];
}

const SET_ORDER: { group: RoleGroup; label: string }[] = [
  { group: 'BATTER', label: 'batters' },
  { group: 'ALLROUNDER', label: 'all-rounders' },
  { group: 'KEEPER', label: 'wicket-keepers' },
  { group: 'PACE', label: 'fast bowlers' },
  { group: 'SPIN', label: 'spinners' },
];

/**
 * The order of the room, as at the IPL: the marquee set first, then capped
 * players set by set (batters, all-rounders, keepers, fast bowlers,
 * spinners), then the uncapped sets. The best go first within a set.
 */
export function auctionSets<T extends { player: { role: RivalPlayer['role']; capped?: boolean }; value: number; marquee?: boolean }>(entries: T[], mega: boolean): { entry: T; set: string }[] {
  const byValue = [...entries].sort((a, b) => b.value - a.value);
  // The marquee set: the best capped players, and anyone the whole league is talking about.
  const marquee = [...byValue.filter((e) => e.marquee), ...byValue.filter((e) => e.player.capped && !e.marquee).slice(0, mega ? 12 : 6)].sort((a, b) => b.value - a.value);
  const inMarquee = new Set(marquee);
  const out: { entry: T; set: string }[] = marquee.map((entry) => ({ entry, set: 'Marquee set' }));
  for (const capped of [true, false]) {
    for (const { group, label } of SET_ORDER) {
      for (const entry of byValue) {
        if (inMarquee.has(entry) || Boolean(entry.player.capped) !== capped || roleGroup(entry.player.role) !== group) continue;
        out.push({ entry, set: `${capped ? 'Capped' : 'Uncapped'} ${label}` });
      }
    }
  }
  return out;
}

/** Is the user in the auction, and if not, why not? */
export function auctionEntry(state: GameState): { inAuction: boolean; status: IplStatus; reason: string } {
  const ipl = state.pro.ipl;
  if (state.pro.retirement.retiredFrom.includes('IPL') || state.pro.retirement.complete) return { inAuction: false, status: ipl.status, reason: 'Retired from the IPL.' };
  if (ipl.franchiseId) return { inAuction: false, status: ipl.status, reason: 'Under contract.' };
  const rep = state.pro.scouting.reputation;
  const trial = state.pro.scouting.trials.find((t) => t.date >= state.season.startDate);
  const trialCase = trial ? trial.bonus * 1.2 : 0;
  if (capped(state) || rep + trialCase >= AUCTION.shortlistAt) return { inAuction: true, status: 'SHORTLISTED', reason: `Shortlisted: scouting reputation ${Math.round(rep)}${trial ? `, franchise trial ${trial.bonus > 0 ? '+' : ''}${trial.bonus}` : ''}.` };
  return { inAuction: false, status: rep >= AUCTION.scoutedAt ? 'NOT_SHORTLISTED' : 'NOT_SCOUTED', reason: `Not on the auction shortlist: scouting reputation ${Math.round(rep)} (${AUCTION.shortlistAt} needed). T20 runs and wickets in the Mushtaq Ali are what the scouts watch.` };
}

/**
 * December: the auction. Released players, fresh domestic names and
 * overseas players go under the hammer with the user (when shortlisted).
 * Each franchise bids to its own valuation - ability, form, age, what it
 * needs, its style, its purse - and a lot goes to the last bidder standing.
 */
export function runAuction(state: GameState, date: string): GameState {
  const year = state.season.year;
  const mega = isMegaSeason(year);
  const rng = rngFor(state, `auction-${year}`);
  const entry = auctionEntry(state);
  const purses: Record<string, number> = { ...state.pro.ipl.purses };
  const squads: Record<string, RivalPlayer[]> = {};
  for (const f of FRANCHISES) {
    squads[f.id] = [...(state.teams[f.id]?.squad ?? [])];
    if (purses[f.id] === undefined) purses[f.id] = purseFor(state, f.id, squads[f.id], mega);
  }

  // The pool.
  const seasonStart = `${year}-06-01`;
  const fresh: RivalPlayer[] = [];
  const taken = new Set<string>();
  const domestic = mega ? AUCTION.freshDomestic.mega : AUCTION.freshDomestic.mini;
  const overseas = mega ? AUCTION.freshOverseas.mega : AUCTION.freshOverseas.mini;
  const roles = ['BATTER', 'OPENING_BATTER', 'PACE_BOWLER', 'SPIN_BOWLER', 'BATTING_ALLROUNDER', 'BOWLING_ALLROUNDER', 'WICKET_KEEPER_BATTER', 'PACE_BOWLER'] as const;
  // Real players not on a franchise's books come first; generated names make up the numbers.
  const signed = new Set<string>();
  for (const f of FRANCHISES) for (const p of squads[f.id]) if (p.realId) signed.add(p.realId);
  for (const p of state.teams[AUCTION_POOL_ID]?.squad ?? []) if (p.realId) signed.add(p.realId);
  const real = realAuctionPool(year, signed, AUCTION_POOL_ID, { domestic, overseas }, rng);
  const realDomestic = real.filter((p) => !p.overseas).length;
  const realOverseas = real.length - realDomestic;
  fresh.push(...real.map((p) => ({ ...p, capped: p.capped ?? p.overall >= 80 })));
  for (const p of real) taken.add(p.name);
  for (let i = realDomestic; i < domestic; i += 1) {
    const p = generateWorldPlayer({ teamId: AUCTION_POOL_ID, region: rng.pick(INDIAN_REGIONS), role: roles[i % roles.length], age: rng.int(19, 31), seasonStart, seasonYear: year, potential: LEVELS.FRANCHISE.potential[0] - 2 + rng.spread() * 6, share: 0.92, rng, taken });
    fresh.push({ ...p, capped: p.overall >= 80 });
  }
  for (let i = realOverseas; i < overseas; i += 1) {
    const p = generateWorldPlayer({ teamId: AUCTION_POOL_ID, region: rng.pick(OVERSEAS_NATIONS), role: roles[(i + 3) % roles.length], age: rng.int(OVERSEAS_PROFILE.ages[0], OVERSEAS_PROFILE.ages[1]), seasonStart, seasonYear: year, potential: OVERSEAS_PROFILE.potential[0] - 1 + rng.spread() * 6, share: 0.95, rng, taken });
    fresh.push({ ...p, overseas: true, capped: true });
  }
  const pool = [...(state.teams[AUCTION_POOL_ID]?.squad ?? []), ...fresh];

  // The user's lot.
  const userValue = userMarketValue(state);
  const userBase = state.pro.ipl.registeredBase && allowedBases(state).includes(state.pro.ipl.registeredBase) ? state.pro.ipl.registeredBase : defaultBase(state);
  const userAsRival: RivalPlayer = { ...fresh[0], id: state.player.id, name: `${state.player.firstName} ${state.player.lastName}`.trim(), role: state.player.role, age: state.player.age, overseas: false, realId: undefined, capped: capped(state), attributes: state.player.attributes };
  type Entry = { player: RivalPlayer; value: number; base: number; isUser: boolean; marquee?: boolean };
  const entries: Entry[] = pool.map((p) => {
    const value = rivalValue(p);
    return { player: p, value, base: baseFor(value, Boolean(p.capped)), isUser: false };
  });
  // After a big IPL season every franchise wants the user - and the user is in the marquee set.
  const hot = lastIplImpact(state).impact >= AUCTION.hotImpact;
  if (entry.inAuction) entries.push({ player: userAsRival, value: userValue, base: userBase, isUser: true, marquee: hot });
  const ordered = auctionSets(entries, mega);

  const pursesBefore = { ...purses };
  const squadsBefore = Object.fromEntries(FRANCHISES.map((f) => [f.id, { players: squads[f.id].length, overseas: squads[f.id].filter((p) => p.overseas).length }]));
  const lots: AuctionLot[] = [];
  const room: AuctionRoomLot[] = [];
  let userLot: AuctionLot | null = null;
  for (const { entry: e, set } of ordered) {
    const full = FRANCHISES.every((f) => squads[f.id].length >= IPL_RULES.squadSize);
    if (full && !e.isUser) break;
    const group = roleGroup(e.player.role);
    const bidders = valuations(e.value, group, Boolean(e.player.overseas), purses, squads, rng, e.isUser ? state.pro.scouting.interest : null, e.isUser && hot);
    const result = hammer(e.base, bidders, rng, e.isUser && hot);
    const lot: AuctionLot = { ...lotOf(e.player, e.base, e.isUser), bids: result.bids, soldTo: result.soldTo, price: result.price };
    lots.push(lot);
    room.push({ ...lot, bids: e.isUser || lot.bids.length <= 16 ? lot.bids : [...lot.bids.slice(0, 4), ...lot.bids.slice(-12)], set, overall: formatOverall(e.player.attributes, e.player.role, 'T20'), from: e.isUser ? state.player.state : e.player.region, real: Boolean(e.player.realId) });
    if (e.isUser) userLot = lot;
    if (result.soldTo && result.price) {
      purses[result.soldTo] -= result.price;
      if (!e.isUser) squads[result.soldTo].push({ ...e.player, teamId: result.soldTo, salary: result.price });
      else squads[result.soldTo].push({ ...userAsRival, id: '__user__' });
    }
  }
  // Short squads fill up with uncapped players at base price.
  for (const f of FRANCHISES) {
    squads[f.id] = squads[f.id].filter((p) => p.id !== '__user__');
    // A franchise that made room for the user lets its least valuable player go.
    const over = squads[f.id].length + (userLot?.soldTo === f.id ? 1 : 0) - IPL_RULES.squadSize;
    if (over > 0) squads[f.id] = [...squads[f.id]].sort((a, b) => rivalValue(b) - rivalValue(a)).slice(0, squads[f.id].length - over);
    const need = IPL_RULES.squadSize - squads[f.id].length - (userLot?.soldTo === f.id ? 1 : 0);
    for (let i = 0; i < need; i += 1) {
      const p = generateWorldPlayer({ teamId: f.id, region: rng.pick(INDIAN_REGIONS), role: roles[(i + 5) % roles.length], age: rng.int(19, 26), seasonStart, seasonYear: year, potential: LEVELS.FRANCHISE.potential[0] - 4 + rng.spread() * 5, share: 0.9, rng, taken });
      squads[f.id].push({ ...p, salary: 20 });
      purses[f.id] -= 20;
    }
  }

  const teams = { ...state.teams };
  for (const f of FRANCHISES) if (teams[f.id]) teams[f.id] = { ...teams[f.id], squad: squads[f.id] };
  teams[AUCTION_POOL_ID] = { ...(teams[AUCTION_POOL_ID] ?? poolTeam()), squad: [] };

  const userStatus: IplStatus = !entry.inAuction ? entry.status : userLot?.soldTo ? 'BOUGHT' : 'UNSOLD';
  const summary: AuctionSummary = {
    seasonYear: year,
    mega,
    date,
    userLot,
    lots: [...lots].filter((l) => l.price).sort((a, b) => (b.price ?? 0) - (a.price ?? 0)).slice(0, 12).concat(userLot && !userLot.price ? [userLot] : []),
    pursesAfter: purses,
    userStatus,
    room,
    pursesBefore,
    squadsBefore,
    watched: false,
  };
  // Only the latest auction keeps its full room; older ones keep the highlights.
  const past = state.pro.ipl.auctions.map(({ room: _room, pursesBefore: _p, squadsBefore: _s, ...a }) => ({ ...a, watched: true }));
  let next: GameState = {
    ...state,
    teams,
    pro: { ...state.pro, ipl: { ...state.pro.ipl, purses, status: userStatus, auctions: [...past, summary].slice(-8) } },
  };
  const title = `${mega ? 'Mega auction' : 'IPL auction'} ${year}`;
  if (userLot?.soldTo && userLot.price) {
    const f = FRANCHISES_BY_ID[userLot.soldTo];
    next = joinFranchise(next, userLot.soldTo, userLot.price, 'AUCTION', date);
    next = withInbox(next, message(date, 'AGENT', 'Agent', `SOLD to ${f?.name} for ${formatLakh(userLot.price)}!`, `${userLot.bids.length} bids from ${new Set(userLot.bids.map((b) => b.franchiseId)).size} franchises; base price ${formatLakh(userLot.basePrice)}. The franchise camp starts in March.`, 'CONTRACT', true, [navigate('Watch the auction', '/auction/live')], userLot.soldTo));
  } else if (userLot) {
    next = { ...next, career: { ...next.career, squads: { ...next.career.squads, ipl: iplPlace('NOT_SELECTED', 'Unsold at the auction - a replacement call can still come before the season.', date, '') } } };
    next = withInbox(next, message(date, 'AGENT', 'Agent', `${title}: unsold`, `No franchise bid at your base price of ${formatLakh(userLot.basePrice)}. It happens to good players. Stay ready - injuries bring replacement signings before and during the season.`, 'CONTRACT', true, [navigate('Watch the auction', '/auction/live')]));
  } else if (!state.pro.ipl.franchiseId && state.pro.scouting.reputation >= AUCTION.scoutedAt / 2) {
    next = { ...next, career: { ...next.career, squads: { ...next.career.squads, ipl: iplPlace('NOT_SELECTED', entry.reason, date, '') } } };
    next = withInbox(next, message(date, 'AGENT', 'Agent', `${title}: not shortlisted`, entry.reason, 'CONTRACT', false, [navigate('Open IPL', '/auction')]));
  }
  return next;
}

/** The latest auction has been watched live (or skipped). */
export function markAuctionWatched(state: GameState): GameState {
  const auctions = state.pro.ipl.auctions;
  const last = auctions[auctions.length - 1];
  if (!last || last.watched !== false) return state;
  return { ...state, pro: { ...state.pro, ipl: { ...state.pro.ipl, auctions: [...auctions.slice(0, -1), { ...last, watched: true }] } } };
}

/** An auction that has happened but not been watched yet. */
export function unwatchedAuction(state: GameState): AuctionSummary | null {
  const last = state.pro?.ipl.auctions.at(-1);
  return last && last.watched === false && last.room?.length ? last : null;
}

// --- Replacements and trades --------------------------------------------------------------------

/**
 * March: injuries before the season. Franchises that lose a player sign a
 * replacement - sometimes an unsold player the scouts still rate.
 */
export function replacementWindow(state: GameState, date: string): GameState {
  const ipl = state.pro.ipl;
  if (ipl.franchiseId || state.pro.retirement.retiredFrom.includes('IPL') || state.pro.retirement.complete) return state;
  const rep = state.pro.scouting.reputation;
  if (rep < AUCTION.scoutedAt) return state;
  const rng = rngFor(state, `replacement-${state.season.year}`);
  const group = roleGroup(state.player.role);
  for (const f of FRANCHISES) {
    if (!rng.chance(AUCTION.replacementChance)) continue;
    const lostGroup = rng.pick(['BATTER', 'BATTER', 'PACE', 'PACE', 'SPIN', 'ALLROUNDER', 'KEEPER'] as RoleGroup[]);
    if (lostGroup !== group) continue;
    const interest = state.pro.scouting.interest[f.id] ?? 0;
    if (rng.next() * 100 < interest * 0.9) {
      const salary = Math.max(20, Math.min(userMarketValue(state), 75));
      let next = joinFranchise(state, f.id, salary, 'REPLACEMENT', date);
      next = withInbox(next, message(date, 'FRANCHISE', f.name, `Replacement signing: ${f.name}`, `An injury in their squad and your name at the top of the scouts' list. ${f.name} sign you as a replacement for ${formatLakh(salary)}.`, 'CONTRACT', true, [navigate('Open IPL', '/auction')], f.id));
      return next;
    }
  }
  return state;
}

/** November: a franchise that rates the player more than their own does may offer a trade. */
export function tradeWindow(state: GameState, date: string): GameState {
  const ipl = state.pro.ipl;
  if (!ipl.franchiseId || ipl.tradeOffer || isMegaSeason(state.season.year)) return state;
  const last = ipl.seasons[ipl.seasons.length - 1];
  if (!last || last.teamMatches === 0 || last.matches / last.teamMatches >= AUCTION.tradeBelowShare) return state;
  const other = keenest(state, ipl.franchiseId);
  if (!other || (state.pro.scouting.interest[other.id] ?? 0) < 40) return state;
  const salary = ipl.contract?.salary ?? 20;
  const next: GameState = { ...state, pro: { ...state.pro, ipl: { ...ipl, tradeOffer: { franchiseId: other.id, date, salary } } } };
  return withInbox(
    next,
    message(date, 'FRANCHISE', other.name, `Trade offer from ${other.name}`, `You played ${last.matches} of ${last.teamMatches} matches last season. ${other.name} want you in their XI and will take over your contract (${formatLakh(salary)}). Accept the trade?`, 'CONTRACT', true, [decision('trade-accept', 'Accept trade', 'ACCEPT'), decision('trade-decline', 'Stay put', 'DECLINE'), navigate('Open IPL', '/auction')], other.id),
  );
}

export function answerTrade(state: GameState, accept: boolean, date = state.season.currentDate): GameState {
  const offer = state.pro.ipl.tradeOffer;
  if (!offer) return state;
  const cleared: GameState = { ...state, pro: { ...state.pro, ipl: { ...state.pro.ipl, tradeOffer: null } } };
  if (!accept) return cleared;
  const f = FRANCHISES_BY_ID[offer.franchiseId];
  const next = joinFranchise(cleared, offer.franchiseId, offer.salary, 'TRADE', date);
  return withInbox(next, message(date, 'FRANCHISE', f?.name ?? 'Franchise', `Traded to ${f?.name}`, 'A fresh start and, they promise, a place in the XI.', 'CONTRACT', true, [], offer.franchiseId));
}

/** Register for the auction at a base price. */
export function registerBase(state: GameState, lakh: number): GameState {
  if (!allowedBases(state).includes(lakh)) return state;
  return { ...state, pro: { ...state.pro, ipl: { ...state.pro.ipl, registeredBase: lakh } } };
}

// --- The season ---------------------------------------------------------------------------------

/** When the IPL finishes: the season line, earnings and the market value. */
export function closeIplSeason(state: GameState): GameState {
  const t = tournamentOf(state, 'ipl');
  const ipl = state.pro.ipl;
  if (!t || !t.complete || ipl.seasons.some((s) => s.seasonYear === state.season.year)) return state;
  const fid = ipl.franchiseId;
  const marketValue = userMarketValue(state);
  if (!fid) return { ...state, pro: { ...state.pro, ipl: { ...ipl, marketValue } } };
  const line = t.stats[state.player.id];
  const teamMatches = Object.values(t.results).filter((r) => r.homeTeamId === fid || r.awayTeamId === fid).length;
  const final = t.knockouts.find((k) => k.stage === 'FINAL');
  const finish = t.winnerTeamId === fid ? 1 : final && (final.homeTeamId === fid || final.awayTeamId === fid) ? 2 : t.standings.find((s) => s.teamId === fid)?.position ?? null;
  const salary = ipl.contract?.salary ?? 0;
  const season: IplSeasonLine = { seasonYear: state.season.year, franchiseId: fid, matches: line?.matches ?? 0, teamMatches, runs: line?.runs ?? 0, wickets: line?.wickets ?? 0, finish, salary, balls: line?.balls ?? 0, ballsBowled: line?.ballsBowled ?? 0, runsConceded: line?.runsConceded ?? 0 };
  season.impact = iplImpact(season);
  let next: GameState = { ...state, pro: { ...state.pro, ipl: { ...ipl, earnings: ipl.earnings + salary, seasons: [...ipl.seasons, season] } } };
  next = refreshInterest(next);
  const newValue = userMarketValue(next);
  next = { ...next, pro: { ...next.pro, ipl: { ...next.pro.ipl, marketValue: newValue } } };
  return valueNews(next, season, marketValue, newValue, salary);
}

/** The agent on what the IPL season has done to the player's price. */
function valueNews(state: GameState, season: IplSeasonLine, before: number, after: number, salary: number): GameState {
  if (season.matches < AUCTION.iplImpact.minMatches) return state;
  const date = state.season.currentDate;
  const sr = season.balls ? Math.round((season.runs / season.balls) * 100) : 0;
  const figures = [season.runs ? `${season.runs} runs${sr ? ` at a strike rate of ${sr}` : ''}` : '', season.wickets ? `${season.wickets} wickets` : ''].filter(Boolean).join(' and ') || 'not much';
  const up = after > before;
  const impact = season.impact ?? 1;
  let body = `${figures} in ${season.matches} matches. Your market value is now ${formatLakh(after)} (${up ? 'up' : 'down'} from ${formatLakh(before)}; the season counts x${impact.toFixed(2)}).`;
  if (impact >= AUCTION.hotImpact && after >= salary * 1.5) {
    body += ` You are on ${formatLakh(salary)}. Every franchise will want you at an auction - ask for a release into the auction before retention day (1 November), or wait for an improved deal.`;
  } else if (up) body += ' A better deal should follow at retention day.';
  const subject = impact >= AUCTION.hotImpact ? `What a season! Your IPL price is ${formatLakh(after)}` : up ? `IPL season done: value up to ${formatLakh(after)}` : `IPL season done: value ${formatLakh(after)}`;
  return withInbox(state, message(date, 'AGENT', 'Agent', subject, body, 'CONTRACT', impact >= AUCTION.hotImpact, [navigate('Open IPL', '/auction')]));
}

/** Ask the franchise for a release into the next auction (or take it back). */
export function requestAuction(state: GameState, on: boolean): GameState {
  if (!state.pro.ipl.franchiseId) return state;
  return { ...state, pro: { ...state.pro, ipl: { ...state.pro.ipl, intoAuction: on } } };
}

/** Squad-book salaries for AI players signed before the save knew about salaries. */
export function ensureSalaries(team: Team, rng: Rng): Team {
  if (team.squad.every((p) => p.salary !== undefined)) return team;
  return { ...team, squad: team.squad.map((p) => (p.salary === undefined ? { ...p, salary: bookSalary(p, rng) } : p)) };
}
