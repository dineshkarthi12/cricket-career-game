import { OVERALL_WEIGHTS } from './config';
import { clampRating } from '@/types';
import type { Attributes, PlayerRole, Rating } from '@/types';

/** Mean of an attribute group's values. The groups are flat numeric objects. */
function meanOf(group: object): number {
  const values = Object.values(group) as number[];
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Collapse a full attribute set into a single 1-99 overall, weighted by the
 * player's role - a pace bowler is not judged on their cover drive.
 */
export function computeOverall(attributes: Attributes, role: PlayerRole): Rating {
  const weights = OVERALL_WEIGHTS[role];
  const score =
    meanOf(attributes.batting) * weights.batting +
    meanOf(attributes.bowling) * weights.bowling +
    meanOf(attributes.fielding) * weights.fielding +
    meanOf(attributes.physical) * weights.physical +
    meanOf(attributes.mental) * weights.mental;
  return clampRating(score);
}
