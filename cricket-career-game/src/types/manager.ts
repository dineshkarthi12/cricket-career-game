/**
 * IPL Manager mode: a separate game from the player career.
 *
 * The user is a franchise manager - scouting, recruiting, bidding, picking
 * and planning - not a player on the field. Everything here lives in its own
 * save (`src/save/managerSaves.ts`) and never touches a career's `GameState`.
 *
 * Money is held in lakh (100 lakh = 1 crore), as whole numbers.
 */
import type { Attributes, BattingStyle, BowlingStyle, Condition, Innings, MatchResult, PlayerRole } from '@/types';

export const MANAGER_SAVE_VERSION = 1;

export type ManagerSlotId = 1 | 2 | 3;
export const MANAGER_SLOT_IDS: readonly ManagerSlotId[] = [1, 2, 3] as const;

export type ManagerDifficulty = 'EASY' | 'NORMAL' | 'HARD';

/**
 * How the career starts. SCOUTING: Head of Scouting, earning the hot seat.
 * DIRECT: appointed Head Coach of a struggling franchise straight away -
 * every responsibility from day one, a smaller budget and an impatient board.
 */
export type ManagerPathway = 'SCOUTING' | 'DIRECT';

/** The ladder. Each rank is earned at a season review - never automatic. */
export type ManagerRank = 'HEAD_OF_SCOUTING' | 'ASSISTANT_COACH' | 'HEAD_COACH' | 'DIRECTOR_OF_CRICKET';

/** Jobs the manager may hold. Anything not held is done by the franchise's AI staff. */
export type Responsibility =
  | 'SCOUTING'
  | 'TRIALS'
  | 'AUCTION'
  | 'DEVELOPMENT'
  | 'SELECTION'
  | 'TACTICS'
  | 'MATCHDAY'
  | 'CONTRACTS'
  | 'STAFF'
  | 'FINANCE';

export type SeasonPhase =
  | 'SCOUTING'
  | 'TRIALS'
  | 'RETENTION'
  | 'AUCTION_PREP'
  | 'AUCTION'
  | 'PRESEASON'
  | 'LEAGUE'
  | 'PLAYOFFS'
  | 'SEASON_END';

export type ScoutRegion = 'NORTH' | 'SOUTH' | 'EAST' | 'WEST' | 'CENTRAL' | 'OVERSEAS';

export type TrainingFocus = 'BATTING' | 'BOWLING' | 'FIELDING' | 'FITNESS' | 'MENTAL' | 'REST';

export interface ManagerStatLine {
  matches: number;
  innings: number;
  runs: number;
  balls: number;
  outs: number;
  fours: number;
  sixes: number;
  highScore: number;
  fifties: number;
  hundreds: number;
  ballsBowled: number;
  runsConceded: number;
  wickets: number;
  bestWickets: number;
  catches: number;
  playerOfMatch: number;
}

export interface ManagedContract {
  franchiseId: string;
  /** Salary per season, lakh. */
  salary: number;
  /** Seasons remaining, including the current one. */
  years: number;
  signedSeason: number;
  /** How the contract came about. */
  via: 'AUCTION' | 'RETAINED' | 'TRIAL' | 'REPLACEMENT' | 'RENEWAL' | 'INITIAL';
}

/** Every cricketer in the manager world. The true figures are hidden from the user; they see scouting estimates. */
export interface ManagedPlayer {
  id: string;
  name: string;
  age: number;
  nationality: string;
  overseas: boolean;
  capped: boolean;
  role: PlayerRole;
  battingStyle: BattingStyle;
  bowlingStyle: BowlingStyle;
  /** True attributes - the engine plays with these. */
  attributes: Attributes;
  overall: number;
  /** Hidden ceiling. */
  potential: number;
  condition: Condition;
  /** Weeks out injured (0: fit). */
  injuredWeeks: number;
  /** 0-100: how much a player's output varies match to match. Hidden. */
  consistency: number;
  contract: ManagedContract | null;
  /** Auction base price, lakh. */
  basePrice: number;
  /** Fractional attribute progress from training, by "group.key". */
  progress: Record<string, number>;
  trainingFocus: TrainingFocus;
  season: ManagerStatLine;
  career: ManagerStatLine;
  history: { season: number; franchiseId: string | null; matches: number; runs: number; wickets: number }[];
  /** An uncapped youngster only known to whoever scouted him. */
  prospect: boolean;
  /** Region the player is found in, for scouting. */
  region: ScoutRegion;
  realId?: string;
  retired?: boolean;
}

/** What the user's scouts believe about a player. Never the truth itself. */
export interface ScoutReport {
  playerId: string;
  /** Week index (season * 100 + week) of the latest look. */
  updated: number;
  observations: number;
  estOverall: number;
  estPotential: number;
  /** ± points either side of the estimates. Shrinks with observations, scout quality and trials. */
  uncertainty: number;
  estFitness: 'POOR' | 'FAIR' | 'GOOD' | 'EXCELLENT';
  estTemperament: 'NERVY' | 'STEADY' | 'ICE_COOL';
  estConsistency: 'ERRATIC' | 'STREAKY' | 'RELIABLE';
  /** Expected auction price, lakh. */
  estPrice: number;
  /** Franchises our scouts have seen watching him. */
  rivalInterest: string[];
  notes: string[];
  trialled: boolean;
}

export type StaffKind = 'SCOUT' | 'BATTING_COACH' | 'BOWLING_COACH' | 'FIELDING_COACH' | 'ANALYST' | 'FITNESS';

export interface StaffMember {
  id: string;
  name: string;
  kind: StaffKind;
  /** 1-99. */
  quality: number;
  /** Lakh per season. */
  salary: number;
  /** Scouts only: where they are working, and for how many more weeks. */
  assignment: { region: ScoutRegion; focus: PlayerRole | null; weeksLeft: number } | null;
}

export interface Franchise {
  id: string;
  name: string;
  short: string;
  monogram: string;
  colors: [string, string];
  city: string;
  homeVenueId: string;
  isUser: boolean;
  /** Auction purse remaining, lakh. */
  purse: number;
  squadIds: string[];
  /** AI personality in the auction and in selection. */
  strategy: { aggression: number; youth: number; overseasLean: number; style: 'SPIN' | 'PACE' | 'BATTING' | 'BALANCED' };
  /** 0-100 brand strength: drives sponsorship and crowds. */
  brand: number;
}

export interface AuctionTarget {
  playerId: string;
  /** Most the manager will pay, lakh. */
  maxBid: number;
  priority: 'MUST' | 'HIGH' | 'BACKUP';
}

export interface AuctionPlan {
  targets: AuctionTarget[];
  /** Overseas players the manager wants in total. */
  overseasWanted: number;
  rolePriorities: PlayerRole[];
}

export interface AuctionLot {
  playerId: string;
  currentBid: number;
  leaderId: string | null;
  bids: { franchiseId: string; amount: number }[];
  /** Franchises that have dropped out of this lot. */
  out: string[];
}

export interface AuctionSale {
  playerId: string;
  franchiseId: string | null;
  price: number;
  round: number;
}

export interface AuctionState {
  round: 1 | 2;
  queue: string[];
  index: number;
  lot: AuctionLot | null;
  sales: AuctionSale[];
  unsold: string[];
  complete: boolean;
  /** Short running log for the screen. */
  log: string[];
}

export type FixtureStage = 'LEAGUE' | 'QUALIFIER_1' | 'ELIMINATOR' | 'QUALIFIER_2' | 'FINAL';

export interface ManagerFixtureResult {
  winnerId: string | null;
  summary: string;
  homeRuns: number;
  homeWickets: number;
  homeBalls: number;
  awayRuns: number;
  awayWickets: number;
  awayBalls: number;
  playerOfMatchId: string | null;
  /** Key into `ManagerState.matchArchive` when a scorecard was kept. */
  archiveId: string | null;
  noResult: boolean;
}

export interface ManagerFixture {
  id: string;
  /** League round 1-14, or 15+ for playoffs. */
  round: number;
  stage: FixtureStage;
  homeId: string;
  awayId: string;
  venueId: string;
  result: ManagerFixtureResult | null;
}

export interface ManagerStanding {
  franchiseId: string;
  played: number;
  won: number;
  lost: number;
  noResult: number;
  points: number;
  runsFor: number;
  ballsFaced: number;
  runsAgainst: number;
  ballsBowled: number;
}

export type BattingApproachSetting = 'AGGRESSIVE' | 'BALANCED' | 'CONSERVATIVE';

/** The manager's game plan. Applied to every match the user's franchise plays. */
export interface TeamTactics {
  /** Exactly eleven, in batting order. */
  xiIds: string[];
  wicketkeeperId: string | null;
  captainId: string | null;
  battingApproach: BattingApproachSetting;
  /** Bowlers by phase, in the order they should be used. */
  bowling: { powerplay: string[]; middle: string[]; death: string[] };
  /** Approach overrides for the surface. */
  pitchPlans: { FLAT: BattingApproachSetting | null; GREEN: BattingApproachSetting | null; DRY: BattingApproachSetting | null };
  /** Bench player to bring on as the impact substitute (null: AI picks). */
  impactSubId: string | null;
  /** Rest a bowler whose fatigue passes this (0-100). */
  workloadLimit: number;
}

export interface LedgerEntry {
  /** Unique: the same transaction is never applied twice. */
  id: string;
  season: number;
  week: number;
  kind: 'SPONSORSHIP' | 'GATE' | 'PRIZE' | 'MEDIA' | 'SALARY' | 'STAFF' | 'SCOUTING' | 'TRIALS' | 'DEVELOPMENT' | 'SIGNING' | 'BONUS' | 'OTHER';
  /** Positive income, negative spending. Lakh. */
  amount: number;
  note: string;
}

export interface ManagerFinances {
  /** Operating balance (not the auction purse), lakh. */
  balance: number;
  ledger: LedgerEntry[];
  /** Season budgets the board signs off, lakh. */
  budgets: { scouting: number; development: number; staff: number };
}

export interface BoardObjective {
  id: string;
  kind: 'PLAYOFFS' | 'TOP_HALF' | 'WIN_TITLE' | 'REACH_FINAL' | 'PROFIT' | 'DEVELOP_YOUTH' | 'DISCOVER_TALENT' | 'AVOID_BOTTOM';
  label: string;
  /** Numeric target where relevant (e.g. 2 discoveries). */
  target: number;
  weight: number;
  met: boolean | null;
}

export interface ManagerNews {
  id: string;
  season: number;
  week: number;
  kind: 'BOARD' | 'SCOUTING' | 'AUCTION' | 'MATCH' | 'INJURY' | 'CONTRACT' | 'FINANCE' | 'AWARD' | 'CAREER' | 'MEDIA';
  title: string;
  body: string;
  read: boolean;
  route?: string;
}

export interface Negotiation {
  id: string;
  playerId: string;
  kind: 'RENEWAL' | 'TRIAL_OFFER' | 'REPLACEMENT';
  offeredSalary: number;
  years: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COUNTERED' | 'WITHDRAWN';
  counterSalary: number | null;
  /** What the player hopes for, lakh. */
  asking: number;
  note: string;
}

export interface TrialResult {
  playerId: string;
  batting: number;
  bowling: number;
  fielding: number;
  fitness: number;
  verdict: 'IMPRESSIVE' | 'PROMISING' | 'ORDINARY' | 'POOR';
}

export interface ManagerAwards {
  season: number;
  orangeCap: { playerId: string; runs: number } | null;
  purpleCap: { playerId: string; wickets: number } | null;
  mvp: { playerId: string; points: number } | null;
  emerging: { playerId: string; points: number } | null;
  champions: string | null;
  runnersUp: string | null;
  managerOfSeason: string | null;
}

export interface SeasonSummary {
  season: number;
  franchiseId: string;
  rank: ManagerRank;
  position: number;
  played: number;
  won: number;
  lost: number;
  playoffs: boolean;
  result: 'CHAMPIONS' | 'RUNNERS_UP' | 'PLAYOFFS' | 'LEAGUE';
  profit: number;
  objectivesMet: number;
  objectivesTotal: number;
  reputationChange: number;
  bestSigningId: string | null;
  topScorerId: string | null;
  topWicketTakerId: string | null;
  boardVerdict: 'PROMOTED' | 'RETAINED' | 'WARNED' | 'SACKED';
}

/** A kept scorecard: the user's matches, without ball-by-ball. */
export interface ArchivedMatch {
  id: string;
  fixtureId: string;
  season: number;
  homeId: string;
  awayId: string;
  innings: Innings[];
  result: MatchResult;
  report: string[];
}

export interface ManagerProfile {
  name: string;
  nationality: string;
  difficulty: ManagerDifficulty;
  pathway: ManagerPathway;
  rank: ManagerRank;
  /**
   * Full control: the manager does every job - scouting, trials, retentions,
   * the auction, the XI, tactics, matches, contracts, staff and budgets -
   * whatever the rank. Nothing is handed to the AI staff. Optional so older
   * saves load (missing = off).
   */
  fullControl?: boolean;
  /** 0-100. Moves with results, objectives, finances and development. */
  reputation: number;
  experience: number;
  /** Board confidence 0-100: below the line, a manager is sacked. */
  boardConfidence: number;
  seasonsManaged: number;
  trophies: number;
  finals: number;
  playoffApps: number;
  /** Prospects the manager discovered who went on to play. */
  discoveries: string[];
  achievements: string[];
  /** The career is over: by the manager's own choice, never automatically. */
  retired: boolean;
  retiredSeason: number | null;
  /** Out of work after a sacking; can accept a new post. */
  unemployed: boolean;
}

export interface ManagerSeason {
  year: number;
  phase: SeasonPhase;
  /** Week within the phase. */
  week: number;
  fixtures: ManagerFixture[];
  standings: ManagerStanding[];
  objectives: BoardObjective[];
  /** League round reached (1-14). */
  round: number;
  awards: ManagerAwards | null;
  retentions: string[];
  trials: TrialResult[];
  /** Trials run this season (limited). */
  trialsRun: number;
  /** Prospects signed outside the auction this season. */
  developmentSignings: number;
}

/** The complete, serialisable state of one manager career. */
export interface ManagerState {
  version: number;
  kind: 'IPL_MANAGER';
  seed: number;
  profile: ManagerProfile;
  /** The franchise the manager works for. */
  franchiseId: string;
  franchises: Record<string, Franchise>;
  players: Record<string, ManagedPlayer>;
  staff: StaffMember[];
  /** Staff on the market to hire. */
  staffMarket: StaffMember[];
  reports: Record<string, ScoutReport>;
  shortlist: string[];
  auctionPlan: AuctionPlan;
  auction: AuctionState | null;
  tactics: TeamTactics;
  season: ManagerSeason;
  history: SeasonSummary[];
  awardsHistory: ManagerAwards[];
  finances: ManagerFinances;
  news: ManagerNews[];
  negotiations: Negotiation[];
  matchArchive: Record<string, ArchivedMatch>;
  /** Every applied transaction / irreversible action id, so nothing happens twice. */
  applied: string[];
  /** Records across the whole career. */
  records: { highestTotal: { runs: number; fixtureId: string; season: number } | null; bestSigning: { playerId: string; value: number; season: number } | null };
}
