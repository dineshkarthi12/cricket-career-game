import type { CompetitionLevel, Id, MatchFormat, Rating } from './primitives';
import type { RivalPlayer } from './player';

export type TeamKind =
  | 'SCHOOL'
  | 'CLUB'
  | 'ACADEMY'
  | 'DISTRICT'
  | 'STATE'
  | 'ZONE'
  | 'FRANCHISE'
  | 'NATIONAL';

/** A generic crest - no real association logos are used anywhere in the game. */
export interface Crest {
  /** Two-letter monogram rendered inside the crest, e.g. "TN". */
  monogram: string;
  primaryColor: string;
  secondaryColor: string;
  /** Generic crest silhouette to draw. */
  shape: 'SHIELD' | 'ROUND' | 'BANNER' | 'DIAMOND';
}

export interface Team {
  id: Id;
  name: string;
  /** e.g. "TN U-16". */
  shortName: string;
  kind: TeamKind;
  level: CompetitionLevel;
  crest: Crest;
  homeVenueId: Id;
  /** 1-99 squad strength, used when simulating matches the user is not in. */
  strength: Rating;
  /** Formats this team plays. */
  formats: MatchFormat[];
  squad: RivalPlayer[];
  /** Ids from `squad` selected for the current match. */
  playingXiIds: Id[];
  captainId: Id | null;
  /** What the selectors are short of right now; boosts the user's chances. */
  needs: TeamNeed[];
  /** Does the user currently belong to this team? */
  isUserTeam: boolean;
  /** 0-100 dressing-room mood. Feeds every player's morale on match day. */
  morale: number;
}

export type TeamNeed =
  | 'TOP_ORDER_BATTER'
  | 'MIDDLE_ORDER_BATTER'
  | 'FINISHER'
  | 'WICKET_KEEPER'
  | 'PACE_BOWLER'
  | 'SPIN_BOWLER'
  | 'ALLROUNDER'
  | 'DEATH_BOWLER'
  | 'NONE';
