/**
 * What a delivery sounds like: the effects to play for it. Pure, so it is
 * easy to test; `lib/audio/player.ts` does the playing. (The written
 * commentary stays on screen; there is no spoken voice.)
 */
import type { Ball, Innings, MatchResult } from '@/types';

export type Sfx = 'BAT' | 'BAT_BIG' | 'CHEER' | 'ROAR' | 'STUMPS' | 'APPEAL' | 'GROAN' | 'APPLAUSE' | 'LIGHT_CLAP';

type Lines = Pick<Innings, 'batting' | 'bowling' | 'fallOfWickets'>;

/** The effects for one delivery, from the innings as it stands after it. */
export function sfxForBall(ball: Ball, innings: Lines, userId: string | null): Sfx[] {
  const sfx: Sfx[] = [];
  if (ball.wicket && ball.wicket.type !== 'RETIRED_HURT') {
    const type = ball.wicket.type;
    // Who went: the latest fall of wicket (a run out can be the non-striker).
    const outId = innings.fallOfWickets.at(-1)?.playerId ?? ball.strikerId;
    const outLine = innings.batting.find((b) => b.playerId === outId);
    sfx.push(type === 'BOWLED' || type === 'RUN_OUT' || type === 'STUMPED' || type === 'HIT_WICKET' ? 'STUMPS' : type === 'LBW' ? 'APPEAL' : 'BAT');
    // A duck, or the player's own wicket: the crowd groans. Otherwise it roars.
    sfx.push(outId === userId || (outLine && outLine.runs === 0) ? 'GROAN' : 'ROAR');
    const bowler = innings.bowling.find((b) => b.playerId === ball.bowlerId);
    if (bowler && bowler.wickets === 5 && type !== 'RUN_OUT') sfx.push('APPLAUSE');
    return sfx;
  }
  if (ball.isBoundarySix) sfx.push('BAT_BIG', 'ROAR');
  else if (ball.isBoundaryFour) sfx.push('BAT', 'CHEER');
  else if (ball.dropped) sfx.push('BAT', 'GROAN');
  else if (ball.runsOffBat === 3) sfx.push('BAT', 'LIGHT_CLAP');
  else if (ball.runsOffBat > 0 || (ball.shot && ball.shotAngle !== null)) sfx.push('BAT');

  // A fifty or a hundred reached on this ball.
  const batter = innings.batting.find((b) => b.playerId === ball.strikerId);
  if (batter && ball.runsOffBat > 0) {
    const before = batter.runs - ball.runsOffBat;
    if ((before < 50 && batter.runs >= 50) || (before < 100 && batter.runs >= 100)) sfx.push('APPLAUSE');
  }
  return sfx;
}

/** The crowd at the end of a match: applause and a roar for a win, polite claps otherwise. */
export function sfxForResult(result: MatchResult, userTeamId: string | null): Sfx[] {
  return result.winningTeamId && result.winningTeamId === userTeamId ? ['APPLAUSE', 'ROAR'] : ['LIGHT_CLAP'];
}
