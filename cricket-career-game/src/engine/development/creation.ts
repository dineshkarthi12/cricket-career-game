/**
 * A new cricketer: role and style shape the ceilings, a hidden potential sets
 * how high they reach overall, and the age they start at decides how much of
 * it is already there. Pure and seeded.
 */
import { DEVELOPMENT } from '../config';
import { computeOverall } from '../ratings';
import type { Rng } from '../match/rng';
import { TRAITS_BY_ID } from '@/data/traits';
import { attributeRefs, cloneAttributes, getAttr, reachableAt, setAttr } from './curves';
import { initialCoachEstimate, coachHints } from './coach';
import type {
  AggressionComfort,
  Attributes,
  BattingApproach,
  BowlingStyle,
  DevelopmentState,
  PersonalityTrait,
  PlayerRole,
} from '@/types';

/** The four roles offered at creation. */
export type CreationRole = 'BATTER' | 'BOWLER' | 'ALLROUNDER' | 'WICKETKEEPER';

const PACE_STYLES: BowlingStyle[] = [
  'RIGHT_ARM_FAST',
  'RIGHT_ARM_FAST_MEDIUM',
  'RIGHT_ARM_MEDIUM',
  'LEFT_ARM_FAST',
  'LEFT_ARM_FAST_MEDIUM',
  'LEFT_ARM_MEDIUM',
];

export function isPaceStyle(style: BowlingStyle): boolean {
  return PACE_STYLES.includes(style);
}

export function isSpinStyle(style: BowlingStyle): boolean {
  return style !== 'NONE' && !isPaceStyle(style);
}

/** Map the creation role onto the engine's roles. */
export function playerRoleFor(
  role: CreationRole,
  bowling: BowlingStyle,
  approach: BattingApproach,
): PlayerRole {
  switch (role) {
    case 'BATTER':
      return approach === 'ANCHOR' ? 'OPENING_BATTER' : 'BATTER';
    case 'WICKETKEEPER':
      return 'WICKET_KEEPER_BATTER';
    case 'ALLROUNDER':
      return 'BATTING_ALLROUNDER';
    case 'BOWLER':
      return isSpinStyle(bowling) ? 'SPIN_BOWLER' : 'PACE_BOWLER';
  }
}

/** A template: the same number for every key in the group. */
type GroupOffsets = Record<keyof Attributes, number>;

const ROLE_OFFSETS: Record<PlayerRole, GroupOffsets> = {
  BATTER: { batting: 5, bowling: -30, fielding: -3, physical: -2, mental: 0 },
  OPENING_BATTER: { batting: 5, bowling: -32, fielding: -4, physical: -2, mental: 1 },
  WICKET_KEEPER_BATTER: { batting: 1, bowling: -42, fielding: 0, physical: -2, mental: 0 },
  BATTING_ALLROUNDER: { batting: -1, bowling: -4, fielding: -2, physical: 0, mental: -2 },
  BOWLING_ALLROUNDER: { batting: -6, bowling: 1, fielding: -2, physical: 0, mental: -2 },
  PACE_BOWLER: { batting: -26, bowling: 4, fielding: -6, physical: 4, mental: -2 },
  SPIN_BOWLER: { batting: -24, bowling: 5, fielding: -6, physical: -5, mental: 1 },
};

/** Per-attribute offsets within the bowling group, by style. */
function bowlingOffsets(style: BowlingStyle): Record<string, number> {
  const fast = style === 'RIGHT_ARM_FAST' || style === 'LEFT_ARM_FAST';
  const fastMedium = style === 'RIGHT_ARM_FAST_MEDIUM' || style === 'LEFT_ARM_FAST_MEDIUM';
  const medium = style === 'RIGHT_ARM_MEDIUM' || style === 'LEFT_ARM_MEDIUM';
  if (fast || fastMedium) {
    return { pace: fast ? 9 : 4, bounce: 4, seam: 3, swing: fast ? 0 : 3, spin: -48, flight: -44 };
  }
  if (medium) {
    return { pace: -8, swing: 6, seam: 5, accuracy: 4, control: 3, spin: -48, flight: -44, bounce: -4 };
  }
  if (style === 'NONE') {
    return { pace: -22, accuracy: -20, swing: -22, seam: -22, spin: -26, flight: -24, bounce: -20, variation: -22, newBall: -24, deathBowling: -24, control: -20 };
  }
  // Spinners.
  const wrist = style === 'LEG_SPIN' || style === 'LEFT_ARM_WRIST_SPIN';
  return {
    pace: -42,
    seam: -36,
    swing: -36,
    newBall: -30,
    deathBowling: -8,
    spin: 7,
    flight: 5,
    variation: wrist ? 7 : 1,
    bounce: wrist ? 3 : -4,
    accuracy: wrist ? -2 : 4,
    control: wrist ? -2 : 4,
  };
}

function approachOffsets(approach: BattingApproach): Record<string, number> {
  switch (approach) {
    case 'ANCHOR':
      return { 'batting.technique': 4, 'batting.concentration': 5, 'batting.power': -4, 'mental.temperament': 3, 'mental.discipline': 2 };
    case 'STROKE_MAKER':
      return { 'batting.timing': 4, 'batting.shotRange': 4, 'batting.concentration': -2 };
    case 'FINISHER':
      return { 'batting.power': 6, 'batting.shotRange': 3, 'batting.concentration': -4, 'batting.running': 2, 'mental.temperament': 1 };
  }
}

export interface CreationInput {
  /** Whole years, 8-12. */
  age: number;
  role: CreationRole;
  battingApproach: BattingApproach;
  bowlingStyle: BowlingStyle;
  traits: PersonalityTrait[];
  /** 1-5. */
  preferredAggression: number;
  /** Fixes the hidden potential (tests and the demo). */
  hiddenPotential?: number;
}

export interface CreatedProfile {
  role: PlayerRole;
  attributes: Attributes;
  /** Per-attribute ceilings. Hidden. */
  potential: Attributes;
  development: DevelopmentState;
}

/** Hidden potential: 60-95, most players in the low 70s, a few genuinely special. */
export function rollHiddenPotential(rng: Rng): number {
  const [min, max] = DEVELOPMENT.potentialRange;
  const u = (rng.next() + rng.next() + rng.next()) / 3;
  return Math.round(min + (max - min) * Math.pow(u, 1.15));
}

/** Starting comfort: at home at the preferred level, less so the further away. */
export function initialComfort(preferred: number, bowlingPreferred = 3): AggressionComfort {
  const curve = [82, 56, 32, 16, 8];
  const around = (centre: number) =>
    [1, 2, 3, 4, 5].map((level) => curve[Math.abs(level - centre)]);
  return { batting: around(preferred), bowling: around(bowlingPreferred) };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Ceilings for every attribute. They are shifted as a whole until the
 * role-weighted overall of the ceilings matches the hidden potential, so a
 * potential-80 player really can reach about 80.
 */
export function buildCeilings(
  role: PlayerRole,
  bowlingStyle: BowlingStyle,
  approach: BattingApproach,
  traits: PersonalityTrait[],
  preferredAggression: number,
  hiddenPotential: number,
  rng: Rng,
): Attributes {
  const template = templateAttributes();
  const bowling = bowlingOffsets(bowlingStyle);
  const byApproach = approachOffsets(approach);
  const roleOffsets = ROLE_OFFSETS[role];
  const traitCeilings: Record<string, number> = {};
  for (const trait of traits) {
    for (const [key, value] of Object.entries(TRAITS_BY_ID[trait].ceilings)) {
      traitCeilings[key] = (traitCeilings[key] ?? 0) + value;
    }
  }

  const raw = cloneAttributes(template);
  for (const ref of attributeRefs(template)) {
    let offset = roleOffsets[ref.group] + (byApproach[ref.id] ?? 0) + (traitCeilings[ref.id] ?? 0);
    if (ref.group === 'bowling') offset += bowling[ref.key] ?? 0;
    if (ref.id === 'fielding.wicketKeeping') offset += role === 'WICKET_KEEPER_BATTER' ? 8 : -44;
    if (ref.id === 'mental.leadership') offset -= 8;
    if (ref.id === 'mental.aggression') offset += (preferredAggression - 3) * 8;
    const noise = rng.spread() * 6;
    setAttr(raw, ref.group, ref.key, hiddenPotential + offset + noise);
  }

  // Calibrate the whole set so its overall lands on the hidden potential.
  let ceilings = raw;
  for (let pass = 0; pass < 4; pass += 1) {
    const clamped = clampAll(ceilings);
    const gap = hiddenPotential - computeOverall(clamped, role);
    if (Math.abs(gap) < 0.5) return clamped;
    const shifted = cloneAttributes(ceilings);
    for (const ref of attributeRefs(shifted)) {
      setAttr(shifted, ref.group, ref.key, getAttr(shifted, ref.group, ref.key) + gap);
    }
    ceilings = shifted;
  }
  return clampAll(ceilings);
}

function clampAll(attributes: Attributes): Attributes {
  const out = cloneAttributes(attributes);
  for (const ref of attributeRefs(out)) {
    setAttr(out, ref.group, ref.key, Math.round(clamp(getAttr(out, ref.group, ref.key), 5, 99)));
  }
  return out;
}

/** Starting skills: what a child of this age has picked up, unevenly. */
export function startingFromCeilings(
  ceilings: Attributes,
  age: number,
  traits: PersonalityTrait[],
  rng: Rng,
): Attributes {
  const [lo, hi] = DEVELOPMENT.startShare;
  const out = cloneAttributes(ceilings);
  for (const ref of attributeRefs(out)) {
    const reachable = reachableAt(getAttr(ceilings, ref.group, ref.key), age, ref.group, traits);
    setAttr(out, ref.group, ref.key, Math.round(clamp(reachable * rng.range(lo, hi), 1, 99)));
  }
  return out;
}

/** Creation: ceilings, starting attributes and the development record. */
export function createProfile(input: CreationInput, rng: Rng): CreatedProfile {
  const role = playerRoleFor(input.role, input.bowlingStyle, input.battingApproach);
  const hiddenPotential = input.hiddenPotential ?? rollHiddenPotential(rng);
  const potential = buildCeilings(
    role,
    input.bowlingStyle,
    input.battingApproach,
    input.traits,
    input.preferredAggression,
    hiddenPotential,
    rng,
  );
  const attributes = startingFromCeilings(potential, input.age, input.traits, rng);
  const development = emptyDevelopment({
    hiddenPotential,
    traits: input.traits,
    battingApproach: input.battingApproach,
    preferredAggression: input.preferredAggression,
    coachEstimate: initialCoachEstimate(hiddenPotential, input.age, input.traits, rng),
  });
  development.coachHints = coachHints(development, input.age);
  return { role, attributes, potential, development };
}

export function emptyDevelopment(
  seed: Pick<
    DevelopmentState,
    'hiddenPotential' | 'traits' | 'battingApproach' | 'preferredAggression' | 'coachEstimate'
  >,
): DevelopmentState {
  return {
    ...seed,
    comfort: initialComfort(seed.preferredAggression),
    progress: {},
    coachHints: [],
    coachQuality: 45,
    matchFitness: 90,
    studies: { grades: 68, family: 72 },
    rehab: null,
    injuryHistory: [],
    fitnessTests: [],
    weeklyReports: [],
    overallHistory: [],
  };
}

/** A flat template the offsets are applied to. */
function templateAttributes(): Attributes {
  const z = 0;
  return {
    batting: { technique: z, timing: z, power: z, shotRange: z, vsPace: z, vsSpin: z, vsSwing: z, footwork: z, running: z, concentration: z },
    bowling: { pace: z, accuracy: z, swing: z, seam: z, spin: z, flight: z, bounce: z, variation: z, newBall: z, deathBowling: z, control: z },
    fielding: { catching: z, groundFielding: z, throwing: z, agility: z, wicketKeeping: z },
    physical: { stamina: z, strength: z, speed: z, durability: z },
    mental: { temperament: z, matchAwareness: z, aggression: z, discipline: z, leadership: z, workRate: z },
  };
}
