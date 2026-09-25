/**
 * What a match does to the player afterwards: form, confidence, morale,
 * fatigue, fitness, injury risk, reputation and how much the selectors trust
 * them. Pure - it takes a condition in and returns a new one.
 */
import { CONDITION, MATCH, XP } from '../config';
import type { Rng } from './rng';
import { createInjury, pickInjuryType } from '../development/injuries';
import type {
  Condition,
  FormBand,
  Injury,
  MoraleBand,
  PlayerMatchPerformance,
  PlayerRole,
} from '@/types';

export interface AftermathInput {
  condition: Condition;
  performance: PlayerMatchPerformance;
  /** Days of play the match lasted. */
  days: number;
  /** Did the player's side win? */
  won: boolean;
  drawn: boolean;
  /** 0-100 prestige of the competition, which scales reputation gains. */
  prestige: number;
  /** In-game date, used to date an injury. */
  date: string;
  durability: number;
  /** The player's role and age shape which injury it is. */
  role?: PlayerRole;
  age?: number;
  /** Trait multiplier on the chance (injury-prone, fitness freak). */
  injuryMultiplier?: number;
}

export interface AftermathResult {
  condition: Condition;
  xpEarned: number;
  /** Set when the match left the player injured. */
  injury: Injury | null;
}

const FORM_BANDS: { band: FormBand; min: number }[] = [
  { band: 'EXCELLENT', min: 80 },
  { band: 'GOOD', min: 62 },
  { band: 'AVERAGE', min: 42 },
  { band: 'POOR', min: 24 },
  { band: 'TERRIBLE', min: 0 },
];

const MORALE_BANDS: { band: MoraleBand; min: number }[] = [
  { band: 'FLYING', min: 82 },
  { band: 'HIGH', min: 64 },
  { band: 'STEADY', min: 42 },
  { band: 'LOW', min: 22 },
  { band: 'BROKEN', min: 0 },
];

export function formBandFor(form: number): FormBand {
  return FORM_BANDS.find((b) => form >= b.min)?.band ?? 'AVERAGE';
}

export function moraleBandFor(morale: number): MoraleBand {
  return MORALE_BANDS.find((b) => morale >= b.min)?.band ?? 'STEADY';
}

/** Roll for an injury. Fatigue is the main driver; durability is the defence. */
function rollInjury(input: AftermathInput, fatigue: number, rng: Rng): Injury | null {
  const base = CONDITION.baseInjuryChance + (fatigue / 100) * CONDITION.fatigueInjuryChance;
  const workload = 1 + input.performance.oversBowled / 30;
  const resistance = 1 - (input.durability / 100) * 0.55;
  const recurrence = input.condition.injury?.recurrence ? 1.5 : 1;
  const traits = input.injuryMultiplier ?? 1;

  if (!rng.chance(base * workload * resistance * recurrence * traits)) return null;

  const type = pickInjuryType(
    {
      role: input.role ?? 'BATTER',
      context: 'MATCH',
      age: input.age ?? 24,
      paceLoad: input.performance.oversBowled / 8,
    },
    rng,
  );
  return createInjury(type, input.date, rng, Boolean(input.condition.injury));
}

/** Apply everything a match leaves behind. */
export function applyAftermath(input: AftermathInput, rng: Rng): AftermathResult {
  const cfg = MATCH.aftermath;
  const { condition, performance } = input;

  // Form and confidence chase the match rating rather than jumping to it.
  const ratingAsPercent = (performance.rating / 10) * 100;
  const form = clamp(
    condition.form + (ratingAsPercent - condition.form) * cfg.formInertia,
    0,
    100,
  );
  const confidence = clamp(
    condition.confidence + (ratingAsPercent - condition.confidence) * cfg.confidenceInertia,
    0,
    100,
  );

  const moraleShift =
    (input.won ? cfg.moraleWin : input.drawn ? 0 : cfg.moraleLoss) +
    (performance.manOfTheMatch ? cfg.moraleMotm : 0) +
    (performance.rating - 5) * 0.8;
  const morale = clamp(condition.morale + moraleShift, 0, 100);

  // Fatigue from days on the park and overs in the legs.
  const fatigue = clamp(
    condition.fatigue + input.days * cfg.fatiguePerDay + performance.oversBowled * cfg.fatiguePerOverBowled,
    0,
    100,
  );

  // Fitness only really suffers once fatigue is high.
  const fitnessLoss =
    fatigue > CONDITION.fatigueFitnessThreshold
      ? ((fatigue - CONDITION.fatigueFitnessThreshold) / 40) * cfg.fitnessLossAtHighFatigue
      : 0;
  let fitness = clamp(condition.fitness - fitnessLoss, 0, 100);

  const injury = rollInjury(input, fatigue, rng);
  if (injury) fitness = clamp(fitness - injury.attributePenalty * 3, 0, 100);

  // Reputation is slow, and scales with how big the stage was.
  const prestigeScale = 0.5 + (input.prestige / 100) * 1.2;
  const reputationGain =
    Math.max(0, performance.rating - 5.5) * cfg.reputationPerRating * prestigeScale +
    (performance.manOfTheMatch ? cfg.reputationMotm : 0);
  const reputation = clamp(condition.reputation + reputationGain, 1, 99);

  // Selector trust moves on performance, and a duck hurts.
  const trustTarget = clamp(performance.rating * 10, 0, 100);
  const selectorTrust = clamp(
    condition.selectorTrust + (trustTarget - condition.selectorTrust) * cfg.selectorTrustInertia,
    0,
    100,
  );

  const recentRatings = [...condition.recentRatings, performance.rating].slice(-CONDITION.formWindow);

  const xpEarned = Math.round(
    (XP.perAppearance +
      performance.runs * XP.perRun +
      performance.wickets * XP.perWicket +
      (performance.catches + performance.stumpings + performance.runOuts) * XP.perCatch) *
      (1 + (input.prestige / 100) * XP.prestigeScale * 100 * 0.01),
  );

  return {
    condition: {
      ...condition,
      form: round(form),
      formBand: formBandFor(form),
      confidence: round(confidence),
      morale: round(morale),
      moraleBand: moraleBandFor(morale),
      fatigue: round(fatigue),
      fitness: round(fitness),
      injury: injury ?? condition.injury,
      recentRatings,
      recentWorkload: round(condition.recentWorkload + performance.oversBowled),
      reputation: round(reputation),
      selectorTrust: round(selectorTrust),
    },
    xpEarned,
    injury,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
