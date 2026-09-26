import type { CaptaincyRecord } from './career';
import type { Id, ISODate, MatchFormat } from './primitives';

/**
 * The professional career, stages 11-20: IPL scouting and contracts, the
 * national setup, rankings, awards, leadership, fans, retirement and the
 * records book. Everything here is earned - nothing is handed out.
 */

/** The three international formats. */
export type IntlFormat = 'T20I' | 'ODI' | 'TEST';
export const INTL_FORMATS: IntlFormat[] = ['T20I', 'ODI', 'TEST'];

// --- IPL -------------------------------------------------------------------

/** Where the player stands with the IPL this season. */
export type IplStatus =
  | 'NOT_SCOUTED'
  | 'NOT_SHORTLISTED'
  | 'SHORTLISTED'
  | 'UNSOLD'
  | 'BOUGHT'
  | 'REPLACEMENT'
  | 'RETAINED'
  | 'RELEASED'
  | 'TRADED';

export interface ScoutingNote {
  date: ISODate;
  /** Change in scouting reputation. */
  delta: number;
  reason: string;
}

export interface FranchiseTrialRecord {
  franchiseId: string;
  date: ISODate;
  bonus: number;
  verdict: string;
}

export interface ScoutingState {
  /** 0-100: what franchise scouts know and think of the player. */
  reputation: number;
  /** Newest first, last 20. */
  notes: ScoutingNote[];
  /** 0-100 interest per franchise id. */
  interest: Record<string, number>;
  trials: FranchiseTrialRecord[];
  /** Franchises whose scouts have been in touch this season (inbox once). */
  contacted: string[];
}

export interface IplContract {
  franchiseId: string;
  /** Salary per season, in lakh rupees (100 lakh = 1 crore). */
  salary: number;
  fromSeason: number;
  /** Last season covered (the next mega auction ends every contract). */
  toSeason: number;
  how: 'AUCTION' | 'REPLACEMENT' | 'RETAINED' | 'TRADE';
}

export interface AuctionBid {
  franchiseId: string;
  /** Lakh. */
  amount: number;
}

/** One lot under the hammer. */
export interface AuctionLot {
  playerId: string;
  name: string;
  role: string;
  age: number;
  overseas: boolean;
  capped: boolean;
  /** Lakh. */
  basePrice: number;
  bids: AuctionBid[];
  soldTo: string | null;
  price: number | null;
  isUser: boolean;
}

export interface AuctionSummary {
  seasonYear: number;
  mega: boolean;
  date: ISODate;
  /** The user's lot, when they were in the auction. */
  userLot: AuctionLot | null;
  /** The biggest buys and a sample of the room, for the screen. */
  lots: AuctionLot[];
  /** Franchise purses left after the auction, lakh. */
  pursesAfter: Record<string, number>;
  userStatus: IplStatus;
}

export interface IplSeasonLine {
  seasonYear: number;
  franchiseId: string;
  matches: number;
  teamMatches: number;
  runs: number;
  wickets: number;
  /** Where the franchise finished: 1 champion ... 10. */
  finish: number | null;
  salary: number;
}

export interface IplState {
  status: IplStatus;
  franchiseId: string | null;
  contract: IplContract | null;
  /** Base price the player registers at (lakh), or null for the agent's choice. */
  registeredBase: number | null;
  auctions: AuctionSummary[];
  seasons: IplSeasonLine[];
  /** Franchise purses going into the next auction, lakh. */
  purses: Record<string, number>;
  /** The season the last mega auction was held for. */
  lastMegaSeason: number;
  /** A pending trade offer from another franchise. */
  tradeOffer: { franchiseId: string; date: ISODate; salary: number } | null;
  /** Estimated market value, lakh. */
  marketValue: number;
  earnings: number;
}

// --- National team ------------------------------------------------------------

export type ContractGrade = 'A+' | 'A' | 'B' | 'C';

export interface CentralContract {
  grade: ContractGrade;
  seasonYear: number;
  /** Retainer, lakh per year. */
  retainer: number;
}

export interface CapRecord {
  format: IntlFormat;
  date: ISODate;
  opponent: string;
  venue: string;
  /** Cap number for India in that format. */
  capNumber: number;
}

export interface NationalState {
  /** On the national selectors' radar (India A, camps, or capped). */
  watched: boolean;
  caps: Record<IntlFormat, number>;
  debuts: CapRecord[];
  contract: CentralContract | null;
  contractHistory: CentralContract[];
  /** Lakh. */
  matchFees: number;
  /** Times invited to the national camp. */
  campInvites: number;
  /** Rest days handed down by the board (workload management), newest first. */
  rested: { date: ISODate; format: IntlFormat; reason: string }[];
  /** Consecutive series without a game while in the squad. */
  benchedSeries: number;
  /** Dropped from a format squad, per format, times. */
  drops: Record<IntlFormat, number>;
  /** What the national camp was worth this season (-10..10), if attended. */
  camp: { seasonYear: number; bonus: number } | null;
  /** ICC events played in, by tournament id and season. */
  iccEvents: { tournamentId: string; seasonYear: number; matches: number; won: boolean }[];
}

/** Figures in a series still being played, for the player of the series. */
export interface SeriesLine {
  name: string;
  teamId: string;
  matches: number;
  runs: number;
  wickets: number;
  rating: number;
}

export interface NationProgress {
  /** Potential offset for the nation's new players, drifts each season. */
  offset: number;
  /** Rating points for the team rankings, per format. */
  ratings: Record<IntlFormat, number>;
}

/** The World Test Championship: a two-year cycle of Test series. */
export interface WtcCycle {
  /** First season of the cycle (cycles start in odd years). */
  startYear: number;
  /** Points and matches per nation. */
  table: Record<string, { played: number; won: number; lost: number; drawn: number; points: number }>;
  finals: { seasonYear: number; winner: string; runnerUp: string; userPlayed: boolean }[];
  /** The two sides in the next final, once a cycle has finished. */
  finalists: [string, string] | null;
}

// --- Rankings --------------------------------------------------------------------

export interface RankingEntry {
  playerId: string;
  name: string;
  nation: string;
  /** 0-1000 rating points. */
  batting: number;
  bowling: number;
  matches: number;
}

export interface RankingSnapshot {
  date: ISODate;
  format: IntlFormat;
  batting: number | null;
  bowling: number | null;
  allRounder: number | null;
}

export interface RankingsState {
  /** Every international player's ratings by format. */
  players: Record<IntlFormat, Record<string, RankingEntry>>;
  /** The user's rank after each international match, newest last (compact). */
  userHistory: RankingSnapshot[];
  /** Best ranks reached, by format and discipline. */
  best: Record<IntlFormat, { batting: number | null; bowling: number | null; allRounder: number | null }>;
}

// --- Awards, media, leadership ---------------------------------------------------

export type AwardKind =
  | 'PLAYER_OF_SERIES'
  | 'PLAYER_OF_TOURNAMENT'
  | 'TOURNAMENT_TOP_SCORER'
  | 'TOURNAMENT_TOP_WICKETS'
  | 'PLAYER_OF_YEAR'
  | 'TEST_PLAYER_OF_YEAR'
  | 'ODI_PLAYER_OF_YEAR'
  | 'T20I_PLAYER_OF_YEAR'
  | 'EMERGING_PLAYER'
  | 'IPL_MVP'
  | 'IPL_ORANGE_CAP'
  | 'IPL_PURPLE_CAP'
  | 'DOMESTIC_CRICKETER_OF_YEAR';

export interface AwardRecord {
  id: Id;
  kind: AwardKind;
  title: string;
  detail: string;
  date: ISODate;
  seasonYear: number;
}

export interface MediaStory {
  id: Id;
  date: ISODate;
  outlet: string;
  headline: string;
  body: string;
  tone: 'PRAISE' | 'NEUTRAL' | 'CRITICAL';
  /** Fan reactions shown under the story. */
  likes: number;
}

export interface FanState {
  /** Social following. */
  followers: number;
  /** 0-100: how the public feels about the player right now. */
  sentiment: number;
  /** 0-100: media pressure after failures; eases with runs and wickets. */
  pressure: number;
  stories: MediaStory[];
}

export type LeadershipLevel = 'STATE' | 'IPL' | 'INDIA';
export type LeadershipRole = 'VICE_CAPTAIN' | 'CAPTAIN';

export interface LeadershipPost {
  level: LeadershipLevel;
  role: LeadershipRole;
  teamId: string;
  teamName: string;
  /** India captaincies are per format. */
  format: IntlFormat | null;
  since: ISODate;
  until: ISODate | null;
}

export interface LeadershipOffer {
  id: Id;
  level: LeadershipLevel;
  role: LeadershipRole;
  teamId: string;
  teamName: string;
  format: IntlFormat | null;
  date: ISODate;
  reason: string;
}

export interface LeadershipState {
  posts: LeadershipPost[];
  offer: LeadershipOffer | null;
  declined: number;
  /** Captaincy records keyed by `${level}|${format ?? 'ALL'}`. */
  records: Record<string, CaptaincyRecord>;
  /** A declined offer is not repeated before this season, by `${level}|${format ?? 'ALL'}`. */
  cooldown: Record<string, number>;
}

// --- Retirement and legacy ---------------------------------------------------------

export type RetirementScope = IntlFormat | 'IPL' | 'FIRST_CLASS' | 'ALL';

export interface RetirementState {
  /** Formats the player has retired from. */
  retiredFrom: RetirementScope[];
  retiredOn: Partial<Record<RetirementScope, ISODate>>;
  /** Fully retired: the career is over. */
  complete: boolean;
  /** The board or franchise has stopped picking the player (by scope). */
  overlooked: RetirementScope[];
  /** A nudge in the inbox has been sent this season. */
  nudgedSeason: number | null;
}

export type LegacyTier =
  | 'CLUB_CRICKETER'
  | 'STATE_PLAYER'
  | 'DOMESTIC_STALWART'
  | 'DOMESTIC_LEGEND'
  | 'IPL_REGULAR'
  | 'INTERNATIONAL_CAP'
  | 'INTERNATIONAL_REGULAR'
  | 'INDIA_GREAT'
  | 'ALL_TIME_GREAT';

export interface CareerRecordEntry {
  id: string;
  label: string;
  value: string;
  date: ISODate;
  /** National or league record broken, not just a personal best. */
  broke: string | null;
}

export interface RecordsBook {
  /** Personal bests and records broken, by id. */
  entries: Record<string, CareerRecordEntry>;
}

export interface CareerMilestone {
  date: ISODate;
  age: number;
  title: string;
  detail: string;
}

export interface ProState {
  scouting: ScoutingState;
  ipl: IplState;
  national: NationalState;
  nations: Record<string, NationProgress>;
  wtc: WtcCycle;
  rankings: RankingsState;
  awards: AwardRecord[];
  fans: FanState;
  leadership: LeadershipState;
  retirement: RetirementState;
  records: RecordsBook;
  /** Turning points of the whole career, for the legacy screen. */
  timeline: CareerMilestone[];
  /** Open series, keyed by `${tournamentId}|${groupId}`, player id -> figures. */
  openSeries: Record<string, Record<string, SeriesLine>>;
  /** Series between other nations: lightweight scorecards, newest first (missing on older saves). */
  worldResults?: WorldResult[];
}

/** A match between two other nations, kept small: the result and who stood out. */
export interface WorldResult {
  date: string;
  format: IntlFormat;
  home: string;
  away: string;
  summary: string;
  batting: { name: string; nation: string; runs: number; balls: number }[];
  bowling: { name: string; nation: string; wickets: number; runs: number }[];
}

/** International competition ids by format (bilateral series). */
export const INTL_TOURNAMENT: Record<IntlFormat, string> = {
  T20I: 'intl-t20i',
  ODI: 'intl-odi',
  TEST: 'intl-test',
};

export function intlFormatOf(format: MatchFormat): IntlFormat {
  return format === 'T20' ? 'T20I' : format === 'TEST' || format === 'MULTI_DAY' ? 'TEST' : 'ODI';
}
