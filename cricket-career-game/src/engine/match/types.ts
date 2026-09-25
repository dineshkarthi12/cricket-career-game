/**
 * Types the match engine uses internally. Nothing here is persisted - the
 * saved shapes live in `/src/types`.
 */
import type {
  Attributes,
  BattingIntent,
  Condition,
  DeliveryLength,
  DeliveryLine,
  Id,
  MatchFormat,
  MatchPhase,
  PlayerRole,
  BowlingStyle,
  BattingStyle,
  MatchConditions,
  Dismissal,
  ShotType,
} from '@/types';

/** A player as the engine sees them: the user and every AI are the same here. */
export interface SimPlayer {
  id: Id;
  name: string;
  teamId: Id;
  role: PlayerRole;
  battingStyle: BattingStyle;
  bowlingStyle: BowlingStyle;
  attributes: Attributes;
  condition: Condition;
  /** Batting order, 1-11. */
  battingPosition: number;
  /** True for the one player the save actually belongs to. */
  isUser: boolean;
}

export type BowlerKind = 'PACE' | 'SPIN';

/** What the bowler is trying to do with this delivery. */
export interface BowlerPlan {
  length: DeliveryLength;
  line: DeliveryLine;
  /** e.g. 'slower ball', 'cutter', 'bouncer', 'googly', 'arm ball', 'doosra'. */
  variation: string | null;
  /** Intended speed in km/h before execution error. */
  speed: number;
}

/** What the batter is trying to do, 1 (survive) to 5 (everything). */
export interface BatterApproach {
  intent: BattingIntent;
  /** 1-5, derived from `intent`. */
  level: number;
}

export const INTENT_LEVELS: Record<BattingIntent, number> = {
  BLOCK: 1,
  DEFENSIVE: 2,
  NORMAL: 3,
  ATTACKING: 4,
  ALL_OUT: 5,
};

export const INTENT_BY_LEVEL: BattingIntent[] = [
  'BLOCK',
  'DEFENSIVE',
  'NORMAL',
  'ATTACKING',
  'ALL_OUT',
];

/** A fielder standing somewhere, with the skill to do something about it. */
export interface PlacedFielder {
  playerId: Id;
  name: string;
  position: string;
  /** Degrees, same convention as `Ball.shotAngle`. */
  angle: number;
  /** Metres from the striker. */
  distance: number;
  ring: 'CLOSE' | 'INNER' | 'OUTER';
  catching: number;
  groundFielding: number;
  throwing: number;
  agility: number;
}

/** The whole fielding picture for one delivery. */
export interface FieldSetting {
  name: string;
  fielders: PlacedFielder[];
  keeperId: Id;
  keeperName: string;
  keeperSkill: number;
}

/** Everything the resolver needs to play one ball. */
export interface DeliveryContext {
  format: MatchFormat;
  phase: MatchPhase;
  conditions: MatchConditions;
  striker: SimPlayer;
  nonStriker: SimPlayer;
  bowler: SimPlayer;
  bowlerKind: BowlerKind;
  plan: BowlerPlan;
  approach: BatterApproach;
  field: FieldSetting;
  /** Balls this batter has already faced in the innings. */
  strikerBallsFaced: number;
  /** Wickets that have fallen in the last `momentum.window` balls. */
  recentWickets: number;
  /** Consecutive dot balls the striker has faced. */
  consecutiveDots: number;
  /** Runs the striker has made, for milestone nerves. */
  strikerRuns: number;
  /** True when the striker is shielding a tailender at the other end. */
  farmingStrike: boolean;
  /** Balls the current pair have been together. */
  partnershipBalls: number;
  /** Overs this bowler has sent down in the current spell. */
  spellOvers: number;
  /** Overs bowled in the innings so far. */
  oversBowled: number;
  /** Which ball of the over this is, 1-6, for strike farming. */
  ballInOver: number;
  /** 0-100 situational pressure on the batter. */
  pressure: number;
  /** Runs still needed, or null when batting first. */
  runsRequired: number | null;
  ballsRemaining: number | null;
  wicketsInHand: number;
  /** Batting side is playing at home. */
  battingAtHome: boolean;
  /** 0-1 dew on the ball, which builds through a night innings. */
  dew: number;
  /** Straight and square boundary distances at this ground, in metres. */
  boundaries: { straight: number; square: number };
  /** Day of a multi-day match, 1-based. 1 for limited overs. */
  day: number;
  /** This ball is a free hit, so only a run-out can end it. */
  freeHit: boolean;
  /** Reviews the batting and bowling sides have left. */
  reviewsLeft: { batting: number; bowling: number };
  /** Direction the batter is trying to hit in, in degrees, or null. */
  shotPreference?: number | null;
}

/** The result of one delivery, before it is written into the innings. */
export interface DeliveryOutcome {
  runsOffBat: number;
  extras: { type: 'WIDE' | 'NO_BALL' | 'BYE' | 'LEG_BYE' | 'PENALTY'; runs: number } | null;
  isLegalDelivery: boolean;
  isBoundaryFour: boolean;
  isBoundarySix: boolean;
  wicket: Dismissal | null;
  /** Set when a wicket fell, so the scorecard can name it. */
  dismissedPlayerId: Id | null;
  shot: ShotType | null;
  contactQuality: number;
  shotAngle: number | null;
  shotDistance: number | null;
  fielderName: string | null;
  speed: number;
  /** True when the batters crossed an odd number of times. */
  strikeRotated: boolean;
  /** Set when the decision went to a review. */
  review: {
    by: 'BATTING' | 'BOWLING';
    outcome: 'OVERTURNED' | 'UPHELD' | 'UMPIRES_CALL';
  } | null;
  /** A catch that went down. */
  dropped: { fielderName: string } | null;
  /** The batter had to go off. */
  retired: { playerId: Id; concussion: boolean } | null;
  commentary: string;
}
