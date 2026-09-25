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

/** Standing of one team within a tournament. */
export interface TournamentStanding {
  teamId: Id;
  played: number;
  won: number;
  lost: number;
  drawn: number;
  tied: number;
  noResult: number;
  points: number;
  netRunRate: number;
  /** Bonus/first-innings-lead points used in first-class competitions. */
  bonusPoints: number;
  position: number;
  qualified: boolean;
  eliminated: boolean;
}

export interface TournamentState {
  tournamentId: Id;
  seasonYear: number;
  currentStage: TournamentStage;
  standings: TournamentStanding[];
  /** Fixture ids belonging to this tournament this season. */
  fixtureIds: Id[];
  winnerTeamId: Id | null;
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
