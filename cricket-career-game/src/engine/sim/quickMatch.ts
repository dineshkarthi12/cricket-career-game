/**
 * A fast, score-only match. Tournaments play hundreds of matches the user is
 * not in; running every ball of every one would be far too slow, and storing
 * them far too big. This produces full scorecards (batting and bowling lines,
 * totals, result) from the same abilities the ball-by-ball engine uses, with
 * per-format constants calibrated against it (`quickMatch.test.ts`), and no
 * deliveries.
 */
import { MATCH, QUICK_SIM } from '../config';
import { createRng, type Rng } from '../match/rng';
import { conditionMultiplier, normalise } from '../match/skill';
import { createPitch, createWeather, newBall } from '../match/conditions';
import type { SimPlayer } from '../match/types';
import type {
  BatterInningsLine,
  BowlerInningsLine,
  ClimateRegion,
  Innings,
  Match,
  MatchFormat,
  MatchResult,
  PlayerMatchPerformance,
  Venue,
} from '@/types';

export interface QuickMatchSetup {
  id?: string;
  fixtureId: string;
  tournamentId: string;
  seasonYear: number;
  format: MatchFormat;
  stage: string;
  date: string;
  /** Days of play (multi-day). */
  days: number;
  venue: Venue;
  homeTeamId: string;
  awayTeamId: string;
  homeXi: SimPlayer[];
  awayXi: SimPlayer[];
  userPlayerId?: string | null;
  userIsHome: boolean;
  seed: number;
  region?: ClimateRegion;
  /**
   * The impact-player rule (IPL): each side may bring one substitute from its
   * bench - a bowler for the side batting first once it bowls, a batter for
   * the side chasing once it bats.
   */
  impact?: { homeBench: SimPlayer[]; awayBench: SimPlayer[] };
}

/** The impact substitute: the bench's best for the job replaces the XI's weakest at it. */
export function impactSwap(xi: SimPlayer[], bench: SimPlayer[], job: 'BAT' | 'BOWL'): { xi: SimPlayer[]; sub: SimPlayer | null } {
  if (bench.length === 0) return { xi, sub: null };
  const skill = job === 'BAT' ? battingAbility : bowlingAbility;
  const best = [...bench].filter((p) => !p.isUser).sort((a, b) => skill(b) - skill(a))[0];
  if (!best) return { xi, sub: null };
  const candidates = xi.filter((p) => !p.isUser && p.role !== 'WICKET_KEEPER_BATTER');
  const weakest = [...candidates].sort((a, b) => skill(a) - skill(b))[0];
  if (!weakest || skill(best) <= skill(weakest) + 0.02) return { xi, sub: null };
  return { xi: xi.map((p) => (p.id === weakest.id ? { ...best, battingPosition: weakest.battingPosition } : p)), sub: best };
}

export interface QuickPlayerLine {
  playerId: string;
  teamId: string;
  name: string;
  runs: number;
  balls: number;
  innings: number;
  notOuts: number;
  fours: number;
  sixes: number;
  wickets: number;
  ballsBowled: number;
  runsConceded: number;
  catches: number;
  stumpings: number;
  rating: number;
}

export interface QuickMatchResult {
  match: Match;
  /** Every player's figures and rating. */
  lines: Record<string, QuickPlayerLine>;
  /** First-innings lead in a multi-day match (for points), or null. */
  firstInningsLeadTeamId: string | null;
}

type FormatKey = 'T20' | 'ODI' | 'MULTI_DAY';

function formatKey(format: MatchFormat): FormatKey {
  if (format === 'T20') return 'T20';
  if (format === 'MULTI_DAY' || format === 'TEST') return 'MULTI_DAY';
  return 'ODI';
}

const OVERS: Record<FormatKey, number | null> = { T20: 20, ODI: 50, MULTI_DAY: null };

/** 0-1 batting ability, the engine's weights. */
export function battingAbility(p: SimPlayer): number {
  const b = p.attributes.batting;
  const core =
    b.technique * 0.26 +
    b.timing * 0.24 +
    ((b.vsPace + b.vsSpin) / 2) * 0.22 +
    b.shotRange * 0.12 +
    b.footwork * 0.1 +
    b.concentration * 0.06;
  return normalise(core) * conditionMultiplier(p.condition);
}

function isSpinner(p: SimPlayer): boolean {
  return ['OFF_SPIN', 'LEG_SPIN', 'LEFT_ARM_ORTHODOX', 'LEFT_ARM_WRIST_SPIN'].includes(p.bowlingStyle);
}

/** 0-1 bowling ability, the engine's weights. */
export function bowlingAbility(p: SimPlayer): number {
  if (p.bowlingStyle === 'NONE') return 0.05;
  const w = p.attributes.bowling;
  const core = isSpinner(p)
    ? w.accuracy * 0.28 + w.control * 0.22 + w.spin * 0.22 + w.variation * 0.12 + w.flight * 0.1 + w.bounce * 0.06
    : w.accuracy * 0.28 + w.control * 0.2 + w.pace * 0.18 + w.seam * 0.14 + w.swing * 0.12 + w.variation * 0.08;
  return normalise(core) * conditionMultiplier(p.condition);
}

interface Attack {
  bowlers: { player: SimPlayer; ability: number; share: number }[];
  /** Quota-weighted mean ability. */
  ability: number;
}

/** The five best bowlers share the overs, the best bowling most. */
function attackOf(xi: SimPlayer[], format: FormatKey): Attack {
  const ranked = xi
    .map((player) => ({ player, ability: bowlingAbility(player) }))
    .sort((a, b) => b.ability - a.ability)
    .slice(0, format === 'MULTI_DAY' ? 5 : 6);
  const weights = format === 'MULTI_DAY' ? [0.26, 0.24, 0.2, 0.18, 0.12] : [0.2, 0.2, 0.2, 0.2, 0.14, 0.06];
  const bowlers = ranked.map((r, i) => ({ ...r, share: weights[i] ?? 0 }));
  const total = bowlers.reduce((s, b) => s + b.share, 0) || 1;
  bowlers.forEach((b) => (b.share /= total));
  const ability = bowlers.reduce((s, b) => s + b.ability * b.share, 0);
  return { bowlers, ability };
}

interface InningsPlay {
  innings: Innings;
  /** Dismissal credited to each bowler (by id), and catches by fielder. */
  catches: Record<string, number>;
  stumpings: Record<string, number>;
}

function newLines(xi: SimPlayer[]): BatterInningsLine[] {
  return xi.map((p, i) => ({
    playerId: p.id,
    name: p.name,
    battingPosition: i + 1,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    strikeRate: 0,
    out: false,
    dismissal: null,
    dismissalText: 'did not bat',
  }));
}

/**
 * One innings. Each batter's runs are drawn from a heavy-tailed distribution
 * whose mean follows their ability against the attack; balls follow their
 * scoring rate. A limited-overs innings stops when the overs run out, a chase
 * when the target is reached, any innings at ten wickets or a declaration.
 */
function playInnings(
  number: number,
  batting: SimPlayer[],
  bowling: SimPlayer[],
  battingTeamId: string,
  bowlingTeamId: string,
  format: FormatKey,
  ease: number,
  rng: Rng,
  limits: { balls: number | null; target: number | null; declareAt: number | null },
): InningsPlay {
  const cfg = QUICK_SIM[format];
  const attack = attackOf(bowling, format);
  const lines = newLines(batting);
  const catches: Record<string, number> = {};
  const stumpings: Record<string, number> = {};
  const keeper = bowling.find((p) => p.role === 'WICKET_KEEPER_BATTER') ?? bowling[0];

  let runs = 0;
  let balls = 0;
  let wickets = 0;
  let allOut = false;
  let declared = false;
  // Extras are part of the total, not any batter's.
  const extras = Math.max(0, Math.round(cfg.extras * (0.6 + rng.next() * 0.8)));
  let extrasAdded = 0;

  const dayForm = Math.exp(rng.spread() * QUICK_SIM.dayVariance[format]);
  for (let i = 0; i < batting.length && wickets < 10; i += 1) {
    const batter = batting[i];
    const line = lines[i];
    const edge = battingAbility(batter) - attack.ability;
    const positionShare = cfg.position[Math.min(10, i)];
    const mean = cfg.average * positionShare * Math.exp(QUICK_SIM.skillK[format] * edge) * ease * dayForm;
    const strikeRate = Math.max(15, cfg.strikeRate * (0.85 + positionShare * 0.15) * (1 + edge * QUICK_SIM.srK));
    // Heavy-tailed: many small scores, the odd big one.
    let score = Math.floor(-mean * Math.log(1 - rng.next() * 0.9999));
    let faced = Math.max(1, Math.round((score * 100) / strikeRate + rng.spread() * 3));

    let out = true;
    if (limits.balls !== null && balls + faced >= limits.balls) {
      // The overs run out on this batter.
      const left = Math.max(0, limits.balls - balls);
      score = Math.round(score * (left / faced));
      faced = left;
      out = false;
    }
    if (limits.target !== null && runs + extras + score >= limits.target) {
      const need = limits.target - runs - extras;
      faced = Math.max(1, Math.round(faced * (Math.max(0, need) / Math.max(1, score))));
      score = Math.max(0, need);
      out = false;
    }
    if (limits.declareAt !== null && runs + score >= limits.declareAt) {
      out = false;
      declared = true;
    }

    line.runs = score;
    line.balls = faced;
    line.fours = Math.floor(score * cfg.fourShare * (0.6 + rng.next() * 0.8) / 4);
    line.sixes = Math.floor(score * cfg.sixShare * (0.4 + rng.next() * 1.2) / 6);
    line.strikeRate = faced > 0 ? Math.round((score / faced) * 1000) / 10 : 0;
    line.out = out;
    line.dismissalText = out ? '' : 'not out';
    runs += score;
    balls += faced;

    if (out) {
      wickets += 1;
      const bowler = pickBowler(attack, rng);
      const kind = rng.next();
      if (kind < 0.04) {
        line.dismissal = { type: 'RUN_OUT', bowlerId: null, fielderId: null };
        line.dismissalText = 'run out';
      } else if (kind < 0.52) {
        const byKeeper = rng.chance(0.3);
        const fielder = byKeeper ? keeper : rng.pick(bowling);
        catches[fielder.id] = (catches[fielder.id] ?? 0) + 1;
        line.dismissal = { type: byKeeper ? 'CAUGHT_BEHIND' : 'CAUGHT', bowlerId: bowler.player.id, fielderId: fielder.id };
        line.dismissalText = `c ${surname(fielder.name)} b ${surname(bowler.player.name)}`;
        credit(bowler, 1);
      } else if (kind < 0.55 && isSpinner(bowler.player)) {
        stumpings[keeper.id] = (stumpings[keeper.id] ?? 0) + 1;
        line.dismissal = { type: 'STUMPED', bowlerId: bowler.player.id, fielderId: keeper.id };
        line.dismissalText = `st ${surname(keeper.name)} b ${surname(bowler.player.name)}`;
        credit(bowler, 1);
      } else if (kind < 0.75) {
        line.dismissal = { type: 'BOWLED', bowlerId: bowler.player.id, fielderId: null };
        line.dismissalText = `b ${surname(bowler.player.name)}`;
        credit(bowler, 1);
      } else {
        line.dismissal = { type: 'LBW', bowlerId: bowler.player.id, fielderId: null };
        line.dismissalText = `lbw b ${surname(bowler.player.name)}`;
        credit(bowler, 1);
      }
    }
    if (declared) break;
    if (limits.balls !== null && balls >= limits.balls) break;
    if (limits.target !== null && runs + extras >= limits.target) break;
  }
  if (wickets >= 10) allOut = true;
  extrasAdded = extras;
  const total = runs + extrasAdded;

  // Overs and runs for each bowler: overs by share (within the quota), runs by share leaning on the weaker.
  const bowlingLines: BowlerInningsLine[] = [];
  const quota = format === 'T20' ? 24 : format === 'ODI' ? 60 : Infinity;
  const weightRuns = attack.bowlers.map((b) => b.share * (1.25 - b.ability * 0.5));
  const runWeight = weightRuns.reduce((s, w) => s + w, 0) || 1;
  let ballsLeft = balls;
  attack.bowlers.forEach((b, index) => {
    const last = index === attack.bowlers.length - 1;
    const bb = last ? ballsLeft : Math.min(quota, Math.round(balls * b.share));
    ballsLeft -= bb;
    const conceded = Math.round(total * (weightRuns[index] / runWeight));
    bowlingLines.push({
      playerId: b.player.id,
      name: b.player.name,
      overs: Math.floor(bb / 6) + (bb % 6) / 10,
      balls: bb,
      maidens: format === 'MULTI_DAY' ? Math.floor(bb / 6 / 5) : 0,
      runsConceded: conceded,
      wickets: wicketsOf.get(b.player.id) ?? 0,
      wides: 0,
      noBalls: 0,
      economy: bb > 0 ? Math.round((conceded / bb) * 6 * 100) / 100 : 0,
    });
  });
  wicketsOf.clear();

  const innings: Innings = {
    id: `inn-${number}`,
    number,
    battingTeamId,
    bowlingTeamId,
    runs: total,
    wickets,
    balls,
    overs: Math.floor(balls / 6) + (balls % 6) / 10,
    extras: { WIDE: Math.round(extrasAdded * 0.45), NO_BALL: Math.round(extrasAdded * 0.1), BYE: Math.round(extrasAdded * 0.15), LEG_BYE: extrasAdded - Math.round(extrasAdded * 0.45) - Math.round(extrasAdded * 0.1) - Math.round(extrasAdded * 0.15), PENALTY: 0 },
    extrasTotal: extrasAdded,
    batting: lines.filter((l) => l.balls > 0 || l.out || l.dismissalText === 'not out'),
    bowling: bowlingLines.filter((l) => l.balls > 0),
    fallOfWickets: [],
    deliveries: [],
    declared,
    followOn: false,
    allOut,
    complete: true,
    target: limits.target,
    dlsTarget: null,
  };
  return { innings, catches, stumpings };
}

const wicketsOf = new Map<string, number>();

function credit(bowler: { player: SimPlayer }, n: number) {
  wicketsOf.set(bowler.player.id, (wicketsOf.get(bowler.player.id) ?? 0) + n);
}

function pickBowler(attack: Attack, rng: Rng) {
  return rng.weighted(attack.bowlers.map((b) => ({ item: b, weight: b.share * (0.3 + b.ability) ** 2 })));
}

function surname(name: string): string {
  const parts = name.split(' ');
  return parts[parts.length - 1];
}

/** The same 0-10 rating the ball-by-ball engine gives (`buildPerformance`). */
export function matchRating(
  format: MatchFormat,
  line: { runs: number; wickets: number; ballsBowled: number; runsConceded: number; catches: number; stumpings: number },
  won: boolean,
): number {
  const battingPoints = line.runs / (format === 'T20' ? 9 : 14);
  const bowlingPoints =
    line.wickets * 1.5 - (line.ballsBowled > 0 ? ((line.runsConceded / line.ballsBowled) * 6 - 5) * 0.25 : 0);
  const fieldingPoints = (line.catches + line.stumpings) * 0.5;
  const raw = 3.2 + battingPoints + bowlingPoints + fieldingPoints + (won ? 0.6 : 0);
  return Math.max(MATCH.aftermath.ratingFloor, Math.min(MATCH.aftermath.ratingCeiling, Number(raw.toFixed(1))));
}

/** Play a match to a result, fast. */
export function quickMatch(setup: QuickMatchSetup): QuickMatchResult {
  const rng = createRng(setup.seed);
  const key = formatKey(setup.format);
  const pitch = createPitch(rng, setup.venue);
  const weather = createWeather(rng, Number(setup.date.slice(5, 7)), setup.region);
  const ease = 0.82 + (pitch.battingEase / 100) * 0.36;
  const batFirstHome = rng.chance(0.5);
  const first = batFirstHome ? setup.homeXi : setup.awayXi;
  const second = batFirstHome ? setup.awayXi : setup.homeXi;
  const firstId = batFirstHome ? setup.homeTeamId : setup.awayTeamId;
  const secondId = batFirstHome ? setup.awayTeamId : setup.homeTeamId;

  const plays: InningsPlay[] = [];
  let result: MatchResult;
  let firstInningsLeadTeamId: string | null = null;

  const subs: SimPlayer[] = [];
  if (key !== 'MULTI_DAY') {
    const balls = (OVERS[key] ?? 50) * 6;
    const one = playInnings(1, first, second, firstId, secondId, key, ease, rng, { balls, target: null, declareAt: null });
    const target = one.innings.runs + 1;
    // Impact substitutes: a bowler in for the side that batted, a batter for the chasers.
    let bowlSecond = first;
    let batSecond = second;
    if (setup.impact) {
      const firstBench = batFirstHome ? setup.impact.homeBench : setup.impact.awayBench;
      const secondBench = batFirstHome ? setup.impact.awayBench : setup.impact.homeBench;
      const a = impactSwap(first, firstBench, 'BOWL');
      const b = impactSwap(second, secondBench, 'BAT');
      bowlSecond = a.xi;
      batSecond = [...b.xi].sort((x, y) => x.battingPosition - y.battingPosition);
      if (a.sub) subs.push(a.sub);
      if (b.sub) subs.push(b.sub);
    }
    const two = playInnings(2, batSecond, bowlSecond, secondId, firstId, key, ease, rng, { balls, target, declareAt: null });
    plays.push(one, two);
    const a = one.innings.runs;
    const b = two.innings.runs;
    if (b >= target) {
      result = win(secondId, `won by ${10 - two.innings.wickets} wickets`, null, 10 - two.innings.wickets);
    } else if (b === a) {
      result = { type: 'TIE', winningTeamId: null, summary: 'Match tied', marginRuns: 0, marginWickets: null, manOfTheMatchId: null };
    } else {
      result = win(firstId, `won by ${a - b} runs`, a - b, null);
    }
  } else {
    // Time is the fourth side in a multi-day match.
    let oversLeft = setup.days * QUICK_SIM.MULTI_DAY.oversPerDay * (0.85 + rng.next() * 0.15);
    const spend = (p: InningsPlay) => {
      oversLeft -= p.innings.balls / 6;
    };
    const one = playInnings(1, first, second, firstId, secondId, key, ease, rng, { balls: null, target: null, declareAt: QUICK_SIM.MULTI_DAY.declareFirst });
    spend(one);
    const two = playInnings(2, second, first, secondId, firstId, key, ease, rng, { balls: Math.max(6, Math.round(oversLeft * 6)), target: null, declareAt: one.innings.runs + QUICK_SIM.MULTI_DAY.declareLead });
    spend(two);
    plays.push(one, two);
    firstInningsLeadTeamId = one.innings.runs >= two.innings.runs ? firstId : secondId;
    const firstLead = one.innings.runs - two.innings.runs;
    if (oversLeft < 20) {
      result = draw();
    } else {
      // The side ahead bats again and declares on a lead worth bowling at.
      const leader = firstLead >= 0 ? { xi: first, id: firstId, opp: second, oppId: secondId } : { xi: second, id: secondId, opp: first, oppId: firstId };
      const lead = Math.abs(firstLead);
      const declareAt = Math.max(60, QUICK_SIM.MULTI_DAY.fourthInningsTarget - lead);
      const three = playInnings(3, leader.xi, leader.opp, leader.id, leader.oppId, key, ease, rng, { balls: Math.max(6, Math.round((oversLeft - QUICK_SIM.MULTI_DAY.leaveForFourth) * 6)), target: null, declareAt });
      spend(three);
      plays.push(three);
      const need = lead + three.innings.runs + 1;
      if (oversLeft < 8) {
        result = draw();
      } else {
        const four = playInnings(4, leader.opp, leader.xi, leader.oppId, leader.id, key, ease, rng, { balls: Math.max(6, Math.round(oversLeft * 6)), target: need, declareAt: null });
        plays.push(four);
        if (four.innings.runs >= need) result = win(leader.oppId, `won by ${10 - four.innings.wickets} wickets`, null, 10 - four.innings.wickets);
        else if (four.innings.allOut) result = win(leader.id, `won by ${need - 1 - four.innings.runs} runs`, need - 1 - four.innings.runs, null);
        else result = draw();
      }
    }
  }

  // Everyone's figures and rating.
  const all = [...setup.homeXi, ...setup.awayXi, ...subs];
  const lines: Record<string, QuickPlayerLine> = {};
  for (const p of all) {
    lines[p.id] = { playerId: p.id, teamId: p.teamId, name: p.name, runs: 0, balls: 0, innings: 0, notOuts: 0, fours: 0, sixes: 0, wickets: 0, ballsBowled: 0, runsConceded: 0, catches: 0, stumpings: 0, rating: 0 };
  }
  for (const play of plays) {
    for (const bat of play.innings.batting) {
      const l = lines[bat.playerId];
      if (!l) continue;
      l.runs += bat.runs;
      l.balls += bat.balls;
      l.fours += bat.fours;
      l.sixes += bat.sixes;
      l.innings += 1;
      if (!bat.out) l.notOuts += 1;
    }
    for (const bowl of play.innings.bowling) {
      const l = lines[bowl.playerId];
      if (!l) continue;
      l.wickets += bowl.wickets;
      l.ballsBowled += bowl.balls;
      l.runsConceded += bowl.runsConceded;
    }
    for (const [id, n] of Object.entries(play.catches)) if (lines[id]) lines[id].catches += n;
    for (const [id, n] of Object.entries(play.stumpings)) if (lines[id]) lines[id].stumpings += n;
  }
  let best: QuickPlayerLine | null = null;
  for (const l of Object.values(lines)) {
    l.rating = matchRating(setup.format, l, result.winningTeamId === l.teamId);
    if (!best || l.rating > best.rating) best = l;
  }
  result = { ...result, manOfTheMatchId: best?.playerId ?? null };

  const conditions = { pitch, weather, ball: newBall(), phase: key === 'MULTI_DAY' ? ('NEW_BALL' as const) : ('POWERPLAY' as const), pressure: 30, underLights: false };
  const match: Match = {
    id: setup.id ?? `qm-${setup.fixtureId}`,
    fixtureId: setup.fixtureId,
    tournamentId: setup.tournamentId,
    seasonYear: setup.seasonYear,
    format: setup.format,
    stage: setup.stage,
    date: setup.date,
    days: key === 'MULTI_DAY' ? setup.days : 1,
    venueId: setup.venue.id,
    homeTeamId: setup.homeTeamId,
    awayTeamId: setup.awayTeamId,
    userIsHome: setup.userIsHome,
    userPlayed: Boolean(setup.userPlayerId && lines[setup.userPlayerId]),
    tossWinnerTeamId: firstId,
    tossDecision: 'BAT',
    status: 'COMPLETED',
    conditions,
    startingPitch: pitch,
    startingWeather: weather,
    innings: plays.map((p) => p.innings),
    currentInningsIndex: plays.length - 1,
    fielders: [],
    result,
    userPerformance: setup.userPlayerId && lines[setup.userPlayerId] ? performanceOf(lines[setup.userPlayerId], result) : null,
  };
  return { match, lines, firstInningsLeadTeamId };
}

function win(teamId: string, summary: string, runs: number | null, wickets: number | null): MatchResult {
  return { type: 'WIN', winningTeamId: teamId, summary, marginRuns: runs, marginWickets: wickets, manOfTheMatchId: null };
}

function draw(): MatchResult {
  return { type: 'DRAW', winningTeamId: null, summary: 'Match drawn', marginRuns: null, marginWickets: null, manOfTheMatchId: null };
}

export function performanceOf(line: QuickPlayerLine, result: MatchResult): PlayerMatchPerformance {
  return {
    playerId: line.playerId,
    runs: line.runs,
    ballsFaced: line.balls,
    fours: line.fours,
    sixes: line.sixes,
    notOut: line.innings > 0 && line.notOuts === line.innings,
    wickets: line.wickets,
    runsConceded: line.runsConceded,
    oversBowled: Math.floor(line.ballsBowled / 6) + (line.ballsBowled % 6) / 10,
    catches: line.catches,
    runOuts: 0,
    stumpings: line.stumpings,
    rating: line.rating,
    manOfTheMatch: result.manOfTheMatchId === line.playerId,
    xpEarned: 0,
  };
}
