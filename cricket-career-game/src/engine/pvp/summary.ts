import type { MatchMode, MatchResultView, ScoreView } from './match';
import type { MatchSummary } from './types';

export function formatScore(s: ScoreView): string {
  return `${s.runs}/${s.wickets} (${Math.floor(s.balls / 6)}.${s.balls % 6})`;
}

/** A finished match from one side's point of view, for the history list. */
export function summarize(input: {
  matchId: string;
  at: string;
  mode: MatchMode;
  side: 0 | 1;
  opponent: string;
  result: MatchResultView;
  ratingChange: number | null;
}): MatchSummary {
  const { result, side } = input;
  const outcome = result.winner === null ? 'TIE' : result.winner === side ? 'WIN' : 'LOSS';
  return {
    matchId: input.matchId,
    at: input.at,
    mode: input.mode,
    opponent: input.opponent,
    result: result.summary,
    outcome,
    myScore: formatScore(result.scores[side]),
    theirScore: formatScore(result.scores[1 - side]),
    ratingChange: input.ratingChange,
  };
}
