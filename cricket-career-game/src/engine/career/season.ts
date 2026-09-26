/**
 * The end of a season: how it went against the targets, what the selectors
 * make of it, and where the player starts next season. Promote, stay, bench,
 * dropped, comeback, fast-track - or, for an age-group player who has run out
 * of time at a level, moving on without it. Nothing is automatic.
 */
import { SEASON_REVIEW, TRIALS } from '../config';
import { CAREER_STAGES, getStage } from '@/data/stages';
import { STAGE_TARGETS, describeTarget } from '@/data/stageTargets';
import { TOURNAMENTS_BY_ID } from '@/data/tournaments';
import { createRng, deriveSeed } from '../match/rng';
import { computeOverall } from '../ratings';
import { newId } from '../id';
import { eligibleForStage } from './eligibility';
import { CLUB_COMPETITION, SENIOR_COMPETITIONS, extraCompetitions, isSeniorStage, stageCompetitions } from './involvement';
import { IN_SQUAD, STATUS_LABEL, userSeasonStats } from './squads';
import { ageOutStage, evaluateTargets, nextStageFor } from './targets';
import type {
  CareerStageId,
  CareerStageProgress,
  GameState,
  InboxMessage,
  PathEntry,
  SeasonOutcome,
  SeasonReview,
  SquadPlace,
  SquadStatus,
} from '@/types';

/** The senior stages that are completed by establishing a place in one format. */
export const ESTABLISH_STAGES: { stageId: CareerStageId; tournamentId: string }[] = [
  { stageId: 'RANJI_TROPHY', tournamentId: 'ranji-trophy' },
  { stageId: 'VIJAY_HAZARE', tournamentId: 'vijay-hazare' },
  { stageId: 'SYED_MUSHTAQ_ALI', tournamentId: 'syed-mushtaq-ali' },
];

export interface SeasonVerdict {
  review: SeasonReview;
  /** The stage the player starts next season at. */
  nextStageId: CareerStageId;
  /** Stages passed over on the way (fast-track or ageing out). */
  skipped: CareerStageId[];
  /** Stages completed this season. */
  completed: CareerStageId[];
  /** Squad places for next season, before the calendar gives them teams. */
  squads: Record<string, SquadPlace>;
  /** Was the player in a squad at their stage (and so "reached" it)? */
  reached: boolean;
}

function place(tournamentId: string, status: SquadStatus, reason: string, since: string): SquadPlace {
  return { tournamentId, teamId: '', status, reason, since };
}

function stageBar(stageId: CareerStageId): number {
  return TRIALS.stageBar[getStage(stageId).order] ?? 70;
}

/** Squad places at the start of a season at a stage. */
export function openingSquads(
  stageId: CareerStageId,
  since: string,
  carry: Record<string, SquadStatus>,
  fresh: { status: SquadStatus; reason: string } | null,
): Record<string, SquadPlace> {
  const out: Record<string, SquadPlace> = {};
  const stage = getStage(stageId);
  for (const id of stageCompetitions(stageId)) {
    const name = TOURNAMENTS_BY_ID[id]?.name ?? id;
    if (stage.order === 1) {
      out[id] = place(id, 'SQUAD', 'Every beginner plays for the school and the club.', since);
    } else if (fresh) {
      out[id] = place(id, fresh.status, fresh.reason.replace('{name}', name), since);
    } else if (carry[id] && IN_SQUAD.includes(carry[id])) {
      out[id] = place(id, 'SQUAD', `Retained in the ${name} squad from last season.`, since);
    } else if (carry[id] === 'DROPPED') {
      out[id] = place(id, 'DROPPED', `Out of the ${name} squad after being dropped last season; runs and wickets will bring you back.`, since);
    } else {
      out[id] = place(id, 'TRIAL_ONLY', `Invited to the ${name} trials.`, since);
    }
  }
  for (const id of extraCompetitions(stageId)) {
    out[id] =
      id === CLUB_COMPETITION
        ? place(id, 'SQUAD', 'Club cricket, whenever there is no squad to play for.', since)
        : place(id, 'SQUAD', 'India U-19 players are picked for their state as well.', since);
  }
  return out;
}

/** Which competitions' fixtures are the player's own at the start of a season. */
export function involvementFor(stageId: CareerStageId, squads: Record<string, SquadPlace>): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  const stageIds = stageCompetitions(stageId);
  let anyIn = false;
  for (const id of stageIds) {
    const status = squads[id]?.status;
    const inIt = status ? IN_SQUAD.includes(status) : true;
    out[id] = inIt;
    anyIn = anyIn || inIt;
  }
  // Juniors play club cricket alongside; seniors only when there is no squad for them.
  const junior = getStage(stageId).order <= 6;
  for (const id of extraCompetitions(stageId)) out[id] = id === CLUB_COMPETITION ? junior || !anyIn : true;
  return out;
}

function reviewLabel(outcome: SeasonOutcome): string {
  return {
    PROMOTE: 'Promoted',
    STAY: 'Staying put',
    BENCH: 'Mostly on the bench',
    DROPPED: 'Dropped',
    COMEBACK: 'Comeback',
    FAST_TRACK: 'Fast-tracked',
    AGED_OUT: 'Aged out',
  }[outcome];
}

/** The season's verdict. Pure; seeded by the save. */
export function reviewSeason(state: GameState): SeasonVerdict {
  const stageId = state.career.currentStageId;
  const stage = getStage(stageId);
  const year = state.season.year;
  const nextYear = year + 1;
  const nextStart = `${nextYear}-06-01`;
  const dob = state.player.dateOfBirth;
  const rng = createRng(deriveSeed(state.seed, 0x5ea5 + year * 7));
  const overall = computeOverall(state.player.attributes, state.player.role);
  const progress = evaluateTargets(state, stageId);
  const comps = stageCompetitions(stageId);
  const places = comps.map((id) => state.career.squads[id]).filter((p): p is SquadPlace => Boolean(p));
  const inSquad = places.some((p) => IN_SQUAD.includes(p.status));
  const stageStats = userSeasonStats(state, comps);
  const reached = stage.order === 1 || stageStats.matches > 0 || inSquad;
  const since = state.season.startDate;
  const events = state.career.events.filter((e) => e.date >= since);
  const droppedThisSeason = events.some((e) => e.kind === 'DROPPED');
  const comeback = events.some((e) => e.kind === 'SELECTION' && e.title.startsWith('Comeback'));
  const trial = (state.career.trials ?? []).find((t) => t.seasonYear === year && t.purpose === 'NEXT_LEVEL');
  const trust = state.player.condition.selectorTrust;
  const reasons: string[] = [];
  const completed: CareerStageId[] = [];
  const skipped: CareerStageId[] = [];

  // How much of their side's cricket the player actually played.
  const sideMatches = comps
    .map((id) => state.season.tournaments.find((t) => t.tournamentId === id && t.seasonYear === year))
    .reduce((sum, t) => {
      if (!t || !t.userTeamId) return sum;
      return sum + Object.values(t.results).filter((r) => r.homeTeamId === t.userTeamId || r.awayTeamId === t.userTeamId).length;
    }, 0);
  const benched = inSquad && sideMatches > 0 && stageStats.matches / sideMatches < SEASON_REVIEW.benchShare;

  const carry: Record<string, SquadStatus> = Object.fromEntries(places.map((p) => [p.tournamentId, p.status]));
  let outcome: SeasonOutcome;
  let nextStageId: CareerStageId = stageId;
  let fresh: { status: SquadStatus; reason: string } | null = null;

  const stayOutcome = (): SeasonOutcome => {
    if (comeback && inSquad) return 'COMEBACK';
    if (droppedThisSeason && !inSquad) return 'DROPPED';
    if (benched) return 'BENCH';
    return 'STAY';
  };

  if (isSeniorStage(stageId) && stage.order >= 8) {
    // Established in a format completes its stage.
    for (const { stageId: sid, tournamentId } of ESTABLISH_STAGES) {
      if (state.career.stages[sid]?.status === 'COMPLETED') continue;
      const p = evaluateTargets(state, sid);
      if (p.met) {
        completed.push(sid);
        reasons.push(`Established in the ${TOURNAMENTS_BY_ID[tournamentId]?.name}: ${p.stats.runs} runs, ${p.stats.wickets} wickets in ${p.stats.matches} matches.`);
      }
    }
    const done = new Set([...completed, ...ESTABLISH_STAGES.map((e) => e.stageId).filter((sid) => state.career.stages[sid]?.status === 'COMPLETED')]);
    nextStageId = ESTABLISH_STAGES.find((e) => !done.has(e.stageId))?.stageId ?? 'IPL_SCOUTING';
    outcome = completed.length ? 'PROMOTE' : stayOutcome();
  } else if (isSeniorStage(stageId)) {
    // Stage 7 is completed by a debut, during the season.
    outcome = stayOutcome();
    if (!inSquad) reasons.push('Still waiting for a senior squad place: club runs and wickets keep the selectors interested.');
  } else {
    const next = nextStageFor(stageId, dob, nextYear);
    const eligibleStay = eligibleForStage(dob, nextYear, stageId);
    let chance = 0;
    if (next) {
      const base = progress.met ? SEASON_REVIEW.metChance : progress.ratio >= SEASON_REVIEW.nearRatio ? SEASON_REVIEW.nearChance : 0;
      if (base > 0) {
        chance =
          base +
          (trial?.bonus ?? 0) * SEASON_REVIEW.trialPerPoint +
          (trust - 50) * SEASON_REVIEW.trustPerPoint +
          (overall - stageBar(next)) * SEASON_REVIEW.abilityPerPoint +
          (progress.fitness === 'FAILED' ? SEASON_REVIEW.failedFitness : 0) +
          (!reached ? SEASON_REVIEW.notInSquad : 0);
        chance = Math.max(SEASON_REVIEW.minChance, Math.min(SEASON_REVIEW.maxChance, chance));
      }
    }
    const roll = rng.next();
    const fastRoll = rng.next();
    if (next && progress.met && progress.ratio >= SEASON_REVIEW.fastTrackRatio && overall >= stageBar(next) + SEASON_REVIEW.fastTrackEdge && fastRoll < SEASON_REVIEW.fastTrackChance) {
      outcome = 'FAST_TRACK';
      const leap = stage.fastTrackStageIds.find((id) => eligibleForStage(dob, nextYear, id) && getStage(id).order <= 7);
      if (progress.ratio >= SEASON_REVIEW.skipRatio && leap && overall >= stageBar(leap)) {
        nextStageId = leap;
        for (const s of CAREER_STAGES) if (s.order > stage.order && s.order < getStage(leap).order) skipped.push(s.id);
        fresh = { status: 'PROBABLES', reason: 'Straight into the {name} probables after an exceptional season - a level skipped.' };
      } else {
        nextStageId = next;
        fresh = { status: 'FAST_TRACK', reason: 'Fast-tracked into the {name} squad after an outstanding season - no trial needed.' };
      }
      completed.push(stageId);
      reasons.push(`${Math.round(progress.ratio * 100)}% of the target - the selectors could not ignore it.`);
    } else if (next && roll < chance) {
      outcome = 'PROMOTE';
      nextStageId = next;
      completed.push(stageId);
      fresh = { status: 'TRIAL_ONLY', reason: 'Promoted: invited to the {name} trials.' };
      reasons.push(progress.met ? 'Targets met - the selectors want a closer look at the next level.' : 'Just short of the target, but the selectors took a chance.');
    } else if (!eligibleStay) {
      outcome = 'AGED_OUT';
      nextStageId = ageOutStage(stageId, dob, nextYear);
      if (reached) completed.push(stageId);
      else skipped.push(stageId);
      for (const s of CAREER_STAGES) if (s.order > stage.order && s.order < getStage(nextStageId).order) skipped.push(s.id);
      fresh = { status: 'TRIAL_ONLY', reason: 'Too old for the last level - trials for the {name} instead.' };
      reasons.push(`Over the age limit for ${stage.name} next season - moving on${reached ? '' : ' without it'}.`);
    } else {
      outcome = stayOutcome();
      if (next && chance > 0) reasons.push(`Close, but the selectors went with others this time (${Math.round(chance * 100)}% chance).`);
      else if (next) reasons.push(`${Math.round(progress.ratio * 100)}% of the target for ${STAGE_TARGETS[stageId]?.step ?? 'the next step'}.`);
    }
  }

  if (droppedThisSeason) reasons.push('Dropped during the season.');
  if (comeback) reasons.push('Fought back into the side after being dropped.');
  if (benched) reasons.push(`Played ${stageStats.matches} of the side's ${sideMatches} matches.`);
  if (progress.fitness === 'FAILED') reasons.push('Failed the fitness test - it counted against you.');
  if (trial) reasons.push(`${trial.title}: ${trial.verdict}`);

  const nextSquads = openingSquads(nextStageId, nextStart, nextStageId === stageId ? carry : {}, nextStageId === stageId ? null : fresh);
  const stats = userSeasonStats(state, null);
  const history = state.player.development.overallHistory ?? [];
  const startOverall = history.find((h) => h.date >= since)?.overall ?? overall;
  const nextTarget = STAGE_TARGETS[nextStageId];
  const awards = [...new Set(state.season.summary.awards ?? [])];
  const headline =
    outcome === 'PROMOTE'
      ? nextStageId === stageId || completed.some((c) => ESTABLISH_STAGES.some((e) => e.stageId === c))
        ? `Established: ${completed.map((c) => getStage(c).shortLabel).join(', ')}`
        : `Promoted to ${getStage(nextStageId).name}`
      : outcome === 'FAST_TRACK'
        ? `Fast-tracked to ${getStage(nextStageId).name}`
        : outcome === 'AGED_OUT'
          ? `Moving on to ${getStage(nextStageId).name}`
          : `${reviewLabel(outcome)} at ${stage.name}`;
  const coachReport =
    stats.matches === 0
      ? 'No matches this season. Training alone will not get you picked - get into a side.'
      : stats.averageRating >= 6.5
        ? 'A season to be proud of. Keep the standards this high and the next level will come.'
        : stats.averageRating >= 5.5
          ? 'Solid, with flashes. The difference now is consistency - turn the starts into big scores.'
          : 'A tough season. Go back to basics in the nets and trust the work.';
  const review: SeasonReview = {
    seasonYear: year,
    label: state.season.label,
    stageId,
    nextStageId,
    outcome,
    headline,
    reasons,
    stats,
    targets: progress.checks,
    awards,
    coachReport,
    goals: nextTarget ? [describeTarget(nextTarget)] : [],
    squads: places,
    overall: [startOverall, overall],
    age: state.player.age,
  };
  return { review, nextStageId, skipped, completed, squads: nextSquads, reached };
}

/** Write the verdict into the career: stages, path, events, reviews, next season's squads. */
export function applyVerdict(state: GameState, verdict: SeasonVerdict): GameState {
  const { review } = verdict;
  const stageId = state.career.currentStageId;
  const date = state.season.endDate;
  const nextStart = `${review.seasonYear + 1}-06-01`;
  const stages = { ...state.career.stages };
  const touch = (id: CareerStageId, patch: Partial<CareerStageProgress>) => {
    stages[id] = { ...stages[id], ...patch };
  };
  const current = stages[stageId];
  touch(stageId, {
    seasonsSpent: current.seasonsSpent + 1,
    outcome: review.outcome === 'COMEBACK' || review.outcome === 'AGED_OUT' ? 'STAY' : review.outcome,
  });
  for (const id of verdict.completed) touch(id, { status: 'COMPLETED', completedOn: date, outcome: review.outcome === 'FAST_TRACK' ? 'FAST_TRACK' : 'PROMOTE' });
  for (const id of verdict.skipped) if (stages[id].status !== 'COMPLETED') touch(id, { status: 'SKIPPED', completedOn: date });
  if (verdict.nextStageId !== stageId) {
    if (stages[stageId].status === 'CURRENT') touch(stageId, { status: 'COMPLETED', completedOn: date });
    touch(verdict.nextStageId, { status: 'CURRENT', enteredOn: nextStart });
  }

  const places = stageCompetitions(stageId).map((id) => state.career.squads[id]).filter((p): p is SquadPlace => Boolean(p));
  const best = places.find((p) => IN_SQUAD.includes(p.status)) ?? places[0];
  const team = best?.teamId ? state.teams[best.teamId] : undefined;
  const pathEntry: PathEntry = {
    seasonYear: review.seasonYear,
    stageId,
    teamName: team?.name ?? state.teams[state.player.currentTeamIds[0]]?.name ?? '',
    status: getStage(stageId).order === 1 ? 'PLAYED' : best?.status ?? 'NOT_SELECTED',
    outcome: review.outcome,
    note: review.headline,
  };

  const kind = review.outcome === 'PROMOTE' || review.outcome === 'FAST_TRACK' ? 'PROMOTION' : review.outcome === 'DROPPED' ? 'DROPPED' : 'MILESTONE';
  const msg: InboxMessage = {
    id: newId('msg'),
    date: nextStart,
    sender: 'SELECTOR',
    senderName: 'Selectors',
    subject: `Season review ${review.label}: ${review.headline}`,
    body: `${review.reasons.join(' ')} ${review.goals[0] ? `Next: ${review.goals[0]}.` : ''}`.trim(),
    category: 'SELECTION',
    read: false,
    important: true,
    actions: [{ id: 'open-review', label: 'Open season review', kind: 'NAVIGATE', route: '/season-review', taken: false }],
    relatedId: null,
  };
  const comebacks = review.outcome === 'COMEBACK' && !state.career.events.some((e) => e.date >= state.season.startDate && e.title.startsWith('Comeback')) ? 1 : 0;

  return {
    ...state,
    career: {
      ...state.career,
      currentStageId: verdict.nextStageId,
      stages,
      squads: verdict.squads,
      path: [...state.career.path, pathEntry],
      seasonReviews: [...state.career.seasonReviews, review].slice(-30),
      pendingReview: review,
      lowScores: 0,
      comebacks: state.career.comebacks + comebacks,
      selectionStatus: statusFromSquads(verdict.nextStageId, verdict.squads),
      events: [
        ...state.career.events,
        { id: newId('evt'), date, stageId, kind, title: review.headline, detail: review.reasons[0] ?? STATUS_LABEL[best?.status ?? 'NOT_SELECTED'] },
      ],
    },
    inbox: [msg, ...state.inbox].slice(0, 80),
  };
}

function statusFromSquads(stageId: CareerStageId, squads: Record<string, SquadPlace>): GameState['career']['selectionStatus'] {
  const statuses = stageCompetitions(stageId).map((id) => squads[id]?.status).filter(Boolean) as SquadStatus[];
  if (statuses.some((s) => IN_SQUAD.includes(s))) return 'SQUAD';
  if (statuses.includes('DROPPED')) return 'DROPPED';
  if (statuses.includes('TRIAL_ONLY')) return 'TRIALIST';
  return 'NOT_IN_SETUP';
}

/** A senior debut completes stage 7 on the spot. */
export function seniorDebut(state: GameState, tournamentId: string, date: string): GameState {
  if (state.career.currentStageId !== 'SENIOR_STATE' || !SENIOR_COMPETITIONS.includes(tournamentId)) return state;
  const stages = { ...state.career.stages };
  stages.SENIOR_STATE = { ...stages.SENIOR_STATE, status: 'COMPLETED', completedOn: date, outcome: 'PROMOTE' };
  stages.RANJI_TROPHY = { ...stages.RANJI_TROPHY, status: 'CURRENT', enteredOn: date };
  const name = TOURNAMENTS_BY_ID[tournamentId]?.name ?? tournamentId;
  return {
    ...state,
    career: {
      ...state.career,
      currentStageId: 'RANJI_TROPHY',
      stages,
      events: [...state.career.events, { id: newId('evt'), date, stageId: 'SENIOR_STATE', kind: 'DEBUT', title: 'Senior debut', detail: `First senior match for the state, in the ${name}.` }],
    },
    inbox: [
      {
        id: newId('msg'),
        date,
        sender: 'MEDIA' as const,
        senderName: 'Press',
        subject: `Senior debut in the ${name}`,
        body: 'A senior state cap. Now the work is to make the place your own - in the Ranji Trophy, the Vijay Hazare and the Mushtaq Ali.',
        category: 'MILESTONE' as const,
        read: false,
        important: true,
        actions: [],
        relatedId: null,
      },
      ...state.inbox,
    ].slice(0, 80),
  };
}
