/**
 * State for one match being played on screen.
 *
 * This is a career game: the player controls their own player - how they bat,
 * what they bowl when the captain gives them the ball, and the catches and
 * run-outs that come their way. Team controls (the bowler each over, the
 * field, instructions to the batters, reviews, declarations) unlock only when
 * the player is captain, and each can be handed to the AI vice-captain.
 *
 * The engine's `LiveMatch` is kept outside React (it is a mutable object with
 * a closure inside); the store holds only the snapshot the screen renders.
 */
import { create } from 'zustand';
import { isCaptainOf } from '@/engine/career/captaincy';
import { emptyTacticalLog, type TacticalLog } from '@/engine/career/afterMatch';
import { applyPressConference, type PressConference } from '@/engine/career/press';
import {
  reviewCaptainXi,
  selectForFixture,
  userTeamOf,
  type SelectionDecision,
  type XiReview,
} from '@/engine/career/selection';
import { commitMatchDetailed, type CommitResult } from '@/engine/match/commit';
import { buildMatch, type MatchBuild } from '@/engine/match/lineup';
import { createLiveMatch, type LiveMatch, type LiveSnapshot } from '@/engine/match/live';
import type { BallOverrides, RiskEstimate } from '@/engine/match/innings';
import type { BowlerPlan, FieldSetting, SimPlayer } from '@/engine/match/types';
import { fieldProblems } from '@/lib/fieldRules';
import { useGameStore } from './gameStore';
import { DEFAULT_AGGRESSION } from '@/types';
import type { Ball, CaptainDelegation, Condition, Fixture, GameState, Id, Match } from '@/types';

/** How long one ball takes to play out, by speed setting. */
export const BALL_SPEEDS = [
  { label: 'Slow', ms: 2600 },
  { label: 'Normal', ms: 1500 },
  { label: 'Fast', ms: 800 },
  { label: 'Turbo', ms: 320 },
];

/** Speed used while the player is not involved and the match is watching itself. */
export const WATCH_SPEED = 3;

export type MatchStage = 'SETUP' | 'PRE_MATCH' | 'TOSS' | 'PLAYING' | 'BREAK' | 'DONE';

/** The five things a batter can try with one ball. */
export type BallIntent = 'LEAVE' | 'DEFEND' | 'ROTATE' | 'ATTACK' | 'BIG_SHOT';

export const BALL_INTENTS: { id: BallIntent; label: string; help: string }[] = [
  { id: 'LEAVE', label: 'Leave', help: 'No shot. Safe outside off, a gamble on the stumps.' },
  { id: 'DEFEND', label: 'Defend', help: 'Keep it out. Almost no risk, almost no runs.' },
  { id: 'ROTATE', label: 'Rotate', help: 'Work it into a gap for a single.' },
  { id: 'ATTACK', label: 'Attack', help: 'Look for the boundary.' },
  { id: 'BIG_SHOT', label: 'Big shot', help: 'Go aerial. Boundaries - and chances.' },
];

function intentOverrides(intent: BallIntent): BallOverrides {
  switch (intent) {
    case 'LEAVE':
      return { leave: true, intentLevel: 1 };
    case 'DEFEND':
      return { intentLevel: 1 };
    case 'ROTATE':
      return { intentLevel: 3, rotate: true };
    case 'ATTACK':
      return { intentLevel: 4 };
    case 'BIG_SHOT':
      return { intentLevel: 5 };
  }
}

/** Decisions that are always the player's own. */
export interface PlayerDecisions {
  /**
   * The player's batting aggression, 1 (very defensive) to 5 (very
   * aggressive). Theirs alone: it never changes unless they change it.
   */
  batting: number;
  /** The player's bowling aggression, 1 (contain) to 5 (all-out attack). */
  bowling: number;
  /** Preferred direction to hit in, degrees, or null. */
  shotPreference: number | null;
  /** The player's own bowling: line, length, variation. */
  plan: Partial<BowlerPlan>;
  roundTheWicket: boolean;
}

/** Decisions that are the player's only as captain. */
export interface CaptainDecisions {
  instruction: 'ATTACK' | 'ROTATE' | 'PROTECT' | null;
  targetBowlerId: Id | null;
  nextBowlerId: Id | null;
  fieldPreset: string | null;
  field: FieldSetting | null;
  /** Aggression the captain has set for particular batters; the rest read the game. */
  batterLevels: Record<Id, number>;
  /** Aggression the captain has set for particular bowlers; the rest bowl their normal game. */
  bowlerLevels: Record<Id, number>;
}

/** Everything the post-match screen needs to show what the match did. */
export interface AfterMatch {
  match: Match;
  result: CommitResult;
  conditionBefore: Condition;
  press: PressConference | null;
  pressAnswered: boolean;
}

interface MatchStore {
  stage: MatchStage;
  fixture: Fixture | null;
  selection: SelectionDecision | null;
  /** True when the player captains this match - team controls unlock. */
  captain: boolean;
  delegate: CaptainDelegation | null;
  /** The captain's proposed XI, in batting order. */
  proposedIds: Id[];
  xiReview: XiReview | null;
  build: MatchBuild | null;
  snap: LiveSnapshot | null;
  player: PlayerDecisions;
  captainDecisions: CaptainDecisions;
  speed: number;
  autoPlay: boolean;
  /** Watch the match go by at speed while the player is not involved. */
  autoWatch: boolean;
  lastBall: Ball | null;
  after: AfterMatch | null;
  error: string | null;

  open: (state: GameState, fixture: Fixture) => void;
  /** Captain only: bring a player into or out of the proposed XI. */
  toggleProposed: (id: Id) => void;
  /** Captain only: move a player up or down the proposed batting order. */
  moveProposed: (id: Id, by: number) => void;
  resetProposed: () => void;
  /** Lock the XI in and go to the toss. */
  toToss: () => void;
  toss: (decision?: 'BAT' | 'BOWL') => void;

  playBall: (intent?: BallIntent) => void;
  nextOver: () => void;
  toNextWicket: () => void;
  untilInvolved: () => void;
  /** Keep batting at the set aggression until the player is out. */
  untilDismissed: () => void;
  toEndOfInnings: () => void;
  startNextInnings: () => void;
  simulateRest: () => void;
  answer: (response: { timing?: number; review?: boolean }) => void;
  declare: () => void;
  chooseFollowOn: (enforce: boolean) => void;
  answerPress: (answers: Record<string, string>) => void;
  quickSim: (state: GameState, fixture: Fixture) => Match | null;

  setPlayer: (patch: Partial<PlayerDecisions>) => void;
  setCaptain: (patch: Partial<CaptainDecisions>) => void;
  setDelegate: (patch: Partial<CaptainDelegation>) => void;
  setSpeed: (index: number) => void;
  setAutoPlay: (on: boolean) => void;
  setAutoWatch: (on: boolean) => void;
  availableBowlers: () => SimPlayer[];
  suggestedBowler: () => SimPlayer | null;
  playerById: (id: Id) => SimPlayer | undefined;
  /** How risky a batting level is for this batter right now. */
  riskFor: (batterId: Id, level: number) => RiskEstimate | null;
  close: () => void;
}

const DEFAULT_PLAYER: PlayerDecisions = {
  batting: DEFAULT_AGGRESSION.batting,
  bowling: DEFAULT_AGGRESSION.bowling,
  shotPreference: null,
  plan: {},
  roundTheWicket: false,
};

const DEFAULT_CAPTAIN: CaptainDecisions = {
  instruction: null,
  targetBowlerId: null,
  nextBowlerId: null,
  fieldPreset: null,
  field: null,
  batterLevels: {},
  bowlerLevels: {},
};

const clampLevel = (level: number) => Math.max(1, Math.min(5, Math.round(level)));

/** The player's saved levels, from the career. */
function savedPlayer(state: GameState | null): PlayerDecisions {
  const saved = state?.career.aggression ?? DEFAULT_AGGRESSION;
  return { ...DEFAULT_PLAYER, batting: clampLevel(saved.batting), bowling: clampLevel(saved.bowling) };
}

/** Lives outside the store: mutable, and nothing renders from it directly. */
let live: LiveMatch | null = null;
let tactics: TacticalLog = emptyTacticalLog();
let conditionBefore: Condition | null = null;

const devBuild = () => import.meta.env.DEV === true;

export const useMatchStore = create<MatchStore>((set, get) => {
  const userId = () => useGameStore.getState().state?.player.id ?? null;

  /** Read the engine back into the store after anything that changed it. */
  const sync = (lastBall?: Ball | null) => {
    if (!live) return;
    const snap = live.snapshot();
    const stage: MatchStage =
      snap.phase === 'COMPLETE'
        ? 'DONE'
        : snap.phase === 'INNINGS_BREAK'
          ? 'BREAK'
          : snap.phase === 'TOSS'
            ? 'TOSS'
            : 'PLAYING';

    set((s) => ({
      snap,
      stage,
      lastBall: lastBall === undefined ? s.lastBall : lastBall,
      // A new over needs a fresh choice of bowler.
      captainDecisions:
        snap.current?.bowlerId && snap.current.bowlerId === s.captainDecisions.nextBowlerId
          ? { ...s.captainDecisions, nextBowlerId: null }
          : s.captainDecisions,
      // Stop the clock for a question, or when play stops.
      autoPlay: stage === 'PLAYING' && !snap.question ? s.autoPlay : false,
    }));

    if (snap.phase === 'COMPLETE') commit();
  };

  /** Captain's calls that are still theirs (not handed to the vice-captain). */
  const calls = (area: keyof CaptainDelegation) => get().captain && !(get().delegate?.[area] ?? false);

  /** The overrides that apply right now, given who is batting and bowling. */
  const overridesNow = (perBall?: BallOverrides): BallOverrides => {
    const { player, captainDecisions, snap } = get();
    const me = userId();
    const overrides: BallOverrides = {
      // The player's own decisions only ever reach their own player.
      battingFor: me,
      bowlingFor: me,
      shotPreference: player.shotPreference,
      plan: Object.keys(player.plan).length > 0 ? player.plan : undefined,
      aroundTheWicket: player.roundTheWicket,
      // Always sent: the player's level holds until they change it. A per-ball
      // choice overrides it for that one ball.
      intentLevel: player.batting,
      bowlingAggression: player.bowling,
      ...perBall,
    };
    if (!snap?.current) return overrides;

    if (snap.userBatting && calls('instructions')) {
      overrides.instruction = captainDecisions.instruction;
      overrides.targetBowlerId = captainDecisions.targetBowlerId;
      overrides.batterLevels = captainDecisions.batterLevels;
    }
    if (snap.userBowling) {
      if (calls('bowling')) overrides.bowlerLevels = captainDecisions.bowlerLevels;
      if (calls('bowling') && captainDecisions.nextBowlerId) {
        overrides.bowlerId = captainDecisions.nextBowlerId;
      }
      if (calls('field')) {
        const venue = get().build?.setup.venue;
        const field = captainDecisions.field;
        const over = Math.floor(snap.current.balls / 6);
        // An illegal field never reaches the engine; the umpire would not allow it.
        const legal = field && venue ? fieldProblems(field, venue, snap.format, over).length === 0 : false;
        if (field && legal) overrides.field = field;
        else if (captainDecisions.fieldPreset) overrides.fieldPreset = captainDecisions.fieldPreset;
      }
    }
    return overrides;
  };

  /** Note the captain's bowling change for the tactics score. */
  const logBowlingChoice = (balls: Ball[], choice: Id | null, suggested: Id | null) => {
    if (!choice || !live) return;
    const first = balls.find((b) => b.bowlerId === choice && b.ballInOver === 1);
    const innings = live.snapshot().current?.number ?? live.snapshot().completed.at(-1)?.number;
    if (first && innings !== undefined) {
      tactics.bowlingChoices.push({ innings, over: first.over, bowlerId: choice, suggestedId: suggested });
    }
  };

  /** Run one engine call and keep everything in step afterwards. */
  const run = (fn: (overrides: BallOverrides) => Ball[] | Ball | null, perBall?: BallOverrides) => {
    if (!live) return;
    const overrides = overridesNow(perBall);
    const choice = get().captainDecisions.nextBowlerId;
    const suggested = choice ? (live.suggestBowler()?.id ?? null) : null;
    const result = fn(overrides);
    const balls = Array.isArray(result) ? result : result ? [result] : [];
    logBowlingChoice(balls, choice, suggested);

    // With nobody choosing bowlers, name the next one straight away so the
    // player knows before the first ball whether it is their over.
    const snap = live.snapshot();
    if (snap.phase === 'IN_PLAY' && !snap.question && !(snap.userBowling && calls('bowling'))) {
      live.prepareNextOver(overridesNow());
    }
    sync(balls[balls.length - 1] ?? null);
  };

  /** Write the finished match back into the career, exactly once. */
  const commit = () => {
    if (!live || get().after) return;
    const done = live.finished();
    const gameState = useGameStore.getState().state;
    if (!done || !gameState) return;
    const { selection, captain, xiReview, build } = get();
    const me = gameState.player.id;
    const userSide = build
      ? build.userTeamId === build.setup.homeTeamId
        ? build.setup.homeXi
        : build.setup.awayXi
      : [];
    const userPlayed = userSide.some((p) => p.id === me);

    // The player's reviews, as recorded by the engine.
    for (const moment of live.snapshot().moments) {
      if (moment.kind === 'REVIEW') tactics.reviews.push({ success: moment.success });
    }

    const result = commitMatchDetailed(gameState, done.match, {
      userPlayed,
      selection: selection ? { status: selection.status, reasons: selection.reasons } : null,
      teammateIds: userSide.map((p) => p.id),
      captain: captain ? { log: tactics, xiChanges: xiReview } : null,
    });
    useGameStore.getState().update(() => result.state);
    const stored = result.state.matches[done.match.id] ?? done.match;
    set({
      after: {
        match: stored,
        result,
        conditionBefore: conditionBefore ?? gameState.player.condition,
        press: result.press,
        pressAnswered: false,
      },
    });
  };

  /** Build the match for the chosen XI. Same seed, so conditions never change. */
  const buildFor = (state: GameState, fixture: Fixture, xiIds: Id[], captain: boolean) => {
    const selection = get().selection;
    const me = state.player.id;
    return buildMatch(state, fixture, {
      userOrder: xiIds,
      userSelected: xiIds.includes(me),
      userIsCaptain: captain,
      bowlerTrust: selection ? { [me]: selection.bowlingTrust } : undefined,
    });
  };

  return {
    stage: 'SETUP',
    fixture: null,
    selection: null,
    captain: false,
    delegate: null,
    proposedIds: [],
    xiReview: null,
    build: null,
    snap: null,
    player: DEFAULT_PLAYER,
    captainDecisions: DEFAULT_CAPTAIN,
    speed: 1,
    autoPlay: false,
    autoWatch: true,
    lastBall: null,
    after: null,
    error: null,

    open: (state, fixture) => {
      live = null;
      tactics = emptyTacticalLog();
      conditionBefore = structuredClone(state.player.condition);
      const team = userTeamOf(state, fixture);
      const selection = selectForFixture(state, fixture);
      if (!team || !selection) {
        set({ error: 'That fixture has no side for you yet.', stage: 'SETUP' });
        return;
      }
      const captain = isCaptainOf(state, team.id, devBuild(), fixture.format);
      const xiIds = selection.xi.map((p) => p.id);
      const build = buildFor(state, fixture, xiIds, captain);
      // A preview match, so the pitch and weather can be read before the toss.
      live = build ? createLiveMatch({ ...build.setup, delegate: state.career.captaincy.delegate }) : null;

      set({
        stage: 'PRE_MATCH',
        fixture,
        selection,
        captain,
        delegate: state.career.captaincy.delegate,
        proposedIds: xiIds,
        xiReview: null,
        build,
        snap: live?.snapshot() ?? null,
        player: savedPlayer(state),
        captainDecisions: DEFAULT_CAPTAIN,
        autoPlay: false,
        lastBall: null,
        after: null,
        error: build ? null : 'That fixture cannot be played.',
      });
    },

    toggleProposed: (id) =>
      set((s) => {
        if (!s.captain) return s;
        if (s.proposedIds.includes(id)) return { proposedIds: s.proposedIds.filter((x) => x !== id) };
        if (s.proposedIds.length >= 11) return s;
        return { proposedIds: [...s.proposedIds, id] };
      }),

    moveProposed: (id, by) =>
      set((s) => {
        if (!s.captain) return s;
        const index = s.proposedIds.indexOf(id);
        const target = index + by;
        if (index === -1 || target < 0 || target >= s.proposedIds.length) return s;
        const next = [...s.proposedIds];
        [next[index], next[target]] = [next[target], next[index]];
        return { proposedIds: next };
      }),

    resetProposed: () => set((s) => ({ proposedIds: s.selection?.xi.map((p) => p.id) ?? [] })),

    toToss: () => {
      const { fixture, selection, captain, proposedIds } = get();
      const state = useGameStore.getState().state;
      if (!state || !fixture || !selection) return;

      let xiIds = selection.xi.map((p) => p.id);
      let xiReview: XiReview | null = null;
      if (captain && proposedIds.length === 11) {
        // The selectors have the final say on the captain's XI.
        xiReview = reviewCaptainXi(state, fixture, selection, proposedIds);
        xiIds = xiReview.xiIds;
      }
      const build = buildFor(state, fixture, xiIds, captain);
      if (!build) {
        set({ error: 'That fixture cannot be played.' });
        return;
      }
      live = createLiveMatch({ ...build.setup, delegate: get().delegate ?? undefined });
      set({ build, xiReview, stage: 'TOSS', after: null, lastBall: null });
      sync(null);
    },

    toss: (decision) => {
      if (!live) return;
      live.doToss(get().captain && !get().delegate?.toss ? decision : undefined);
      const snap = live.snapshot();
      if (snap.phase === 'IN_PLAY' && !(snap.userBowling && calls('bowling'))) {
        live.prepareNextOver(overridesNow());
      }
      sync(null);
    },

    playBall: (intent) =>
      run((o) => live!.nextBall(o), intent ? intentOverrides(intent) : undefined),
    nextOver: () => run((o) => live!.nextOver(o)),
    toNextWicket: () => run((o) => live!.toNextWicket(o)),
    untilInvolved: () => run((o) => live!.untilInvolved(o)),

    untilDismissed: () =>
      run((o) => {
        const balls: Ball[] = [];
        const me = userId();
        let guard = 0;
        while (live && live.snapshot().phase === 'IN_PLAY' && guard < 2000) {
          guard += 1;
          const snap = live.snapshot();
          if (snap.question || !snap.involvement.atCrease) break;
          const ball = live.nextBall(o);
          if (!ball) break;
          balls.push(ball);
          if (ball.wicket && (ball.strikerId === me || ball.nonStrikerId === me)) {
            const out = live.snapshot().current?.batting.find((b) => b.playerId === me)?.out;
            if (out !== false) break;
          }
        }
        return balls;
      }),

    toEndOfInnings: () => run((o) => live!.toEndOfInnings(o)),

    startNextInnings: () => {
      if (!live) return;
      live.startNextInnings();
      const snap = live.snapshot();
      if (snap.phase === 'IN_PLAY' && !(snap.userBowling && calls('bowling'))) {
        live.prepareNextOver(overridesNow());
      }
      sync(null);
    },

    simulateRest: () => {
      if (!live) return;
      // Anything still waiting on the player is settled on average timing.
      if (live.snapshot().question) live.answer({ timing: 0.5, review: false });
      live.toEnd(overridesNow());
      sync(null);
    },

    answer: (response) => {
      if (!live) return;
      const ball = live.answer(response);
      const snap = live.snapshot();
      if (snap.phase === 'IN_PLAY' && !snap.question && !(snap.userBowling && calls('bowling'))) {
        live.prepareNextOver(overridesNow());
      }
      sync(ball);
    },

    declare: () => {
      if (live?.declare()) {
        tactics.declared = true;
        sync(null);
      }
    },

    chooseFollowOn: (enforce) => {
      if (!live) return;
      tactics.followOnEnforced = enforce;
      live.chooseFollowOn(enforce);
      sync(null);
    },

    answerPress: (answers) => {
      const after = get().after;
      if (!after?.press) return;
      useGameStore
        .getState()
        .update((state) =>
          applyPressConference(state, after.press!, answers, state.season.currentDate),
        );
      set({ after: { ...after, pressAnswered: true } });
    },

    quickSim: (state, fixture) => {
      const selection = selectForFixture(state, fixture);
      const team = userTeamOf(state, fixture);
      if (!selection || !team) {
        set({ error: 'That fixture cannot be played.' });
        return null;
      }
      const captain = isCaptainOf(state, team.id, devBuild(), fixture.format);
      const me = state.player.id;
      const xiIds = selection.xi.map((p) => p.id);
      const build = buildMatch(state, fixture, {
        userOrder: xiIds,
        userSelected: xiIds.includes(me),
        userIsCaptain: captain,
        bowlerTrust: { [me]: selection.bowlingTrust },
      });
      if (!build) return null;
      // Simmed: the vice-captain makes every call; the player bats and bowls
      // at their own saved levels.
      const match = createLiveMatch(build.setup);
      const levels = savedPlayer(state);
      match.toEnd({
        battingFor: me,
        bowlingFor: me,
        intentLevel: levels.batting,
        bowlingAggression: levels.bowling,
      });
      const done = match.finished();
      if (!done) return null;
      const result = commitMatchDetailed(state, done.match, {
        userPlayed: xiIds.includes(me),
        selection: { status: selection.status, reasons: selection.reasons },
        teammateIds: xiIds,
        captain: captain ? { log: emptyTacticalLog(), xiChanges: null } : null,
      });
      useGameStore.getState().update(() => result.state);
      return result.state.matches[done.match.id] ?? done.match;
    },

    setPlayer: (patch) => {
      const next = { ...get().player, ...patch };
      next.batting = clampLevel(next.batting);
      next.bowling = clampLevel(next.bowling);
      set({ player: next });
      // The levels are the player's and last from match to match.
      if (patch.batting !== undefined || patch.bowling !== undefined) {
        useGameStore.getState().update((state) => ({
          ...state,
          career: { ...state.career, aggression: { batting: next.batting, bowling: next.bowling } },
        }));
      }
    },
    setCaptain: (patch) => set((s) => ({ captainDecisions: { ...s.captainDecisions, ...patch } })),
    setDelegate: (patch) => {
      const delegate = { ...(get().delegate ?? useGameStore.getState().state!.career.captaincy.delegate), ...patch };
      set({ delegate });
      // Remembered for the next match.
      useGameStore.getState().update((state) => ({
        ...state,
        career: { ...state.career, captaincy: { ...state.career.captaincy, delegate } },
      }));
    },
    setSpeed: (index) => set({ speed: Math.max(0, Math.min(BALL_SPEEDS.length - 1, index)) }),
    setAutoPlay: (on) => set({ autoPlay: on }),
    setAutoWatch: (on) => set({ autoWatch: on }),

    availableBowlers: () => live?.availableBowlers() ?? [],
    suggestedBowler: () => live?.suggestBowler() ?? null,
    playerById: (id) => live?.playerById(id),
    riskFor: (batterId, level) => live?.riskFor(batterId, level) ?? null,

    close: () => {
      live = null;
      tactics = emptyTacticalLog();
      set({
        stage: 'SETUP',
        fixture: null,
        selection: null,
        captain: false,
        proposedIds: [],
        xiReview: null,
        build: null,
        snap: null,
        lastBall: null,
        after: null,
        autoPlay: false,
        player: DEFAULT_PLAYER,
        captainDecisions: DEFAULT_CAPTAIN,
        error: null,
      });
    },
  };
});

/** Test-only: forget the engine instance between cases. */
export function __resetMatchStore(): void {
  live = null;
  tactics = emptyTacticalLog();
  conditionBefore = null;
  useMatchStore.setState({
    stage: 'SETUP',
    fixture: null,
    selection: null,
    captain: false,
    delegate: null,
    proposedIds: [],
    xiReview: null,
    build: null,
    snap: null,
    player: DEFAULT_PLAYER,
    captainDecisions: DEFAULT_CAPTAIN,
    speed: 1,
    autoPlay: false,
    autoWatch: true,
    lastBall: null,
    after: null,
    error: null,
  });
}
