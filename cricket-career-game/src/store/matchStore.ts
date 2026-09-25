/**
 * State for one match being played on screen.
 *
 * The engine's `LiveMatch` is kept outside React (it is a mutable object with a
 * closure inside), and the store holds only the snapshot the screen renders.
 * Every call that advances play takes a fresh snapshot, so components re-render
 * exactly once per action.
 */
import { create } from 'zustand';
import { commitMatch } from '@/engine/match/commit';
import { buildMatch, defaultXiIds, squadFor, type MatchBuild } from '@/engine/match/lineup';
import { createLiveMatch, type LiveMatch, type LiveSnapshot } from '@/engine/match/live';
import type { BallOverrides } from '@/engine/match/innings';
import type { BowlerPlan, FieldSetting, SimPlayer } from '@/engine/match/types';
import { useGameStore } from './gameStore';
import type { Ball, Fixture, GameState, Id, Match } from '@/types';

/** How long one ball takes to play out, by speed setting. */
export const BALL_SPEEDS = [
  { label: 'Slow', ms: 2600 },
  { label: 'Normal', ms: 1500 },
  { label: 'Fast', ms: 800 },
  { label: 'Turbo', ms: 320 },
];

export type MatchStage = 'SETUP' | 'PRE_MATCH' | 'PLAYING' | 'BREAK' | 'DONE';

export interface MatchDecisions {
  /** Batting aggression, 1-5. */
  intent: number;
  /** Preferred direction to hit in, in degrees, or null for no preference. */
  shotPreference: number | null;
  /** Parts of the bowler's plan the player has set. */
  plan: Partial<BowlerPlan>;
  /** Bowling from round the wicket rather than over it. */
  roundTheWicket: boolean;
  /** Named field preset. */
  fieldPreset: string | null;
  /** A field the player arranged themselves; wins over the preset. */
  field: FieldSetting | null;
  /** Bowler to hand the next over to. */
  nextBowlerId: Id | null;
}

interface MatchStore {
  stage: MatchStage;
  fixture: Fixture | null;
  build: MatchBuild | null;
  snap: LiveSnapshot | null;
  /** The whole squad the user picks their XI from. */
  squad: SimPlayer[];
  xiIds: Id[];
  userSelected: boolean;
  decisions: MatchDecisions;
  /** Index into BALL_SPEEDS. */
  speed: number;
  autoPlay: boolean;
  /** The most recent ball, for the animation layer. */
  lastBall: Ball | null;
  /** Set once the match has been written back to the career. */
  committed: Match | null;
  error: string | null;

  /** Open the pre-match screen for a fixture. */
  open: (state: GameState, fixture: Fixture) => void;
  setXi: (ids: Id[]) => void;
  toggleXi: (id: Id) => void;
  resetXi: () => void;
  /** Leave the pre-match screen and go out to the middle. */
  start: () => void;
  toss: (decision?: 'BAT' | 'BOWL') => void;

  nextBall: () => void;
  nextOver: () => void;
  toNextWicket: () => void;
  toEndOfInnings: () => void;
  startNextInnings: () => void;
  /** Play the rest out without watching it. */
  simulateRest: () => void;
  /** Play the whole fixture out from the pre-match screen. */
  quickSim: (state: GameState, fixture: Fixture) => Match | null;

  setDecisions: (patch: Partial<MatchDecisions>) => void;
  setSpeed: (index: number) => void;
  setAutoPlay: (on: boolean) => void;
  availableBowlers: () => SimPlayer[];
  playerById: (id: Id) => SimPlayer | undefined;
  close: () => void;
}

const DEFAULT_DECISIONS: MatchDecisions = {
  intent: 3,
  shotPreference: null,
  plan: {},
  roundTheWicket: false,
  fieldPreset: null,
  field: null,
  nextBowlerId: null,
};

/** Lives outside the store: mutable, and nothing renders from it directly. */
let live: LiveMatch | null = null;

export const useMatchStore = create<MatchStore>((set, get) => {
  /** Read the engine back into the store after anything that changed it. */
  const sync = (lastBall?: Ball | null) => {
    if (!live) return;
    const snap = live.snapshot();
    const stage: MatchStage =
      snap.phase === 'COMPLETE' ? 'DONE' : snap.phase === 'INNINGS_BREAK' ? 'BREAK' : 'PLAYING';

    set((s) => ({
      snap,
      stage,
      lastBall: lastBall === undefined ? s.lastBall : lastBall,
      // A new over needs a fresh choice of bowler.
      decisions:
        snap.current?.bowlerId && snap.current.bowlerId === s.decisions.nextBowlerId
          ? { ...s.decisions, nextBowlerId: null }
          : s.decisions,
      autoPlay: stage === 'PLAYING' ? s.autoPlay : false,
    }));

    if (snap.phase === 'COMPLETE') commit();
  };

  /** Write the finished match back into the career, exactly once. */
  const commit = () => {
    if (!live || get().committed) return;
    const done = live.finished();
    if (!done) return;
    const userPlayed = get().userSelected;
    useGameStore.getState().update((state) => commitMatch(state, done.match, { userPlayed }));
    set({ committed: done.match });
  };

  /** The overrides that apply right now, given who is batting. */
  const overridesNow = (): BallOverrides => {
    const { decisions, snap } = get();
    if (!snap?.current) return {};
    const overrides: BallOverrides = {};

    if (snap.userBatting) {
      overrides.intentLevel = decisions.intent;
      overrides.shotPreference = decisions.shotPreference;
    }
    if (snap.userBowling) {
      if (decisions.nextBowlerId) overrides.bowlerId = decisions.nextBowlerId;
      if (Object.keys(decisions.plan).length > 0) overrides.plan = decisions.plan;
      if (decisions.roundTheWicket) overrides.aroundTheWicket = true;
      if (decisions.field) overrides.field = decisions.field;
      else if (decisions.fieldPreset) overrides.fieldPreset = decisions.fieldPreset;
    }
    return overrides;
  };

  return {
    stage: 'SETUP',
    fixture: null,
    build: null,
    snap: null,
    squad: [],
    xiIds: [],
    userSelected: true,
    decisions: DEFAULT_DECISIONS,
    speed: 1,
    autoPlay: false,
    lastBall: null,
    committed: null,
    error: null,

    open: (state, fixture) => {
      live = null;
      const teamId = fixture.homeTeamId && state.teams[fixture.homeTeamId]?.isUserTeam
        ? fixture.homeTeamId
        : fixture.awayTeamId;
      if (!teamId) {
        set({ error: 'That fixture has no teams yet.', stage: 'SETUP' });
        return;
      }
      const squad = [
        {
          id: state.player.id,
          name: `${state.player.firstName} ${state.player.lastName}`,
          teamId,
          role: state.player.role,
          battingStyle: state.player.battingStyle,
          bowlingStyle: state.player.bowlingStyle,
          attributes: state.player.attributes,
          condition: state.player.condition,
          battingPosition: 4,
          isUser: true,
        } satisfies SimPlayer,
        ...squadFor(state, teamId),
      ];

      set({
        stage: 'PRE_MATCH',
        fixture,
        build: buildMatch(state, fixture),
        squad,
        xiIds: defaultXiIds(squad, state.player.id),
        userSelected: true,
        snap: null,
        lastBall: null,
        committed: null,
        decisions: DEFAULT_DECISIONS,
        autoPlay: false,
        error: null,
      });
    },

    setXi: (ids) => set({ xiIds: ids }),

    toggleXi: (id) =>
      set((s) => {
        if (s.xiIds.includes(id)) {
          return { xiIds: s.xiIds.filter((x) => x !== id), userSelected: id === s.squad[0]?.id ? false : s.userSelected };
        }
        if (s.xiIds.length >= 11) return s;
        return {
          xiIds: [...s.xiIds, id],
          userSelected: id === s.squad[0]?.id ? true : s.userSelected,
        };
      }),

    resetXi: () =>
      set((s) => {
        const state = useGameStore.getState().state;
        if (!state) return s;
        return { xiIds: defaultXiIds(s.squad, state.player.id), userSelected: true };
      }),

    start: () => {
      const { fixture, xiIds, userSelected } = get();
      const state = useGameStore.getState().state;
      if (!state || !fixture) return;
      const build = buildMatch(state, fixture, { userXiIds: xiIds, userSelected });
      if (!build) {
        set({ error: 'That fixture cannot be played.' });
        return;
      }
      live = createLiveMatch(build.setup);
      set({ build, stage: 'PLAYING', committed: null, lastBall: null });
      sync(null);
    },

    toss: (decision) => {
      live?.doToss(decision);
      sync(null);
    },

    nextBall: () => {
      if (!live) return;
      const ball = live.nextBall(overridesNow());
      sync(ball);
    },

    nextOver: () => {
      if (!live) return;
      const balls = live.nextOver(overridesNow());
      sync(balls[balls.length - 1] ?? null);
    },

    toNextWicket: () => {
      if (!live) return;
      const balls = live.toNextWicket(overridesNow());
      sync(balls[balls.length - 1] ?? null);
    },

    toEndOfInnings: () => {
      if (!live) return;
      const balls = live.toEndOfInnings(overridesNow());
      sync(balls[balls.length - 1] ?? null);
    },

    startNextInnings: () => {
      live?.startNextInnings();
      sync(null);
    },

    simulateRest: () => {
      if (!live) return;
      live.toEnd();
      sync(null);
    },

    quickSim: (state, fixture) => {
      const build = buildMatch(state, fixture);
      if (!build) {
        set({ error: 'That fixture cannot be played.' });
        return null;
      }
      const match = createLiveMatch(build.setup);
      match.toEnd();
      const done = match.finished();
      if (!done) return null;
      useGameStore.getState().update((s) => commitMatch(s, done.match, { userPlayed: true }));
      return done.match;
    },

    setDecisions: (patch) => set((s) => ({ decisions: { ...s.decisions, ...patch } })),
    setSpeed: (index) => set({ speed: Math.max(0, Math.min(BALL_SPEEDS.length - 1, index)) }),
    setAutoPlay: (on) => set({ autoPlay: on }),

    availableBowlers: () => live?.availableBowlers() ?? [],
    playerById: (id) => live?.playerById(id),

    close: () => {
      live = null;
      set({
        stage: 'SETUP',
        fixture: null,
        build: null,
        snap: null,
        squad: [],
        xiIds: [],
        lastBall: null,
        committed: null,
        autoPlay: false,
        decisions: DEFAULT_DECISIONS,
        error: null,
      });
    },
  };
});

/** Test-only: forget the engine instance between cases. */
export function __resetMatchStore(): void {
  live = null;
  useMatchStore.setState({
    stage: 'SETUP',
    fixture: null,
    build: null,
    snap: null,
    squad: [],
    xiIds: [],
    userSelected: true,
    decisions: DEFAULT_DECISIONS,
    speed: 1,
    autoPlay: false,
    lastBall: null,
    committed: null,
    error: null,
  });
}
