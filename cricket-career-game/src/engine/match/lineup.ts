/**
 * The bridge between a saved career and the match engine.
 *
 * The save stores teams as `RivalPlayer` squads and the user as a `Player`; the
 * engine wants `SimPlayer`. Everything in here is pure: it reads game state and
 * returns engine input, and never writes to the store.
 */
import { emptyCareerRecord } from '../records';
import { createRng, deriveSeed } from './rng';
import { generateSquad } from './squad';
import { isLimitedOvers } from './simulate';
import type { LiveMatchSetup } from './live';
import type { SimPlayer } from './types';
import type { Fixture, GameState, Id, MatchFormat, Player, RivalPlayer, Team } from '@/types';

/** Batting order a role usually occupies, used when nothing better is known. */
const POSITION_BY_ROLE: Record<string, number> = {
  OPENING_BATTER: 1,
  BATTER: 4,
  WICKET_KEEPER_BATTER: 5,
  BATTING_ALLROUNDER: 6,
  BOWLING_ALLROUNDER: 7,
  SPIN_BOWLER: 8,
  PACE_BOWLER: 9,
};

/** A stable numeric salt for a string, so squads regenerate identically. */
function saltOf(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function simFromRival(rival: RivalPlayer, battingPosition: number): SimPlayer {
  return {
    id: rival.id,
    name: rival.name,
    teamId: rival.teamId,
    role: rival.role,
    battingStyle: rival.battingStyle,
    bowlingStyle: rival.bowlingStyle,
    attributes: rival.attributes,
    condition: rival.condition,
    battingPosition,
    isUser: false,
  };
}

export function simFromUser(player: Player, teamId: Id, battingPosition: number): SimPlayer {
  return {
    id: player.id,
    name: `${player.firstName} ${player.lastName}`,
    teamId,
    role: player.role,
    battingStyle: player.battingStyle,
    bowlingStyle: player.bowlingStyle,
    attributes: player.attributes,
    condition: player.condition,
    battingPosition,
    isUser: true,
  };
}

/** The same players in the shape the save stores them. */
export function rivalFromSim(sim: SimPlayer, overall: number): RivalPlayer {
  return {
    id: sim.id,
    name: sim.name,
    age: 24,
    teamId: sim.teamId,
    role: sim.role,
    battingStyle: sim.battingStyle,
    bowlingStyle: sim.bowlingStyle,
    attributes: sim.attributes,
    overall,
    potentialOverall: overall,
    condition: sim.condition,
    record: emptyCareerRecord(),
    isDirectRival: false,
    selectorFavour: 50,
  };
}

/**
 * A squad for a team. Saves start with empty squads, so one is generated the
 * first time it is needed - always from the same seed, so the same career gets
 * the same players every time.
 */
export function squadFor(state: GameState, teamId: Id): SimPlayer[] {
  const team = state.teams[teamId];
  if (!team) return [];
  if (team.squad.length >= 11) {
    return team.squad.map((rival) => simFromRival(rival, POSITION_BY_ROLE[rival.role] ?? 8));
  }
  const rng = createRng(deriveSeed(state.seed, saltOf(teamId)));
  // Ids must be stable: an XI the player picked is stored by id, and a squad
  // that is regenerated rather than saved has to come back with the same ones.
  return generateSquad(teamId, team.strength, rng).map((player, index) => ({
    ...player,
    id: `${teamId}-p${index + 1}`,
  }));
}

/** Who bats where, given a chosen XI. Openers first, bowlers last. */
export function battingOrderOf(xi: SimPlayer[]): SimPlayer[] {
  return [...xi]
    .sort((a, b) => {
      const pa = POSITION_BY_ROLE[a.role] ?? 8;
      const pb = POSITION_BY_ROLE[b.role] ?? 8;
      if (pa !== pb) return pa - pb;
      // Within a role, the better batter goes up.
      const ba = a.attributes.batting.technique + a.attributes.batting.timing;
      const bb = b.attributes.batting.technique + b.attributes.batting.timing;
      return bb - ba;
    })
    .map((player, index) => ({ ...player, battingPosition: index + 1 }));
}

/**
 * The XI a squad would pick on its own: the balanced first-choice eleven, with
 * the user in it when this is their team and they have been selected.
 */
export function defaultXiIds(squad: SimPlayer[], userId?: Id | null): Id[] {
  const picked: SimPlayer[] = [];
  const pool = [...squad];

  const take = (test: (p: SimPlayer) => boolean, count: number) => {
    for (let i = 0; i < count; i += 1) {
      const index = pool.findIndex(test);
      if (index === -1) return;
      picked.push(pool.splice(index, 1)[0]);
    }
  };

  if (userId) take((p) => p.id === userId, 1);
  take((p) => p.role === 'WICKET_KEEPER_BATTER', 1);
  take((p) => p.role === 'OPENING_BATTER', 2);
  take((p) => p.role === 'BATTER', 2);
  take((p) => p.role === 'BATTING_ALLROUNDER' || p.role === 'BOWLING_ALLROUNDER', 1);
  take((p) => p.role === 'PACE_BOWLER', 2);
  take((p) => p.role === 'SPIN_BOWLER', 2);
  // Whatever is left, best first.
  pool.sort(
    (a, b) =>
      b.attributes.batting.technique +
      b.attributes.bowling.accuracy -
      (a.attributes.batting.technique + a.attributes.bowling.accuracy),
  );
  while (picked.length < 11 && pool.length > 0) picked.push(pool.shift()!);

  return picked.slice(0, 11).map((p) => p.id);
}

/** Warnings shown next to an XI the user has assembled. */
export function xiWarnings(xi: SimPlayer[]): string[] {
  const warnings: string[] = [];
  if (xi.length !== 11) warnings.push(`Pick exactly 11 — you have ${xi.length}.`);
  if (!xi.some((p) => p.role === 'WICKET_KEEPER_BATTER')) warnings.push('No wicket-keeper.');
  const bowlers = xi.filter(
    (p) =>
      p.bowlingStyle !== 'NONE' &&
      (p.role === 'PACE_BOWLER' ||
        p.role === 'SPIN_BOWLER' ||
        p.role === 'BOWLING_ALLROUNDER' ||
        p.role === 'BATTING_ALLROUNDER'),
  );
  if (bowlers.length < 4) warnings.push(`Only ${bowlers.length} front-line bowlers — you want five.`);
  const pace = xi.filter((p) => p.role === 'PACE_BOWLER').length;
  const spin = xi.filter((p) => p.role === 'SPIN_BOWLER').length;
  if (pace === 0) warnings.push('No specialist seamer.');
  if (spin === 0) warnings.push('No specialist spinner.');
  const injured = xi.filter((p) => p.condition.injury);
  for (const p of injured) warnings.push(`${p.name} is injured.`);
  return warnings;
}

export interface MatchBuild {
  setup: LiveMatchSetup;
  homeXi: SimPlayer[];
  awayXi: SimPlayer[];
  userTeamId: Id;
  oppositionTeamId: Id;
}

function fallbackFormat(team: Team | undefined): MatchFormat {
  return team?.formats[0] ?? 'ODI';
}

/**
 * Everything `createLiveMatch` needs for one fixture. `userXiIds` lets the
 * pre-match screen override the XI the selectors would have picked.
 */
export function buildMatch(
  state: GameState,
  fixture: Fixture,
  options: { userXiIds?: Id[]; userSelected?: boolean } = {},
): MatchBuild | null {
  const homeTeamId = fixture.homeTeamId;
  const awayTeamId = fixture.awayTeamId;
  if (!homeTeamId || !awayTeamId) return null;

  const userTeamId = state.teams[homeTeamId]?.isUserTeam ? homeTeamId : awayTeamId;
  const oppositionTeamId = userTeamId === homeTeamId ? awayTeamId : homeTeamId;
  const userSelected = options.userSelected ?? true;

  const buildSide = (teamId: Id): SimPlayer[] => {
    const squad = squadFor(state, teamId);
    const isUserSide = teamId === userTeamId;
    let pool = squad;
    if (isUserSide && userSelected) {
      pool = [simFromUser(state.player, teamId, 4), ...squad];
    }
    const wanted =
      isUserSide && options.userXiIds?.length === 11
        ? options.userXiIds
        : defaultXiIds(pool, isUserSide && userSelected ? state.player.id : null);
    const byId = new Map(pool.map((p) => [p.id, p]));
    const xi = wanted.map((id) => byId.get(id)).filter((p): p is SimPlayer => Boolean(p));
    // Top up if the saved XI has gone stale.
    for (const player of pool) {
      if (xi.length >= 11) break;
      if (!xi.some((p) => p.id === player.id)) xi.push(player);
    }
    return battingOrderOf(xi.slice(0, 11));
  };

  const homeXi = buildSide(homeTeamId);
  const awayXi = buildSide(awayTeamId);
  const venue =
    (fixture.venueId ? state.venues[fixture.venueId] : null) ??
    state.venues[state.teams[homeTeamId]?.homeVenueId ?? ''] ??
    Object.values(state.venues)[0];
  const format = fixture.format ?? fallbackFormat(state.teams[homeTeamId]);

  const setup: LiveMatchSetup = {
    fixtureId: fixture.id,
    tournamentId: fixture.tournamentId ?? 'friendly',
    seasonYear: state.season.year,
    format,
    stage: fixture.stage ?? 'League',
    date: fixture.date,
    venue,
    homeTeamId,
    awayTeamId,
    homeXi,
    awayXi,
    userTeamId,
    userPlayerId: userSelected ? state.player.id : null,
    userIsCaptain: state.teams[userTeamId]?.captainId === state.player.id,
    knockout: fixture.stage === 'FINAL' || fixture.stage === 'SEMI_FINAL',
    underLights: Boolean(venue?.floodlights) && isLimitedOvers(format) && format !== 'MULTI_DAY',
    seed: deriveSeed(state.seed, saltOf(fixture.id)),
    teamNames: {
      [homeTeamId]: state.teams[homeTeamId]?.shortName ?? homeTeamId,
      [awayTeamId]: state.teams[awayTeamId]?.shortName ?? awayTeamId,
    },
    month: Number(fixture.date.slice(5, 7)),
  };

  return { setup, homeXi, awayXi, userTeamId, oppositionTeamId };
}
