/**
 * What a delivery sounds like: the effects to play, how important the
 * moment is, and what the commentator says. Pure, so it is easy to test;
 * `lib/audio/player.ts` does the playing.
 */
import { voiceLine, type VoiceMoment } from '@/data/voiceLines';
import type { Ball, Innings, MatchResult } from '@/types';

export type Sfx = 'BAT' | 'BAT_BIG' | 'CHEER' | 'ROAR' | 'STUMPS' | 'APPEAL' | 'GROAN' | 'APPLAUSE' | 'LIGHT_CLAP';

export interface BallCall {
  sfx: Sfx[];
  /** 0 routine, 1 worth a word, 2 a boundary or a chance, 3 a wicket or a milestone. */
  priority: 0 | 1 | 2 | 3;
  moment: VoiceMoment | null;
  line: string | null;
  /** The player's own moment: said with a little more excitement. */
  mine: boolean;
}

const WICKET_MOMENT: Record<string, VoiceMoment> = {
  BOWLED: 'BOWLED',
  CAUGHT: 'CAUGHT',
  CAUGHT_BEHIND: 'CAUGHT_BEHIND',
  CAUGHT_AND_BOWLED: 'CAUGHT_AND_BOWLED',
  LBW: 'LBW',
  STUMPED: 'STUMPED',
  RUN_OUT: 'RUN_OUT',
  HIT_WICKET: 'HIT_WICKET',
};

type Lines = Pick<Innings, 'batting' | 'bowling' | 'fallOfWickets'>;

/** The call for one delivery, from the innings as it stands after it. */
export function callForBall(ball: Ball, innings: Lines, userId: string | null, lastLine: string | null = null): BallCall {
  const batterLine = innings.batting.find((b) => b.playerId === ball.strikerId);
  const bowlerLine = innings.bowling.find((b) => b.playerId === ball.bowlerId);
  const names = { batter: batterLine?.name, bowler: bowlerLine?.name, fielder: ball.fielderName ?? undefined };
  const runs = ball.runsOffBat;
  let moment: VoiceMoment | null = null;
  let priority: BallCall['priority'] = 0;
  const sfx: Sfx[] = [];
  let mine = ball.strikerId === userId || ball.bowlerId === userId;

  if (ball.wicket && ball.wicket.type !== 'RETIRED_HURT') {
    // Who went: the latest fall of wicket (a run out can be the non-striker).
    const outId = innings.fallOfWickets.at(-1)?.playerId ?? ball.strikerId;
    const outLine = innings.batting.find((b) => b.playerId === outId);
    names.batter = outLine?.name ?? names.batter;
    mine = mine || outId === userId;
    const type = ball.wicket.type;
    moment = WICKET_MOMENT[type] ?? 'CAUGHT';
    if (outLine && outLine.runs === 0 && type !== 'RUN_OUT') moment = outLine.balls <= 1 ? 'GOLDEN_DUCK' : 'DUCK';
    priority = 3;
    sfx.push(type === 'BOWLED' || type === 'RUN_OUT' || type === 'STUMPED' || type === 'HIT_WICKET' ? 'STUMPS' : type === 'LBW' ? 'APPEAL' : 'BAT');
    sfx.push(outLine?.playerId === userId ? 'GROAN' : 'ROAR');
    if (bowlerLine && bowlerLine.wickets === 5 && type !== 'RUN_OUT') moment = 'FIVE_FOR';
  } else if (ball.isBoundarySix) {
    moment = 'SIX';
    priority = 3;
    sfx.push('BAT_BIG', 'ROAR');
  } else if (ball.isBoundaryFour) {
    moment = 'FOUR';
    priority = 2;
    sfx.push('BAT', 'CHEER');
  } else if (ball.dropped) {
    moment = 'DROPPED';
    priority = 2;
    names.fielder = ball.dropped.fielderName;
    sfx.push('BAT', 'GROAN');
  } else if (ball.extras && (ball.extras.type === 'WIDE' || ball.extras.type === 'NO_BALL')) {
    moment = ball.extras.type;
    priority = 1;
  } else if (runs === 3) {
    moment = 'THREE';
    priority = 1;
    sfx.push('BAT', 'LIGHT_CLAP');
  } else if (runs === 2) {
    moment = 'TWO';
    priority = 1;
    sfx.push('BAT');
  } else if (runs === 1) {
    moment = 'SINGLE';
    sfx.push('BAT');
  } else if (ball.shot && ball.shotAngle === null) {
    moment = 'BEATEN';
    priority = 1;
  } else {
    moment = 'DOT';
    if (ball.shot) sfx.push('BAT');
  }

  // A milestone reached on this ball outranks the shot itself.
  if (!ball.wicket && batterLine && runs > 0) {
    const before = batterLine.runs - runs;
    if (before < 100 && batterLine.runs >= 100) moment = 'HUNDRED';
    else if (before < 50 && batterLine.runs >= 50) moment = 'FIFTY';
    if (moment === 'HUNDRED' || moment === 'FIFTY') {
      priority = 3;
      sfx.push('APPLAUSE');
    }
  }

  const line = moment ? voiceLine(moment, names, ball.id, lastLine) : null;
  return { sfx, priority, moment, line, mine };
}

/** The last word on a finished match. */
export function callForResult(result: MatchResult, userTeamId: string | null, teamName: (id: string) => string): BallCall {
  const moment: VoiceMoment = !result.winningTeamId ? 'DRAW' : result.winningTeamId === userTeamId ? 'WIN' : 'LOSS';
  const team = result.winningTeamId ? teamName(result.winningTeamId) : undefined;
  return { sfx: moment === 'LOSS' ? ['LIGHT_CLAP'] : ['APPLAUSE', 'ROAR'], priority: 3, moment, line: voiceLine(moment, { team }, `${result.summary}-${moment}`), mine: moment === 'WIN' };
}
