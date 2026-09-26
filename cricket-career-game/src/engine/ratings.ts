import { OVERALL_WEIGHTS } from './config';
import { clampRating } from '@/types';
import type { Attributes, MatchFormat, PlayerRole, Rating } from '@/types';

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

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Overall for one format. T20 rewards power, range, running and death
 * bowling; Tests reward technique, concentration, swing and seam, and the
 * stamina for long spells; ODIs sit on the plain overall. This is how the
 * national selectors can pick a different XI for each format - and why a
 * player can debut in one format and wait years for another.
 */
export function formatOverall(attributes: Attributes, role: PlayerRole, format: MatchFormat): Rating {
  const base = computeOverall(attributes, role);
  if (format === 'ODI' || format === 'ONE_DAY') return base;
  const w = OVERALL_WEIGHTS[role];
  const b = attributes.batting;
  const o = attributes.bowling;
  const batMean = meanOf(b);
  const bowlMean = meanOf(o);
  let batSkill: number;
  let bowlSkill: number;
  let physical = 0;
  if (format === 'T20') {
    batSkill = mean([b.power, b.shotRange, b.timing, b.running]);
    bowlSkill = mean([o.deathBowling, o.variation, o.control, o.accuracy]);
  } else {
    batSkill = mean([b.technique, b.concentration, b.vsSwing, b.footwork, b.vsSpin]);
    bowlSkill = mean([o.accuracy, o.swing, o.seam, Math.max(o.spin, o.flight), o.newBall, o.bounce]);
    physical = (attributes.physical.stamina - meanOf(attributes.physical)) * w.physical * 0.5;
  }
  const score = base + (batSkill - batMean) * w.batting * 0.9 + (bowlSkill - bowlMean) * w.bowling * 0.9 + physical;
  return clampRating(score);
}
