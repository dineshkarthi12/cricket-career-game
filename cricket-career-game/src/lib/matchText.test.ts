import { describe, expect, it } from 'vitest';
import { resultHeadline } from './matchText';
import type { Match } from '@/types';

const match = (result: Match['result']) => ({ result }) as Match;

describe('result headline', () => {
  it('names the winner', () => {
    const m = match({ type: 'WIN', winningTeamId: 'ka', summary: 'Won by 8 wickets', marginRuns: null, marginWickets: 8, manOfTheMatchId: null });
    expect(resultHeadline(m, () => 'Karnataka U-16')).toBe('Karnataka U-16 won by 8 wickets');
  });

  it('leaves a draw as it is', () => {
    const m = match({ type: 'DRAW', winningTeamId: null, summary: 'Match drawn', marginRuns: null, marginWickets: null, manOfTheMatchId: null });
    expect(resultHeadline(m, () => 'x')).toBe('Match drawn');
  });
});
