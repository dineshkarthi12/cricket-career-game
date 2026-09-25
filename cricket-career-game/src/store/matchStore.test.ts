import { beforeEach, describe, expect, it } from 'vitest';
import { appointCaptain } from '@/engine/career/captaincy';
import { recentMatch } from '@/lib/selectors';
import { cancelAutosave } from '@/save';
import { useGameStore } from './gameStore';
import { __resetMatchStore, useMatchStore } from './matchStore';

const FIXTURE = 'fx-ka-u16';
const TEAM = 'team-tn-u16';

function reset() {
  cancelAutosave();
  localStorage.clear();
  useGameStore.setState({ state: null, booted: false, slot: null, slots: [null, null, null], lastError: null });
  __resetMatchStore();
  useGameStore.getState().loadDemoCareer(1);
}

function open() {
  const state = useGameStore.getState().state!;
  useMatchStore.getState().open(state, state.fixtures[FIXTURE]);
}

function makeCaptain() {
  useGameStore.getState().update((s) => appointCaptain(s, TEAM, '2026-10-01', 'test'));
}

/** Play the match out, answering anything put to the player. */
function playOut() {
  let guard = 0;
  while (useMatchStore.getState().stage !== 'DONE' && guard < 400) {
    guard += 1;
    const { stage, snap } = useMatchStore.getState();
    if (stage === 'TOSS') useMatchStore.getState().toss('BAT');
    else if (snap?.question) useMatchStore.getState().answer({ timing: 0.8, review: false });
    else if (stage === 'BREAK') {
      if (snap?.followOnChoice) useMatchStore.getState().chooseFollowOn(false);
      useMatchStore.getState().startNextInnings();
    } else useMatchStore.getState().toEndOfInnings();
  }
}

describe('match store: career mode', () => {
  beforeEach(reset);

  it('opens with the selectors’ decision, and no team controls', () => {
    open();
    const { stage, selection, captain, proposedIds } = useMatchStore.getState();
    expect(stage).toBe('PRE_MATCH');
    expect(selection?.xi).toHaveLength(11);
    expect(captain).toBe(false);
    expect(proposedIds).toHaveLength(11);
  });

  it('does not let a player who is not captain change the XI', () => {
    open();
    const before = useMatchStore.getState().proposedIds;
    useMatchStore.getState().toggleProposed(before[3]);
    useMatchStore.getState().moveProposed(before[0], 1);
    expect(useMatchStore.getState().proposedIds).toEqual(before);
  });

  it('reads the conditions before the toss', () => {
    open();
    const snap = useMatchStore.getState().snap!;
    expect(snap.phase).toBe('TOSS');
    expect(snap.conditions.pitch.type).toBeTruthy();
  });

  it('goes through the toss into play, one ball at a time', () => {
    open();
    useMatchStore.getState().toToss();
    expect(useMatchStore.getState().stage).toBe('TOSS');
    useMatchStore.getState().toss();
    expect(useMatchStore.getState().stage).toBe('PLAYING');
    useMatchStore.getState().playBall();
    const { snap, lastBall } = useMatchStore.getState();
    expect(lastBall ?? snap?.question).toBeTruthy();
  });

  it('only sends the player’s intent while their own batter is on strike', () => {
    open();
    useMatchStore.getState().toToss();
    useMatchStore.getState().toss();
    useMatchStore.getState().setPlayer({ batting: 5 });
    const me = useGameStore.getState().state!.player.id;
    let guard = 0;
    while (useMatchStore.getState().stage === 'PLAYING' && guard < 800) {
      guard += 1;
      const snap = useMatchStore.getState().snap!;
      if (snap.question) useMatchStore.getState().answer({ timing: 0.5, review: false });
      else useMatchStore.getState().playBall();
    }
    const innings = useMatchStore.getState().snap!;
    const balls = [...innings.completed.flatMap((i) => i.deliveries), ...(innings.current?.deliveries ?? [])];
    const mine = balls.filter((b) => b.strikerId === me);
    const others = balls.filter((b) => b.strikerId !== me && b.isLegalDelivery);
    if (mine.length > 0) expect(mine.every((b) => b.intent === 'ALL_OUT')).toBe(true);
    expect(others.some((b) => b.intent !== 'ALL_OUT')).toBe(true);
  }, 60_000);

  it('keeps the player’s aggression levels from match to match', () => {
    open();
    expect(useMatchStore.getState().player.batting).toBe(3);
    useMatchStore.getState().setPlayer({ batting: 5, bowling: 1 });
    expect(useGameStore.getState().state!.career.aggression).toEqual({ batting: 5, bowling: 1 });
    useMatchStore.getState().close();
    open();
    expect(useMatchStore.getState().player).toMatchObject({ batting: 5, bowling: 1 });
    // Out of range is clamped, never stored.
    useMatchStore.getState().setPlayer({ batting: 9 });
    expect(useGameStore.getState().state!.career.aggression.batting).toBe(5);
  });

  it('lets a one-ball choice override the level for that ball only', () => {
    open();
    useMatchStore.getState().toToss();
    useMatchStore.getState().toss();
    useMatchStore.getState().setPlayer({ batting: 2 });
    const me = useGameStore.getState().state!.player.id;
    const mine: { intent: string; chosen: boolean }[] = [];
    let guard = 0;
    while (useMatchStore.getState().stage === 'PLAYING' && guard < 1500 && mine.length < 6) {
      guard += 1;
      const snap = useMatchStore.getState().snap!;
      if (snap.question) {
        useMatchStore.getState().answer({ timing: 0.5, review: false });
        continue;
      }
      const onStrike = snap.involvement.onStrike;
      // Every other ball on strike is a big shot; the rest are at the level.
      const big = onStrike && mine.length % 2 === 0;
      useMatchStore.getState().playBall(big ? 'BIG_SHOT' : undefined);
      const ball = useMatchStore.getState().lastBall;
      if (onStrike && ball?.strikerId === me && ball.isLegalDelivery) mine.push({ intent: ball.intent, chosen: big });
    }
    if (mine.length === 0) return; // The player never faced a ball this time.
    for (const ball of mine) expect(ball.intent).toBe(ball.chosen ? 'ALL_OUT' : 'DEFENSIVE');
  }, 60_000);

  it('rates the risk of the player’s level while they are at the crease', () => {
    open();
    useMatchStore.getState().toToss();
    useMatchStore.getState().toss('BAT');
    const me = useGameStore.getState().state!.player.id;
    const low = useMatchStore.getState().riskFor(me, 1);
    const high = useMatchStore.getState().riskFor(me, 5);
    expect(low?.label).toBeTruthy();
    expect(high!.chance).toBeGreaterThan(low!.chance);
  });

  it('writes a finished match back into the career exactly once', () => {
    open();
    useMatchStore.getState().toToss();
    playOut();
    const { stage, after } = useMatchStore.getState();
    expect(stage).toBe('DONE');
    expect(after).not.toBeNull();
    const state = useGameStore.getState().state!;
    expect(state.fixtures[FIXTURE].played).toBe(true);
    expect(recentMatch(state)?.id).toBe(after!.match.id);
    expect(state.inbox.some((m) => m.sender === 'SELECTOR' && m.relatedId === after!.match.id)).toBe(true);

    const count = Object.keys(state.matches).length;
    useMatchStore.getState().simulateRest();
    expect(Object.keys(useGameStore.getState().state!.matches)).toHaveLength(count);
  }, 60_000);

  it('quick-sims a fixture straight into the career', () => {
    const state = useGameStore.getState().state!;
    const match = useMatchStore.getState().quickSim(state, state.fixtures[FIXTURE]);
    expect(match).not.toBeNull();
    const after = useGameStore.getState().state!;
    expect(after.fixtures[FIXTURE].played).toBe(true);
    expect(recentMatch(after)?.id).toBe(match!.id);
  }, 60_000);
});

describe('match store: captain mode', () => {
  beforeEach(reset);

  it('unlocks when the player is appointed captain', () => {
    makeCaptain();
    open();
    expect(useMatchStore.getState().captain).toBe(true);
  });

  it('unlocks with the dev toggle in a development build', () => {
    useGameStore.getState().update((s) => ({ ...s, settings: { ...s.settings, devCaptainMode: true } }));
    open();
    expect(useMatchStore.getState().captain).toBe(import.meta.env.DEV === true);
  });

  it('lets a captain reshape the XI and the order', () => {
    makeCaptain();
    open();
    const { proposedIds, selection } = useMatchStore.getState();
    useMatchStore.getState().moveProposed(proposedIds[0], 1);
    expect(useMatchStore.getState().proposedIds[1]).toBe(proposedIds[0]);

    const out = proposedIds[8];
    const reserve = selection!.ranked.find((r) => !proposedIds.includes(r.player.id))!.player.id;
    useMatchStore.getState().toggleProposed(out);
    useMatchStore.getState().toggleProposed(reserve);
    expect(useMatchStore.getState().proposedIds).toContain(reserve);
    expect(useMatchStore.getState().proposedIds).toHaveLength(11);
  });

  it('sends the captain’s XI to the selectors at the toss', () => {
    makeCaptain();
    open();
    const { proposedIds, selection } = useMatchStore.getState();
    const reserve = selection!.ranked.find((r) => !proposedIds.includes(r.player.id))!.player.id;
    useMatchStore.getState().toggleProposed(proposedIds[9]);
    useMatchStore.getState().toggleProposed(reserve);
    useMatchStore.getState().toToss();
    const review = useMatchStore.getState().xiReview!;
    expect(review.accepted.length + review.overruled.length).toBe(1);
  });

  it('records the captaincy after the match', () => {
    makeCaptain();
    open();
    useMatchStore.getState().toToss();
    playOut();
    const state = useGameStore.getState().state!;
    expect(state.career.captaincy.record.matches).toBe(1);
    expect(useMatchStore.getState().after?.result.captaincy).not.toBeNull();
  }, 60_000);

  it('lets a captain set the aggression of another batter', () => {
    makeCaptain();
    open();
    useMatchStore.getState().toToss();
    useMatchStore.getState().toss('BAT');
    const me = useGameStore.getState().state!.player.id;
    const snap = useMatchStore.getState().snap!;
    const other = [snap.current!.strikerId, snap.current!.nonStrikerId].find((id) => id !== me)!;
    useMatchStore.getState().setCaptain({ batterLevels: { [other]: 1 } });
    for (let i = 0; i < 30 && useMatchStore.getState().stage === 'PLAYING'; i += 1) {
      if (useMatchStore.getState().snap!.question) useMatchStore.getState().answer({ timing: 0.5, review: false });
      else useMatchStore.getState().playBall();
    }
    const current = useMatchStore.getState().snap!.current;
    const faced = (current?.deliveries ?? []).filter((b) => b.strikerId === other);
    expect(faced.length).toBeGreaterThan(0);
    expect(faced.every((b) => b.intent === 'BLOCK')).toBe(true);
  }, 60_000);

  it('remembers what the captain hands to the vice-captain', () => {
    makeCaptain();
    open();
    useMatchStore.getState().setDelegate({ field: true });
    expect(useGameStore.getState().state!.career.captaincy.delegate.field).toBe(true);
  });
});
