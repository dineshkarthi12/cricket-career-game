/**
 * A simplified Duckworth-Lewis-Stern. Not the published tables, but the same
 * shape: resources fall away with overs used and wickets lost, and a revised
 * target is the par score scaled by the resources each side actually had.
 */
import { MATCH } from '../config';

/** Resources remaining, 0-1, with `oversLeft` to bat and `wicketsLost` gone. */
export function resourcesRemaining(oversLeft: number, wicketsLost: number, totalOvers: number): number {
  if (oversLeft <= 0 || wicketsLost >= 10) return 0;
  const overShare = Math.min(1, oversLeft / totalOvers);
  // Overs are worth less at the top of an innings than at the end of one.
  const overResource = Math.pow(overShare, MATCH.rain.resourceExponent);
  // Each wicket lost costs an increasing share of what is left.
  const wicketResource = Math.pow(1 - wicketsLost / 10, 1.35);
  return Math.max(0, Math.min(1, overResource * wicketResource));
}

/**
 * Target for the side batting second when either innings was shortened.
 * Returns the runs needed to win.
 */
export function revisedTarget(input: {
  firstInningsRuns: number;
  firstInningsOvers: number;
  firstInningsWicketsLost: number;
  secondInningsOvers: number;
  totalOvers: number;
}): number {
  const team1 = resourcesRemaining(input.firstInningsOvers, 0, input.totalOvers);
  const team2 = resourcesRemaining(input.secondInningsOvers, 0, input.totalOvers);
  if (team1 <= 0) return input.firstInningsRuns + 1;

  const ratio = team2 / team1;
  // Chasing with fewer resources scales the target down; more scales it up.
  const par = input.firstInningsRuns * ratio;
  return Math.max(1, Math.floor(par) + 1);
}

/** Has a rain-shortened limited-overs match played enough to give a result? */
export function hasResult(oversBowled: number): boolean {
  return oversBowled >= MATCH.rain.minOversForResult;
}
