/**
 * Trials and selection camps, played: a nets session (the player chooses how
 * to go about it), a fitness test (steady or all-out) and a practice match on
 * the fast sim. The day is worth a bonus of -10 to +10 with the selectors.
 * A squad trial decides this season's squads there and then; an end-of-season
 * trial for the next level feeds the season review.
 */
import { AUCTION, FITNESS_TEST, TRIALS } from '../config';
import { createRng, deriveSeed } from '../match/rng';
import { battingOrderOf, defaultXiIds, simFromUser, squadFor } from '../match/lineup';
import { quickMatch } from '../sim/quickMatch';
import { computeOverall } from '../ratings';
import { runFitnessTest } from '../development';
import { regionOf } from '@/data/places';
import { getStage } from '@/data/stages';
import { newId } from '../id';
import { IN_SQUAD, roleGroup } from './squads';
import { stageCompetitions } from './involvement';
import { decideCompetition, hasMatchesLeft } from './squadFlow';
import { evaluateTargets, nextStageFor } from './targets';
import { tournamentOf } from '../tournament/live';
import { proActive } from '../pro/season';
import { keenest } from '../pro/ipl';
import { applyCamp, campInvite } from '../pro/national';
import { nationTeamId } from '@/data/nations';
import type { SimPlayer } from '../match/types';
import type { CareerStageId, FitnessEffort, Fixture, GameState, InboxMessage, NetsApproach, Team, TrialRecord } from '@/types';

export interface TrialPlan {
  fixtureId: string;
  title: string;
  date: string;
  purpose: TrialRecord['purpose'];
  /** The side whose standard the trial is judged against (pro trials). */
  teamId?: string;
  /** The practice match format. */
  format?: 'ONE_DAY' | 'T20';
  /** The stage whose selectors are watching. */
  stageId: CareerStageId;
  /** Squads decided on the day (squad trials). */
  tournamentIds: string[];
  /** End-of-season trials are by invitation. */
  invited: boolean;
  note: string;
}

function saltOf(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const month = (date: string) => Number(date.slice(5, 7));

/** Is this event a trial the player takes part in, and for what? */
export function trialFor(state: GameState, fixture: Fixture): TrialPlan | null {
  if (fixture.kind !== 'TRIAL' && fixture.kind !== 'SELECTION_CAMP') return null;
  if (fixture.id.includes('-pro-')) return proTrialFor(state, fixture);
  const stageId = state.career.currentStageId;
  const late = [3, 4, 5].includes(month(fixture.date));
  if (late && fixture.kind === 'TRIAL') {
    const next = nextStageFor(stageId, state.player.dateOfBirth, state.season.year + 1);
    if (!next) return null;
    const progress = evaluateTargets(state, stageId);
    const invited = progress.ratio >= TRIALS.inviteRatio;
    return {
      fixtureId: fixture.id,
      title: fixture.title,
      date: fixture.date,
      purpose: 'NEXT_LEVEL',
      stageId: next,
      tournamentIds: [],
      invited,
      note: invited
        ? `Invited on the strength of the season (${Math.round(progress.ratio * 100)}% of the target).`
        : `Not invited: the season is at ${Math.round(progress.ratio * 100)}% of the target the selectors look for.`,
    };
  }
  const waiting = stageCompetitions(stageId).filter((id) => {
    const place = state.career.squads[id];
    return tournamentOf(state, id) && (!place || !IN_SQUAD.includes(place.status)) && hasMatchesLeft(state, id, fixture.date);
  });
  if (waiting.length === 0) return null;
  return { fixtureId: fixture.id, title: fixture.title, date: fixture.date, purpose: 'SQUAD', stageId, tournamentIds: waiting, invited: true, note: 'Squad places are decided today.' };
}

/** Franchise trials (IPL scouts) and the India camp (national selectors). */
function proTrialFor(state: GameState, fixture: Fixture): TrialPlan | null {
  if (!proActive(state)) return null;
  const base = { fixtureId: fixture.id, title: fixture.title, date: fixture.date, tournamentIds: [] as string[] };
  if (fixture.id.endsWith('-pro-trials')) {
    if (state.pro.ipl.franchiseId || state.pro.retirement.retiredFrom.includes('IPL')) return null;
    const f = keenest(state);
    const interest = f ? (state.pro.scouting.interest[f.id] ?? 0) : 0;
    const invited = Boolean(f) && Math.max(interest, state.pro.scouting.reputation) >= AUCTION.trialAt;
    return {
      ...base,
      purpose: 'FRANCHISE',
      stageId: 'IPL_SCOUTING',
      teamId: f?.id,
      format: 'T20',
      invited,
      note: invited ? `${f?.name} have invited you to their trials (interest ${interest}).` : `No franchise trial invitation: scouting reputation ${Math.round(state.pro.scouting.reputation)} (${AUCTION.trialAt} gets you in the door).`,
    };
  }
  if (fixture.id.endsWith('-pro-camp')) {
    const invite = campInvite(state);
    return { ...base, purpose: 'NATIONAL_CAMP', stageId: 'INDIA_SENIOR_CAMP', teamId: nationTeamId('India'), format: 'ONE_DAY', invited: invite.invited, note: invite.note };
  }
  return null;
}

/** The side the selectors are picking, for the level bar and the practice match. */
function trialTeam(state: GameState, plan: TrialPlan): Team | null {
  if (plan.teamId && state.teams[plan.teamId]?.squad.length) return state.teams[plan.teamId];
  for (const id of plan.tournamentIds) {
    const t = tournamentOf(state, id);
    if (t?.userTeamId && state.teams[t.userTeamId]) return state.teams[t.userTeamId];
  }
  const own = state.player.currentTeamIds.map((id) => state.teams[id]).find((t) => t && t.squad.length >= 11);
  return own ?? null;
}

/** The overall the selectors think the level needs, from the peers in the player's role. */
function levelBar(state: GameState, plan: TrialPlan, team: Team | null): number {
  const group = roleGroup(state.player.role);
  const peers = (team?.squad ?? []).filter((p) => roleGroup(p.role) === group).map((p) => p.overall).sort((a, b) => b - a);
  const fromSquad = peers.length ? peers[Math.min(peers.length - 1, 1)] : null;
  const step = plan.purpose === 'NEXT_LEVEL' ? TRIALS.nextLevelStep : 0;
  return (fromSquad ?? TRIALS.stageBar[getStage(plan.stageId).order] ?? 60) + step;
}

export interface NetsResult {
  approach: NetsApproach;
  score: number;
  note: string;
}

const APPROACH: Record<NetsApproach, { mean: number; spread: number }> = {
  SOLID: { mean: 0, spread: 0.8 },
  POSITIVE: { mean: 0.3, spread: 1.3 },
  SHOWY: { mean: 0.1, spread: 2.3 },
};

export function runNets(state: GameState, plan: TrialPlan, approach: NetsApproach): NetsResult {
  const team = trialTeam(state, plan);
  const overall = computeOverall(state.player.attributes, state.player.role);
  const edge = (overall - levelBar(state, plan, team)) / 8;
  const rng = createRng(deriveSeed(state.seed, saltOf(`nets-${plan.fixtureId}-${approach}`)));
  const a = APPROACH[approach];
  const discipline = (state.player.attributes.mental.discipline - 50) / 40;
  const base = 5.6 + a.mean + edge * 1.7 + (approach === 'SOLID' ? discipline : 0);
  const score = Math.round(Math.max(1, Math.min(10, base + rng.spread() * a.spread)) * 10) / 10;
  const bowler = ['PACE', 'SPIN'].includes(roleGroup(state.player.role));
  const note =
    score >= 8
      ? approach === 'SHOWY'
        ? bowler ? 'You bowled with real venom - heads turned at every net.' : 'You took the bowlers on and it came off - the selectors were out of their chairs.'
        : bowler ? 'Relentless: line, length and a few that did too much for the batters.' : 'Clean, compact and in control - the best session of the day.'
      : score >= 6
        ? 'A tidy session. You did nothing wrong and a few things well.'
        : score >= 4
          ? approach === 'SHOWY' ? 'A couple of eye-catching moments, and a couple of reckless ones.' : 'Scratchy. The selectors wanted to see more.'
          : approach === 'SHOWY' ? 'Tried too hard to impress and it showed.' : 'A difficult session - nothing went right.';
  return { approach, score, note };
}

export function runTrialFitness(state: GameState, plan: TrialPlan, effort: FitnessEffort): TrialRecord['fitness'] {
  const rng = createRng(deriveSeed(state.seed, saltOf(`fit-${plan.fixtureId}`)));
  const result = runFitnessTest(state.player, plan.stageId, plan.date, plan.title, rng);
  const push = effort === 'ALL_OUT';
  const yoyo = Math.round((result.yoyo + (push ? TRIALS.allOutYoyo : 0)) * 10) / 10;
  const sprint = Math.round((result.sprint - (push ? TRIALS.allOutSprint : 0)) * 100) / 100;
  return { passed: yoyo >= result.yoyoTarget && sprint <= result.sprintTarget, yoyo, yoyoTarget: result.yoyoTarget, sprint, sprintTarget: result.sprintTarget, effort };
}

/** Probables against the rest, on the fast sim. */
export function runPracticeMatch(state: GameState, plan: TrialPlan, nets: NetsResult): TrialRecord['practice'] {
  const team = trialTeam(state, plan);
  const pool: SimPlayer[] = team ? squadFor(state, team.id) : [];
  // A good nets session carries into the middle.
  const user = simFromUser(state.player, 'probables-a', 4);
  const boosted: SimPlayer = { ...user, condition: { ...user.condition, confidence: Math.max(0, Math.min(100, user.condition.confidence + (nets.score - 5.5) * 3)) } };
  const others = [...pool].sort((a, b) => computeOverall(b.attributes, b.role) - computeOverall(a.attributes, a.role));
  const a: SimPlayer[] = [];
  const b: SimPlayer[] = [];
  others.forEach((p, i) => (i % 2 === 0 ? b : a).push(p));
  const pickXi = (squad: SimPlayer[], teamId: string, extra?: SimPlayer) => {
    const all = (extra ? [extra, ...squad] : squad).map((p) => ({ ...p, teamId }));
    const ids = defaultXiIds(all, extra?.id ?? null);
    const byId = new Map(all.map((p) => [p.id, p]));
    const xi = ids.map((id) => byId.get(id)).filter((p): p is SimPlayer => Boolean(p));
    while (xi.length < 11 && all.length > xi.length) {
      const spare = all.find((p) => !xi.includes(p));
      if (!spare) break;
      xi.push(spare);
    }
    return battingOrderOf(xi);
  };
  const venue = Object.values(state.venues)[0];
  const homeXi = pickXi(a, 'probables-a', boosted);
  const awayXi = pickXi(b.length >= 11 ? b : [...b, ...a.slice(0, 11 - b.length)], 'probables-b');
  const result = quickMatch({
    fixtureId: `trial-${plan.fixtureId}`,
    tournamentId: 'friendly',
    seasonYear: state.season.year,
    format: plan.format ?? 'ONE_DAY',
    stage: 'FRIENDLY',
    date: plan.date,
    days: 1,
    venue,
    homeTeamId: 'probables-a',
    awayTeamId: 'probables-b',
    homeXi,
    awayXi,
    userPlayerId: state.player.id,
    userIsHome: true,
    seed: deriveSeed(state.seed, saltOf(`practice-${plan.fixtureId}`)),
    region: regionOf(state.player.state),
  });
  const line = result.lines[state.player.id];
  const runs = line?.runs ?? 0;
  const balls = line?.balls ?? 0;
  const wickets = line?.wickets ?? 0;
  const ballsBowled = line?.ballsBowled ?? 0;
  const conceded = line?.runsConceded ?? 0;
  const parts = [balls > 0 || (line?.innings ?? 0) > 0 ? `${runs}${line && line.notOuts === line.innings && line.innings > 0 ? '*' : ''} off ${balls}` : 'did not bat'];
  if (ballsBowled > 0) parts.push(`${wickets}/${conceded} from ${Math.floor(ballsBowled / 6)}${ballsBowled % 6 ? `.${ballsBowled % 6}` : ''} overs`);
  return { runs, balls, wickets, ballsBowled, runsConceded: conceded, rating: line?.rating ?? 5, summary: `Practice match: ${parts.join(', ')}.` };
}

export function trialBonus(nets: NetsResult, fitness: TrialRecord['fitness'], practice: TrialRecord['practice']): number {
  const raw = (nets.score - 5.5) * TRIALS.netsWeight + (fitness.passed ? TRIALS.fitnessPass : TRIALS.fitnessFail) + (practice.rating - 5.5) * TRIALS.practiceWeight;
  return Math.round(Math.max(-10, Math.min(10, raw)) * 10) / 10;
}

export interface TrialChoices {
  approach: NetsApproach;
  effort: FitnessEffort;
}

/** The whole day, worked out without changing the save (the screen reveals it step by step). */
export function playTrial(state: GameState, fixtureId: string, choices: TrialChoices): TrialRecord | null {
  const fixture = state.fixtures[fixtureId];
  if (!fixture) return null;
  const plan = trialFor(state, fixture);
  if (!plan || !plan.invited) return null;
  const nets = runNets(state, plan, choices.approach);
  const fitness = runTrialFitness(state, plan, choices.effort);
  const practice = runPracticeMatch(state, plan, nets);
  const bonus = trialBonus(nets, fitness, practice);
  const verdict =
    bonus >= 5 ? 'An outstanding trial - you forced your way to the front of the queue.'
      : bonus >= 1.5 ? 'A good trial. The selectors liked what they saw.'
        : bonus > -1.5 ? 'A steady trial. It did not change many minds either way.'
          : bonus > -5 ? 'A disappointing trial. You will need the runs and wickets to do the talking.'
            : 'A trial to forget.';
  return {
    fixtureId,
    date: fixture.date,
    seasonYear: state.season.year,
    title: fixture.title,
    purpose: plan.purpose,
    stageId: plan.stageId,
    nets,
    fitness,
    practice,
    bonus,
    verdict,
    decisions: [],
  };
}

/** Apply a played trial: the fitness test, trust, the squads, the inbox. */
export function applyTrial(state: GameState, record: TrialRecord): GameState {
  const fixture = state.fixtures[record.fixtureId];
  const plan = fixture ? trialFor(state, fixture) : null;
  const date = record.date;
  const player = state.player;
  const test = {
    id: newId('fit'),
    date,
    label: record.title,
    yoyo: record.fitness.yoyo,
    yoyoTarget: record.fitness.yoyoTarget,
    sprint: record.fitness.sprint,
    sprintTarget: record.fitness.sprintTarget,
    passed: record.fitness.passed,
  };
  const trust = Math.round(record.bonus * TRIALS.trustPerBonus + (record.fitness.passed ? FITNESS_TEST.passTrust : FITNESS_TEST.failTrust));
  let next: GameState = {
    ...state,
    fixtures: fixture ? { ...state.fixtures, [fixture.id]: { ...fixture, played: true } } : state.fixtures,
    player: {
      ...player,
      condition: {
        ...player.condition,
        selectorTrust: Math.max(0, Math.min(100, player.condition.selectorTrust + trust)),
        fatigue: Math.min(100, player.condition.fatigue + (record.fitness.effort === 'ALL_OUT' ? TRIALS.allOutFatigue : 4)),
      },
      development: { ...player.development, fitnessTests: [test, ...player.development.fitnessTests].slice(0, 20) },
    },
    calendar: { ...state.calendar, pendingTrialId: null },
  };
  const decisions: TrialRecord['decisions'] = [];
  if (record.purpose === 'FRANCHISE' && plan) next = franchiseTrialResult(next, plan, record);
  if (record.purpose === 'NATIONAL_CAMP') next = applyCamp(next, record.bonus, date);
  if (record.purpose === 'SQUAD' && plan) {
    for (const id of plan.tournamentIds) {
      next = decideCompetition(next, id, { date, trialBonus: record.bonus, announce: true });
      const place = next.career.squads[id];
      if (place) decisions.push({ tournamentId: id, status: place.status, reason: place.reason });
    }
  }
  const stored: TrialRecord = { ...record, decisions };
  const msg: InboxMessage = {
    id: newId('msg'),
    date,
    sender: 'SELECTOR',
    senderName: 'Selectors',
    subject: `${record.title}: ${record.verdict.split(' - ')[0].replace(/\.$/, '')}`,
    body: `Nets ${record.nets.score}/10 (${record.nets.approach.toLowerCase()}). Fitness test ${record.fitness.passed ? 'passed' : 'failed'} (yo-yo ${record.fitness.yoyo}). ${record.practice.summary} ${record.purpose === 'NEXT_LEVEL' ? 'The selectors will weigh it up with the season at the end of the year.' : ''}`.trim(),
    category: 'SELECTION',
    read: false,
    important: true,
    actions: [],
    relatedId: record.fixtureId,
  };
  next = {
    ...next,
    career: { ...next.career, trials: [stored, ...(next.career.trials ?? [])].slice(0, 12) },
    inbox: [msg, ...next.inbox].slice(0, 80),
  };
  return next;
}

/** A franchise trial moves the scouts: reputation, and that franchise's interest most of all. */
function franchiseTrialResult(state: GameState, plan: TrialPlan, record: TrialRecord): GameState {
  const s = state.pro.scouting;
  const fid = plan.teamId ?? '';
  const reputation = Math.max(0, Math.min(100, s.reputation + record.bonus * 1.2));
  const interest = { ...s.interest, [fid]: Math.max(0, Math.min(100, (s.interest[fid] ?? 0) + record.bonus * 3)) };
  return {
    ...state,
    pro: {
      ...state.pro,
      scouting: {
        ...s,
        reputation,
        interest,
        trials: [{ franchiseId: fid, date: record.date, bonus: record.bonus, verdict: record.verdict }, ...s.trials].slice(0, 10),
        notes: [{ date: record.date, delta: Math.round(record.bonus * 12) / 10, reason: `Franchise trial: ${record.verdict}` }, ...s.notes].slice(0, 20),
      },
    },
  };
}

/** The choices a coach would make, for the headless sim and "let the coach decide". */
export function defaultTrialChoices(state: GameState): TrialChoices {
  const tired = state.player.condition.fatigue > 60;
  return { approach: 'POSITIVE', effort: tired ? 'STEADY' : 'ALL_OUT' };
}

/** Play and apply a trial with default choices. */
export function autoTrial(state: GameState, fixtureId: string): GameState {
  const record = playTrial(state, fixtureId, defaultTrialChoices(state));
  if (!record) return { ...state, calendar: { ...state.calendar, pendingTrialId: null } };
  return applyTrial(state, record);
}
