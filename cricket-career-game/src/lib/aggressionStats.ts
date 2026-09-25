/**
 * What the player did at each aggression level in a match: balls, runs and
 * how they got out at each batting level, and balls, runs and wickets at each
 * bowling level.
 */
import type { Ball, BattingIntent, Id, Match } from '@/types';

const LEVEL_OF: Record<BattingIntent, number> = {
  BLOCK: 1,
  DEFENSIVE: 2,
  NORMAL: 3,
  ATTACKING: 4,
  ALL_OUT: 5,
};

export interface BattingLevelRow {
  level: number;
  balls: number;
  runs: number;
  fours: number;
  sixes: number;
  /** How they were out at this level, when they were. One line per innings. */
  dismissals: string[];
}

export interface BowlingLevelRow {
  level: number;
  balls: number;
  runs: number;
  wickets: number;
}

const emptyBatting = (): BattingLevelRow[] =>
  [1, 2, 3, 4, 5].map((level) => ({ level, balls: 0, runs: 0, fours: 0, sixes: 0, dismissals: [] }));

export function battingByLevel(match: Match, playerId: Id): BattingLevelRow[] {
  const rows = emptyBatting();
  for (const innings of match.innings) {
    let lastLevel = 3;
    for (const ball of innings.deliveries) {
      if (ball.strikerId !== playerId) continue;
      const row = rows[LEVEL_OF[ball.intent] - 1];
      lastLevel = row.level;
      // Balls faced as the scorecard counts them: legal deliveries.
      if (ball.isLegalDelivery) row.balls += 1;
      row.runs += ball.runsOffBat;
      if (ball.isBoundaryFour) row.fours += 1;
      if (ball.isBoundarySix) row.sixes += 1;
    }

    // Which ball got them out: the n-th wicket ball is the n-th fall of wicket.
    const fall = innings.fallOfWickets.find((f) => f.playerId === playerId);
    if (!fall) continue;
    const wicketBalls = innings.deliveries.filter((b) => b.wicket);
    const ball: Ball | undefined = wicketBalls[fall.wicketNumber - 1];
    const level = ball && ball.strikerId === playerId ? LEVEL_OF[ball.intent] : lastLevel;
    const line = innings.batting.find((b) => b.playerId === playerId);
    rows[level - 1].dismissals.push(line?.dismissalText || 'out');
  }
  return rows;
}

export function bowlingByLevel(match: Match, playerId: Id): BowlingLevelRow[] {
  const rows: BowlingLevelRow[] = [1, 2, 3, 4, 5].map((level) => ({ level, balls: 0, runs: 0, wickets: 0 }));
  for (const innings of match.innings) {
    for (const ball of innings.deliveries) {
      if (ball.bowlerId !== playerId) continue;
      const row = rows[(ball.bowlingAggression ?? 3) - 1];
      if (ball.isLegalDelivery) row.balls += 1;
      const extra = ball.extras;
      const conceded = extra && (extra.type === 'WIDE' || extra.type === 'NO_BALL') ? extra.runs : 0;
      row.runs += ball.runsOffBat + conceded;
      if (ball.wicket && ball.wicket.type !== 'RUN_OUT' && ball.wicket.bowlerId === playerId) row.wickets += 1;
    }
  }
  return rows;
}
