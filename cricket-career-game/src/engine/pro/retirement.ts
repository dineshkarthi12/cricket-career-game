/**
 * The end. Players decline with age, pick up the same injuries again, lose
 * form and places; the board and the franchises stop picking an ageing
 * player. The player can retire from one format at a time or from all
 * cricket - it is their call (the headless simulation makes it for them).
 */
import { RETIREMENT } from '../config';
import { TOURNAMENTS_BY_ID } from '@/data/tournaments';
import { IN_SQUAD, retiredFromCompetition } from '../career/squads';
import { setInvolvement } from '../career/involvement';
import { levelOfCompetition } from '../career/eligibility';
import { message, navigate, withEvent, withInbox } from './common';
import { addStory } from './media';
import { leaveFranchise } from './ipl';
import { syncPosts } from './leadership';
import { legacyRating } from './legacy';
import { totalCaps } from './national';
import type { GameState, IntlFormat, RetirementScope } from '@/types';

export const SCOPE_LABEL: Record<RetirementScope, string> = {
  TEST: 'Test cricket',
  ODI: 'ODI cricket',
  T20I: 'T20 internationals',
  IPL: 'the IPL',
  FIRST_CLASS: 'first-class cricket',
  ALL: 'all cricket',
};

/** Scopes the player can still retire from. */
export function retirableScopes(state: GameState): RetirementScope[] {
  const gone = state.pro.retirement.retiredFrom;
  if (gone.includes('ALL')) return [];
  const caps = state.pro.national.caps;
  const out: RetirementScope[] = [];
  for (const f of ['TEST', 'ODI', 'T20I'] as IntlFormat[]) if (caps[f] > 0 && !gone.includes(f)) out.push(f);
  if ((state.pro.ipl.seasons.length > 0 || state.pro.ipl.franchiseId) && !gone.includes('IPL')) out.push('IPL');
  if (!gone.includes('FIRST_CLASS') && state.career.stages.SENIOR_STATE?.status === 'COMPLETED') out.push('FIRST_CLASS');
  out.push('ALL');
  return out;
}

/** Retire from a format (or everything). The squads for it close at once. */
export function retireFrom(state: GameState, scope: RetirementScope, date = state.season.currentDate): GameState {
  const r = state.pro.retirement;
  if (r.retiredFrom.includes(scope) || r.retiredFrom.includes('ALL')) return state;
  const retiredFrom = [...r.retiredFrom, scope];
  const all = scope === 'ALL';
  let next: GameState = {
    ...state,
    pro: { ...state.pro, retirement: { ...r, retiredFrom, retiredOn: { ...r.retiredOn, [scope]: date }, complete: all } },
  };
  // Every squad the retirement covers closes, and its fixtures go back to the AI.
  const squads = { ...next.career.squads };
  for (const [id, place] of Object.entries(squads)) {
    if (!all && !retiredFromCompetition(next, id)) continue;
    squads[id] = { ...place, status: 'NOT_SELECTED', reason: `Retired from ${SCOPE_LABEL[scope]}.`, since: date };
    next = setInvolvement({ ...next, career: { ...next.career, squads } }, id, false);
  }
  next = { ...next, career: { ...next.career, squads } };
  if ((all || scope === 'IPL') && next.pro.ipl.franchiseId) next = leaveFranchise(next, date, 'RELEASED', `Retired from ${SCOPE_LABEL[scope]}.`);
  next = syncPosts(next, date);
  if (all) {
    const stages = { ...next.career.stages };
    stages.LEGACY = { ...stages.LEGACY, status: 'COMPLETED', enteredOn: stages.LEGACY.enteredOn ?? date, completedOn: date, outcome: 'RETIRE' };
    next = {
      ...next,
      player: { ...next.player, retired: true, retiredOn: date },
      career: { ...next.career, stages, currentStageId: 'LEGACY', selectionStatus: 'NOT_IN_SETUP' },
    };
    // Nothing left on the calendar is the player's.
    const fixtures = Object.fromEntries(Object.entries(next.fixtures).map(([id, f]) => [id, !f.played && f.date >= date && f.involvesUser && f.kind === 'MATCH' ? { ...f, involvesUser: false } : f]));
    next = { ...next, fixtures };
  }
  const legacy = legacyRating(next);
  const age = next.player.age;
  const body = all
    ? `${next.player.firstName} ${next.player.lastName} retires at ${age}. Legacy: ${legacy.label} (${legacy.score}/100). ${legacy.reasons.slice(0, 2).join('; ')}.`
    : `${next.player.firstName} ${next.player.lastName} steps away from ${SCOPE_LABEL[scope]} at ${age}${scope !== 'IPL' && scope !== 'FIRST_CLASS' && totalCaps(next) ? ` after ${next.pro.national.caps[scope as IntlFormat]} caps` : ''}.`;
  next = withEvent(next, date, 'RETIREMENT', all ? 'Retired from all cricket' : `Retired from ${SCOPE_LABEL[scope]}`, body, all ? 'LEGACY' : undefined);
  next = addStory(next, date, all ? `End of an era: ${next.player.firstName} ${next.player.lastName} retires` : `${next.player.lastName || next.player.firstName} retires from ${SCOPE_LABEL[scope]}`, body, 'NEUTRAL');
  next = withInbox(next, message(date, 'SYSTEM', 'Career', all ? 'Retired from all cricket' : `Retired from ${SCOPE_LABEL[scope]}`, body, 'MILESTONE', true, [navigate('Legacy', '/legacy')]));
  const stages = { ...next.career.stages };
  if (!all && stages.LEGACY.status !== 'COMPLETED' && stages.LEGACY.status !== 'CURRENT') {
    stages.LEGACY = { ...stages.LEGACY, status: 'CURRENT', enteredOn: date };
    next = { ...next, career: { ...next.career, stages } };
  }
  return next;
}

/** Did the player play any real (non-club) cricket in a season? */
function playedSeriousCricket(matchIds: string[], state: GameState): number {
  return matchIds.map((id) => state.matches[id]).filter((m) => m?.userPerformance && levelOfCompetition(m.tournamentId) >= 7 && TOURNAMENTS_BY_ID[m.tournamentId]?.level !== 'CLUB').length;
}

/**
 * The season's end for an ageing player: the board and franchises may
 * stop picking them, and the inbox raises retirement. Nothing is forced.
 */
export function retirementReview(state: GameState, date: string): GameState {
  const r = state.pro.retirement;
  if (r.complete || state.player.age < RETIREMENT.nudgeAge) return state;
  const last = state.seasonHistory[state.seasonHistory.length - 1];
  const serious = playedSeriousCricket(last?.matchIds ?? [], state);
  let next = state;
  const overlooked = new Set(r.overlooked);
  if (state.player.age >= RETIREMENT.overlookAge) {
    for (const f of ['TEST', 'ODI', 'T20I'] as IntlFormat[]) {
      const id = f === 'TEST' ? 'intl-test' : f === 'ODI' ? 'intl-odi' : 'intl-t20i';
      const place = state.career.squads[id];
      if (state.pro.national.caps[f] > 0 && (!place || !IN_SQUAD.includes(place.status)) && !r.retiredFrom.includes(f)) overlooked.add(f);
    }
    if (!state.pro.ipl.franchiseId && state.pro.ipl.seasons.length && !r.retiredFrom.includes('IPL')) overlooked.add('IPL');
  }
  if (overlooked.size !== r.overlooked.length) {
    next = { ...next, pro: { ...next.pro, retirement: { ...next.pro.retirement, overlooked: [...overlooked] } } };
    next = withInbox(next, message(date, 'SELECTOR', 'Selectors', 'The selectors are looking to the future', `At ${state.player.age}, the ${[...overlooked].map((s) => SCOPE_LABEL[s as RetirementScope]).join(', ')} selectors have moved on to younger players. A big domestic season can still change minds - or it may be time to choose how you go.`, 'SELECTION', true, [navigate('Legacy', '/legacy')]));
  }
  if (r.nudgedSeason !== state.season.year && serious === 0) {
    next = { ...next, pro: { ...next.pro, retirement: { ...next.pro.retirement, nudgedSeason: state.season.year } } };
    next = withInbox(next, message(date, 'AGENT', 'Agent', 'Time to think about retirement?', `No senior matches last season, and you are ${state.player.age}. You can keep going in club cricket, or retire and see your legacy.`, 'MILESTONE', true, [navigate('Retirement options', '/legacy')]));
  }
  return next;
}

/**
 * How the headless simulation decides: formats first, then everything.
 * Mirrors what real players do - Tests go first for fast bowlers, white-ball
 * cricket carries on, and nobody plays club cricket at 38 for long.
 */
export function autoRetire(state: GameState, date: string): GameState {
  const r = state.pro.retirement;
  if (r.complete) return state;
  const age = state.player.age;
  const last = state.seasonHistory[state.seasonHistory.length - 1];
  const serious = playedSeriousCricket(last?.matchIds ?? [], state);
  const prior = state.seasonHistory[state.seasonHistory.length - 2];
  const seriousBefore = playedSeriousCricket(prior?.matchIds ?? [], state);
  const neverSenior = state.career.stages.SENIOR_STATE?.status !== 'COMPLETED';
  if (neverSenior && age >= RETIREMENT.amateurQuitAge && serious === 0 && seriousBefore === 0) return retireFrom(state, 'ALL', date);
  if (age >= RETIREMENT.hardStop || (age >= RETIREMENT.quitAge && serious === 0 && seriousBefore === 0) || (age >= RETIREMENT.quitAge + 3 && serious < 4)) {
    return retireFrom(state, 'ALL', date);
  }
  let next = state;
  for (const f of ['TEST', 'ODI', 'T20I'] as IntlFormat[]) {
    if (r.retiredFrom.includes(f) || state.pro.national.caps[f] === 0) continue;
    const limit = RETIREMENT.formatAge[f];
    if (age >= limit && r.overlooked.includes(f)) next = retireFrom(next, f, date);
  }
  return next;
}
