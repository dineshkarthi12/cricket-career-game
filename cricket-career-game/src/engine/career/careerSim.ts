/**
 * Whole careers, played headless: a player created at 10 goes through the
 * real calendar with the default training plan, every one of their matches
 * on the fast sim, every trial with the coach's default choices, every
 * selection meeting and season review. The harness the selection and
 * progression constants were tuned against (see PROGRESS.md).
 */
import { createRng } from '../match/rng';
import { CAREER_STAGES, getStage } from '@/data/stages';
import { createNewCareer } from '../newCareer';
import { advanceWeek } from '../calendar/advance';
import { autoTrial } from './trials';
import { autoPlayFixture } from './autoplay';
import { IN_SQUAD } from './squads';
import { ageInYears } from '../development';
import type { CreationRole } from '../development';
import type { CareerStageId, GameState, SeasonOutcome } from '@/types';

export interface SimulatedCareerRun {
  seed: number;
  role: CreationRole;
  hiddenPotential: number;
  /** Age each stage was first reached (selected and playing there), if it was. */
  reachedAt: Partial<Record<CareerStageId, number>>;
  /** Senior formats established in (stages 8-10), with the age. */
  establishedAt: Partial<Record<CareerStageId, number>>;
  outcomes: SeasonOutcome[];
  drops: number;
  comebacks: number;
  finalStageId: CareerStageId;
  finalOverall: number;
  seasons: number;
  matches: number;
}

const ROLES: CreationRole[] = ['BATTER', 'BOWLER', 'ALLROUNDER', 'WICKETKEEPER'];

/** Play one week, attending trials and matches as the clock stops for them. */
export function playOn(state: GameState): GameState {
  const result = advanceWeek(state);
  if (result.trial) return autoTrial(result.state, result.trial.id);
  if (result.stoppedFor) return autoPlayFixture(result.state, result.stoppedFor);
  return result.state;
}

export function simulateCareer(seed: number, endAge = 30): SimulatedCareerRun {
  const rng = createRng(seed);
  const role = rng.pick(ROLES);
  const month = rng.int(1, 12);
  const dob = `2016-${String(month).padStart(2, '0')}-${String(rng.int(1, 28)).padStart(2, '0')}`;
  const bowler = role === 'BOWLER' || role === 'ALLROUNDER';
  let state = createNewCareer({
    firstName: 'Sim',
    lastName: String(seed),
    dateOfBirth: dob,
    creationRole: role,
    bowlingStyle: bowler ? rng.pick(['RIGHT_ARM_FAST', 'RIGHT_ARM_MEDIUM', 'OFF_SPIN', 'LEG_SPIN', 'LEFT_ARM_ORTHODOX'] as const) : 'RIGHT_ARM_MEDIUM',
    seed,
    startDate: '2026-06-01',
  });
  const reachedAt: SimulatedCareerRun['reachedAt'] = {};
  const establishedAt: SimulatedCareerRun['establishedAt'] = {};
  const age = (date: string) => Math.floor(ageInYears(dob, date));
  let guard = 0;
  let reviews = 0;
  while (age(state.season.currentDate) < endAge && guard < 5000) {
    guard += 1;
    state = playOn(state);
    // Reached: in a squad at the stage and on the field for it.
    const stageId = state.career.currentStageId;
    if (reachedAt[stageId] === undefined) {
      const order = getStage(stageId).order;
      const inSquad = Object.values(state.career.squads).some((p) => IN_SQUAD.includes(p.status) && p.tournamentId !== 'club-league');
      if (order === 1 || (inSquad && state.career.stages[stageId].matchesPlayed > 0)) reachedAt[stageId] = age(state.season.currentDate);
    }
    if (state.career.seasonReviews.length !== reviews) {
      reviews = state.career.seasonReviews.length;
      state = { ...state, career: { ...state.career, pendingReview: null } };
    }
  }
  // Stages completed along the way count as reached; senior formats as established.
  for (const s of CAREER_STAGES) {
    const p = state.career.stages[s.id];
    if (s.id === 'SENIOR_STATE' && p.status === 'COMPLETED' && reachedAt.SENIOR_STATE === undefined) {
      const debut = state.career.events.find((e) => e.kind === 'DEBUT');
      reachedAt.SENIOR_STATE = debut ? age(debut.date) : age(p.completedOn ?? state.season.currentDate);
    }
    if (['RANJI_TROPHY', 'VIJAY_HAZARE', 'SYED_MUSHTAQ_ALI'].includes(s.id) && p.status === 'COMPLETED') {
      establishedAt[s.id] = age(p.completedOn ?? state.season.currentDate);
    }
  }
  const matches = Object.values(state.player.record.byFormat).reduce((sum, r) => sum + (r?.batting.matches ?? 0), 0);
  return {
    seed,
    role,
    hiddenPotential: state.player.development.hiddenPotential,
    reachedAt,
    establishedAt,
    outcomes: state.career.seasonReviews.map((r) => r.outcome),
    drops: state.career.drops,
    comebacks: state.career.comebacks,
    finalStageId: state.career.currentStageId,
    finalOverall: state.player.overall,
    seasons: state.career.seasonReviews.length,
    matches,
  };
}

export interface CareerSimReport {
  careers: number;
  byStage: { stageId: CareerStageId; label: string; reached: number; averageAge: number | null }[];
  established: { stageId: CareerStageId; label: string; count: number; averageAge: number | null }[];
  outcomes: Record<SeasonOutcome, number>;
  droppedCareers: number;
  drops: number;
  comebacks: number;
  averageMatches: number;
}

export function summarise(runs: SimulatedCareerRun[]): CareerSimReport {
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
  const byStage = CAREER_STAGES.filter((s) => s.order <= 10).map((s) => {
    const ages = runs.map((r) => r.reachedAt[s.id]).filter((a): a is number => a !== undefined);
    return { stageId: s.id, label: `${s.order}. ${s.shortLabel}`, reached: ages.length, averageAge: avg(ages) };
  });
  const established = (['RANJI_TROPHY', 'VIJAY_HAZARE', 'SYED_MUSHTAQ_ALI'] as CareerStageId[]).map((id) => {
    const ages = runs.map((r) => r.establishedAt[id]).filter((a): a is number => a !== undefined);
    return { stageId: id, label: getStage(id).shortLabel, count: ages.length, averageAge: avg(ages) };
  });
  const outcomes = { PROMOTE: 0, STAY: 0, BENCH: 0, DROPPED: 0, COMEBACK: 0, FAST_TRACK: 0, AGED_OUT: 0 } as Record<SeasonOutcome, number>;
  for (const r of runs) for (const o of r.outcomes) outcomes[o] += 1;
  return {
    careers: runs.length,
    byStage,
    established,
    outcomes,
    droppedCareers: runs.filter((r) => r.drops > 0).length,
    drops: runs.reduce((s, r) => s + r.drops, 0),
    comebacks: runs.reduce((s, r) => s + r.comebacks, 0),
    averageMatches: avg(runs.map((r) => r.matches)) ?? 0,
  };
}

export function formatReport(report: CareerSimReport): string {
  const lines: string[] = [];
  lines.push(`${report.careers} careers from age 10, default training, every match on the fast sim`);
  lines.push('');
  lines.push('Stage reached (selected and played)      careers   share   avg age');
  for (const s of report.byStage) {
    lines.push(`${s.label.padEnd(40)} ${String(s.reached).padStart(7)} ${`${Math.round((s.reached / report.careers) * 100)}%`.padStart(7)} ${String(s.averageAge ?? '-').padStart(9)}`);
  }
  lines.push('');
  lines.push('Established regular (stages 8-10)');
  for (const e of report.established) lines.push(`${e.label.padEnd(40)} ${String(e.count).padStart(7)} ${`${Math.round((e.count / report.careers) * 100)}%`.padStart(7)} ${String(e.averageAge ?? '-').padStart(9)}`);
  lines.push('');
  lines.push(`Season outcomes: ${Object.entries(report.outcomes).map(([k, v]) => `${k.toLowerCase()} ${v}`).join(', ')}`);
  lines.push(`Careers with a drop: ${report.droppedCareers}; drops ${report.drops}; comebacks ${report.comebacks}`);
  lines.push(`Average matches per career: ${report.averageMatches}`);
  return lines.join('\n');
}
