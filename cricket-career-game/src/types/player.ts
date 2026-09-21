import type { Attributes } from './attributes';
import type { Condition } from './condition';
import type {
  BattingStyle,
  BowlingStyle,
  CompetitionLevel,
  Hand,
  Id,
  ISODate,
  MatchFormat,
  PlayerRole,
  Rating,
  TeamRole,
} from './primitives';

/** Aggregate figures for one format. Every player carries one per format. */
export interface BattingRecord {
  matches: number;
  innings: number;
  notOuts: number;
  runs: number;
  balls: number;
  highScore: number;
  highScoreNotOut: boolean;
  fifties: number;
  hundreds: number;
  doubleHundreds: number;
  fours: number;
  sixes: number;
  ducks: number;
}

export interface BowlingRecord {
  innings: number;
  balls: number;
  runsConceded: number;
  wickets: number;
  maidens: number;
  fiveWicketHauls: number;
  tenWicketMatches: number;
  /** Best innings figures, e.g. `{ wickets: 5, runs: 32 }`. */
  bestInnings: { wickets: number; runs: number } | null;
}

export interface FieldingRecord {
  catches: number;
  runOuts: number;
  stumpings: number;
}

export interface FormatRecord {
  format: MatchFormat;
  batting: BattingRecord;
  bowling: BowlingRecord;
  fielding: FieldingRecord;
}

/** All career figures, keyed by format, plus per-competition breakdowns. */
export interface CareerRecord {
  byFormat: Record<MatchFormat, FormatRecord>;
  /** Keyed by `Tournament.id` so the Stats screen can filter by competition. */
  byCompetition: Record<Id, FormatRecord>;
  manOfTheMatch: number;
  manOfTheSeries: number;
}

/** A club/state/franchise/country the player has represented. */
export interface Contract {
  id: Id;
  teamId: Id;
  teamName: string;
  level: CompetitionLevel;
  /** Season year the contract starts, e.g. 2026. */
  fromSeason: number;
  toSeason: number | null;
  /** Fee in in-game currency units (used for IPL auction and retainers). */
  value: number;
  role: TeamRole;
  active: boolean;
}

/** The player the user controls. */
export interface Player {
  id: Id;
  firstName: string;
  lastName: string;
  /** Name shown on the shirt back, e.g. "DINESH". */
  displayName: string;
  shirtNumber: number;
  dateOfBirth: ISODate;
  /** Derived from `dateOfBirth` and the current in-game date. */
  age: number;
  hometown: string;
  state: string;
  country: string;
  battingStyle: BattingStyle;
  bowlingStyle: BowlingStyle;
  /** Throwing/fielding hand; usually matches the batting hand. */
  dominantHand: Hand;
  role: PlayerRole;
  /** Handwritten quote on the hero banner. */
  motto: string;
  avatarUrl: string | null;

  attributes: Attributes;
  /** Ceiling the player can reach with training - the radar's "Potential". */
  potential: Attributes;
  condition: Condition;

  /** Current overall, 1-99. Derived from attributes weighted by role. */
  overall: Rating;
  /** Overall the player could reach at full development. */
  potentialOverall: Rating;

  /** Experience points and level shown in the top bar ("Lv 12, 820/1200 XP"). */
  level: number;
  xp: number;
  xpToNextLevel: number;

  record: CareerRecord;
  contracts: Contract[];
  /** Teams currently represented, newest first. */
  currentTeamIds: Id[];
  retired: boolean;
  retiredOn: ISODate | null;
}

/**
 * An AI player: a team-mate, an opponent, or a rival competing for the same
 * selection spot. Lighter than `Player` - no XP, no contracts history.
 */
export interface RivalPlayer {
  id: Id;
  name: string;
  age: number;
  teamId: Id;
  role: PlayerRole;
  battingStyle: BattingStyle;
  bowlingStyle: BowlingStyle;
  attributes: Attributes;
  overall: Rating;
  potentialOverall: Rating;
  condition: Condition;
  record: CareerRecord;
  /** True when this player competes with the user for the same XI slot. */
  isDirectRival: boolean;
  /** 1-99 standing with selectors; the user must out-perform this. */
  selectorFavour: Rating;
}
