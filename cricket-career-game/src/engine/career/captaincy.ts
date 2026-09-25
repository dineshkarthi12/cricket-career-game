/**
 * Captaincy: who captains, how it is going, and the pressure that comes with
 * it. Pure functions over career state - no React, no storage.
 */
import type {
  CaptainDelegation,
  CaptaincyRecord,
  CaptaincyState,
  GameState,
  Id,
} from '@/types';

export function emptyCaptaincyRecord(): CaptaincyRecord {
  return { matches: 0, won: 0, lost: 0, drawn: 0, tied: 0, noResult: 0 };
}

/** A new captain makes every call; delegation is opt-in. */
export const DEFAULT_DELEGATION: CaptainDelegation = {
  toss: false,
  battingOrder: false,
  instructions: false,
  bowling: false,
  field: false,
  reviews: false,
  declarations: false,
};

export function emptyCaptaincy(): CaptaincyState {
  return {
    teamId: null,
    since: null,
    rating: 50,
    tactics: 50,
    stress: 0,
    streak: 0,
    record: emptyCaptaincyRecord(),
    byTeam: {},
    delegate: { ...DEFAULT_DELEGATION },
    history: [],
    recommendedForHigher: false,
  };
}

/**
 * Does the player captain this team? Team controls in a match unlock only
 * when this is true. The dev toggle stands in for an appointment while the
 * career has not reached one; the caller passes `devBuild`, so it can never
 * take effect in a production build.
 */
export function isCaptainOf(
  state: GameState,
  teamId: Id | null | undefined,
  devBuild = false,
): boolean {
  if (!teamId) return false;
  if (state.career.captaincy.teamId === teamId) return true;
  if (state.teams[teamId]?.captainId === state.player.id) return true;
  return devBuild && state.settings.devCaptainMode && Boolean(state.teams[teamId]?.isUserTeam);
}

/** Win percentage from a record, or null before a completed match. */
export function winPercent(record: CaptaincyRecord): number | null {
  const decided = record.matches - record.noResult;
  if (decided <= 0) return null;
  return Math.round((record.won / decided) * 1000) / 10;
}

/** Make the player captain of a team. */
export function appointCaptain(state: GameState, teamId: Id, date: string, note: string): GameState {
  const team = state.teams[teamId];
  if (!team) return state;
  const captaincy = state.career.captaincy;
  return {
    ...state,
    teams: { ...state.teams, [teamId]: { ...team, captainId: state.player.id } },
    career: {
      ...state.career,
      captaincy: {
        ...captaincy,
        teamId,
        since: date,
        // A new captain starts with the benefit of the doubt.
        rating: Math.max(captaincy.rating, 55),
        stress: Math.min(captaincy.stress, 30),
        streak: 0,
        byTeam: { ...captaincy.byTeam, [teamId]: captaincy.byTeam[teamId] ?? emptyCaptaincyRecord() },
        history: [...captaincy.history, { date, kind: 'APPOINTED', teamId, note }],
      },
    },
  };
}

/** Take the captaincy away, or give it up. */
export function removeCaptain(
  state: GameState,
  date: string,
  kind: 'SACKED' | 'RESIGNED',
  note: string,
): GameState {
  const captaincy = state.career.captaincy;
  const teamId = captaincy.teamId;
  if (!teamId) return state;
  const team = state.teams[teamId];
  return {
    ...state,
    teams: team
      ? { ...state.teams, [teamId]: { ...team, captainId: null } }
      : state.teams,
    career: {
      ...state.career,
      captaincy: {
        ...captaincy,
        teamId: null,
        since: null,
        streak: 0,
        history: [...captaincy.history, { date, kind, teamId, note }],
      },
    },
  };
}
