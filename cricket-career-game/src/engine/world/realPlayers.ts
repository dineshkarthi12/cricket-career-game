/**
 * Real cricketers in the game world. Their figures (`src/data/real`, from
 * `npm run import:players`) become ratings on the same scale as the
 * generated players, and then a full attribute set; from then on they age,
 * develop, get injured and retire like everyone else.
 *
 * The data describes one season (`RealData.*.season`). A side built later in
 * a career takes each player as they would be by then - aged year by year
 * with a random stream fixed to the player, so every copy of the same person
 * (state side, franchise, country) is the same, and retired players are gone.
 *
 * The data is loaded asynchronously by `src/data/real/index.ts`, which calls
 * `setRealData`; until then (and in a build without it) every side is
 * generated as before.
 */
import { REAL_PLAYERS, WORLD } from '../config';
import { computeOverall } from '../ratings';
import { createRng, deriveSeed, type Rng } from '../match/rng';
import { freshCondition } from '../match/squad';
import { buildCeilings } from '../development/creation';
import { attributeRefs, cloneAttributes, getAttr, maturityAt, setAttr } from '../development/curves';
import { ageRival, emptySeasonLine, generateWorldPlayer } from './players';
import { LEVELS } from './teams';
import type {
  Attributes,
  BattingApproach,
  BowlingStyle,
  PlayerRole,
  RealData,
  RealFormat,
  RealPlayerRecord,
  RealRoleCode,
  RivalPlayer,
} from '@/types';
import { REAL_GUESS, REAL_STAT_KEYS } from '@/types';

const K = Object.fromEntries(REAL_STAT_KEYS.map((k, i) => [k, i])) as Record<(typeof REAL_STAT_KEYS)[number], number>;
const FORMATS: RealFormat[] = ['TEST', 'ODI', 'T20I', 'IPL', 'SMAT'];
const T20_FORMATS: RealFormat[] = ['T20I', 'IPL', 'SMAT'];
const RED_FORMATS: RealFormat[] = ['TEST', 'ODI'];

// --- The loaded data -------------------------------------------------------------------------

interface Registry {
  data: RealData;
  byId: Map<string, RealPlayerRecord>;
  /** Domestic players' state side. */
  homeSide: Map<string, string>;
}

let registry: Registry | null = null;
/** Every season loaded, by year: today's data, and the past seasons a career can start in. */
const registries = new Map<number, Registry>();

function buildRegistry(data: RealData): Registry {
  const byId = new Map<string, RealPlayerRecord>();
  for (const file of [data.international, data.ipl, data.domestic]) for (const p of file.players) byId.set(p.id, p);
  const homeSide = new Map<string, string>();
  for (const [side, squads] of Object.entries(data.domestic.squads)) {
    for (const id of [...squads.ranji, ...squads.vht, ...squads.smat]) if (!homeSide.has(id)) homeSide.set(id, side);
  }
  return { data, byId, homeSide };
}

/** Install (or clear) the real players and make them the ones in use. Called by the data loader and by tests. */
export function setRealData(data: RealData | null): void {
  ratingCache.clear();
  if (!data) {
    registry = null;
    registries.clear();
    return;
  }
  registry = buildRegistry(data);
  registries.set(data.domestic.season, registry);
}

/** Keep a season's players ready without putting them in use (`activateRealSeason`). */
export function addRealData(data: RealData): void {
  registries.set(data.domestic.season, buildRegistry(data));
}

/** Whether the players of exactly this season are loaded. */
export function hasRealSeason(season: number): boolean {
  return registries.has(season);
}

/**
 * Put in use the latest loaded season up to `season`. With none loaded that
 * early, no real players are in use (sides are generated) rather than
 * players from the future. True when the season in use changed.
 */
export function activateRealSeason(season: number): boolean {
  let best: Registry | null = null;
  for (const [year, r] of registries) if (year <= season && (!best || year > best.data.domestic.season)) best = r;
  if (best === registry) return false;
  registry = best;
  ratingCache.clear();
  return true;
}

/**
 * The season whose real players a career uses in `seasonYear`. A career
 * begun in a past season follows real history up to the latest data, and
 * ages the players from there; any other uses the latest data throughout.
 */
export function realSeasonFor(realStartYear: number | undefined, seasonYear: number): number {
  const latest = REAL_PLAYERS.seasons.latest;
  return realStartYear === undefined ? latest : Math.max(REAL_PLAYERS.seasons.first, Math.min(seasonYear, latest));
}

export function realData(): RealData | null {
  return registry?.data ?? null;
}

export function hasRealPlayers(): boolean {
  return registry !== null;
}

export function realRecord(id: string): RealPlayerRecord | undefined {
  return registry?.byId.get(id);
}

/** The state side a domestic player plays for, if known. */
export function realHomeSide(id: string): string | undefined {
  return registry?.homeSide.get(id);
}

/** The season the data describes. */
export function realSeason(): number {
  return registry?.data.domestic.season ?? 2026;
}

// --- Figures -> ratings ------------------------------------------------------------------------

export interface RealRatings {
  /** Batting and bowling points (around 70 for par at the top level), null without figures. */
  bat: number | null;
  bowl: number | null;
  /** Batting / bowling points from T20 cricket and from the longer formats. */
  batT20: number | null;
  batRed: number | null;
  bowlT20: number | null;
  bowlRed: number | null;
  /** The role-weighted points and the overall they map to. */
  points: number;
  overall: number;
  /** Whether the overall comes from figures (false: generated at state level). */
  fromFigures: boolean;
}

/** Points -> the game's 1-99 overall (`REAL_PLAYERS.overallCurve`). */
export function pointsToOverall(points: number): number {
  const curve = REAL_PLAYERS.overallCurve;
  if (points <= curve[0][0]) return Math.max(40, curve[0][1] - (curve[0][0] - points) * 0.7);
  for (let i = 1; i < curve.length; i += 1) {
    const [x1, y1] = curve[i];
    const [x0, y0] = curve[i - 1];
    if (points <= x1) return y0 + ((points - x0) / (x1 - x0)) * (y1 - y0);
  }
  const [xl, yl] = curve[curve.length - 1];
  return Math.min(98, yl + (points - xl) * 0.5);
}

function offsetFor(format: RealFormat, country: string): number {
  const intl = format === 'TEST' || format === 'ODI' || format === 'T20I';
  const nation = intl ? (REAL_PLAYERS.nationPoints[country] ?? REAL_PLAYERS.otherNationPoints) : 0;
  return REAL_PLAYERS.levelPoints[format] + nation;
}

/** Batting points in one competition, and the weight (innings) behind them. */
export function battingPoints(c: number[], format: RealFormat, country: string): { points: number; weight: number } | null {
  if (!c || c[K.inn] < 1) return null;
  const par = REAL_PLAYERS.par[format];
  const [wAvg, wSr] = REAL_PLAYERS.batWeights[format];
  // Shrunk towards a modest prior so a handful of innings cannot make a star.
  const avg = (c[K.runs] + 4 * par.avg * 0.55) / (c[K.outs] + 4);
  const sr = ((c[K.runs] + 60 * (par.sr * 0.85) / 100) / (c[K.balls] + 60)) * 100;
  const quality = wAvg * Math.log(avg / par.avg) + wSr * Math.log(sr / par.sr);
  return { points: 70 + REAL_PLAYERS.pointsScale * quality + offsetFor(format, country), weight: Math.min(40, c[K.inn]) * REAL_PLAYERS.importance[format] };
}

/** Bowling points in one competition, and the weight (24-ball spells) behind them. */
export function bowlingPoints(c: number[], format: RealFormat, country: string): { points: number; weight: number } | null {
  if (!c || c[K.bb] < 12) return null;
  const par = REAL_PLAYERS.par[format];
  const [wEcon, wAvg] = REAL_PLAYERS.bowlWeights[format];
  const rpb = (c[K.br] + 60 * par.rpb * 1.12) / (c[K.bb] + 60);
  const avg = (c[K.br] + 3 * par.bowlAvg * 1.3) / (c[K.wk] + 3);
  const quality = wEcon * Math.log(par.rpb / rpb) + wAvg * Math.log(par.bowlAvg / avg);
  return { points: 70 + REAL_PLAYERS.pointsScale * quality + offsetFor(format, country), weight: Math.min(40, c[K.bb] / 24) * REAL_PLAYERS.importance[format] };
}

function combine(parts: ({ points: number; weight: number } | null)[], volume: number): number | null {
  let sum = 0;
  let weight = 0;
  for (const p of parts) {
    if (!p) continue;
    sum += p.points * p.weight;
    weight += p.weight;
  }
  if (weight === 0) return null;
  const raw = sum / weight;
  // Few innings or spells: pulled towards an ordinary level.
  const trust = volume / (volume + REAL_PLAYERS.shrinkInnings);
  return REAL_PLAYERS.shrinkTo + (raw - REAL_PLAYERS.shrinkTo) * trust;
}

const ratingCache = new Map<string, RealRatings>();

/** The ratings a player's figures earn. */
export function realRatings(rec: RealPlayerRecord): RealRatings {
  const cached = ratingCache.get(rec.id);
  if (cached) return cached;
  const batIn = (formats: RealFormat[]) => combine(formats.map((f) => battingPoints(rec.s[f] as number[], f, rec.c)), formats.reduce((n, f) => n + (rec.s[f]?.[K.inn] ?? 0), 0));
  const bowlIn = (formats: RealFormat[]) => combine(formats.map((f) => bowlingPoints(rec.s[f] as number[], f, rec.c)), formats.reduce((n, f) => n + (rec.s[f]?.[K.bb] ?? 0) / 24, 0));
  const bat = batIn(FORMATS);
  const bowl = bowlIn(FORMATS);
  const floor = REAL_PLAYERS.shrinkTo - 10;
  let points: number;
  switch (rec.r) {
    case 'PB':
    case 'SB':
      points = bowl ?? floor;
      break;
    case 'AR':
      points = 0.55 * (bat ?? floor) + 0.45 * (bowl ?? floor) + 5;
      break;
    case 'BR':
      points = 0.4 * (bat ?? floor) + 0.6 * (bowl ?? floor) + 5;
      break;
    default:
      points = bat ?? floor;
  }
  const fromFigures = bat !== null || bowl !== null;
  const out: RealRatings = {
    bat,
    bowl,
    batT20: batIn(T20_FORMATS),
    batRed: batIn(RED_FORMATS),
    bowlT20: bowlIn(T20_FORMATS),
    bowlRed: bowlIn(RED_FORMATS),
    points,
    overall: fromFigures ? Math.round(pointsToOverall(points)) : noFiguresOverall(rec),
    fromFigures,
  };
  ratingCache.set(rec.id, out);
  return out;
}

function saltOf(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** A random stream fixed to one player (and a purpose), independent of the career seed. */
export function playerRng(id: string, salt: string | number): Rng {
  return createRng(deriveSeed(saltOf(id), saltOf(String(salt))));
}

function noFiguresOverall(rec: RealPlayerRecord): number {
  const [mean, spread] = REAL_PLAYERS.noFiguresOverall;
  return Math.round(mean + playerRng(rec.id, 'overall').spread() * spread);
}

// --- Roles and styles ---------------------------------------------------------------------------

const ROLE_OF: Record<RealRoleCode, PlayerRole> = {
  OB: 'OPENING_BATTER',
  BA: 'BATTER',
  WK: 'WICKET_KEEPER_BATTER',
  AR: 'BATTING_ALLROUNDER',
  BR: 'BOWLING_ALLROUNDER',
  PB: 'PACE_BOWLER',
  SB: 'SPIN_BOWLER',
};

export function realRole(code: RealRoleCode): PlayerRole {
  return ROLE_OF[code] ?? 'BATTER';
}

const STYLES: BowlingStyle[] = [
  'RIGHT_ARM_FAST',
  'RIGHT_ARM_FAST_MEDIUM',
  'RIGHT_ARM_MEDIUM',
  'LEFT_ARM_FAST',
  'LEFT_ARM_FAST_MEDIUM',
  'LEFT_ARM_MEDIUM',
  'OFF_SPIN',
  'LEG_SPIN',
  'LEFT_ARM_ORTHODOX',
  'LEFT_ARM_WRIST_SPIN',
  'NONE',
];

export function realBowlingStyle(rec: RealPlayerRecord): BowlingStyle {
  const style = STYLES.includes(rec.bw as BowlingStyle) ? (rec.bw as BowlingStyle) : 'NONE';
  const role = realRole(rec.r);
  // Bowlers always have a style; a spinner's is a spin style and a seamer's a pace style.
  const spin = style === 'OFF_SPIN' || style === 'LEG_SPIN' || style === 'LEFT_ARM_ORTHODOX' || style === 'LEFT_ARM_WRIST_SPIN';
  if (role === 'SPIN_BOWLER' && !spin) return 'OFF_SPIN';
  if (role === 'PACE_BOWLER' && (spin || style === 'NONE')) return 'RIGHT_ARM_FAST_MEDIUM';
  if ((role === 'BATTING_ALLROUNDER' || role === 'BOWLING_ALLROUNDER') && style === 'NONE') return 'RIGHT_ARM_MEDIUM';
  return style;
}

/** How they bat, from the strike rate against par and where they bat. */
function approachOf(rec: RealPlayerRecord): { approach: BattingApproach; aggression: number } {
  let runs = 0;
  let balls = 0;
  let parBalls = 0;
  let posSum = 0;
  let posN = 0;
  for (const f of FORMATS) {
    const c = rec.s[f];
    if (!c || c[K.balls] <= 0) continue;
    runs += c[K.runs];
    balls += c[K.balls];
    parBalls += (c[K.runs] / REAL_PLAYERS.par[f].sr) * 100;
    if (c[K.pos] > 0) {
      posSum += c[K.pos] * c[K.inn];
      posN += c[K.inn];
    }
  }
  if (balls < 30) return { approach: 'STROKE_MAKER', aggression: 3 };
  const ratio = parBalls / balls; // above 1: scores faster than par
  const pos = posN > 0 ? posSum / posN : 5;
  const aggression = ratio >= 1.12 ? 4 : ratio <= 0.9 ? 2 : 3;
  if (ratio >= 1.06) return { approach: pos >= 4.5 ? 'FINISHER' : 'STROKE_MAKER', aggression };
  if (ratio <= 0.93) return { approach: 'ANCHOR', aggression };
  return { approach: pos <= 2.5 ? 'ANCHOR' : 'STROKE_MAKER', aggression };
}

// --- Attributes ----------------------------------------------------------------------------------

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function groupMean(a: Attributes, group: keyof Attributes): number {
  const values = Object.values(a[group]) as number[];
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function shiftGroup(a: Attributes, group: keyof Attributes, delta: number, only?: string[]): void {
  for (const key of Object.keys(a[group])) {
    if (only && !only.includes(key)) continue;
    setAttr(a, group, key, getAttr(a, group, key) + delta);
  }
}

function sumOver(rec: RealPlayerRecord, key: number, formats: RealFormat[] = FORMATS): number {
  return formats.reduce((s, f) => s + (rec.s[f]?.[key] ?? 0), 0);
}

/**
 * A full attribute set for the ratings: the role's usual shape at the
 * target overall, then batting against bowling as the figures say, T20
 * against red-ball skills, power from the six rate, catching and keeping
 * from the catches - and the whole set shifted so the overall lands on the
 * target.
 */
export function realAttributes(rec: RealPlayerRecord, ratings: RealRatings, rng: Rng): Attributes {
  const role = realRole(rec.r);
  const style = realBowlingStyle(rec);
  const { approach, aggression } = approachOf(rec);
  const target = ratings.overall;
  const a = cloneAttributes(buildCeilings(role, style, approach, [], aggression, target, rng));
  const bat = ratings.bat;
  const bowl = ratings.bowl;

  // Batting against bowling.
  if (role === 'PACE_BOWLER' || role === 'SPIN_BOWLER') {
    if (bat !== null) {
      const desired = clamp(pointsToOverall(bat) - 8, target - 40, target - 6);
      shiftGroup(a, 'batting', desired - groupMean(a, 'batting'));
    }
  } else if (role === 'BATTING_ALLROUNDER' || role === 'BOWLING_ALLROUNDER') {
    if (bat !== null && bowl !== null) {
      const delta = clamp((bat - bowl) * 0.5, -10, 10);
      shiftGroup(a, 'batting', delta / 2);
      shiftGroup(a, 'bowling', -delta / 2);
    }
  } else if (bowl !== null && sumOver(rec, K.bb) >= 120) {
    // A batter who bowls a bit: part-time skills, never a front-line bowler's.
    const desired = clamp(pointsToOverall(bowl) - 14, target - 45, target - 12);
    const now = groupMean(a, 'bowling');
    if (desired > now) shiftGroup(a, 'bowling', desired - now);
  }

  // T20 against the longer game.
  const tilt = (t20: number | null, red: number | null) => {
    // Only a player with figures in both can be told apart; one format alone says nothing.
    if (t20 !== null && red !== null) return clamp((t20 - red) / 2, -REAL_PLAYERS.formatTilt, REAL_PLAYERS.formatTilt);
    return 0;
  };
  const batTilt = tilt(ratings.batT20, ratings.batRed);
  shiftGroup(a, 'batting', batTilt, ['power', 'shotRange', 'running']);
  shiftGroup(a, 'batting', -batTilt, ['technique', 'concentration', 'vsSwing', 'footwork']);
  const bowlTilt = tilt(ratings.bowlT20, ratings.bowlRed);
  shiftGroup(a, 'bowling', bowlTilt, ['deathBowling', 'variation']);
  shiftGroup(a, 'bowling', -bowlTilt, style === 'NONE' || /SPIN|ORTHODOX/.test(style) ? ['flight', 'accuracy'] : ['swing', 'seam', 'newBall']);

  // Six hitting in T20 cricket.
  const t20Balls = sumOver(rec, K.balls, T20_FORMATS);
  if (t20Balls >= 60) {
    const rate = sumOver(rec, K.sixes, T20_FORMATS) / t20Balls;
    shiftGroup(a, 'batting', clamp((rate / 0.055 - 1) * 6, -6, 6), ['power']);
  }
  // Catching and keeping.
  const matches = sumOver(rec, K.m);
  if (matches >= 5) {
    const catches = sumOver(rec, K.ct);
    if (role === 'WICKET_KEEPER_BATTER') {
      shiftGroup(a, 'fielding', clamp(((catches + sumOver(rec, K.st)) / matches - 1.2) * 6, -4, 6), ['wicketKeeping']);
    } else {
      shiftGroup(a, 'fielding', clamp((catches / matches - 0.4) * 15, -5, 6), ['catching']);
    }
  }

  // Land on the target overall.
  let out = clampAll(a);
  for (let pass = 0; pass < 6; pass += 1) {
    const gap = target - computeOverall(out, role);
    if (Math.abs(gap) < 0.5) break;
    for (const ref of attributeRefs(a)) setAttr(a, ref.group, ref.key, getAttr(a, ref.group, ref.key) + gap);
    out = clampAll(a);
  }
  return out;
}

function clampAll(a: Attributes): Attributes {
  const out = cloneAttributes(a);
  for (const ref of attributeRefs(out)) setAttr(out, ref.group, ref.key, Math.round(clamp(getAttr(out, ref.group, ref.key), 5, 99)));
  return out;
}

// --- Age, potential, retirement ----------------------------------------------------------------

/** Date of birth from the estimated year (a fixed day for the player). */
export function realDateOfBirth(rec: RealPlayerRecord): string {
  const rng = playerRng(rec.id, 'dob');
  const month = rng.int(1, 12);
  const day = rng.int(1, 28);
  return `${rec.y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Whole years on `date`. */
export function ageOn(dateOfBirth: string, date: string): number {
  const [by, bm, bd] = dateOfBirth.split('-').map(Number);
  const [y, m, d] = date.split('-').map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

/**
 * Hidden potential that keeps an established player where the figures put
 * them (see `ageRival`: the overall moves towards potential x maturity x the
 * developed share, less decline), with room to grow for the young.
 */
export function realPotential(overall: number, age: number): number {
  const decline = age > WORLD.declineStart ? (age - WORLD.declineStart) * WORLD.declinePerYear : 0;
  const steady = (overall + decline) / (REAL_PLAYERS.developedShare * maturityAt(age));
  const room = age < 26 ? (26 - age) * 2.2 + 3 : 3;
  return Math.round(clamp(Math.min(steady, overall + room), overall, 99));
}

/** The age a player retires at: fixed per player; later for the best, earlier for fast bowlers. */
export function realRetireAge(rec: RealPlayerRecord, ageAtData: number): number {
  const [lo, hi] = REAL_PLAYERS.retireAge;
  let age = playerRng(rec.id, 'retire').int(lo, hi);
  if (realRatings(rec).overall >= REAL_PLAYERS.eliteOverall) age += REAL_PLAYERS.eliteBonus;
  if (rec.r === 'PB') age -= 1;
  // Playing in the data season (or the one before, like a listed IPL veteran), so a few seasons more yet.
  const active = rec.ly >= realSeason() - 1;
  return Math.max(age, ageAtData + (active ? REAL_PLAYERS.minSeasonsLeft : 1));
}

// --- Rival players ------------------------------------------------------------------------------

export interface RealPlayerOptions {
  teamId: string;
  /** Home state or country (name pool, climate). */
  region: string;
  seasonYear: number;
  /** An overseas player in an IPL squad. */
  overseas?: boolean;
}

function teamSlug(teamId: string): string {
  return teamId.replace(/^team-/, '');
}

/** The player as they are in the data season. */
function realAtDataSeason(rec: RealPlayerRecord, options: RealPlayerOptions): RivalPlayer {
  const season = realSeason();
  const seasonStart = `${season}-06-01`;
  const dateOfBirth = realDateOfBirth(rec);
  const age = ageOn(dateOfBirth, seasonStart);
  const role = realRole(rec.r);
  const ratings = realRatings(rec);
  const rng = playerRng(rec.id, 'attributes');
  const id = `rl-${teamSlug(options.teamId)}-${rec.id}`;
  let base: RivalPlayer;
  if (ratings.fromFigures) {
    const attributes = realAttributes(rec, ratings, rng);
    const overall = computeOverall(attributes, role);
    const condition = freshCondition(rng, overall);
    base = {
      id,
      name: rec.n,
      age,
      dateOfBirth,
      region: options.region,
      teamId: options.teamId,
      role,
      battingStyle: rec.h === 'L' ? 'LEFT_HAND_BAT' : 'RIGHT_HAND_BAT',
      bowlingStyle: realBowlingStyle(rec),
      attributes,
      overall,
      potentialOverall: realPotential(overall, age),
      condition: { ...condition, reputation: clamp(Math.round((overall - 50) * 1.8 + (rec.cap ? 8 : 0)), 5, 95), selectorTrust: 50 },
      season: emptySeasonLine(season),
      history: [],
      injuredUntil: null,
      isDirectRival: false,
      selectorFavour: clamp(Math.round(overall - 22), 40, 80),
    };
  } else {
    // No figures: generated at state level, keeping the real name, role and age.
    const profile = LEVELS.STATE;
    const generated = generateWorldPlayer({
      teamId: options.teamId,
      region: options.region,
      role,
      age,
      seasonStart,
      seasonYear: season,
      potential: profile.potential[0] + rng.spread() * profile.potential[1],
      share: profile.share,
      rng,
    });
    // Generated shape, but at the level the real state players sit (`noFiguresOverall`), never above proven ones.
    const scale = ratings.overall / Math.max(1, generated.overall);
    const attributes = cloneAttributes(generated.attributes);
    for (const ref of attributeRefs(attributes)) setAttr(attributes, ref.group, ref.key, Math.round(clamp(getAttr(attributes, ref.group, ref.key) * scale, 1, 99)));
    const overall = computeOverall(attributes, role);
    base = {
      ...generated,
      attributes,
      overall,
      potentialOverall: realPotential(overall, age),
      id,
      name: rec.n,
      dateOfBirth,
      battingStyle: rec.g & REAL_GUESS.BAT_HAND ? generated.battingStyle : rec.h === 'L' ? 'LEFT_HAND_BAT' : 'RIGHT_HAND_BAT',
      bowlingStyle: rec.g & REAL_GUESS.BOWL_STYLE ? generated.bowlingStyle : realBowlingStyle(rec),
    };
  }
  return { ...base, realId: rec.id, ...(options.overseas ? { overseas: true } : {}), ...(rec.cap ? { capped: true } : {}) };
}

/**
 * The player as they are in `seasonYear`: aged one season at a time from the
 * data season with their own random stream; null once they have retired.
 */
export function realPlayerAt(rec: RealPlayerRecord, options: RealPlayerOptions): RivalPlayer | null {
  let p = realAtDataSeason(rec, options);
  const retireAt = realRetireAge(rec, p.age);
  for (let year = realSeason() + 1; year <= options.seasonYear; year += 1) {
    p = ageRival(p, `${year}-06-01`, year, playerRng(rec.id, year));
    if (p.age >= retireAt) return null;
  }
  // Before the data season (a career begun before the earliest data): the same player, their age then.
  const age = options.seasonYear < realSeason() ? ageOn(p.dateOfBirth, `${options.seasonYear}-06-01`) : p.age;
  return { ...p, age, season: emptySeasonLine(options.seasonYear) };
}

/** A real player's retirement age, from their record (for the yearly progression). */
export function retireAgeOf(rival: RivalPlayer): number | null {
  if (!rival.realId) return null;
  const rec = realRecord(rival.realId);
  if (!rec) return null;
  return realRetireAge(rec, ageOn(realDateOfBirth(rec), `${realSeason()}-06-01`));
}
