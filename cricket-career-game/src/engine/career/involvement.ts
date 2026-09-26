/**
 * Which competitions the player is actually playing in. A squad place makes
 * the side's fixtures the player's own; losing it hands them back to the AI.
 * Club cricket fills the gap whenever the player is in no squad at their
 * level, and when two of their matches clash the bigger one wins.
 */
import { getStage } from '@/data/stages';
import { TOURNAMENTS_BY_ID } from '@/data/tournaments';
import { newId } from '../id';
import { IN_SQUAD, STATUS_LABEL } from './squads';
import { PRO_LEVEL, eligibleForStage } from './eligibility';
import type { CareerStageId, GameState, InboxMessage, SelectionStatus, SquadPlace, SquadStatus } from '@/types';

export const SENIOR_COMPETITIONS = ['ranji-trophy', 'vijay-hazare', 'syed-mushtaq-ali'];
export const CLUB_COMPETITION = 'club-league';

/** Stages 7 onwards play senior state cricket (India players too, when free). */
export function isSeniorStage(stageId: CareerStageId): boolean {
  return getStage(stageId).order >= 7;
}

/** The competitions whose squads the selectors pick at a stage. */
export function stageCompetitions(stageId: CareerStageId): string[] {
  if (isSeniorStage(stageId)) return SENIOR_COMPETITIONS;
  return getStage(stageId).tournamentIds;
}

/**
 * Competitions played on top of the stage's own: club cricket as the
 * fallback from stage 2 on, the state U-19 competitions for an India U-19
 * player, and U-23 cricket for a senior probable still young enough for it.
 */
export function extraCompetitions(stageId: CareerStageId, ctx?: { dob: string; seasonYear: number }): string[] {
  const order = getStage(stageId).order;
  const extras: string[] = [];
  if (stageId === 'INDIA_U19') extras.push('vinoo-mankad', 'cooch-behar');
  if (stageId === 'SENIOR_STATE' && ctx && eligibleForStage(ctx.dob, ctx.seasonYear, 'U23_EMERGING')) extras.push('ck-nayudu', 'u23-state-a');
  if (order >= 2) extras.push(CLUB_COMPETITION);
  return extras;
}

/** Bigger competitions win clashes. */
function priority(tournamentId: string | null): number {
  if (!tournamentId) return 0;
  // Internationals first, then the IPL, India A, the zones, then the state.
  const pro = PRO_LEVEL[tournamentId];
  if (pro) return 10 + pro * 2 - (tournamentId === 'ipl' ? 3 : 0);
  if (tournamentId === CLUB_COMPETITION) return 1;
  if (tournamentId === 'school-league') return 2;
  if (tournamentId.startsWith('u19-')) return 5;
  if (SENIOR_COMPETITIONS.includes(tournamentId)) return 4;
  return 3;
}

/** Is the player in a squad for any of the stage's competitions? */
export function inAnyStageSquad(state: GameState, stageId: CareerStageId = state.career.currentStageId): boolean {
  return stageCompetitions(stageId).some((id) => {
    const place = state.career.squads[id];
    return place ? IN_SQUAD.includes(place.status) : false;
  });
}

/**
 * Make the user's side's remaining fixtures in a competition theirs (or
 * not). Travel and recovery days for matches they no longer play go too.
 */
export function setInvolvement(state: GameState, tournamentId: string, involved: boolean): GameState {
  const t = state.season.tournaments.find((x) => x.tournamentId === tournamentId && x.seasonYear === state.season.year);
  if (!t) return state;
  const today = state.season.currentDate;
  const fixtures = { ...state.fixtures };
  let changed = false;
  for (const f of Object.values(state.fixtures)) {
    if (f.tournamentId !== tournamentId || f.kind !== 'MATCH' || f.played || f.date <= today) continue;
    const users = f.homeTeamId === t.userTeamId || f.awayTeamId === t.userTeamId;
    // Knockout ties without sides yet stay as they are; they are filled later.
    if (!users || f.involvesUser === involved) continue;
    fixtures[f.id] = { ...f, involvesUser: involved };
    changed = true;
    if (!involved) {
      for (const suffix of ['-travel', '-rest']) {
        const side = fixtures[f.id + suffix];
        if (side && !side.played) fixtures[f.id + suffix] = { ...side, played: true };
      }
    }
  }
  return changed ? { ...state, fixtures } : state;
}

/** When two of the player's matches overlap, the smaller competition plays without them. */
export function resolveClashes(state: GameState): GameState {
  const today = state.season.currentDate;
  const mine = Object.values(state.fixtures)
    .filter((f) => f.kind === 'MATCH' && f.involvesUser && !f.played && f.date > today)
    .sort((a, b) => priority(b.tournamentId) - priority(a.tournamentId) || a.date.localeCompare(b.date));
  const kept: { start: string; end: string }[] = [];
  let fixtures = state.fixtures;
  for (const f of mine) {
    const clash = kept.some((k) => f.date <= k.end && k.start <= f.endDate);
    if (clash) {
      if (fixtures === state.fixtures) fixtures = { ...state.fixtures };
      fixtures[f.id] = { ...f, involvesUser: false };
      continue;
    }
    kept.push({ start: f.date, end: f.endDate });
  }
  return fixtures === state.fixtures ? state : { ...state, fixtures };
}

/** The old single selection status, for the screens that still show one. */
function summaryStatus(state: GameState): SelectionStatus {
  if (state.player.condition.injury) return 'INJURED_OUT';
  const places = stageCompetitions(state.career.currentStageId)
    .map((id) => state.career.squads[id])
    .filter((p): p is SquadPlace => Boolean(p));
  const has = (s: SquadStatus) => places.some((p) => p.status === s);
  if (places.some((p) => IN_SQUAD.includes(p.status))) return 'SQUAD';
  if (has('RESERVE')) return 'RESERVE';
  if (has('DROPPED')) return 'DROPPED';
  if (has('TRIAL_ONLY')) return 'TRIALIST';
  return 'NOT_IN_SETUP';
}

/** Club cricket is on whenever there is no squad at the player's level. */
export function syncClubFallback(state: GameState): GameState {
  const stage = getStage(state.career.currentStageId);
  if (stage.order < 2 || !state.season.tournaments.some((t) => t.tournamentId === CLUB_COMPETITION && t.seasonYear === state.season.year)) {
    return state;
  }
  // Juniors play club cricket alongside their age-group side; seniors only without a squad.
  const playClub = stage.order <= 6 || !inAnyStageSquad(state);
  return resolveClashes(setInvolvement(state, CLUB_COMPETITION, playClub));
}

export interface PlaceOptions {
  date: string;
  /** Send a squad announcement to the inbox. */
  announce?: boolean;
  teamName?: string;
}

/** Record a squad decision: the place, the fixtures, club cricket and the news. */
export function applySquadPlace(state: GameState, place: SquadPlace, options: PlaceOptions): GameState {
  const before = state.career.squads[place.tournamentId];
  const wasIn = before ? IN_SQUAD.includes(before.status) : false;
  const nowIn = IN_SQUAD.includes(place.status);
  const dropped = place.status === 'DROPPED' && before?.status !== 'DROPPED';
  const lowScores = wasIn !== nowIn ? 0 : state.career.lowScores;
  let next: GameState = {
    ...state,
    career: {
      ...state.career,
      squads: { ...state.career.squads, [place.tournamentId]: place },
      drops: state.career.drops + (dropped ? 1 : 0),
      comebacks: state.career.comebacks + (before?.status === 'DROPPED' && nowIn ? 1 : 0),
      lowScores,
    },
  };
  next = setInvolvement(next, place.tournamentId, nowIn);
  next = syncClubFallback(resolveClashes(next));
  next = { ...next, career: { ...next.career, selectionStatus: summaryStatus(next) } };

  const changed = !before || before.status !== place.status;
  if (options.announce && changed) {
    const name = TOURNAMENTS_BY_ID[place.tournamentId]?.name ?? place.tournamentId;
    const good = nowIn;
    const msg: InboxMessage = {
      id: newId('msg'),
      date: options.date,
      sender: 'SELECTOR',
      senderName: 'Selectors',
      subject: `Squad announced: ${options.teamName ? `${options.teamName}, ` : ''}${name} - ${STATUS_LABEL[place.status].toLowerCase()}`,
      body: place.reason,
      category: 'SELECTION',
      read: false,
      important: good || place.status === 'DROPPED',
      actions: [],
      relatedId: place.tournamentId,
    };
    next = { ...next, inbox: [msg, ...next.inbox].slice(0, 80) };
  }
  if (dropped) {
    next = {
      ...next,
      career: {
        ...next.career,
        events: [
          ...next.career.events,
          { id: newId('evt'), date: options.date, stageId: next.career.currentStageId, kind: 'DROPPED', title: `Dropped: ${TOURNAMENTS_BY_ID[place.tournamentId]?.shortName ?? place.tournamentId}`, detail: place.reason },
        ],
      },
    };
  } else if (!wasIn && nowIn && before) {
    next = {
      ...next,
      career: {
        ...next.career,
        events: [
          ...next.career.events,
          { id: newId('evt'), date: options.date, stageId: next.career.currentStageId, kind: 'SELECTION', title: `${before.status === 'DROPPED' ? 'Comeback' : 'Selected'}: ${TOURNAMENTS_BY_ID[place.tournamentId]?.shortName ?? place.tournamentId}`, detail: place.reason },
        ],
      },
    };
  }
  return next;
}
