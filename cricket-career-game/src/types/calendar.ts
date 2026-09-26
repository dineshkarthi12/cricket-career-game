import type { CareerStageId } from './career';
import type { Id, ISODate } from './primitives';

/** A stretch of the year, drawn as a band behind the month view. */
export type CalendarWindowKind =
  | 'SCHOOL_TERM'
  | 'EXAMS'
  | 'HOLIDAYS'
  | 'CLUB_SEASON'
  | 'TOURNAMENT'
  | 'IPL'
  | 'INTERNATIONAL'
  | 'ICC_EVENT';

export interface CalendarWindow {
  id: Id;
  kind: CalendarWindowKind;
  title: string;
  start: ISODate;
  end: ISODate;
  tournamentId: Id | null;
}

/** Broad climate zones. Weather for a match is drawn from its venue's zone and month. */
export type ClimateRegion =
  /** Tamil Nadu, Puducherry, Andhra coast: north-east monsoon Oct-Dec. */
  | 'SOUTH_EAST'
  /** Kerala, Karnataka coast, Goa: heavy south-west monsoon Jun-Sep. */
  | 'SOUTH_WEST'
  /** Maharashtra, Gujarat: south-west monsoon, dry winters. */
  | 'WEST'
  /** Delhi, Punjab, UP, Rajasthan: hot summers, foggy dewy winters. */
  | 'NORTH'
  /** Bengal, Odisha, Assam: monsoon plus early-winter dew. */
  | 'EAST'
  /** Deccan plateau: Hyderabad, Bengaluru, MP. */
  | 'CENTRAL';

/**
 * The season calendar. Matches, camps, tests and exams are `Fixture`s; the
 * calendar adds the windows around them and the clock that advances them.
 */
export interface CalendarState {
  seasonYear: number;
  /** Stage the calendar was generated for. Events only appear for this stage. */
  stageId: CareerStageId;
  windows: CalendarWindow[];
  /** Climate of the player's home region. */
  region: ClimateRegion;
  /** Weeks advanced since the career began. */
  weeksPlayed: number;
  /**
   * A match the clock stopped for: the player must play or sim it before
   * the week can go on.
   */
  pendingFixtureId: Id | null;
  /** A trial the clock stopped for: the player attends it before going on. */
  pendingTrialId?: Id | null;
}
