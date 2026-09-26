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
  const short = (n?: string | null) => (n ? surname(n) : undefined);
  const names = { batter: short(batterLine?.name), bowler: short(bowlerLine?.name), fielder: short(ball.fielderName) };
  const runs = ball.runsOffBat;
  let moment: VoiceMoment | null = null;
  let priority: BallCall['priority'] = 0;
  const sfx: Sfx[] = [];
  let mine = ball.strikerId === userId || ball.bowlerId === userId;

  if (ball.wicket && ball.wicket.type !== 'RETIRED_HURT') {
    // Who went: the latest fall of wicket (a run out can be the non-striker).
    const outId = innings.fallOfWickets.at(-1)?.playerId ?? ball.strikerId;
    const outLine = innings.batting.find((b) => b.playerId === outId);
    names.batter = short(outLine?.name) ?? names.batter;
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
    names.fielder = short(ball.dropped.fielderName);
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

// --- Full ball-by-ball commentary -------------------------------------------------------

export interface SpokenLine {
  text: string;
  priority: number;
  /** Wait for the line before it rather than cutting in. */
  queue: boolean;
  excited: boolean;
}

export interface InningsState {
  battingTeam: string;
  runs: number;
  wickets: number;
  target: number | null;
  requiredRate: number | null;
  legalBalls: number;
}

/** Commentators use surnames: "Varadan", not "Arjun Varadan". */
export function surname(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0] ?? name;
}

/** The engine's written line, made for speaking: surnames, no shouting capitals, no dashes. */
export function speakable(text: string, names: string[]): string {
  let out = text;
  for (const n of [...names].sort((a, b) => b.length - a.length)) {
    if (n && n.trim().includes(' ')) out = out.split(n).join(surname(n));
  }
  return out
    .replace(/\b([A-Z]{3,})\b/g, (w) => w.charAt(0) + w.slice(1).toLowerCase())
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Every delivery, called the way a commentator would: who is bowling to
 * whom, what happened (the engine's own description), the big call on a
 * boundary, wicket or milestone, and the score at the end of each over.
 */
export function fullCommentary(ball: Ball, call: BallCall, innings: Lines, state: InningsState | null): SpokenLine[] {
  const names = [...innings.batting.map((b) => b.name), ...innings.bowling.map((b) => b.name), ball.fielderName ?? ''].filter(Boolean);
  const bowler = innings.bowling.find((b) => b.playerId === ball.bowlerId)?.name;
  const striker = innings.batting.find((b) => b.playerId === ball.strikerId);
  const out: SpokenLine[] = [];
  const described = speakable(ball.commentary, names);
  const lead = bowler && striker && ball.isLegalDelivery ? `${surname(bowler)} to ${surname(striker.name)}. ` : '';

  if (call.priority >= 2 && call.line) {
    // The big moment: the excited call, then what happened.
    out.push({ text: speakable(call.line, names), priority: call.priority, queue: false, excited: true });
    out.push({ text: described, priority: call.priority, queue: true, excited: false });
  } else {
    out.push({ text: `${lead}${described}`, priority: call.priority, queue: false, excited: call.mine });
  }

  // Closing in on a milestone.
  if (striker && !ball.wicket && ball.runsOffBat > 0) {
    const before = striker.runs - ball.runsOffBat;
    for (const mark of [50, 100]) {
      if (before < mark - 5 && striker.runs >= mark - 5 && striker.runs < mark) {
        out.push({ text: `${surname(striker.name)} moves to ${striker.runs}. ${mark - striker.runs} more for ${mark === 50 ? 'a fifty' : 'a hundred'}.`, priority: 1, queue: true, excited: false });
      }
    }
  }

  // The end of an over: the score, and the equation in a chase.
  if (state && ball.isLegalDelivery && ball.ballInOver === 6) {
    const overs = Math.floor(state.legalBalls / 6);
    let summary = `End of the over. ${state.battingTeam} ${state.runs} for ${state.wickets} after ${overs} ${overs === 1 ? 'over' : 'overs'}.`;
    if (state.target !== null && state.requiredRate !== null && state.requiredRate > 0) {
      const need = state.target - state.runs;
      const ballsLeft = Math.round((need / state.requiredRate) * 6);
      if (need > 0 && ballsLeft > 0) summary += ` They need ${need} from ${ballsLeft} balls.`;
    }
    out.push({ text: summary, priority: 1, queue: true, excited: false });
  }
  return out;
}
