/**
 * AI cricketers who live across seasons. They are built on the same ceilings
 * and age curve as the user's player, so a 15-year-old in a state U-16 side
 * and the user at 15 are measured on one scale.
 */
import { WORLD } from '../config';
import { computeOverall } from '../ratings';
import type { Rng } from '../match/rng';
import { bowlingStyleFor, freshCondition } from '../match/squad';
import { buildCeilings } from '../development/creation';
import { addDays } from '../development/dates';
import { attributeRefs, cloneAttributes, getAttr, maturityAt, reachableAt, setAttr } from '../development/curves';
import { FAMOUS, NAME_POOLS, POOL_BY_STATE, type NamePool } from '@/data/names';
import type { Attributes, BattingApproach, PlayerRole, RivalPlayer, RivalSeasonLine } from '@/types';

export function emptySeasonLine(seasonYear: number): RivalSeasonLine {
  return {
    seasonYear,
    matches: 0,
    innings: 0,
    notOuts: 0,
    runs: 0,
    balls: 0,
    highScore: 0,
    fifties: 0,
    hundreds: 0,
    wickets: 0,
    ballsBowled: 0,
    runsConceded: 0,
    catches: 0,
    ratings: [],
  };
}

export function poolFor(region: string): NamePool {
  return POOL_BY_STATE[region] ?? 'HINDI';
}

/** A fictional name from the region's pool, never a famous real pairing, unique within `taken`. */
export function pickName(region: string, rng: Rng, taken?: Set<string>): string {
  const pool = NAME_POOLS[poolFor(region)];
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const name = `${rng.pick(pool.first)} ${rng.pick(pool.last)}`;
    if (FAMOUS.has(name) || taken?.has(name)) continue;
    taken?.add(name);
    return name;
  }
  const fallback = `${rng.pick(pool.first)} ${rng.pick(pool.last)} ${rng.int(2, 9)}`;
  taken?.add(fallback);
  return fallback;
}

let rivalSeq = 0;

export interface WorldPlayerInput {
  teamId: string;
  region: string;
  role: PlayerRole;
  /** Whole years on `seasonStart`. */
  age: number;
  seasonStart: string;
  seasonYear: number;
  /** Hidden ceiling for the overall. */
  potential: number;
  /** Share of the reachable level already developed (selected players train). */
  share: number;
  rng: Rng;
  taken?: Set<string>;
}

const APPROACHES: BattingApproach[] = ['ANCHOR', 'STROKE_MAKER', 'FINISHER'];

export function generateWorldPlayer(input: WorldPlayerInput): RivalPlayer {
  const { rng, role, age } = input;
  const bowlingStyle = bowlingStyleFor(rng, role);
  const potential = Math.max(40, Math.min(97, Math.round(input.potential)));
  const ceilings = buildCeilings(role, bowlingStyle, rng.pick(APPROACHES), [], rng.int(2, 4), potential, rng);
  const attributes = developedAt(ceilings, age, input.share, rng);
  const dateOfBirth = addDays(input.seasonStart, -Math.round(age * 365.25) - rng.int(0, 360));
  rivalSeq += 1;
  const condition = freshCondition(rng, 55);
  return {
    id: `rv-${input.teamId.replace(/^team-/, '')}-${rivalSeq.toString(36)}-${Math.floor(rng.next() * 1e6).toString(36)}`,
    name: pickName(input.region, rng, input.taken),
    age,
    dateOfBirth,
    region: input.region,
    teamId: input.teamId,
    role,
    battingStyle: rng.chance(0.27) ? 'LEFT_HAND_BAT' : 'RIGHT_HAND_BAT',
    bowlingStyle,
    attributes,
    overall: computeOverall(attributes, role),
    potentialOverall: potential,
    condition: { ...condition, reputation: 5, selectorTrust: 50 },
    season: emptySeasonLine(input.seasonYear),
    history: [],
    injuredUntil: null,
    isDirectRival: false,
    selectorFavour: Math.round(40 + rng.next() * 30),
  };
}

/** Attributes at an age: the reachable level times how much has been developed, with scatter. */
function developedAt(ceilings: Attributes, age: number, share: number, rng: Rng): Attributes {
  const out = cloneAttributes(ceilings);
  for (const ref of attributeRefs(out)) {
    const reachable = reachableAt(getAttr(ceilings, ref.group, ref.key), age, ref.group);
    const value = reachable * Math.min(1, share + rng.spread() * 0.06);
    setAttr(out, ref.group, ref.key, Math.max(1, Math.min(99, Math.round(value))));
  }
  return out;
}

/** Reachable overall at an age, for a hidden potential. */
export function reachableOverall(potential: number, age: number): number {
  const decline = age > WORLD.declineStart ? (age - WORLD.declineStart) * WORLD.declinePerYear : 0;
  return potential * maturityAt(age) - decline;
}

/**
 * A year older. The overall moves part of the way towards what the age and
 * potential allow (a little luck either way); every attribute scales with it.
 */
export function ageRival(rival: RivalPlayer, seasonStart: string, seasonYear: number, rng: Rng): RivalPlayer {
  const age = rival.age + 1;
  const target = reachableOverall(rival.potentialOverall, age) * WORLD.developedShare;
  const move = (target - rival.overall) * WORLD.annualPull + rng.spread() * WORLD.annualNoise;
  const nextOverall = Math.max(10, Math.min(97, rival.overall + move));
  const scale = nextOverall / Math.max(1, rival.overall);
  const attributes = cloneAttributes(rival.attributes);
  for (const ref of attributeRefs(attributes)) {
    setAttr(attributes, ref.group, ref.key, Math.max(1, Math.min(99, Math.round(getAttr(attributes, ref.group, ref.key) * scale))));
  }
  const season = rival.season;
  const history = season.matches > 0
    ? [{ seasonYear: season.seasonYear, teamName: rival.teamId, matches: season.matches, runs: season.runs, wickets: season.wickets }, ...rival.history].slice(0, 6)
    : rival.history;
  const injured = rng.chance(WORLD.seasonInjuryChance);
  return {
    ...rival,
    age,
    attributes,
    overall: computeOverall(attributes, rival.role),
    season: emptySeasonLine(seasonYear),
    history,
    injuredUntil: injured ? addDays(seasonStart, rng.int(14, 90)) : null,
    condition: { ...rival.condition, form: Math.round(45 + rng.next() * 20), recentRatings: [], fatigue: 10, injury: null },
  };
}

/** Average rating over the season so far (5 when there is none). */
export function seasonRating(rival: RivalPlayer): number {
  const r = rival.season.ratings;
  return r.length ? r.reduce((a, b) => a + b, 0) / r.length : 5;
}
