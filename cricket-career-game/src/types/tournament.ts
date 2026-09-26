import type { CompetitionLevel, Id, ISODate, MatchFormat } from './primitives';

export type TournamentStructure =
  | 'LEAGUE'
  | 'LEAGUE_KNOCKOUT'
  | 'GROUP_KNOCKOUT'
  | 'KNOCKOUT'
  | 'BILATERAL_SERIES'
  | 'ROUND_ROBIN'
  | 'ONE_OFF';

/** Named round within a tournament. Drives pressure and reward multipliers. */
export type TournamentStage =
  | 'TRIAL'
  | 'CAMP'
  | 'PRACTICE'
  | 'GROUP'
  | 'LEAGUE'
  | 'SUPER_LEAGUE'
  | 'PRE_QUARTER_FINAL'
  | 'QUARTER_FINAL'
  | 'ELIMINATOR'
  | 'QUALIFIER_1'
  | 'QUALIFIER_2'
  | 'SEMI_FINAL'
  | 'FINAL';

export interface Tournament {
  id: Id;
  /** Real competition name, e.g. "Ranji Trophy", "Cooch Behar Trophy". */
  name: string;
  shortName: string;
  level: CompetitionLevel;
  format: MatchFormat;
  structure: TournamentStructure;
  /** Age cap for age-group competitions, e.g. 16, 19, 23. `null` for senior. */
  ageLimit: number | null;
  /** Stages played, in order. */
  stages: TournamentStage[];
  teamIds: Id[];
  /** Days of play per match. */
  matchDays: number;
  /** 0-100 prestige. Feeds reputation and scouting gains. */
  prestige: number;
  /** Trophy awarded to the winner. */
  trophyId: Id | null;
  /** Typical start month, 1-12. */
  startMonth: number;
  description: string;
}

/** Standing of one team within a tournament group. */
export interface TournamentStanding {
  teamId: Id;
  groupId: string;
  played: number;
  won: number;
  lost: number;
  drawn: number;
  tied: number;
  noResult: number;
  points: number;
  /** Limited overs: (runs for / overs faced) - (runs against / overs bowled). */
  netRunRate: number;
  /** First-class: first-innings leads taken in drawn matches. */
  bonusPoints: number;
  runsFor: number;
  /** Balls faced; an all-out innings counts the full quota (the NRR rule). */
  ballsFaced: number;
  runsAgainst: number;
  ballsBowled: number;
  wicketsLost: number;
  wicketsTaken: number;
  position: number;
  qualified: boolean;
  eliminated: boolean;
}

export interface TournamentGroup {
  id: string;
  name: string;
  teamIds: Id[];
}

/** Where a knockout side comes from: a group position, or the winner of an earlier tie. */
export type SeedRef = { groupId: string; position: number } | { tieId: string } | { loserOf: string };

export interface KnockoutTie {
  id: string;
  stage: TournamentStage;
  label: string;
  home: SeedRef;
  away: SeedRef;
  homeTeamId: Id | null;
  awayTeamId: Id | null;
  fixtureId: Id;
  winnerTeamId: Id | null;
}

/** A played match, kept small: enough for tables, results lists and knockouts. */
export interface CompactResult {
  fixtureId: Id;
  stage: TournamentStage;
  homeTeamId: Id;
  awayTeamId: Id;
  winnerTeamId: Id | null;
  type: 'WIN' | 'TIE' | 'DRAW' | 'NO_RESULT';
  summary: string;
  /** One entry per innings, in order. */
  scores: { teamId: Id; runs: number; wickets: number; balls: number; allOut: boolean }[];
  firstInningsLeadTeamId: Id | null;
  /** Full match id when the user played it (ball-by-ball or scorecard in `matches`). */
  matchId: Id | null;
}

/** One player's figures in one tournament. */
export interface PlayerTournamentLine {
  playerId: Id;
  name: string;
  teamId: Id;
  matches: number;
  innings: number;
  notOuts: number;
  runs: number;
  balls: number;
  highScore: number;
  fifties: number;
  hundreds: number;
  wickets: number;
  ballsBowled: number;
  runsConceded: number;
  bestWickets: number;
  bestRuns: number;
  ratingSum: number;
}

export interface AwardWinner {
  playerId: Id;
  name: string;
  teamId: Id;
  /** e.g. "612 runs", "34 wickets". */
  detail: string;
}

export interface TournamentAwards {
  championTeamId: Id | null;
  runnerUpTeamId: Id | null;
  playerOfTournament: AwardWinner | null;
  topScorer: AwardWinner | null;
  topWicketTaker: AwardWinner | null;
}

export interface TournamentState {
  tournamentId: Id;
  seasonYear: number;
  name: string;
  format: MatchFormat;
  /** Points system for the table. */
  points: 'LIMITED' | 'FIRST_CLASS';
  currentStage: TournamentStage;
  groups: TournamentGroup[];
  standings: TournamentStanding[];
  knockouts: KnockoutTie[];
  /** Fixture ids belonging to this tournament this season. */
  fixtureIds: Id[];
  results: Record<Id, CompactResult>;
  stats: Record<Id, PlayerTournamentLine>;
  /** The side the user belongs to in this competition, if any. */
  userTeamId: Id | null;
  winnerTeamId: Id | null;
  awards: TournamentAwards | null;
  complete: boolean;
}

/** A scheduled event on the calendar. Not every fixture is a match. */
export type FixtureKind =
  | 'MATCH'
  | 'TRIAL'
  | 'SELECTION_CAMP'
  | 'TRAINING_CAMP'
  | 'FITNESS_ASSESSMENT'
  | 'SELECTION_MEETING'
  | 'AUCTION'
  | 'AWARDS'
  | 'REST'
  | 'EXAMS'
  | 'TRAVEL'
  | 'TRAINING'
  | 'BIRTHDAY';

export interface Fixture {
  id: Id;
  kind: FixtureKind;
  /** Short label shown on the Upcoming Schedule card. */
  title: string;
  subtitle: string;
  date: ISODate;
  /** Multi-day fixtures end later than they start. */
  endDate: ISODate;
  tournamentId: Id | null;
  stage: TournamentStage | null;
  format: MatchFormat | null;
  venueId: Id | null;
  homeTeamId: Id | null;
  awayTeamId: Id | null;
  /** Set once the fixture has been played out. */
  matchId: Id | null;
  /** Is the user involved at all (selected, on the bench, or attending)? */
  involvesUser: boolean;
  played: boolean;
}

export interface SeasonSummary {
  matches: number;
  runs: number;
  wickets: number;
  battingAverage: number;
  strikeRate: number;
  bowlingAverage: number;
  economy: number;
  fifties: number;
  hundreds: number;
  fiveWicketHauls: number;
  catches: number;
  /** Mean of the user's 0-10 match ratings this season. */
  averageRating: number;
  awards: string[];
}

export interface Season {
  /** Starting year of the season, e.g. 2026 for the 2026-27 season. */
  year: number;
  label: string;
  startDate: ISODate;
  endDate: ISODate;
  /** In-game "today". The whole calendar advances from here. */
  currentDate: ISODate;
  /** Career stage the player is in for this season. */
  stageId: string;
  tournaments: TournamentState[];
  fixtureIds: Id[];
  matchIds: Id[];
  summary: SeasonSummary;
  complete: boolean;
}
