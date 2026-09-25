import { describe, expect, it } from 'vitest';
import { createDemoCareer } from '@/data/demoCareer';
import { appointCaptain } from './captaincy';
import { reviewCaptainXi, selectForFixture } from './selection';
import type { GameState } from '@/types';

const FIXTURE = 'fx-ka-u16';

function withPlayer(patch: Partial<GameState['player']['condition']>): GameState {
  const state = createDemoCareer();
  state.player = { ...state.player, condition: { ...state.player.condition, ...patch } };
  return state;
}

describe('selection for a fixture', () => {
  it('picks the in-form player and gives a batting position and a role', () => {
    const state = withPlayer({ form: 80, selectorTrust: 75 });
    const pick = selectForFixture(state, state.fixtures[FIXTURE])!;
    expect(pick.status).toBe('PLAYING_XI');
    expect(pick.xi).toHaveLength(11);
    expect(pick.xi.some((p) => p.isUser)).toBe(true);
    expect(pick.battingPosition).toBeGreaterThanOrEqual(1);
    expect(pick.expectedRole).toMatch(/Picked as/);
  });

  it('leaves out a player who is injured, and says why', () => {
    const state = createDemoCareer();
    state.player.condition.injury = {
      id: 'inj',
      name: 'Hamstring strain',
      bodyPart: 'Hamstring',
      severity: 'MODERATE',
      startedOn: '2026-10-01',
      expectedReturn: '2026-11-01',
      matchesMissed: 0,
      attributePenalty: 3,
      recurrence: false,
    };
    const pick = selectForFixture(state, state.fixtures[FIXTURE])!;
    expect(pick.status).not.toBe('PLAYING_XI');
    expect(pick.reasons.join(' ')).toMatch(/injured/);
  });

  it('drops a player whose form and standing have collapsed', () => {
    const state = withPlayer({ form: 5, selectorTrust: 5, reputation: 5, confidence: 10 });
    const pick = selectForFixture(state, state.fixtures[FIXTURE])!;
    expect(pick.status).not.toBe('PLAYING_XI');
    expect(pick.reasons.some((r) => /dried up|not yet convinced/.test(r))).toBe(true);
  });

  it('is the same decision every time for the same career', () => {
    const state = createDemoCareer();
    const a = selectForFixture(state, state.fixtures[FIXTURE])!;
    const b = selectForFixture(state, state.fixtures[FIXTURE])!;
    expect(a.xi.map((p) => p.id)).toEqual(b.xi.map((p) => p.id));
    expect(a.status).toBe(b.status);
  });

  it('promotes a batter in form and demotes one who is not', () => {
    const hot = withPlayer({ form: 95, selectorTrust: 95, recentRatings: [9, 9, 8] });
    const cold = withPlayer({ form: 30, selectorTrust: 40, recentRatings: [2, 3, 2] });
    const up = selectForFixture(hot, hot.fixtures[FIXTURE])!;
    const down = selectForFixture(cold, cold.fixtures[FIXTURE]);
    expect(up.battingPosition!).toBeLessThan(up.basePosition!);
    if (down?.status === 'PLAYING_XI') {
      expect(down.battingPosition!).toBeGreaterThanOrEqual(down.basePosition!);
    }
  });

  it('trusts an in-form bowler with more overs than one out of form', () => {
    const hot = withPlayer({ form: 90, selectorTrust: 85 });
    const cold = withPlayer({ form: 35, selectorTrust: 40 });
    const a = selectForFixture(hot, hot.fixtures[FIXTURE])!;
    const b = selectForFixture(cold, cold.fixtures[FIXTURE]);
    if (b?.status === 'PLAYING_XI') expect(a.bowlingTrust).toBeGreaterThan(b.bowlingTrust);
  });
});

describe('the captain’s XI goes to the selectors', () => {
  function proposal(state: GameState) {
    const pick = selectForFixture(state, state.fixtures[FIXTURE])!;
    const benchSpinner = pick.ranked.find(
      (r) => !pick.xi.some((p) => p.id === r.player.id) && r.player.role === 'SPIN_BOWLER',
    )!;
    const outSpinner = pick.xi.find((p) => p.role === 'SPIN_BOWLER')!;
    const ids = pick.xi.map((p) => (p.id === outSpinner.id ? benchSpinner.player.id : p.id));
    return { pick, ids, inId: benchSpinner.player.id, outId: outSpinner.id };
  }

  it('makes no changes when the captain agrees with them', () => {
    const state = appointCaptain(createDemoCareer(), 'team-tn-u16', '2026-10-01', 'test');
    const pick = selectForFixture(state, state.fixtures[FIXTURE])!;
    const review = reviewCaptainXi(state, state.fixtures[FIXTURE], pick, pick.xi.map((p) => p.id));
    expect(review.accepted).toHaveLength(0);
    expect(review.overruled).toHaveLength(0);
    expect(review.xiIds).toHaveLength(11);
  });

  it('accepts or overrules each change, and always ends with eleven', () => {
    const state = appointCaptain(createDemoCareer(), 'team-tn-u16', '2026-10-01', 'test');
    const { pick, ids, inId, outId } = proposal(state);
    const review = reviewCaptainXi(state, state.fixtures[FIXTURE], pick, ids);
    expect(review.accepted.length + review.overruled.length).toBe(1);
    expect(review.xiIds).toHaveLength(11);
    expect(new Set(review.xiIds).size).toBe(11);
    if (review.accepted.length) {
      expect(review.xiIds).toContain(inId);
      expect(review.xiIds).not.toContain(outId);
    } else {
      expect(review.xiIds).toContain(outId);
      expect(review.overruled[0].reason).toBeTruthy();
    }
  });

  it('gives a respected captain their way more often than a struggling one', () => {
    let respected = 0;
    let struggling = 0;
    for (let seed = 1; seed <= 60; seed += 1) {
      const base = appointCaptain(createDemoCareer(), 'team-tn-u16', '2026-10-01', 'test');
      base.seed = seed;
      const good = structuredClone(base);
      good.career.captaincy.rating = 90;
      good.player.condition.reputation = 85;
      const bad = structuredClone(base);
      bad.career.captaincy.rating = 15;
      bad.player.condition.reputation = 20;
      const g = proposal(good);
      const b = proposal(bad);
      respected += reviewCaptainXi(good, good.fixtures[FIXTURE], g.pick, g.ids).accepted.length;
      struggling += reviewCaptainXi(bad, bad.fixtures[FIXTURE], b.pick, b.ids).accepted.length;
    }
    expect(respected).toBeGreaterThan(struggling);
  });

  it('keeps the captain’s batting order for the players who play', () => {
    const state = appointCaptain(createDemoCareer(), 'team-tn-u16', '2026-10-01', 'test');
    const pick = selectForFixture(state, state.fixtures[FIXTURE])!;
    const reversed = [...pick.xi.map((p) => p.id)].reverse();
    const review = reviewCaptainXi(state, state.fixtures[FIXTURE], pick, reversed);
    expect(review.xiIds).toEqual(reversed);
  });
});
