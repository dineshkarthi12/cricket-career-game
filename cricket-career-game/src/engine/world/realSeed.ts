/**
 * Careers saved before the real players arrived keep their generated squads
 * for the rest of the season they are in. At the next 1 June the sides that
 * are real now - the franchises, the senior national sides, India A, the
 * zones, the Rest of India and the senior state sides - lose their generated
 * squads, and the season's builders (`ensureFranchises`, `ensureNationSide`,
 * `buildTournament`, ...) fill them with real players, aged to that season.
 * District, school, club and age-group sides are untouched.
 */
import { FRANCHISES } from '@/data/franchises';
import { nationTeamId } from '@/data/nations';
import { hasRealPlayers } from './realPlayers';
import type { GameState, Team } from '@/types';

const FRANCHISE_IDS = new Set(FRANCHISES.map((f) => f.id));

/** A side whose squad is built from real players. */
export function isRealSide(team: Team): boolean {
  if (FRANCHISE_IDS.has(team.id)) return true;
  if (team.id === nationTeamId('India', 'A')) return true;
  if (team.kind === 'NATIONAL') return !/U-19|U-23| A$/.test(team.name);
  if (team.kind === 'ZONE') return true;
  return team.kind === 'STATE' && team.level === 'STATE_SENIOR';
}

export function seedRealSquads(state: GameState): GameState {
  if (!state.realSquadsPending || !hasRealPlayers()) return state;
  const teams = Object.fromEntries(
    Object.entries(state.teams).map(([id, team]) => [id, isRealSide(team) && team.squad.length > 0 ? { ...team, squad: [], competitionSquads: undefined, captainId: team.captainId === state.player.id ? team.captainId : null } : team]),
  );
  return { ...state, teams, realSquadsPending: false };
}
