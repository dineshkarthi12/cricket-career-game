/**
 * Squad selection. The selectors compare the player with the AI cricketers
 * competing for the same kind of place - batters with batters, spinners
 * with spinners - on recent form (the last eight matches, the newest
 * counting most), the season's figures against those rivals, ability,
 * fitness and fitness tests, trust, reputation and discipline. Age-group
 * cut-offs and injuries are hard gates. A good player can still be stuck
 * behind a better one.
 */
import { SQUAD_SELECTION } from '../config';
import { computeOverall, formatOverall } from '../ratings';
import { eligibleForStage, levelOfCompetition } from './eligibility';
import { TOURNAMENTS_BY_ID } from '@/data/tournaments';
import { daysBetweenDates } from '../development/dates';
import { createRng, deriveSeed } from '../match/rng';
import { generateWorldPlayer } from '../world/players';
import { profileOf } from '../world/progression';
import type {
  CareerStageId,
  GameState,
  Match,
  PlayerRole,
  RivalPlayer,
  SeasonStatLine,
  SquadPlace,
  SquadStatus,
  Team,
} from '@/types';

export type RoleGroup = 'BATTER' | 'KEEPER' | 'ALLROUNDER' | 'PACE' | 'SPIN';

export function roleGroup(role: PlayerRole): RoleGroup {
  switch (role) {
    case 'OPENING_BATTER':
    case 'BATTER':
      return 'BATTER';
    case 'WICKET_KEEPER_BATTER':
      return 'KEEPER';
    case 'BATTING_ALLROUNDER':
    case 'BOWLING_ALLROUNDER':
      return 'ALLROUNDER';
    case 'PACE_BOWLER':
      return 'PACE';
    case 'SPIN_BOWLER':
      return 'SPIN';
  }
}

export const ROLE_GROUP_LABEL: Record<RoleGroup, string> = {
  BATTER: 'batter',
  KEEPER: 'wicket-keeper',
  ALLROUNDER: 'all-rounder',
  PACE: 'seamer',
  SPIN: 'spinner',
};

/** Places per role group in the XI and in a 17-man squad. */
export const XI_PLACES: Record<RoleGroup, number> = { BATTER: 4, KEEPER: 1, ALLROUNDER: 2, PACE: 2, SPIN: 2 };
export const SQUAD_PLACES: Record<RoleGroup, number> = { BATTER: 6, KEEPER: 2, ALLROUNDER: 3, PACE: 4, SPIN: 3 };
/** Where a newcomer must rank to break into the match squad: the XI places and one cover. */
export const SQUAD_CUT: Record<RoleGroup, number> = { BATTER: 5, KEEPER: 1, ALLROUNDER: 3, PACE: 3, SPIN: 3 };

/** Statuses that put the player in contention for match-day XIs. Probables wait outside. */
export const IN_SQUAD: SquadStatus[] = ['SQUAD', 'FAST_TRACK'];

export const STATUS_LABEL: Record<SquadStatus, string> = {
  NOT_SELECTED: 'Not selected',
  TRIAL_ONLY: 'Trial only',
  PROBABLES: 'Probables',
  RESERVE: 'Reserve',
  SQUAD: 'In the squad',
  DROPPED: 'Dropped',
  FAST_TRACK: 'Fast-tracked',
  STANDBY: 'Standby',
};

/** One player as the selectors see them. */
export interface Candidate {
  id: string;
  name: string;
  isUser: boolean;
  role: PlayerRole;
  group: RoleGroup;
  overall: number;
  age: number;
  ratings: number[];
  season: { matches: number; runs: number; innings: number; notOuts: number; balls: number; wickets: number; ballsBowled: number; runsConceded: number };
  fitness: number;
  trust: number;
  reputation: number;
  discipline: number;
  injured: boolean;
  failedFitnessTest: boolean;
  /** A probable from outside the squad. */
  outside?: boolean;
  /** Has figures at this level this season (lower-level figures do not count). */
  seasonAtLevel: boolean;
}

/** Recency-weighted form from the last eight ratings, 0-100 (50 with none). */
export function weightedForm(ratings: number[]): number {
  const last = ratings.slice(-8);
  if (last.length === 0) return 50;
  let sum = 0;
  let weights = 0;
  last.forEach((r, i) => {
    const w = i + 1;
    sum += r * w;
    weights += w;
  });
  return Math.round((sum / weights) * 10);
}

const avg = (runs: number, outs: number) => (outs > 0 ? runs / outs : runs > 0 ? runs : 0);

/** How the season's figures compare with the peers in the same role, 0-100. */
function seasonIndex(c: Candidate, peers: Candidate[]): number {
  if (!c.seasonAtLevel || c.season.matches === 0) return 45;
  const bat = (x: Candidate) => avg(x.season.runs, x.season.innings - x.season.notOuts) * 0.7 + (x.season.balls > 0 ? (x.season.runs / x.season.balls) * 100 : 0) * 0.15;
  const bowl = (x: Candidate) => (x.season.wickets / Math.max(1, x.season.matches)) * 12 - (x.season.ballsBowled > 0 ? (x.season.runsConceded / x.season.ballsBowled) * 6 : 6) * 1.5;
  const measure = c.group === 'PACE' || c.group === 'SPIN' ? bowl : c.group === 'ALLROUNDER' ? (x: Candidate) => bat(x) * 0.5 + bowl(x) * 1.2 : bat;
  const values = peers.filter((p) => p.seasonAtLevel && p.season.matches > 0).map(measure).sort((a, b) => a - b);
  const median = values.length ? values[Math.floor(values.length / 2)] : measure(c);
  const spread = Math.max(4, Math.abs(median) * 0.6);
  return Math.max(0, Math.min(100, 50 + ((measure(c) - median) / spread) * 25));
}

/**
 * Senior and U-23 selectors back a young player on the way up: every year
 * under `prospectAge` is worth `prospectPerYear` points of ability, for the
 * user and the AI alike. A 20-year-old at 72 is judged like a 26-year-old
 * at about 77 - they will be.
 */
export function prospectCredit(age: number, level: number): number {
  const w = SQUAD_SELECTION;
  if (level < w.prospectFromLevel) return 0;
  return Math.max(0, w.prospectAge - age) * w.prospectPerYear;
}

/** The selectors' score. `level` is the competition's place on the path (1-20). */
export function candidateScore(c: Candidate, peers: Candidate[], level = 0): number {
  const w = SQUAD_SELECTION;
  let score =
    w.ability * (c.overall + prospectCredit(c.age, level)) +
    w.form * weightedForm(c.ratings) +
    w.season * seasonIndex(c, peers) +
    w.trust * c.trust +
    w.reputation * c.reputation +
    w.discipline * c.discipline;
  if (c.fitness < 70) score -= (70 - c.fitness) * 0.4;
  if (c.failedFitnessTest) score -= w.failedTestPenalty;
  return Math.round(score * 10) / 10;
}

function rivalCandidate(p: RivalPlayer, today: string): Candidate {
  return {
    id: p.id,
    name: p.name,
    isUser: false,
    role: p.role,
    group: roleGroup(p.role),
    overall: p.overall,
    age: p.age,
    // Last season's form carries over until they have played this season.
    ratings: p.season.ratings.length ? p.season.ratings : p.condition.recentRatings,
    season: p.season,
    seasonAtLevel: p.season.matches > 0,
    fitness: p.condition.fitness,
    trust: p.selectorFavour,
    reputation: p.condition.reputation,
    discipline: p.attributes.mental.discipline,
    injured: Boolean(p.injuredUntil && p.injuredUntil > today),
    failedFitnessTest: false,
  };
}

/** The player's figures this season in some competitions (or all of them). */
export function userSeasonStats(state: GameState, tournamentIds: string[] | null): SeasonStatLine {
  const matches = state.season.matchIds
    .map((id) => state.matches[id])
    .filter((m): m is Match => Boolean(m?.userPerformance) && (!tournamentIds || tournamentIds.length === 0 || tournamentIds.includes(m.tournamentId)));
  let runs = 0;
  let balls = 0;
  let innings = 0;
  let notOuts = 0;
  let wickets = 0;
  let runsConceded = 0;
  let ballsBowled = 0;
  let highScore = 0;
  let fifties = 0;
  let hundreds = 0;
  let catches = 0;
  let ratingSum = 0;
  for (const m of matches) {
    const p = m.userPerformance!;
    runs += p.runs;
    balls += p.ballsFaced;
    const batted = p.ballsFaced > 0 || !p.notOut;
    if (batted) innings += 1;
    if (batted && p.notOut) notOuts += 1;
    wickets += p.wickets;
    runsConceded += p.runsConceded;
    ballsBowled += Math.floor(p.oversBowled) * 6 + Math.round((p.oversBowled % 1) * 10);
    highScore = Math.max(highScore, p.runs);
    if (p.runs >= 100) hundreds += 1;
    else if (p.runs >= 50) fifties += 1;
    catches += p.catches;
    ratingSum += p.rating;
  }
  const outs = innings - notOuts;
  return {
    matches: matches.length,
    runs,
    innings,
    notOuts,
    average: outs > 0 ? Math.round((runs / outs) * 10) / 10 : innings > 0 ? runs : null,
    strikeRate: balls > 0 ? Math.round((runs / balls) * 1000) / 10 : null,
    highScore,
    fifties,
    hundreds,
    wickets,
    bowlingAverage: wickets > 0 ? Math.round((runsConceded / wickets) * 10) / 10 : null,
    economy: ballsBowled > 0 ? Math.round((runsConceded / ballsBowled) * 60) / 10 : null,
    catches,
    averageRating: matches.length ? Math.round((ratingSum / matches.length) * 10) / 10 : 0,
  };
}

/** The player's recent matches, newest last, reaching back into last season if needed. */
function recentUserMatches(state: GameState, count: number): Match[] {
  const ids = [...(state.seasonHistory[state.seasonHistory.length - 1]?.matchIds ?? []), ...state.season.matchIds];
  return ids
    .map((id) => state.matches[id])
    .filter((m): m is Match => Boolean(m?.userPerformance))
    .slice(-count);
}

function userCandidate(state: GameState, tournamentIds: string[]): Candidate {
  const p = state.player;
  // Cricket below the level counts for less, level by level.
  const level = Math.max(...tournamentIds.map(levelOfCompetition));
  const weight = (tournamentId: string) => levelWeight(level, tournamentId, tournamentIds);
  const ratings = recentUserMatches(state, 8).map((m) => 5 + (m.userPerformance!.rating - 5) * weight(m.tournamentId));
  const season = { matches: 0, runs: 0, innings: 0, notOuts: 0, balls: 0, wickets: 0, ballsBowled: 0, runsConceded: 0 };
  let atLevel = 0;
  // Professional selectors look back a full year: last season counts, a little less.
  const lastSeason = level >= 8 ? (state.seasonHistory[state.seasonHistory.length - 1]?.matchIds ?? []).map((id) => [id, SQUAD_SELECTION.proLastSeason] as const) : [];
  for (const [id, age] of [...lastSeason, ...state.season.matchIds.map((x) => [x, 1] as const)]) {
    const m = state.matches[id];
    const perf = m?.userPerformance;
    if (!m || !perf) continue;
    const w = weight(m.tournamentId) * age;
    if (w >= 0.99) atLevel += 1;
    const batted = perf.ballsFaced > 0 || !perf.notOut;
    const bowled = Math.floor(perf.oversBowled) * 6 + Math.round((perf.oversBowled % 1) * 10);
    season.matches += 1;
    season.runs += perf.runs * w;
    season.balls += perf.ballsFaced;
    if (batted) season.innings += 1;
    if (batted && perf.notOut) season.notOuts += 1;
    season.wickets += perf.wickets * w;
    season.ballsBowled += bowled;
    season.runsConceded += perf.runsConceded / Math.max(0.25, w);
  }
  const tests = p.development.fitnessTests.filter((t) => t.date >= state.season.startDate);
  return {
    id: p.id,
    name: `${p.firstName} ${p.lastName}`.trim(),
    isUser: true,
    role: p.role,
    group: roleGroup(p.role),
    overall: computeOverall(p.attributes, p.role),
    age: p.age,
    ratings,
    season: { ...season, runs: Math.round(season.runs), wickets: Math.round(season.wickets), runsConceded: Math.round(season.runsConceded) },
    seasonAtLevel: atLevel > 0,
    fitness: p.condition.fitness,
    trust: p.condition.selectorTrust,
    reputation: p.condition.reputation,
    discipline: p.attributes.mental.discipline,
    injured: Boolean(p.condition.injury && daysBetweenDates(state.season.currentDate, p.condition.injury.expectedReturn) > 21),
    failedFitnessTest: tests.length > 0 && !tests[0].passed,
  };
}

/**
 * How much a match counts towards a competition's selection: fully at the
 * level, half per level down below it (club runs barely move the U-19
 * selectors). Professional selectors discount senior cricket more gently.
 */
export function levelWeight(level: number, tournamentId: string, targets: string[]): number {
  if (targets.includes(tournamentId)) return 1;
  const below = level - levelOfCompetition(tournamentId);
  if (below <= 0) return 1;
  if (level < 8) return SQUAD_SELECTION.lowerLevelDiscount ** below;
  const proSteps = Math.min(below, level - 7);
  return SQUAD_SELECTION.proLevelDiscount ** proSteps * SQUAD_SELECTION.lowerLevelDiscount ** (below - proSteps);
}

/** Professional selectors look to the future: every year past 32 counts against a player. */
export function ageDrag(age: number, level: number): number {
  if (level < 8) return 0;
  return Math.max(0, age - SQUAD_SELECTION.ageDragFrom) * SQUAD_SELECTION.ageDragPerYear;
}

export interface Ranked {
  candidate: Candidate;
  score: number;
}

const GROUP_ROLES: Record<RoleGroup, PlayerRole[]> = {
  BATTER: ['OPENING_BATTER', 'BATTER'],
  KEEPER: ['WICKET_KEEPER_BATTER'],
  ALLROUNDER: ['BATTING_ALLROUNDER', 'BOWLING_ALLROUNDER'],
  PACE: ['PACE_BOWLER'],
  SPIN: ['SPIN_BOWLER'],
};

function saltOf(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * The squad is not the whole field: probables from the rest of the state
 * (or the country) are in contention too. They are the same each time within
 * a season, and a little behind the squad on average.
 */
export function outsideProbables(state: GameState, team: Team, group: RoleGroup, level = 0): RivalPlayer[] {
  const profile = profileOf(team);
  // Professional selectors pick from the whole country: the higher the level, the bigger the field.
  const count = Math.round(SQUAD_SELECTION.outsidePool[group] * (SQUAD_SELECTION.proPoolMultiplier[level] ?? 1));
  if (!profile || count <= 0) return [];
  const year = state.season.year;
  const rng = createRng(deriveSeed(state.seed, saltOf(`probables-${team.id}-${year}-${group}`)));
  const taken = new Set(team.squad.map((p) => p.name));
  const out: RivalPlayer[] = [];
  for (let i = 0; i < count; i += 1) {
    const player = generateWorldPlayer({
      teamId: `probables-${team.id}`,
      region: team.squad[0]?.region ?? state.player.state,
      role: rng.pick(GROUP_ROLES[group]),
      age: rng.int(profile.ages[0], profile.ages[1]),
      seasonStart: state.season.startDate,
      seasonYear: year,
      potential: profile.potential[0] + (team.potentialOffset ?? 0) - SQUAD_SELECTION.outsideBehind + rng.spread() * profile.potential[1] * 1.6,
      share: profile.share,
      rng,
      taken,
    });
    out.push({ ...player, id: `probable-${team.id}-${group}-${i}` });
  }
  return out;
}

/** Everyone in the user's role group for a side, best first, with the user in it. */
export function rankGroup(state: GameState, team: Team, tournamentIds: string[]): Ranked[] {
  const today = state.season.currentDate;
  const level = Math.max(...tournamentIds.map(levelOfCompetition));
  // Professional selectors pick for the format, and look to the future.
  const format = level >= 8 ? TOURNAMENTS_BY_ID[tournamentIds[0]]?.format : undefined;
  const adjust = (c: Candidate, attributes: RivalPlayer['attributes']): Candidate =>
    format ? { ...c, overall: formatOverall(attributes, c.role, format) - ageDrag(c.age, level) } : c;
  const user = adjust(userCandidate(state, tournamentIds), state.player.attributes);
  const rivals = team.squad.map((p) => adjust(rivalCandidate(p, today), p.attributes)).filter((c) => c.group === user.group);
  const outside = outsideProbables(state, team, user.group, level).map((p) => ({ ...adjust(rivalCandidate(p, today), p.attributes), outside: true }));
  const peers = [user, ...rivals, ...outside];
  return peers
    .filter((c) => !c.injured || c.isUser)
    .map((candidate) => ({ candidate, score: candidateScore(candidate, peers, level) }))
    .sort((a, b) => b.score - a.score);
}

/** Why the player was picked ahead of (or behind) a rival, in plain words. */
export function compareReason(a: Candidate, b: Candidate): string {
  const sr = (c: Candidate) => (c.season.balls > 0 ? (c.season.runs / c.season.balls) * 100 : 0);
  const av = (c: Candidate) => avg(c.season.runs, c.season.innings - c.season.notOuts);
  const econ = (c: Candidate) => (c.season.ballsBowled > 0 ? (c.season.runsConceded / c.season.ballsBowled) * 6 : 9);
  const reasons: { text: string; gap: number }[] = [
    { text: 'a better batting average', gap: (av(a) - av(b)) / Math.max(10, av(b)) },
    { text: 'a better strike rate', gap: (sr(a) - sr(b)) / Math.max(40, sr(b)) },
    { text: 'more wickets', gap: (a.season.wickets - b.season.wickets) / Math.max(4, b.season.wickets) },
    { text: 'a tighter economy rate', gap: (econ(b) - econ(a)) / Math.max(3, econ(b)) },
    { text: 'better recent form', gap: (weightedForm(a.ratings) - weightedForm(b.ratings)) / 50 },
    { text: 'more all-round ability', gap: (a.overall - b.overall) / 30 },
    { text: 'better fitness', gap: (a.fitness - b.fitness) / 60 },
  ];
  const relevant = a.group === 'PACE' || a.group === 'SPIN' ? reasons.slice(2) : a.group === 'BATTER' || a.group === 'KEEPER' ? reasons.filter((r) => !/wickets|economy/.test(r.text)) : reasons;
  const best = [...relevant].sort((x, y) => y.gap - x.gap)[0];
  return best.text;
}

export interface SquadDecision {
  status: SquadStatus;
  reason: string;
  /** Where the player ranks among their role group (1 = first choice). */
  rank: number;
  /** The rival they were picked ahead of, or are stuck behind. */
  rivalName: string | null;
}

/**
 * The squad decision for one competition. `incumbent` players get a little
 * credit for being in possession; `trialBonus` is from a trial (-10..+10).
 */
export function decideSquad(
  state: GameState,
  tournamentId: string,
  team: Team,
  options: { incumbent: boolean; trialBonus?: number; stageId: CareerStageId },
): SquadDecision {
  const name = TOURNAMENTS_BY_ID[tournamentId]?.name ?? tournamentId;
  if (!eligibleForStage(state.player.dateOfBirth, state.season.year, options.stageId)) {
    return { status: 'NOT_SELECTED', reason: `Over the age limit for the ${name} this season.`, rank: 99, rivalName: null };
  }
  const retired = retiredFromCompetition(state, tournamentId);
  if (retired) return { status: 'NOT_SELECTED', reason: `Retired from ${retired}.`, rank: 99, rivalName: null };
  const national = levelOfCompetition(tournamentId) >= 10;
  const ranked = rankGroup(state, team, [tournamentId]);
  const userIndex = ranked.findIndex((r) => r.candidate.isUser);
  const bonus = (options.incumbent ? SQUAD_SELECTION.incumbentBonus : 0) + (options.trialBonus ?? 0) * SQUAD_SELECTION.trialWeight;
  const userScore = ranked[userIndex].score + bonus;
  const rivals = ranked.filter((r) => !r.candidate.isUser);
  const ahead = rivals.filter((r) => r.score > userScore);
  const rank = ahead.length + 1;
  const user = ranked[userIndex].candidate;
  const group = user.group;
  const label = ROLE_GROUP_LABEL[group];
  const nextBehind = rivals.find((r) => r.score <= userScore);

  if (user.injured) {
    return { status: 'RESERVE', reason: `Injured - the selectors will look again once you are fit.`, rank, rivalName: null };
  }
  const cut = SQUAD_CUT[group];
  const wide = SQUAD_PLACES[group];
  const blocker = ahead[ahead.length - 1]?.candidate;
  const lowRun = state.career.lowScores >= SQUAD_SELECTION.lowScoresToDrop;
  // Newcomers must break into the match squad; a player in possession keeps
  // the place while they stay in the wider group and the runs keep coming.
  if (rank <= cut || (options.incumbent && rank <= wide && !lowRun)) {
    const xi = rank <= XI_PLACES[group];
    const vs = nextBehind ? ` - picked ahead of ${nextBehind.candidate.name} for ${compareReason(user, nextBehind.candidate)}` : '';
    return {
      status: 'SQUAD',
      reason: xi
        ? `In the ${name} squad as a first-choice ${label}${vs}.`
        : `In the ${name} squad as cover; ${ahead.slice(0, XI_PLACES[group]).map((r) => r.candidate.name).join(' and ')} hold the ${label} places for now.`,
      rank,
      rivalName: nextBehind?.candidate.name ?? ahead[0]?.candidate.name ?? null,
    };
  }
  if (options.incumbent) {
    return {
      status: 'DROPPED',
      reason: lowRun
        ? `Dropped from the ${name} squad after ${state.career.lowScores} low scores; ${blocker?.name ?? 'a rival'} comes in.`
        : `Dropped from the ${name} squad: ${blocker?.name ?? 'a rival'} has overtaken you as a ${label}.`,
      rank,
      rivalName: blocker?.name ?? null,
    };
  }
  if (national && rank === cut + 1) {
    return { status: 'STANDBY', reason: `On standby for the ${name}: you travel with the squad and are next in if anyone breaks down. ${blocker?.name ?? 'A rival'} is just ahead.`, rank, rivalName: blocker?.name ?? null };
  }
  if (national && rank <= wide + 1) {
    return { status: 'RESERVE', reason: `On the reserves list for the ${name}, behind ${ahead.slice(-2).map((r) => r.candidate.name).join(' and ')}. Runs and wickets at home keep your name in the room.`, rank, rivalName: blocker?.name ?? null };
  }
  if (rank <= wide) {
    return {
      status: 'PROBABLES',
      reason: `In the ${name} probables, stuck behind ${ahead.slice(-2).map((r) => r.candidate.name).join(' and ')}; a call-up needs runs and wickets in club cricket or an injury ahead of you.`,
      rank,
      rivalName: blocker?.name ?? null,
    };
  }
  if (rank === wide + 1) {
    return { status: 'RESERVE', reason: `Reserve for the ${name}: next in line behind ${blocker?.name ?? 'the probables'}.`, rank, rivalName: blocker?.name ?? null };
  }
  return {
    status: 'NOT_SELECTED',
    reason: `${ahead.slice(0, 3).map((r) => r.candidate.name).join(', ')} are ahead of you as ${label}s for the ${name}.`,
    rank,
    rivalName: blocker?.name ?? null,
  };
}

/** The format a competition belongs to for retirement ("Test cricket", "the IPL"), if the player has left it. */
export function retiredFromCompetition(state: GameState, tournamentId: string): string | null {
  const gone = state.pro?.retirement.retiredFrom ?? [];
  if (gone.length === 0) return null;
  if (gone.includes('ALL')) return 'all cricket';
  const format = TOURNAMENTS_BY_ID[tournamentId]?.format;
  const intl = levelOfCompetition(tournamentId) >= 10;
  if (tournamentId === 'ipl') return gone.includes('IPL') ? 'the IPL' : null;
  if (intl) {
    if (format === 'TEST' && gone.includes('TEST')) return 'Test cricket';
    if ((format === 'ODI' || format === 'ONE_DAY') && gone.includes('ODI')) return 'ODI cricket';
    if (format === 'T20' && gone.includes('T20I')) return 'T20 internationals';
    return null;
  }
  if ((format === 'MULTI_DAY' || format === 'TEST') && gone.includes('FIRST_CLASS')) return 'first-class cricket';
  return null;
}

/** The "Competition for places" panel: everyone in the user's role group, best first. */
export function competitionForPlaces(state: GameState, teamId: string, tournamentIds: string[]): (Ranked & { holdsSpot: boolean; inSquad: boolean })[] {
  const team = state.teams[teamId];
  if (!team) return [];
  const ranked = rankGroup(state, team, tournamentIds);
  const group = ranked.find((r) => r.candidate.isUser)?.candidate.group ?? 'BATTER';
  return ranked.map((r, i) => ({ ...r, holdsSpot: i < XI_PLACES[group], inSquad: i < SQUAD_CUT[group] }));
}

/** The squad place for a competition, or a default when there is none. */
export function squadPlace(state: GameState, tournamentId: string | null): SquadPlace | null {
  if (!tournamentId) return null;
  return state.career.squads?.[tournamentId] ?? null;
}

export function inSquad(state: GameState, tournamentId: string | null): boolean {
  const place = squadPlace(state, tournamentId);
  return place ? IN_SQUAD.includes(place.status) : true;
}
