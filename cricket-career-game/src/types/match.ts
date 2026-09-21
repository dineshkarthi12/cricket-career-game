import type { Id, ISODate, MatchFormat, MatchPhase } from './primitives';
import type { MatchConditions, Pitch, Weather } from './venue';

export type DeliveryLength = 'FULL_TOSS' | 'YORKER' | 'FULL' | 'GOOD' | 'SHORT_OF_GOOD' | 'SHORT';
export type DeliveryLine = 'WIDE_OFF' | 'OUTSIDE_OFF' | 'OFF_STUMP' | 'MIDDLE' | 'LEG_STUMP' | 'DOWN_LEG';

export type ShotType =
  | 'DEFEND'
  | 'LEAVE'
  | 'DRIVE'
  | 'CUT'
  | 'PULL'
  | 'HOOK'
  | 'SWEEP'
  | 'REVERSE_SWEEP'
  | 'FLICK'
  | 'LOFT'
  | 'RAMP'
  | 'BLOCK';

/** How aggressively the batter is playing - set by the user before each ball. */
export type BattingIntent = 'BLOCK' | 'DEFENSIVE' | 'NORMAL' | 'ATTACKING' | 'ALL_OUT';

export type DismissalType =
  | 'BOWLED'
  | 'CAUGHT'
  | 'LBW'
  | 'RUN_OUT'
  | 'STUMPED'
  | 'HIT_WICKET'
  | 'CAUGHT_BEHIND'
  | 'CAUGHT_AND_BOWLED'
  | 'RETIRED_HURT';

export type ExtraType = 'WIDE' | 'NO_BALL' | 'BYE' | 'LEG_BYE' | 'PENALTY';

export interface Dismissal {
  type: DismissalType;
  bowlerId: Id | null;
  fielderId: Id | null;
}

/** Position on the 2D ground, in normalised coordinates from the centre. */
export interface GroundPoint {
  /** -1 (deep square leg side) to 1 (deep off side). */
  x: number;
  /** -1 (fine leg / behind the keeper) to 1 (straight down the ground). */
  y: number;
}

export interface Fielder {
  playerId: Id;
  /** Named position, e.g. 'mid-on', 'third man'. */
  position: string;
  point: GroundPoint;
}

/** One delivery. The atomic unit of the match engine and the commentary feed. */
export interface Ball {
  id: Id;
  /** 0-based over number. */
  over: number;
  /** 1-6 within the over (legal deliveries only). */
  ballInOver: number;
  /** Absolute legal-delivery index within the innings. */
  ballNumber: number;
  bowlerId: Id;
  strikerId: Id;
  nonStrikerId: Id;
  line: DeliveryLine;
  length: DeliveryLength;
  /** Delivery speed in km/h. */
  speed: number;
  /** Variation the bowler tried, e.g. 'slower ball', 'googly'. */
  variation: string | null;
  intent: BattingIntent;
  shot: ShotType | null;
  /** 0-100 quality of contact. Drives whether a shot carries or is caught. */
  contactQuality: number;
  runsOffBat: number;
  extras: { type: ExtraType; runs: number } | null;
  isLegalDelivery: boolean;
  isBoundaryFour: boolean;
  isBoundarySix: boolean;
  wicket: Dismissal | null;
  /** Where the ball ended up - drives the ball-path line on the 2D ground. */
  landingPoint: GroundPoint | null;
  /** Ball-by-ball text commentary line. */
  commentary: string;
  /** Snapshot of the conditions for this delivery. */
  phase: MatchPhase;
}

export interface BatterInningsLine {
  playerId: Id;
  name: string;
  battingPosition: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  out: boolean;
  dismissal: Dismissal | null;
  /** Text as it appears on the scorecard, e.g. "c Kumar b Iyer". */
  dismissalText: string;
}

export interface BowlerInningsLine {
  playerId: Id;
  name: string;
  overs: number;
  balls: number;
  maidens: number;
  runsConceded: number;
  wickets: number;
  wides: number;
  noBalls: number;
  economy: number;
}

export interface FallOfWicket {
  wicketNumber: number;
  runs: number;
  over: number;
  playerId: Id;
}

export interface Innings {
  id: Id;
  /** 1-based; a Test has up to four. */
  number: number;
  battingTeamId: Id;
  bowlingTeamId: Id;
  runs: number;
  wickets: number;
  /** Legal deliveries bowled. */
  balls: number;
  overs: number;
  extras: Record<ExtraType, number>;
  extrasTotal: number;
  batting: BatterInningsLine[];
  bowling: BowlerInningsLine[];
  fallOfWickets: FallOfWicket[];
  /** Full ball-by-ball log, newest last. */
  deliveries: Ball[];
  declared: boolean;
  followOn: boolean;
  allOut: boolean;
  complete: boolean;
  /** Runs needed when chasing, or `null` when batting first. */
  target: number | null;
  /** Revised target and overs after a rain interruption. */
  dlsTarget: number | null;
}

export type MatchStatus =
  | 'SCHEDULED'
  | 'TOSS'
  | 'IN_PROGRESS'
  | 'INNINGS_BREAK'
  | 'RAIN_DELAY'
  | 'STUMPS'
  | 'COMPLETED'
  | 'ABANDONED';

export type MatchResultType =
  | 'WIN'
  | 'LOSS'
  | 'TIE'
  | 'DRAW'
  | 'NO_RESULT'
  | 'ABANDONED';

export interface MatchResult {
  type: MatchResultType;
  winningTeamId: Id | null;
  /** e.g. "Won by 34 runs", "Lost by 5 wickets". */
  summary: string;
  marginRuns: number | null;
  marginWickets: number | null;
  manOfTheMatchId: Id | null;
}

/** How the user's own performance in this match was rated, 0-10. */
export interface PlayerMatchPerformance {
  playerId: Id;
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  notOut: boolean;
  wickets: number;
  runsConceded: number;
  oversBowled: number;
  catches: number;
  runOuts: number;
  stumpings: number;
  /** 0-10 overall match rating; feeds form, morale and selection. */
  rating: number;
  manOfTheMatch: boolean;
  xpEarned: number;
}

export interface Match {
  id: Id;
  /** Fixture this match was played from. */
  fixtureId: Id;
  tournamentId: Id;
  seasonYear: number;
  format: MatchFormat;
  /** e.g. 'League', 'Quarter Final', 'Final'. */
  stage: string;
  date: ISODate;
  /** Scheduled days of play (1 for limited overs, 3-5 for multi-day). */
  days: number;
  venueId: Id;
  homeTeamId: Id;
  awayTeamId: Id;
  /** True when the user's team is the home side. */
  userIsHome: boolean;
  /** Was the user actually selected to play this match? */
  userPlayed: boolean;
  tossWinnerTeamId: Id | null;
  tossDecision: 'BAT' | 'BOWL' | null;
  status: MatchStatus;
  conditions: MatchConditions;
  /** Pitch and weather as they were at the start, for the match report. */
  startingPitch: Pitch;
  startingWeather: Weather;
  innings: Innings[];
  /** Index into `innings` of the innings in progress. */
  currentInningsIndex: number;
  fielders: Fielder[];
  result: MatchResult | null;
  userPerformance: PlayerMatchPerformance | null;
}
