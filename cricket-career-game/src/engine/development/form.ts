/**
 * Form between matches, and streaks. Form and confidence chase match ratings
 * (`applyAftermath`); here they drift back towards normal in weeks without
 * cricket, and a run of good or bad scores becomes a streak that feeds on
 * itself through confidence.
 */
import { formBandFor } from '../match/aftermath';
import type { Condition } from '@/types';

export type Streak = 'HOT' | 'COLD' | null;

/** Three good matches in a row is a hot streak; three poor ones, a slump. */
export function formStreak(ratings: number[]): Streak {
  const last = ratings.slice(-3);
  if (last.length < 3) return null;
  if (last.every((r) => r >= 7)) return 'HOT';
  if (last.every((r) => r <= 4.5)) return 'COLD';
  return null;
}

/** Confidence bonus (or cost) a streak adds after a match. */
export function streakConfidence(streak: Streak): number {
  return streak === 'HOT' ? 4 : streak === 'COLD' ? -4 : 0;
}

/** A week without a match: form and confidence drift back towards normal. */
export function driftCondition(condition: Condition, weeks = 1): Condition {
  const pull = 1 - Math.pow(0.97, weeks);
  const form = condition.form + (50 - condition.form) * pull;
  const confidence = condition.confidence + (55 - condition.confidence) * pull * 0.6;
  // Workload in the legs fades over a fortnight.
  const recentWorkload = condition.recentWorkload * Math.pow(0.5, weeks);
  return {
    ...condition,
    form: round(form),
    formBand: formBandFor(form),
    confidence: round(confidence),
    recentWorkload: round(recentWorkload),
  };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
