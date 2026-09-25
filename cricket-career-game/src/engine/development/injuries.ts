/**
 * Injuries: what causes them, what they are, and the road back. A training
 * injury is rolled once a week from fatigue, load, the player's durability,
 * traits and lifestyle; a match injury comes out of the match aftermath and
 * uses the same catalogue.
 */
import { INJURY } from '../config';
import type { Rng } from '../match/rng';
import { INJURIES, INJURIES_BY_TYPE, type InjuryContext } from '@/data/injuries';
import { traitProduct } from '@/data/traits';
import { addDays, daysBetweenDates } from './dates';
import type {
  DevelopmentState,
  Injury,
  InjuryHistoryEntry,
  InjurySeverity,
  InjuryType,
  PersonalityTrait,
  PlayerRole,
  RehabPlan,
  RehabState,
} from '@/types';

export interface InjuryRiskInput {
  /** 0-100. */
  fatigue: number;
  /** Intensity-weighted sum of the week's drill injury loads. */
  load: number;
  /** 0-99 durability attribute. */
  durability: number;
  traits: PersonalityTrait[];
  /** Product of the lifestyle injury multipliers. */
  lifestyle: number;
  /** True within `rushedWeeks` of coming back early. */
  rushed: boolean;
}

/** Chance of picking up an injury in a week of training. */
export function weeklyInjuryChance(input: InjuryRiskInput): number {
  const fatigue = Math.max(0, Math.min(100, input.fatigue)) / 100;
  const raw =
    INJURY.baseWeekly + fatigue * fatigue * INJURY.fatigueWeekly + input.load * INJURY.loadWeekly;
  const durability = 1 - (Math.max(0, Math.min(99, input.durability)) / 100) * INJURY.durabilityRelief;
  const traits = traitProduct(input.traits, 'injury');
  const rushed = input.rushed ? INJURY.rushedMultiplier : 1;
  return Math.min(0.6, raw * durability * traits * input.lifestyle * rushed);
}

export function severityForWeeks(weeks: number): InjurySeverity {
  if (weeks <= 1.5) return 'NIGGLE';
  if (weeks <= 3) return 'MINOR';
  if (weeks <= 6) return 'MODERATE';
  if (weeks <= 12) return 'SERIOUS';
  return 'SEVERE';
}

/**
 * Which injury. Fast bowlers pick up side strains and - young and overbowled
 * - stress fractures of the back; keepers break fingers; blows to the head
 * only happen in matches.
 */
export function pickInjuryType(
  input: { role: PlayerRole; context: InjuryContext; age: number; paceLoad: number },
  rng: Rng,
): InjuryType {
  const youngPace = input.age < 23 ? Math.min(3, input.paceLoad) : input.paceLoad * 0.3;
  return rng.weighted(
    INJURIES.filter((def) => input.context === 'MATCH' || !def.matchOnly).map((def) => ({
      item: def.type,
      weight: def.weight * (def.roleWeight[input.role] ?? 1) * (1 + def.youngPaceWorkload * youngPace),
    })),
  );
}

/** Build an injury of a given type, with a recovery time from its range. */
export function createInjury(
  type: InjuryType,
  date: string,
  rng: Rng,
  recurrence = false,
): Injury {
  const def = INJURIES_BY_TYPE[type];
  const [lo, hi] = def.weeks;
  const weeks = lo + (hi - lo) * rng.next() * (recurrence ? 1.2 : 1);
  const days = Math.max(3, Math.round(weeks * 7));
  return {
    id: `inj-${date}-${type.toLowerCase()}-${Math.floor(rng.next() * 1e6)}`,
    name: def.name,
    bodyPart: def.bodyPart,
    severity: severityForWeeks(weeks),
    startedOn: date,
    expectedReturn: addDays(date, days),
    matchesMissed: 0,
    attributePenalty: def.penalty,
    recurrence,
    type,
  };
}

/** Weeks of rehab an injury needs on a given plan. */
export function rehabWeeks(injury: Injury, plan: RehabPlan): number {
  const weeks = daysBetweenDates(injury.startedOn, injury.expectedReturn) / 7;
  return Math.max(1, Math.ceil(weeks * INJURY.rehab[plan].time));
}

export function startRehab(injury: Injury, plan: RehabPlan = 'STANDARD'): RehabState {
  return { injuryId: injury.id, plan, weeksDone: 0, weeksNeeded: rehabWeeks(injury, plan), testsFailed: 0 };
}

/** Change plan mid-way; the weeks already done still count. */
export function changeRehabPlan(rehab: RehabState, injury: Injury, plan: RehabPlan): RehabState {
  return { ...rehab, plan, weeksNeeded: Math.max(rehab.weeksDone, rehabWeeks(injury, plan)) };
}

export function historyEntry(injury: Injury): InjuryHistoryEntry {
  return {
    id: injury.id,
    type: injury.type ?? 'NIGGLE',
    name: injury.name,
    severity: injury.severity,
    startedOn: injury.startedOn,
    returnedOn: null,
    weeksOut: 0,
    rushed: false,
  };
}

/** Match sharpness on the first day back. */
export function returnMatchFitness(weeksOut: number): number {
  return Math.round(
    Math.max(40, Math.min(92, INJURY.returnMatchFitness + 10 - weeksOut * INJURY.matchFitnessLostPerWeekOut)),
  );
}

/** True within the risky weeks after a rushed return. */
export function rushedRecently(development: DevelopmentState, today: string): boolean {
  return development.injuryHistory.some(
    (entry) =>
      entry.rushed &&
      entry.returnedOn !== null &&
      daysBetweenDates(entry.returnedOn, today) <= INJURY.rushedWeeks * 7,
  );
}

/** Re-injury risk multiplier after a completed rehab, by plan. */
export function reinjuryMultiplier(plan: RehabPlan): number {
  return INJURY.rehab[plan].reinjury;
}

export interface RehabWeekResult {
  rehab: RehabState | null;
  /** Set when the player is cleared this week. */
  cleared: boolean;
  /** Set when a return-to-play test was taken and failed. */
  failedTest: boolean;
  /** True when this plan counts as a rushed comeback. */
  rushed: boolean;
}

/**
 * One week of rehab. When the weeks are done the player takes a return-to-
 * play test; a fail adds a week or two.
 */
export function rehabWeek(rehab: RehabState, rng: Rng): RehabWeekResult {
  const next = { ...rehab, weeksDone: rehab.weeksDone + 1 };
  if (next.weeksDone < next.weeksNeeded) {
    return { rehab: next, cleared: false, failedTest: false, rushed: false };
  }
  const pass = rng.chance(INJURY.rehab[rehab.plan].passChance - rehab.testsFailed * 0.05);
  if (pass) {
    return { rehab: null, cleared: true, failedTest: false, rushed: rehab.plan === 'AGGRESSIVE' };
  }
  return {
    rehab: { ...next, weeksNeeded: next.weeksNeeded + rng.int(1, 2), testsFailed: rehab.testsFailed + 1 },
    cleared: false,
    failedTest: true,
    rushed: false,
  };
}
