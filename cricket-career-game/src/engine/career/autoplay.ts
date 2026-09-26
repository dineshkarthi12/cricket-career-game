/**
 * The player's own match, played on the fast sim: the selectors pick the XI
 * as usual, the score-only model plays it, and the result is committed like
 * any other match. Used by the headless career simulation.
 */
import { deriveSeed } from '../match/rng';
import { battingOrderOf, defaultXiIds, squadFor, xiOptionsFor } from '../match/lineup';
import { commitMatchDetailed } from '../match/commit';
import { quickMatch } from '../sim/quickMatch';
import { regionOf } from '@/data/places';
import { TOURNAMENTS_BY_ID } from '@/data/tournaments';
import { selectForFixture, userTeamOf } from './selection';
import { playAiFixture } from '../tournament/live';
import type { SimPlayer } from '../match/types';
import type { Fixture, GameState } from '@/types';

function saltOf(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function opponentXi(state: GameState, teamId: string, format: Fixture['format']): SimPlayer[] {
  const squad = squadFor(state, teamId).filter((p) => !state.teams[teamId]?.squad.find((r) => r.id === p.id)?.injuredUntil);
  const ids = defaultXiIds(squad.length >= 11 ? squad : squadFor(state, teamId), null, xiOptionsFor(state.teams[teamId], format));
  const byId = new Map(squad.map((p) => [p.id, p]));
  return battingOrderOf(ids.map((id) => byId.get(id)).filter((p): p is SimPlayer => Boolean(p)));
}

export function autoPlayFixture(state: GameState, fixture: Fixture): GameState {
  const team = userTeamOf(state, fixture);
  const selection = team ? selectForFixture(state, fixture) : null;
  if (!team || !selection || !fixture.homeTeamId || !fixture.awayTeamId) {
    // Not the player's to play after all: the AI plays it.
    const handed = { ...state, fixtures: { ...state.fixtures, [fixture.id]: { ...fixture, involvesUser: false } } };
    return fixture.homeTeamId && fixture.awayTeamId ? playAiFixture(handed, handed.fixtures[fixture.id]) : handed;
  }
  const userIsHome = fixture.homeTeamId === team.id;
  const opponentId = userIsHome ? fixture.awayTeamId : fixture.homeTeamId;
  const me = state.player.id;
  const xi = selection.xi;
  const played = xi.some((p) => p.id === me);
  const meta = TOURNAMENTS_BY_ID[fixture.tournamentId ?? ''];
  const venue = (fixture.venueId && state.venues[fixture.venueId]) || state.venues[team.homeVenueId] || Object.values(state.venues)[0];
  const result = quickMatch({
    id: `m-${fixture.id}`,
    fixtureId: fixture.id,
    tournamentId: fixture.tournamentId ?? 'friendly',
    seasonYear: state.season.year,
    format: fixture.format ?? meta?.format ?? 'ONE_DAY',
    stage: fixture.stage ?? 'GROUP',
    date: fixture.date,
    days: meta?.matchDays ?? 1,
    venue,
    homeTeamId: fixture.homeTeamId,
    awayTeamId: fixture.awayTeamId,
    homeXi: userIsHome ? xi : opponentXi(state, opponentId, fixture.format),
    awayXi: userIsHome ? opponentXi(state, opponentId, fixture.format) : xi,
    userPlayerId: played ? me : null,
    userIsHome,
    seed: deriveSeed(state.seed, saltOf(`user-${fixture.id}`)),
    region: regionOf(venue?.state),
  });
  return commitMatchDetailed(state, result.match, {
    userPlayed: played,
    selection: { status: selection.status, reasons: selection.reasons },
    teammateIds: xi.map((p) => p.id),
  }).state;
}
