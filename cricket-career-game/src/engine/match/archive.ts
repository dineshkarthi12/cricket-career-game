/**
 * Keeping the save small. A multi-day match carries over a megabyte of
 * ball-by-ball data, and localStorage holds about five - a season would not
 * fit. The latest matches keep every ball (for commentary, the wagon wheel
 * and the charts); older ones keep their full scorecards and lose the balls.
 */
import { SAVE } from '../config';
import type { Id, Match } from '@/types';

/** True when a match was stored as a scorecard only. */
export function isArchived(match: Match): boolean {
  return match.innings.some((innings) => innings.balls > 0 && innings.deliveries.length === 0);
}

export function archiveMatch(match: Match): Match {
  if (match.innings.every((innings) => innings.deliveries.length === 0)) return match;
  return { ...match, innings: match.innings.map((innings) => ({ ...innings, deliveries: [] })) };
}

/** Strip ball-by-ball from all but the newest `keep` matches (the one just played always stays). */
export function compactMatches(
  matches: Record<Id, Match>,
  keepId: Id | null = null,
  keep: number = SAVE.ballByBallMatches,
): Record<Id, Match> {
  const newest = Object.values(matches)
    .filter((m) => m.id !== keepId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, Math.max(0, keep - (keepId ? 1 : 0)))
    .map((m) => m.id);
  const kept = new Set([...(keepId ? [keepId] : []), ...newest]);
  return Object.fromEntries(
    Object.entries(matches).map(([id, match]) => [id, kept.has(id) ? match : archiveMatch(match)]),
  );
}
