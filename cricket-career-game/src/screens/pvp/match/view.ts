/** What the match screen should show, derived only from the authority's events. */
import type { BowlerPlan } from '@/engine/match/types';
import type { BatIntent, DeliveryType, FieldSetting, FieldView, MatchEvent, PublicOutcome, PublicPlayer, PublicSide, PvpShot, ScoreView, ShotDirection } from '@/engine/pvp/match';

type Ev<K extends MatchEvent['kind']> = Extract<MatchEvent, { kind: K }>;

export type Phase = 'LOADING' | 'SELECT_BOWLER' | 'AWAIT_BOWL' | 'AWAIT_BAT' | 'BETWEEN' | 'END';

/** One finished ball, everything the timeline, commentary and replay need. */
export interface BallRecord {
  deliveryId: string;
  innings: 0 | 1;
  /** 0-based over and 1-based ball in it, as bowled. */
  over: number;
  ball: number;
  bowlerId: string;
  strikerId: string;
  deliveryType: DeliveryType | null;
  plan: BowlerPlan | null;
  fieldSetting: FieldSetting | null;
  field: FieldView | null;
  shot: PvpShot | null;
  intent: BatIntent | null;
  direction: ShotDirection | null;
  timing: string | null;
  outcome: PublicOutcome;
  symbol: string;
  score: ScoreView;
}

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
  /** This innings: runs and balls for each batter who has faced. */
  batters: Map<string, { runs: number; balls: number; fours: number; sixes: number; out: boolean }>;
  /** This innings: each bowler's balls, runs conceded and wickets. */
  bowlers: Map<string, { balls: number; runs: number; wickets: number }>;
  strikerId: string | null;
  nonStrikerId: string | null;
  bowlerId: string | null;
  /** The current over, ball by ball: '•', '1', '4', 'W', 'wd', 'nb'... */
  thisOver: string[];
  /** Every finished ball of the match, oldest first. */
  balls: BallRecord[];
  /** The field for the current ball: the bowling side's choice once bowled, else the automatic one. */
  field: FieldView | null;
}

/** Runs per over so far, to two decimals' worth of sense. */
export function runRate(runs: number, balls: number): number {
  return balls > 0 ? (runs * 6) / balls : 0;
}

/** The chase: runs needed, balls left, and the rate required. */
export function chase(score: ScoreView, totalBalls: number): { need: number; balls: number; rate: number } | null {
  if (score.target === null) return null;
  const need = Math.max(0, score.target - score.runs);
  const balls = Math.max(0, totalBalls - score.balls);
  return { need, balls, rate: balls > 0 ? (need * 6) / balls : 0 };
}

export function ballSymbol(e: Extract<MatchEvent, { kind: 'BALL_RESULT' }>): string {
  const o = e.outcome;
  if (o.wicket) return 'W';
  if (o.extras?.type === 'WIDE') return 'wd';
  if (o.extras?.type === 'NO_BALL') return `nb${o.runsOffBat ? o.runsOffBat : ''}`;
  if (o.extras?.type === 'BYE' || o.extras?.type === 'LEG_BYE') return `${o.extras.runs}${o.extras.type === 'BYE' ? 'b' : 'lb'}`;
  if (o.runsOffBat === 0) return '•';
  return String(o.runsOffBat);
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
    batters: new Map(),
    bowlers: new Map(),
    strikerId: null,
    nonStrikerId: null,
    bowlerId: null,
    thisOver: [],
    balls: [],
    field: null,
  };
  let lastReleased: Ev<'BALL_RELEASED'> | null = null;
  let lastOpen: Ev<'DELIVERY_OPEN'> | null = null;
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
        view.batters = new Map();
        view.bowlers = new Map();
        view.thisOver = [];
        break;
      case 'BOWLER_NEEDED':
        view.bowlerNeeded = e;
        view.phase = 'SELECT_BOWLER';
        view.actor = e.side;
        view.deadlineAt = e.deadlineAt;
        break;
      case 'BOWLER_SELECTED':
        view.bowlerNeeded = null;
        view.bowlerId = e.bowlerId;
        if (view.score.balls % 6 === 0) view.thisOver = [];
        break;
      case 'DELIVERY_OPEN':
        lastOpen = e;
        view.strikerId = e.strikerId;
        view.nonStrikerId = e.nonStrikerId;
        view.bowlerId = e.bowlerId;
        for (const id of [e.strikerId, e.nonStrikerId]) if (!view.batters.has(id)) view.batters.set(id, { runs: 0, balls: 0, fours: 0, sixes: 0, out: false });
        view.open = e;
        view.released = null;
        view.field = e.field;
        view.phase = 'AWAIT_BOWL';
        view.actor = (1 - view.battingSide) as 0 | 1;
        view.deadlineAt = e.deadlineAt;
        break;
      case 'BALL_RELEASED':
        view.released = e;
        lastReleased = e;
        if (e.field) view.field = e.field;
        view.phase = 'AWAIT_BAT';
        view.actor = view.battingSide;
        view.deadlineAt = e.deadlineAt;
        break;
      case 'BALL_RESULT': {
        if (lastOpen && lastOpen.deliveryId === e.deliveryId) {
          const o = e.outcome;
          const bat = view.batters.get(lastOpen.strikerId) ?? { runs: 0, balls: 0, fours: 0, sixes: 0, out: false };
          bat.runs += o.runsOffBat;
          if (o.extras?.type !== 'WIDE') bat.balls += 1;
          if (o.isBoundaryFour) bat.fours += 1;
          if (o.isBoundarySix) bat.sixes += 1;
          view.batters.set(lastOpen.strikerId, bat);
          if (o.dismissedPlayerId) {
            const gone = view.batters.get(o.dismissedPlayerId);
            if (gone) gone.out = true;
          }
          const bowl = view.bowlers.get(lastOpen.bowlerId) ?? { balls: 0, runs: 0, wickets: 0 };
          if (o.isLegalDelivery) bowl.balls += 1;
          // Byes and leg-byes are not the bowler's; wides and no-balls are.
          bowl.runs += o.runsOffBat + (o.extras && (o.extras.type === 'WIDE' || o.extras.type === 'NO_BALL') ? o.extras.runs : 0);
          if (o.wicket && o.wicket.type !== 'RUN_OUT') bowl.wickets += 1;
          view.bowlers.set(lastOpen.bowlerId, bowl);
          view.thisOver = [...view.thisOver, ballSymbol(e)];
          const rel = lastReleased && lastReleased.deliveryId === e.deliveryId ? lastReleased : null;
          view.balls.push({
            deliveryId: e.deliveryId,
            innings: lastOpen.innings,
            over: lastOpen.over,
            ball: lastOpen.ballInOver,
            bowlerId: lastOpen.bowlerId,
            strikerId: lastOpen.strikerId,
            deliveryType: rel?.deliveryType ?? null,
            plan: rel?.plan ?? null,
            fieldSetting: rel?.fieldSetting ?? null,
            field: rel?.field ?? lastOpen.field,
            shot: e.shot,
            intent: e.intent ?? null,
            direction: e.direction ?? null,
            timing: e.timing,
            outcome: o,
            symbol: ballSymbol(e),
            score: e.score,
          });
        }
        view.strikerId = e.strikerId;
        view.nonStrikerId = e.nonStrikerId;
        view.lastResult = e;
        view.score = e.score;
        view.phase = 'BETWEEN';
        view.actor = null;
        view.deadlineAt = null;
        break;
      }
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
