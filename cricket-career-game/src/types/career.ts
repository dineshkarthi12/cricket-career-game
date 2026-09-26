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

/** Wins, losses and the rest as captain. */
export interface CaptaincyRecord {
  matches: number;
  won: number;
  lost: number;
  drawn: number;
  tied: number;
  noResult: number;
}

/** Which captaincy calls the player hands to the AI vice-captain. */
export interface CaptainDelegation {
  toss: boolean;
  battingOrder: boolean;
  /** Instructions to the batters. */
  instructions: boolean;
  /** Choosing the bowler for each over. */
  bowling: boolean;
  field: boolean;
  reviews: boolean;
  /** Declarations and the follow-on. */
  declarations: boolean;
}

export interface CaptaincyEvent {
  date: ISODate;
  kind: 'APPOINTED' | 'SACKED' | 'RESIGNED' | 'RECOMMENDED';
  teamId: Id;
  note: string;
}

/**
 * Captaincy. Team controls in a match only unlock while the player captains
 * the side they are playing for.
 */
export interface CaptaincyState {
  /** Team the player captains, or `null`. */
  teamId: Id | null;
  since: ISODate | null;
  /** 0-100: results, tactics and the dressing room, rolled together. */
  rating: number;
  /** 0-100 how well the recent tactical calls have worked. */
  tactics: number;
  /** 0-100 accumulated strain. High stress costs the player their own form. */
  stress: number;
  /** Positive: wins in a row. Negative: losses in a row. */
  streak: number;
  /** Every match as captain, across every team. */
  record: CaptaincyRecord;
  byTeam: Record<Id, CaptaincyRecord>;
  delegate: CaptainDelegation;
  history: CaptaincyEvent[];
  /** A strong record has put the player in line for a bigger captaincy. */
  recommendedForHigher: boolean;
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
  captaincy: CaptaincyState;
  /** How each team-mate feels about the player, -100 to 100. */
  relationships: Record<Id, number>;
  /** 0-100 standing with the press, separate from reputation with selectors. */
  mediaReputation: number;
  /**
   * The player's own aggression, 1 (very defensive) to 5 (very aggressive).
   * Set by the player and kept until they change it.
   */
  aggression: AggressionLevels;
  /** Squad places this season, by competition. */
  squads: Record<string, SquadPlace>;
  /** Every season, oldest first: where the player was and how it ended. */
  path: PathEntry[];
  seasonReviews: SeasonReview[];
  /** A review the player has not opened yet. */
  pendingReview: SeasonReview | null;
  /** Consecutive low scores in the current squad (drop risk). */
  lowScores: number;
  /** Times dropped from a squad. */
  drops: number;
  /** Trials and camps attended, newest first. */
  trials: TrialRecord[];
}

/** How the player goes about the nets session at a trial. */
export type NetsApproach = 'SOLID' | 'POSITIVE' | 'SHOWY';
/** How hard they push in the trial's fitness test. */
export type FitnessEffort = 'STEADY' | 'ALL_OUT';

/** One trial or selection camp: nets, a fitness test, a practice match. */
export interface TrialRecord {
  fixtureId: Id;
  date: ISODate;
  seasonYear: number;
  title: string;
  /** SQUAD picks this season's squads; NEXT_LEVEL feeds the season review. */
  purpose: 'SQUAD' | 'NEXT_LEVEL';
  /** The stage whose selectors are watching. */
  stageId: CareerStageId;
  nets: { approach: NetsApproach; score: number; note: string };
  fitness: { passed: boolean; yoyo: number; yoyoTarget: number; sprint: number; sprintTarget: number; effort: FitnessEffort };
  practice: { runs: number; balls: number; wickets: number; ballsBowled: number; runsConceded: number; rating: number; summary: string };
  /** What the trial is worth to the selectors, -10 to 10. */
  bonus: number;
  verdict: string;
  /** Squad decisions made on the day. */
  decisions: { tournamentId: string; status: SquadStatus; reason: string }[];
}

/**
 * Where the player stands with a competition's selectors this season. The
 * match-day XI (playing XI, 12th man, bench) is decided fixture by fixture
 * from the squad.
 */
export type SquadStatus =
  | 'NOT_SELECTED'
  | 'TRIAL_ONLY'
  | 'PROBABLES'
  | 'RESERVE'
  | 'SQUAD'
  | 'DROPPED'
  | 'FAST_TRACK';

export interface SquadPlace {
  tournamentId: string;
  teamId: string;
  status: SquadStatus;
  /** The selectors' reason, in a sentence. */
  reason: string;
  since: ISODate;
}

/** What a season's end means for the career. */
export type SeasonOutcome = 'PROMOTE' | 'STAY' | 'BENCH' | 'DROPPED' | 'COMEBACK' | 'FAST_TRACK' | 'AGED_OUT';

export interface SeasonStatLine {
  matches: number;
  runs: number;
  innings: number;
  notOuts: number;
  average: number | null;
  strikeRate: number | null;
  highScore: number;
  fifties: number;
  hundreds: number;
  wickets: number;
  bowlingAverage: number | null;
  economy: number | null;
  catches: number;
  averageRating: number;
}

export interface TargetCheck {
  label: string;
  met: boolean;
  /** e.g. "312 / 300". */
  progress: string;
}

/** The end-of-season verdict, shown on the Season Review screen. */
export interface SeasonReview {
  seasonYear: number;
  label: string;
  stageId: CareerStageId;
  nextStageId: CareerStageId;
  outcome: SeasonOutcome;
  headline: string;
  reasons: string[];
  stats: SeasonStatLine;
  targets: TargetCheck[];
  awards: string[];
  coachReport: string;
  goals: string[];
  squads: SquadPlace[];
  overall: [number, number];
  age: number;
}

/** One step of the path actually taken, for the Career Path screen. */
export interface PathEntry {
  seasonYear: number;
  stageId: CareerStageId;
  teamName: string;
  status: SquadStatus | 'PLAYED';
  outcome: SeasonOutcome | null;
  note: string;
}

export interface AggressionLevels {
  batting: number;
  bowling: number;
}

export const DEFAULT_AGGRESSION: AggressionLevels = { batting: 3, bowling: 3 };
