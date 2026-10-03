/** What the match screen should show, derived only from the authority's events. */
import type { MatchEvent, PublicPlayer, PublicSide, ScoreView } from '@/engine/pvp/match';

type Ev<K extends MatchEvent['kind']> = Extract<MatchEvent, { kind: K }>;

export type Phase = 'LOADING' | 'SELECT_BOWLER' | 'AWAIT_BOWL' | 'AWAIT_BAT' | 'BETWEEN' | 'END';

export interface MatchView {
  phase: Phase;
  start: Ev<'MATCH_START'> | null;
  sides: [PublicSide, PublicSide] | null;
  innings: 0 | 1;
  battingSide: 0 | 1;
  /** Which side must act now. */
  actor: 0 | 1 | null;
  bowlerNeeded: Ev<'BOWLER_NEEDED'> | null;
  open: Ev<'DELIVERY_OPEN'> | null;
  released: Ev<'BALL_RELEASED'> | null;
  lastResult: Ev<'BALL_RESULT'> | null;
  end: Ev<'MATCH_END'> | null;
  score: ScoreView;
  firstInnings: ScoreView | null;
  deadlineAt: number | null;
  players: Map<string, PublicPlayer>;
}

export function deriveView(events: MatchEvent[]): MatchView {
  const view: MatchView = {
    phase: 'LOADING',
    start: null,
    sides: null,
    innings: 0,
    battingSide: 0,
    actor: null,
    bowlerNeeded: null,
    open: null,
    released: null,
    lastResult: null,
    end: null,
    score: { innings: 0, runs: 0, wickets: 0, balls: 0, target: null },
    firstInnings: null,
    deadlineAt: null,
    players: new Map(),
  };
  for (const e of events) {
    switch (e.kind) {
      case 'MATCH_START':
        view.start = e;
        view.sides = e.sides;
        for (const s of e.sides) for (const p of s.players) view.players.set(p.id, p);
        break;
      case 'INNINGS_START':
        view.innings = e.innings;
        view.battingSide = e.battingSide;
        view.score = { innings: e.innings, runs: 0, wickets: 0, balls: 0, target: e.target };
        view.open = null;
        view.released = null;
        break;
      case 'BOWLER_NEEDED':
        view.bowlerNeeded = e;
        view.phase = 'SELECT_BOWLER';
        view.actor = e.side;
        view.deadlineAt = e.deadlineAt;
        break;
      case 'BOWLER_SELECTED':
        view.bowlerNeeded = null;
        break;
      case 'DELIVERY_OPEN':
        view.open = e;
        view.released = null;
        view.phase = 'AWAIT_BOWL';
        view.actor = (1 - view.battingSide) as 0 | 1;
        view.deadlineAt = e.deadlineAt;
        break;
      case 'BALL_RELEASED':
        view.released = e;
        view.phase = 'AWAIT_BAT';
        view.actor = view.battingSide;
        view.deadlineAt = e.deadlineAt;
        break;
      case 'BALL_RESULT':
        view.lastResult = e;
        view.score = e.score;
        view.phase = 'BETWEEN';
        view.actor = null;
        view.deadlineAt = null;
        break;
      case 'INNINGS_END':
        if (e.innings === 0) view.firstInnings = e.score;
        view.score = e.score;
        break;
      case 'MATCH_END':
        view.end = e;
        view.phase = 'END';
        view.actor = null;
        view.deadlineAt = null;
        break;
    }
  }
  return view;
}

export function overs(balls: number): string {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

export const SHOT_KEYS: Record<string, string> = {
  '1': 'DEFEND',
  '2': 'DRIVE',
  ' ': 'DRIVE',
  '3': 'CUT',
  '4': 'PULL',
  '5': 'SWEEP',
  '6': 'LOFT',
  '0': 'LEAVE',
  l: 'LEAVE',
};
