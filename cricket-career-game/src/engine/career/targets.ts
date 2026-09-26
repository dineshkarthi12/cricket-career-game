/**
 * The visible targets for the next step, checked against the season so far.
 * Meeting them makes selection likely; it never guarantees it.
 */
import { getStage } from '@/data/stages';
import { STAGE_TARGETS, type StageTarget } from '@/data/stageTargets';
import { eligibleForStage } from './eligibility';
import { userSeasonStats } from './squads';
import type { CareerStageId, GameState, SeasonStatLine, TargetCheck } from '@/types';

/** The first next stage the player is young enough for next season. */
export function nextStageFor(stageId: CareerStageId, dateOfBirth: string, nextSeasonYear: number): CareerStageId | null {
  const stage = getStage(stageId);
  return stage.nextStageIds.find((id) => eligibleForStage(dateOfBirth, nextSeasonYear, id)) ?? null;
}

/**
 * Where an age-group player lands when they are too old for their stage: the
 * first stage down the path they are still young enough for.
 */
export function ageOutStage(stageId: CareerStageId, dateOfBirth: string, nextSeasonYear: number): CareerStageId {
  let current = stageId;
  for (let guard = 0; guard < 8; guard += 1) {
    const next = getStage(current).nextStageIds;
    const eligible = next.find((id) => eligibleForStage(dateOfBirth, nextSeasonYear, id));
    if (eligible) return eligible;
    if (next.length === 0) return current;
    current = next[next.length - 1];
  }
  return current;
}

export interface TargetProgress {
  target: StageTarget | null;
  stats: SeasonStatLine;
  checks: TargetCheck[];
  /** Best of the batting and bowling routes, 1 = exactly on target. */
  ratio: number;
  /** Runs-and-average or wickets, and the minimum matches. */
  met: boolean;
  /** The season's latest fitness test: passed, failed or not taken. */
  fitness: 'PASSED' | 'FAILED' | 'NOT_TAKEN';
}

export function evaluateTargets(state: GameState, stageId: CareerStageId = state.career.currentStageId): TargetProgress {
  const target = STAGE_TARGETS[stageId] ?? null;
  const stats = userSeasonStats(state, target?.countFrom.length ? target.countFrom : null);
  const tests = state.player.development.fitnessTests.filter((t) => t.date >= state.season.startDate);
  const fitness = tests.length === 0 ? 'NOT_TAKEN' : tests[0].passed ? 'PASSED' : 'FAILED';
  if (!target) return { target, stats, checks: [], ratio: 0, met: false, fitness };

  const average = stats.average ?? 0;
  const runsRoute = Math.min(stats.runs / target.runs, average / target.average);
  const wicketsRoute = stats.wickets / target.wickets;
  const ratio = Math.round(Math.max(runsRoute, wicketsRoute) * 100) / 100;
  const matchesOk = stats.matches >= target.minMatches;
  const checks: TargetCheck[] = [
    { label: `${target.runs}+ runs`, met: stats.runs >= target.runs, progress: `${stats.runs} / ${target.runs}` },
    { label: `Average ${target.average}+`, met: average >= target.average, progress: `${stats.average ?? '-'} / ${target.average}` },
    { label: `or ${target.wickets}+ wickets`, met: stats.wickets >= target.wickets, progress: `${stats.wickets} / ${target.wickets}` },
    { label: `${target.minMatches}+ matches`, met: matchesOk, progress: `${stats.matches} / ${target.minMatches}` },
  ];
  if (target.fitnessTest) {
    checks.push({ label: 'Pass the fitness test', met: fitness === 'PASSED', progress: fitness === 'PASSED' ? 'Passed' : fitness === 'FAILED' ? 'Failed' : 'Not taken' });
  }
  return { target, stats, checks, ratio, met: ratio >= 1 && matchesOk, fitness };
}
