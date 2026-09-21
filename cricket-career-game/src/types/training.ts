import type { AttributeGroup } from './attributes';
import type { Id, ISODate } from './primitives';

/** A single drill the player can put into their weekly plan. */
export type TrainingFocus =
  | 'BATTING_NETS'
  | 'POWER_HITTING'
  | 'SPIN_PRACTICE'
  | 'PACE_PRACTICE'
  | 'BOWLING_NETS'
  | 'DEATH_BOWLING'
  | 'FIELDING_DRILLS'
  | 'KEEPING_DRILLS'
  | 'FITNESS'
  | 'STRENGTH'
  | 'SPEED_WORK'
  | 'MENTAL_TRAINING'
  | 'MATCH_SIMULATION'
  | 'REST_RECOVERY';

export type TrainingIntensity = 'LIGHT' | 'MODERATE' | 'HARD' | 'MAXIMUM';

export interface TrainingSlot {
  id: Id;
  focus: TrainingFocus;
  intensity: TrainingIntensity;
  /** Share of the weekly plan given to this drill, 0-1. Slots sum to 1. */
  weight: number;
  /** Attribute group this drill develops. */
  group: AttributeGroup;
  /** Specific attribute keys it improves, e.g. ['technique', 'timing']. */
  attributeKeys: string[];
  /** Progress towards the next attribute point, 0-1. */
  progress: number;
  /** Fatigue added per week at this intensity. */
  fatigueCost: number;
}

export interface TrainingPlan {
  id: Id;
  name: string;
  slots: TrainingSlot[];
  /** Overall effort; raises gains and fatigue together. */
  intensity: TrainingIntensity;
  /** In-game date the plan was last applied. */
  lastAppliedOn: ISODate | null;
  /** Weeks this plan has been running - consistency compounds gains. */
  weeksActive: number;
  /** Injury risk added by the current plan, 0-100. */
  injuryRisk: number;
  active: boolean;
}
