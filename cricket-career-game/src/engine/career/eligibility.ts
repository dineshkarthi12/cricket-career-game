/**
 * Age-group eligibility, the BCCI way: a player is "under 16" for a season if
 * they are under 16 on 1 September of the year the season starts.
 */
import { STAGE_AGE_LIMIT } from '@/data/stageTargets';
import { CAREER_STAGES } from '@/data/stages';
import type { CareerStageId } from '@/types';

export const CUTOFF_MONTH_DAY = '09-01';

/** Whole years on 1 September of the season's first year. */
export function ageOnCutoff(dateOfBirth: string, seasonYear: number): number {
  const cutoff = `${seasonYear}-${CUTOFF_MONTH_DAY}`;
  const [by, bm, bd] = dateOfBirth.split('-').map(Number);
  const [cy, cm, cd] = cutoff.split('-').map(Number);
  let age = cy - by;
  if (cm < bm || (cm === bm && cd < bd)) age -= 1;
  return age;
}

/** Eligible for an under-`limit` competition this season? */
export function eligibleForLimit(dateOfBirth: string, seasonYear: number, limit: number | null): boolean {
  if (limit === null) return true;
  return ageOnCutoff(dateOfBirth, seasonYear) < limit;
}

/** Can the player play at this stage this season (age-group cut-offs)? */
export function eligibleForStage(dateOfBirth: string, seasonYear: number, stageId: CareerStageId): boolean {
  const limit = STAGE_AGE_LIMIT[stageId];
  return eligibleForLimit(dateOfBirth, seasonYear, limit ?? null);
}

/** Minimum age to be considered for senior state cricket. */
export const SENIOR_MIN_AGE = 17;

/** The stage whose age limit (and level) a competition belongs to. */
export function stageOfCompetition(tournamentId: string): CareerStageId {
  return CAREER_STAGES.find((s) => s.tournamentIds.includes(tournamentId))?.id ?? 'SENIOR_STATE';
}

/** A competition's place on the path, 1 (school, club) to 7 (senior state). */
export function levelOfCompetition(tournamentId: string): number {
  return CAREER_STAGES.find((s) => s.tournamentIds.includes(tournamentId))?.order ?? 7;
}
