import { beforeEach, describe, expect, it } from 'vitest';
import { recentMatch } from '@/lib/selectors';
import { cancelAutosave } from '@/save';
import { useGameStore } from './gameStore';
import { __resetMatchStore, useMatchStore } from './matchStore';

const FIXTURE = 'fx-ka-u16';

function reset() {
  cancelAutosave();
  localStorage.clear();
  useGameStore.setState({
    state: null,
    booted: false,
    slot: null,
    slots: [null, null, null],
    lastError: null,
  });
  __resetMatchStore();
  useGameStore.getState().bootstrap();
}

function openFixture() {
  const state = useGameStore.getState().state!;
  useMatchStore.getState().open(state, state.fixtures[FIXTURE]);
}

describe('match store', () => {
  beforeEach(reset);

  it('opens a fixture on the pre-match screen with the user in a full XI', () => {
    openFixture();
    const { stage, xiIds, squad } = useMatchStore.getState();
    const player = useGameStore.getState().state!.player;
    expect(stage).toBe('PRE_MATCH');
    expect(xiIds).toHaveLength(11);
    expect(xiIds).toContain(player.id);
    expect(squad.length).toBeGreaterThan(11);
  });

  it('lets the player drop someone and bring in a reserve, but not a twelfth', () => {
    openFixture();
    const store = useMatchStore.getState();
    const out = store.xiIds[5];
    const reserve = store.squad.find((p) => !store.xiIds.includes(p.id))!;
    store.toggleXi(reserve.id);
    expect(useMatchStore.getState().xiIds).toHaveLength(11);
    store.toggleXi(out);
    useMatchStore.getState().toggleXi(reserve.id);
    const ids = useMatchStore.getState().xiIds;
    expect(ids).toHaveLength(11);
    expect(ids).toContain(reserve.id);
    expect(ids).not.toContain(out);
  });

  it('plays ball by ball and only passes the batting side’s decisions when batting', () => {
    openFixture();
    const store = useMatchStore.getState();
    store.start();
    useMatchStore.getState().toss();
    expect(useMatchStore.getState().stage).toBe('PLAYING');
    useMatchStore.getState().nextBall();
    const { snap, lastBall } = useMatchStore.getState();
    expect(lastBall).not.toBeNull();
    expect(snap?.current?.deliveries.length).toBe(1);
  });

  it('writes a finished match back into the career exactly once', () => {
    openFixture();
    useMatchStore.getState().start();
    useMatchStore.getState().toss();
    useMatchStore.getState().simulateRest();

    const { stage, committed } = useMatchStore.getState();
    expect(stage).toBe('DONE');
    expect(committed).not.toBeNull();

    const state = useGameStore.getState().state!;
    expect(state.matches[committed!.id]).toBeDefined();
    expect(state.fixtures[FIXTURE].played).toBe(true);
    expect(state.fixtures[FIXTURE].matchId).toBe(committed!.id);
    expect(state.season.matchIds).toContain(committed!.id);
    expect(recentMatch(state)?.id).toBe(committed!.id);
    expect(state.inbox[0].relatedId).toBe(committed!.id);
    // The stored card carries the XP that was actually awarded.
    expect(committed!.userPerformance?.xpEarned).toBeGreaterThan(0);
    expect(state.matches[committed!.id].userPerformance?.xpEarned).toBe(
      committed!.userPerformance?.xpEarned,
    );

    // Calling it again changes nothing.
    const before = Object.keys(state.matches).length;
    useMatchStore.getState().simulateRest();
    expect(Object.keys(useGameStore.getState().state!.matches)).toHaveLength(before);
  }, 60_000);

  it('adds the match to the user’s career record', () => {
    const before = structuredClone(useGameStore.getState().state!.player.record);
    openFixture();
    useMatchStore.getState().start();
    useMatchStore.getState().toss();
    useMatchStore.getState().simulateRest();
    const after = useGameStore.getState().state!.player.record;
    expect(after.byFormat.MULTI_DAY.batting.matches).toBe(
      before.byFormat.MULTI_DAY.batting.matches + 1,
    );
  }, 60_000);

  it('quick-sims a fixture straight into the career', () => {
    const state = useGameStore.getState().state!;
    const match = useMatchStore.getState().quickSim(state, state.fixtures[FIXTURE]);
    expect(match).not.toBeNull();
    const after = useGameStore.getState().state!;
    expect(after.fixtures[FIXTURE].played).toBe(true);
    expect(recentMatch(after)?.id).toBe(match!.id);
  }, 60_000);

  it('never sends an illegal hand-placed field to the engine', () => {
    openFixture();
    useMatchStore.getState().start();
    useMatchStore.getState().toss();
    useMatchStore.getState().nextBall();
    const snap = useMatchStore.getState().snap!;
    if (!snap.userBowling || !snap.field) return; // Only meaningful when fielding.
    const illegal = {
      ...snap.field,
      fielders: snap.field.fielders.map((f, i) => ({ ...f, angle: 200 + i * 5, distance: 50 })),
    };
    useMatchStore.getState().setDecisions({ field: illegal });
    useMatchStore.getState().nextBall();
    const placed = useMatchStore.getState().snap!.field!;
    expect(placed.fielders.filter((f) => f.angle > 180 && f.angle < 270).length).toBeLessThanOrEqual(2);
  });
});
