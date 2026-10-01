/**
 * Player roles: one place that says what each role may do.
 *
 * Every rule about who bats, who bowls and who keeps goes through here - the
 * match engine, the bowler choice, training, the match screen and player
 * creation all ask the same functions, so a Pure Batter cannot be handed the
 * ball by one code path that forgot the rule. Hiding a button is never the
 * restriction: the engine itself rejects an illegal bowler.
 *
 * Pure TypeScript - no React.
 */
import type { BowlingStyle, PlayerRole } from '@/types';

/** The four roles a player is created with, and what the user experiences. */
export type RoleCategory = 'PURE_BATTER' | 'BOWLER' | 'ALL_ROUNDER' | 'WICKETKEEPER';

export function roleCategory(role: PlayerRole): RoleCategory {
  switch (role) {
    case 'BATTER':
    case 'OPENING_BATTER':
      return 'PURE_BATTER';
    case 'WICKET_KEEPER_BATTER':
      return 'WICKETKEEPER';
    case 'BATTING_ALLROUNDER':
    case 'BOWLING_ALLROUNDER':
      return 'ALL_ROUNDER';
    case 'PACE_BOWLER':
    case 'SPIN_BOWLER':
      return 'BOWLER';
  }
}

export const ROLE_CATEGORY_LABEL: Record<RoleCategory, string> = {
  PURE_BATTER: 'Pure Batter',
  BOWLER: 'Bowler',
  ALL_ROUNDER: 'All-rounder',
  WICKETKEEPER: 'Wicketkeeper',
};

/** What a player is, as far as the role rules care. */
export interface RoleSubject {
  role: PlayerRole;
  bowlingStyle: BowlingStyle;
}

/** A player in a match: the user's own player is held to the role rules strictly. */
export interface MatchRoleSubject extends RoleSubject {
  id: string;
  isUser?: boolean;
}

/** Does the role itself include bowling? Pure batters and keepers do not bowl. */
export function roleAllowsBowling(role: PlayerRole): boolean {
  const category = roleCategory(role);
  return category === 'BOWLER' || category === 'ALL_ROUNDER';
}

/** Everyone bats when their turn comes - bowlers included. */
export function canUserControlBatting(_player: RoleSubject): boolean {
  return true;
}

/** Bowling controls are only ever the user's when the role bowls and they have a bowling type. */
export function canUserControlBowling(player: RoleSubject): boolean {
  return roleAllowsBowling(player.role) && player.bowlingStyle !== 'NONE';
}

/** Wicketkeeping duties: keepers only. */
export function canUserKeepWicket(player: RoleSubject): boolean {
  return roleCategory(player.role) === 'WICKETKEEPER';
}

/** Bowling drills and bowling-attribute growth are for players whose role bowls. */
export function canTrainBowling(player: RoleSubject): boolean {
  return canUserControlBowling(player);
}

/**
 * May this player bowl at all in a match? The user's own player is bound by
 * their role. AI players may still turn their arm over as part-timers when
 * they have a bowling type (the AI captain keeps the gloves on his keeper by
 * picking real bowlers first).
 */
export function canBowlInMatch(player: MatchRoleSubject): boolean {
  if (player.bowlingStyle === 'NONE') return false;
  if (player.isUser) return roleAllowsBowling(player.role);
  return true;
}

/**
 * Someone the captain may throw the ball to in an emergency (a side with too
 * few bowlers). Never the user's player unless their role bowls.
 */
export function canBowlInEmergency(player: MatchRoleSubject): boolean {
  if (player.isUser) return canBowlInMatch(player);
  return true;
}

/** The match situation that decides whether this over may go to this bowler. */
export interface OverAssignment {
  oversBowledBy: Record<string, number>;
  /** The format's per-bowler cap, or null for unlimited. */
  maxOversPerBowler: number | null;
  /** Who bowled the last over (no one bowls two in a row). */
  lastBowlerId: string | null;
}

/** May this player be given the next over, right now? */
export function canPlayerBeAssignedToBowl(player: MatchRoleSubject, match: OverAssignment): boolean {
  if (!canBowlInMatch(player)) return false;
  if (player.id === match.lastBowlerId) return false;
  if (match.maxOversPerBowler !== null && (match.oversBowledBy[player.id] ?? 0) >= match.maxOversPerBowler) return false;
  return true;
}

/** Where the player is in a match, as the screen reads it. */
export interface MatchInvolvement {
  playing: boolean;
  onStrike: boolean;
  atCrease: boolean;
  bowling: boolean;
  fielding: boolean;
}

export interface AvailableMatchActions {
  /** Choose an intent for the next ball faced. */
  bat: boolean;
  /** Choose a plan, line and length for the ball being bowled. */
  bowl: boolean;
  /** Set bowling aggression for overs to come. Off for anyone who never bowls. */
  setBowlingAggression: boolean;
  /** Set batting aggression for balls to come. */
  setBattingAggression: boolean;
  keep: boolean;
  field: boolean;
}

/** What the user may do right now. The engine enforces the same rules; this only drives the screen. */
export function getAvailableMatchActions(player: RoleSubject, involvement: MatchInvolvement): AvailableMatchActions {
  const bowls = canUserControlBowling(player);
  return {
    bat: involvement.playing && involvement.onStrike && canUserControlBatting(player),
    bowl: involvement.playing && involvement.bowling && bowls,
    setBowlingAggression: involvement.playing && bowls,
    setBattingAggression: involvement.playing,
    keep: involvement.playing && involvement.fielding && canUserKeepWicket(player),
    field: involvement.playing && involvement.fielding,
  };
}

/** A sentence for the player about what their role means in a match. */
export function roleMatchNote(player: RoleSubject): string {
  switch (roleCategory(player.role)) {
    case 'PURE_BATTER':
      return 'Pure Batter: you bat and field. You will not bowl in matches.';
    case 'WICKETKEEPER':
      return 'Wicketkeeper: you bat and keep wicket. You will not bowl in matches.';
    case 'ALL_ROUNDER':
      return player.bowlingStyle === 'NONE'
        ? 'All-rounder without a bowling type: choose one to be given overs.'
        : 'All-rounder: you bat, and the captain may give you overs.';
    case 'BOWLER':
      return 'Bowler: bowling is your job. You still bat when your turn comes.';
  }
}
