import type { Id, ISODate } from './primitives';

/**
 * One drill the player can put into a weekly session. Each is defined in
 * `src/data/drills.ts`: what it costs in energy and fatigue, and which
 * attributes it builds.
 */
export type DrillId =
  // Batting nets
  | 'NETS_PACE'
  | 'NETS_SPIN'
  | 'POWER_HITTING'
  | 'DEFENCE'
  // Bowling
  | 'BOWL_ACCURACY'
  | 'BOWL_PACE'
  | 'BOWL_VARIATIONS'
  | 'DEATH_BOWLING'
  | 'SPIN_BOWLING'
  // Fielding
  | 'FIELDING'
  | 'KEEPING'
  // Fitness
  | 'STRENGTH'
  | 'SPEED'
  | 'ENDURANCE'
  // Mental
  | 'TEMPERAMENT'
  | 'FOCUS'
  // Everything together
  | 'MATCH_SIM'
  | 'REST';

export type DrillCategory = 'BATTING' | 'BOWLING' | 'FIELDING' | 'FITNESS' | 'MENTAL' | 'MATCH' | 'RECOVERY';

export type TrainingIntensity = 'LIGHT' | 'NORMAL' | 'HARD';

/** One session in the week: a drill, how hard, and (for nets) at what aggression. */
export interface TrainingSession {
  id: Id;
  drill: DrillId;
  intensity: TrainingIntensity;
  /**
   * 1-5 for drills that practise an aggression level (batting nets, bowling,
   * match simulation). Training at a level makes the player comfortable there.
   */
  aggression: number | null;
}

export type SleepHabit = 'SHORT' | 'NORMAL' | 'FULL';
export type DietHabit = 'CARELESS' | 'BALANCED' | 'STRICT';
export type RecoveryRoutine = 'NONE' | 'STRETCHING' | 'FULL';

/** Small weekly choices off the field. Each nudges fitness and injury risk. */
export interface Lifestyle {
  sleep: SleepHabit;
  diet: DietHabit;
  recovery: RecoveryRoutine;
}

export interface TrainingPlan {
  id: Id;
  name: string;
  /** This week's sessions, in the order they are run. Limited by energy. */
  sessions: TrainingSession[];
  lifestyle: Lifestyle;
  /**
   * 0-100 share of spare time given to school work. Only matters while the
   * player is at school (under 16): it costs training energy, and neglecting
   * it upsets grades and family.
   */
  studyFocus: number;
  /** In-game date the plan was last run. */
  lastAppliedOn: ISODate | null;
  /** Consecutive weeks the plan has run unchanged - consistency compounds. */
  weeksActive: number;
}

/** One attribute that moved during a week. */
export interface AttributeChange {
  /** `group.key`, e.g. `batting.technique`. */
  key: string;
  label: string;
  /** Whole points gained (or lost, negative) this week. */
  delta: number;
}

/** What a week of training did. The latest few are kept for the Training screen. */
export interface WeeklyReport {
  id: Id;
  /** Monday the week started. */
  weekOf: ISODate;
  age: number;
  energyUsed: number;
  energyBudget: number;
  changes: AttributeChange[];
  fatigue: [number, number];
  fitness: [number, number];
  overall: [number, number];
  xpEarned: number;
  /** Set when the week ended in an injury. */
  injury: string | null;
  coachNote: string;
  /** True when this was an exam week and training time was cut. */
  examWeek: boolean;
}
