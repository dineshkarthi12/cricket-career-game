import type { InjurySeverity, InjuryType } from './condition';
import type { Id, ISODate } from './primitives';
import type { WeeklyReport } from './training';

/**
 * Personality. Two or three per player, chosen at creation. Each one bends
 * training, pressure, injuries or leadership - see `src/data/traits.ts`.
 */
export type PersonalityTrait =
  | 'HARD_WORKER'
  | 'BIG_MATCH_TEMPERAMENT'
  | 'NERVOUS_STARTER'
  | 'INJURY_PRONE'
  | 'NATURAL_LEADER'
  | 'FITNESS_FREAK'
  | 'LATE_BLOOMER'
  | 'EARLY_BLOOMER'
  | 'QUICK_LEARNER'
  | 'EASILY_DISTRACTED';

/** How the player likes to bat, chosen at creation. */
export type BattingApproach = 'ANCHOR' | 'STROKE_MAKER' | 'FINISHER';

/**
 * How comfortable the player is at each aggression level, 0-100, index 0 is
 * level 1. Playing at an uncomfortable level costs a little effectiveness;
 * training at that level builds comfort.
 */
export interface AggressionComfort {
  batting: number[];
  bowling: number[];
}

export type RehabPlan = 'CAUTIOUS' | 'STANDARD' | 'AGGRESSIVE';

/** An injury being worked back from. */
export interface RehabState {
  injuryId: Id;
  plan: RehabPlan;
  /** Weeks of rehab done so far. */
  weeksDone: number;
  /** Weeks the physio wants at this plan. */
  weeksNeeded: number;
  /** Return-to-play tests failed on this injury. */
  testsFailed: number;
}

export interface InjuryHistoryEntry {
  id: Id;
  type: InjuryType;
  name: string;
  severity: InjurySeverity;
  startedOn: ISODate;
  returnedOn: ISODate | null;
  weeksOut: number;
  /** Came back before the physio was happy - re-injury risk is higher. */
  rushed: boolean;
}

/** A yo-yo and sprint test at a camp or a return-to-play check. */
export interface FitnessTestResult {
  id: Id;
  date: ISODate;
  /** e.g. "District camp", "Return to play". */
  label: string;
  /** Yo-yo intermittent recovery level reached, e.g. 16.5. */
  yoyo: number;
  yoyoTarget: number;
  /** 20 m sprint, seconds. Lower is better. */
  sprint: number;
  sprintTarget: number;
  passed: boolean;
}

/** School life while under 16. */
export interface StudyState {
  /** 0-100 school grades. */
  grades: number;
  /** 0-100 how happy the family is with the balance. */
  family: number;
}

export interface OverallSnapshot {
  date: ISODate;
  age: number;
  overall: number;
}

/**
 * Everything about how the player grows that is not an attribute. Stored on
 * the player; `hiddenPotential` is never shown to the user - coaches only
 * hint at it.
 */
export interface DevelopmentState {
  /** 60-95 true ceiling for the player's overall. Hidden. */
  hiddenPotential: number;
  traits: PersonalityTrait[];
  battingApproach: BattingApproach;
  /** 1-5 aggression the player is naturally comfortable at. */
  preferredAggression: number;
  comfort: AggressionComfort;
  /** Fractional progress towards the next point, keyed `group.key`. */
  progress: Record<string, number>;
  /** The coaches' estimate of the player's potential overall - noisy, and it firms up with time. */
  coachEstimate: number;
  /** Vague words about the ceiling, e.g. "High ceiling", "Late bloomer". */
  coachHints: string[];
  /** 0-100 quality of the coaching at the player's current level. */
  coachQuality: number;
  /** 0-100 sharpness for matches; drops after a long lay-off. */
  matchFitness: number;
  studies: StudyState;
  rehab: RehabState | null;
  injuryHistory: InjuryHistoryEntry[];
  fitnessTests: FitnessTestResult[];
  /** Newest first, capped. */
  weeklyReports: WeeklyReport[];
  /** One per month, oldest first. */
  overallHistory: OverallSnapshot[];
}
