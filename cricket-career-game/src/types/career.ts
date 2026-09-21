import type { CompetitionLevel, Id, ISODate, MatchFormat } from './primitives';

/**
 * The 20 career stages from CAREER_MODE.md. Progression between them is never
 * automatic - see `src/engine/progression.ts`.
 */
export type CareerStageId =
  | 'BEGINNER'
  | 'DISTRICT_AGE_GROUP'
  | 'STATE_U16'
  | 'U19_PATHWAY'
  | 'INDIA_U19'
  | 'U23_EMERGING'
  | 'SENIOR_STATE'
  | 'RANJI_TROPHY'
  | 'VIJAY_HAZARE'
  | 'SYED_MUSHTAQ_ALI'
  | 'IPL_SCOUTING'
  | 'IPL_CAREER'
  | 'HIGH_LEVEL_DOMESTIC'
  | 'INDIA_A'
  | 'INDIA_SENIOR_CAMP'
  | 'INTERNATIONAL_DEBUT'
  | 'ESTABLISH_INDIA'
  | 'ICC_TOURNAMENTS'
  | 'INTERNATIONAL_STAR'
  | 'LEGACY';

/** Where the player currently sits within a squad. */
export type SelectionStatus =
  | 'NOT_IN_SETUP'
  | 'TRIALIST'
  | 'CAMP_INVITEE'
  | 'SQUAD'
  | 'RESERVE'
  | 'STANDBY'
  | 'BENCH'
  | 'PLAYING_XI'
  | 'ROTATED'
  | 'RESTED'
  | 'DROPPED'
  | 'INJURED_OUT'
  | 'CAPTAIN'
  | 'VICE_CAPTAIN';

/** Outcome of a stage, as listed in CAREER_MODE.md. */
export type StageOutcome =
  | 'PROMOTE'
  | 'STAY'
  | 'BENCH'
  | 'DROPPED'
  | 'INJURED'
  | 'FAST_TRACK'
  | 'RETIRE';

/** What the player must achieve to be considered for the next stage. */
export interface StageRequirement {
  id: string;
  label: string;
  /** Metric the requirement is measured against. */
  metric:
    | 'MATCHES_PLAYED'
    | 'RUNS'
    | 'WICKETS'
    | 'BATTING_AVERAGE'
    | 'BOWLING_AVERAGE'
    | 'STRIKE_RATE'
    | 'ECONOMY'
    | 'AVERAGE_RATING'
    | 'FORM'
    | 'FITNESS'
    | 'REPUTATION'
    | 'OVERALL';
  /** Value needed to satisfy the requirement. */
  target: number;
  /** Window the metric is measured over. */
  window: 'SEASON' | 'STAGE' | 'CAREER' | 'LAST_5_MATCHES';
  /** Requirements marked optional strengthen the case but are not mandatory. */
  optional: boolean;
}

export interface CareerStage {
  id: CareerStageId;
  /** 1-20, matching CAREER_MODE.md. */
  order: number;
  name: string;
  /** Short label used on the 20-step career stepper. */
  shortLabel: string;
  description: string;
  level: CompetitionLevel;
  minAge: number;
  maxAge: number;
  /** Age past which staying at this stage starts to hurt the career. */
  softAgeLimit: number;
  formats: MatchFormat[];
  /** Real tournament ids available while at this stage. */
  tournamentIds: Id[];
  /** Ordered steps inside the stage, e.g. "U-16 Trials" -> "State Squad". */
  steps: string[];
  requirements: StageRequirement[];
  /** Stage ids that can follow this one. */
  nextStageIds: CareerStageId[];
  /** Stages reachable directly when performance is exceptional. */
  fastTrackStageIds: CareerStageId[];
  /** Stage to fall back to after being dropped. */
  fallbackStageId: CareerStageId | null;
}

/** Progress record for one stage of the user's career. */
export interface CareerStageProgress {
  stageId: CareerStageId;
  status: 'LOCKED' | 'CURRENT' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  enteredOn: ISODate | null;
  completedOn: ISODate | null;
  seasonsSpent: number;
  matchesPlayed: number;
  /** Per-requirement progress, keyed by `StageRequirement.id`. */
  requirementProgress: Record<string, number>;
  outcome: StageOutcome | null;
}

/** A recorded turning point in the career, shown on the Career Path screen. */
export interface CareerEvent {
  id: Id;
  date: ISODate;
  stageId: CareerStageId;
  kind:
    | 'DEBUT'
    | 'PROMOTION'
    | 'SELECTION'
    | 'DROPPED'
    | 'INJURY'
    | 'RECOVERY'
    | 'AWARD'
    | 'MILESTONE'
    | 'CONTRACT'
    | 'CAPTAINCY'
    | 'RETIREMENT';
  title: string;
  detail: string;
}

/** Complete career state for the save file. */
export interface CareerState {
  currentStageId: CareerStageId;
  selectionStatus: SelectionStatus;
  stages: Record<CareerStageId, CareerStageProgress>;
  events: CareerEvent[];
  /** Consecutive matches missed; feeds the risk of being dropped. */
  matchesOnBench: number;
  /** In-game date the player last appeared in a match. */
  lastAppearance: ISODate | null;
  /** How many times the player has been dropped and fought back. */
  comebacks: number;
}
