import type { ISODate, Percent, Rating } from './primitives';

/** Coarse form band shown on the hero card ("Form: Good"). */
export type FormBand = 'TERRIBLE' | 'POOR' | 'AVERAGE' | 'GOOD' | 'EXCELLENT';

/** Coarse morale band shown on the hero card ("Morale: High"). */
export type MoraleBand = 'BROKEN' | 'LOW' | 'STEADY' | 'HIGH' | 'FLYING';

export type InjurySeverity = 'NIGGLE' | 'MINOR' | 'MODERATE' | 'SERIOUS' | 'SEVERE';

/** Injury types with realistic recovery times - see `src/data/injuries.ts`. */
export type InjuryType =
  | 'HAMSTRING'
  | 'SIDE_STRAIN'
  | 'BACK_STRESS_FRACTURE'
  | 'FINGER_FRACTURE'
  | 'ANKLE_SPRAIN'
  | 'CONCUSSION'
  | 'SHOULDER'
  | 'KNEE'
  | 'GROIN'
  | 'NIGGLE';

export interface Injury {
  id: string;
  name: string;
  /** e.g. 'Hamstring', 'Lower back', 'Finger'. */
  bodyPart: string;
  severity: InjurySeverity;
  startedOn: ISODate;
  /** In-game date the player is expected to be fit again. */
  expectedReturn: ISODate;
  /** Matches missed so far because of this injury. */
  matchesMissed: number;
  /** Temporary penalty applied to physical attributes while carrying it. */
  attributePenalty: number;
  /** A recurrence of a previous injury raises future risk. */
  recurrence: boolean;
  /** What kind of injury it is. Missing on saves from before Phase 5. */
  type?: InjuryType;
}

/**
 * Everything about the player that changes week to week. Attributes are what
 * the player *can* do; condition is how well they can do it right now.
 */
export interface Condition {
  /** 0-100 rolling form rating derived from recent match ratings. */
  form: Percent;
  formBand: FormBand;
  /** 0-100. Shown as "Fitness 92%". Falls with fatigue and injury. */
  fitness: Percent;
  /** 0-100 accumulated physical load. High fatigue raises injury risk. */
  fatigue: Percent;
  /** 0-100. Shown as "Morale High". Moved by selection, results, media. */
  morale: Percent;
  moraleBand: MoraleBand;
  /** 0-100 belief in own game; damps or amplifies form swings. */
  confidence: Percent;
  /** Current injury, or `null` when fully fit. */
  injury: Injury | null;
  /** Match ratings (0-10) for the last N appearances, newest last. */
  recentRatings: number[];
  /** Overs bowled in the last 14 in-game days - drives workload management. */
  recentWorkload: number;
  /** Reputation 1-99: how well known the player is to selectors and scouts. */
  reputation: Rating;
  /**
   * 0-100 standing with the selectors of the current team. Reputation is who
   * knows your name; trust is whether they pick you this week.
   */
  selectorTrust: Percent;
}
