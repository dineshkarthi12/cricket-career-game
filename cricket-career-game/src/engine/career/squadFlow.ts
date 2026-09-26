/**
 * When the selectors sit: after trials and camps, at the season's selection
 * meetings, before a competition's first match for anyone still waiting on
 * a decision, every few weeks for players outside the squad, and after a run
 * of low scores for those in it.
 */
import { stageOfCompetition } from './eligibility';
import { SQUAD_SELECTION } from '../config';
import { daysBetweenDates } from '../development/dates';
import { applySquadPlace } from './involvement';
import { IN_SQUAD, decideSquad } from './squads';
import { tournamentOf } from '../tournament/live';
import { stageCompetitions } from './involvement';
import type { Fixture, GameState, SquadStatus } from '@/types';

export { stageOfCompetition } from './eligibility';

/** Does the user's side still have matches to play in it this season? */
export function hasMatchesLeft(state: GameState, tournamentId: string, after = state.season.currentDate): boolean {
  const t = tournamentOf(state, tournamentId);
  if (!t || t.complete) return false;
  return Object.values(state.fixtures).some(
    (f) => f.tournamentId === tournamentId && f.kind === 'MATCH' && !f.played && f.date >= after && (f.homeTeamId === t.userTeamId || f.awayTeamId === t.userTeamId || f.homeTeamId === null),
  );
}

export interface DecideOptions {
  date: string;
  trialBonus?: number;
  announce?: boolean;
  /** Only ever move the player up (call-ups between meetings). */
  upOnly?: boolean;
}

/** One competition's squad decision, applied. */
export function decideCompetition(state: GameState, tournamentId: string, options: DecideOptions): GameState {
  const t = tournamentOf(state, tournamentId);
  const team = t?.userTeamId ? state.teams[t.userTeamId] : undefined;
  if (!t || !team) return state;
  const current = state.career.squads[tournamentId];
  const incumbent = current ? IN_SQUAD.includes(current.status) : false;
  const decision = decideSquad(state, tournamentId, team, { incumbent, trialBonus: options.trialBonus, stageId: stageOfCompetition(tournamentId) });
  let status: SquadStatus = decision.status;
  // A player waiting on a decision who misses out stays not selected, not "dropped".
  if (status === 'DROPPED' && !incumbent) status = 'NOT_SELECTED';
  if (options.upOnly && !IN_SQUAD.includes(status)) return state;
  if (current && current.status === status && current.reason === decision.reason) return state;
  return applySquadPlace(
    state,
    { tournamentId, teamId: team.id, status, reason: decision.reason, since: options.date },
    { date: options.date, announce: options.announce ?? true, teamName: team.name },
  );
}

/** A selection meeting: every competition at the stage with matches left. */
export function selectionMeeting(state: GameState, fixture: Fixture): GameState {
  let next = state;
  const text = `${fixture.title} ${fixture.subtitle}`.toLowerCase();
  const ids = stageCompetitions(state.career.currentStageId).filter((id) => {
    if (/ranji/.test(text)) return id === 'ranji-trophy';
    if (/white-ball/.test(text)) return id === 'vijay-hazare' || id === 'syed-mushtaq-ali';
    return true;
  });
  for (const id of ids) {
    if (!hasMatchesLeft(next, id, fixture.date)) continue;
    next = decideCompetition(next, id, { date: fixture.date });
  }
  return next;
}

/** Days between reconsiderations for a player outside the squad. */
const CALL_UP_GAP = 28;

/**
 * Before a day's matches: a decision for anyone still on "trial only" when
 * their competition starts, and a fresh look at players outside the squad
 * whose side has a match that day.
 */
export function ensureDecisions(state: GameState, date: string): GameState {
  let next = state;
  for (const id of stageCompetitions(state.career.currentStageId)) {
    const t = tournamentOf(next, id);
    if (!t || t.complete) continue;
    const place = next.career.squads[id];
    const matchToday = Object.values(next.fixtures).some(
      (f) => f.tournamentId === id && f.kind === 'MATCH' && !f.played && f.date === date && (f.homeTeamId === t.userTeamId || f.awayTeamId === t.userTeamId),
    );
    if (!matchToday) continue;
    if (!place || place.status === 'TRIAL_ONLY') {
      next = decideCompetition(next, id, { date });
    } else if (!IN_SQUAD.includes(place.status) && daysBetweenDates(place.since, date) >= CALL_UP_GAP) {
      next = decideCompetition(next, id, { date, upOnly: true });
    }
  }
  return next;
}

/** A low score for a player in the squad; enough of them and the selectors look again. */
export function afterUserMatch(state: GameState, tournamentId: string, rating: number | null, date: string): GameState {
  const place = state.career.squads[tournamentId];
  if (!place || !IN_SQUAD.includes(place.status) || rating === null) return state;
  const low = rating < SQUAD_SELECTION.lowScoreRating;
  const lowScores = low ? state.career.lowScores + 1 : rating >= 6 ? 0 : state.career.lowScores;
  let next: GameState = { ...state, career: { ...state.career, lowScores } };
  if (low && lowScores >= SQUAD_SELECTION.lowScoresToDrop && hasMatchesLeft(next, tournamentId, date)) {
    next = decideCompetition(next, tournamentId, { date });
  }
  return next;
}
