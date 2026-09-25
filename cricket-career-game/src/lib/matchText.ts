import type { Match } from '@/types';

/**
 * The result as a headline. The engine's summary ("Won by 8 wickets") does
 * not say who won, which reads wrongly next to "You lost".
 */
export function resultHeadline(match: Match, teamNameOf: (id: string) => string): string {
  const result = match.result;
  if (!result) return 'No result';
  if (result.type === 'WIN' && result.winningTeamId) {
    const summary = result.summary.charAt(0).toLowerCase() + result.summary.slice(1);
    return `${teamNameOf(result.winningTeamId)} ${summary}`;
  }
  return result.summary;
}
