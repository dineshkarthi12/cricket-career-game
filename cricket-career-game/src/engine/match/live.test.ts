import { describe, expect, it } from 'vitest';
import { createLiveMatch, type LiveMatchSetup } from './live';
import { createRng } from './rng';
import { generateXi } from './squad';
import { VENUES_BY_ID } from '@/data/venues';
import type { MatchFormat } from '@/types';

const venue = VENUES_BY_ID['venue-chepauk'];

function setup(overrides: Partial<LiveMatchSetup> = {}): LiveMatchSetup {
  const seed = overrides.seed ?? 4242;
  return {
    fixtureId: 'fx-live',
    tournamentId: 'vijay-hazare',
    seasonYear: 2026,
    format: 'ODI',
    stage: 'League',
    date: '2026-11-15',
    venue,
    homeTeamId: 'home',
    awayTeamId: 'away',
    homeXi: generateXi('home', 66, createRng(seed ^ 0xa)),
    awayXi: generateXi('away', 64, createRng(seed ^ 0xb)),
    userTeamId: 'home',
    userIsCaptain: true,
    seed,
    month: 11,
    ...overrides,
  };
}

describe('live match controller', () => {
  it('starts at the toss and does nothing until it is settled', () => {
    const live = createLiveMatch(setup());
    expect(live.snapshot().phase).toBe('TOSS');
    expect(live.nextBall()).toBeNull();
    expect(live.snapshot().current).toBeNull();

    live.doToss();
    expect(live.snapshot().phase).toBe('IN_PLAY');
    expect(live.snapshot().toss).not.toBeNull();
    expect(live.snapshot().current).not.toBeNull();
  });

  it('honours the captain’s toss call when the user wins it', () => {
    // Find a seed where the user's side wins the toss.
    for (let seed = 1; seed < 60; seed += 1) {
      const live = createLiveMatch(setup({ seed }));
      live.doToss('BOWL');
      const snap = live.snapshot();
      if (snap.toss?.winnerTeamId !== 'home') continue;
      expect(snap.toss.decision).toBe('BOWL');
      expect(snap.current?.battingTeamId).toBe('away');
      return;
    }
    throw new Error('no seed found where the user won the toss');
  });

  it('bowls one legal ball at a time and keeps the over together', () => {
    const live = createLiveMatch(setup());
    live.doToss();

    const first = live.nextBall();
    expect(first).not.toBeNull();
    expect(live.snapshot().current?.bowlerId).not.toBeNull();

    const rest = live.nextOver();
    expect(rest.length).toBeGreaterThan(0);
    const snap = live.snapshot();
    // One complete over has been bowled between nextBall and nextOver.
    expect(snap.current?.balls).toBe(6);
    expect(snap.current?.overs).toBe('1.0');
  });

  it('rotates the bowler at the end of an over', () => {
    const live = createLiveMatch(setup());
    live.doToss();
    live.nextOver();
    const firstBowler = live.snapshot().current?.bowlerId;
    live.nextBall();
    const secondBowler = live.snapshot().current?.bowlerId;
    expect(secondBowler).not.toBe(firstBowler);
  });

  it('never offers the bowler who bowled the last over', () => {
    const live = createLiveMatch(setup());
    live.doToss();
    live.nextOver();
    const last = live.snapshot().current?.bowlerId;
    expect(live.availableBowlers().map((b) => b.id)).not.toContain(last);
  });

  it('lets the player pick the bowler for the next over', () => {
    const live = createLiveMatch(setup());
    live.doToss();
    live.nextOver();
    const choice = live.availableBowlers()[2];
    live.nextBall({ bowlerId: choice.id });
    expect(live.snapshot().current?.bowlerId).toBe(choice.id);
  });

  it('stops at a wicket', () => {
    const live = createLiveMatch(setup());
    live.doToss();
    const balls = live.toNextWicket();
    const last = balls[balls.length - 1];
    // Either a wicket fell or the innings ran out of balls entirely.
    if (live.snapshot().phase === 'IN_PLAY') expect(last.wicket).toBeTruthy();
  });

  it('breaks between innings and only resumes when told to', () => {
    const live = createLiveMatch(setup());
    live.doToss();
    live.toEndOfInnings();

    const atBreak = live.snapshot();
    expect(atBreak.phase).toBe('INNINGS_BREAK');
    expect(atBreak.completed).toHaveLength(1);
    expect(live.nextBall()).toBeNull();

    live.startNextInnings();
    const second = live.snapshot();
    expect(second.phase).toBe('IN_PLAY');
    expect(second.current?.number).toBe(2);
    expect(second.current?.target).toBe(atBreak.completed[0].runs + 1);
    expect(second.current?.battingTeamId).not.toBe(atBreak.completed[0].battingTeamId);
  });

  it('plays a whole match out and produces a result', () => {
    const live = createLiveMatch(setup());
    live.toEnd();

    const snap = live.snapshot();
    expect(snap.phase).toBe('COMPLETE');
    expect(snap.result).not.toBeNull();
    expect(snap.completed).toHaveLength(2);

    const done = live.finished();
    expect(done).not.toBeNull();
    expect(done?.match.status).toBe('COMPLETED');
    expect(done?.match.result?.manOfTheMatchId).toBeTruthy();
  });

  it('replays identically from the same seed', () => {
    const a = createLiveMatch(setup({ seed: 777 }));
    const b = createLiveMatch(setup({ seed: 777 }));
    a.toEnd();
    b.toEnd();
    expect(a.snapshot().result?.summary).toBe(b.snapshot().result?.summary);
    expect(a.snapshot().completed.map((i) => `${i.runs}/${i.wickets}`)).toEqual(
      b.snapshot().completed.map((i) => `${i.runs}/${i.wickets}`),
    );
  });

  it('matches the batch simulator when nothing is overridden', () => {
    const live = createLiveMatch(setup({ seed: 31337 }));
    const ball = createLiveMatch(setup({ seed: 31337 }));
    live.toEnd();
    // Step the second one ball at a time instead of in bulk.
    ball.doToss();
    let guard = 0;
    while (ball.snapshot().phase !== 'COMPLETE' && guard < 5000) {
      if (ball.snapshot().phase === 'INNINGS_BREAK') ball.startNextInnings();
      else if (ball.nextBall() === null) break;
      guard += 1;
    }
    expect(ball.snapshot().completed.map((i) => `${i.runs}/${i.wickets}`)).toEqual(
      live.snapshot().completed.map((i) => `${i.runs}/${i.wickets}`),
    );
  });

  it('tracks the user’s side batting and bowling', () => {
    const live = createLiveMatch(setup());
    live.doToss();
    const snap = live.snapshot();
    expect(snap.userBatting).toBe(snap.current?.battingTeamId === 'home');
    expect(snap.userBowling).toBe(!snap.userBatting);
  });

  it('raises alerts for wickets and the result', () => {
    const live = createLiveMatch(setup());
    live.toEnd();
    const kinds = new Set(live.snapshot().alerts.map((a) => a.kind));
    expect(kinds.has('INNINGS')).toBe(true);
    expect(kinds.has('WICKET')).toBe(true);
    expect(kinds.has('RESULT')).toBe(true);
  });

  it('keeps a running scorecard the screen can draw', () => {
    const live = createLiveMatch(setup());
    live.doToss();
    live.nextOver();
    live.nextOver();
    const cur = live.snapshot().current!;
    expect(cur.batting.length).toBeGreaterThanOrEqual(2);
    expect(cur.bowling.length).toBeGreaterThanOrEqual(1);
    expect(cur.lastSix.length).toBeLessThanOrEqual(6);
    expect(cur.deliveries.length).toBeGreaterThanOrEqual(12);
    expect(cur.runRate).toBeGreaterThanOrEqual(0);
    expect(live.snapshot().field).not.toBeNull();
  });
});

describe('player decisions change what happens', () => {
  function runInnings(overrides: Parameters<ReturnType<typeof createLiveMatch>['nextBall']>[0], seed: number) {
    const live = createLiveMatch(setup({ seed }));
    live.doToss();
    const balls = live.toEndOfInnings(overrides);
    return { balls, snap: live.snapshot() };
  }

  it('attacking intent scores faster and loses more wickets than blocking', () => {
    let attackRuns = 0;
    let blockRuns = 0;
    let attackWickets = 0;
    let blockWickets = 0;

    for (let seed = 1; seed <= 12; seed += 1) {
      const attack = runInnings({ intentLevel: 5 }, seed);
      const block = runInnings({ intentLevel: 1 }, seed);
      const a = attack.snap.completed[0];
      const b = block.snap.completed[0];
      attackRuns += (a.runs / Math.max(1, a.balls)) * 6;
      blockRuns += (b.runs / Math.max(1, b.balls)) * 6;
      attackWickets += a.wickets;
      blockWickets += b.wickets;
    }

    expect(attackRuns).toBeGreaterThan(blockRuns);
    expect(attackWickets).toBeGreaterThan(blockWickets);
  });

  it('a shot-direction preference bends where the ball goes', () => {
    const preference = 90; // square on the off side
    let near = 0;
    let total = 0;

    for (let seed = 1; seed <= 6; seed += 1) {
      const { balls } = runInnings({ shotPreference: preference, intentLevel: 4 }, seed);
      for (const ball of balls) {
        if (ball.shotAngle === null) continue;
        total += 1;
        const diff = Math.abs(((ball.shotAngle - preference + 540) % 360) - 180);
        if (diff < 60) near += 1;
      }
    }

    let baseNear = 0;
    let baseTotal = 0;
    for (let seed = 1; seed <= 6; seed += 1) {
      const { balls } = runInnings({ intentLevel: 4 }, seed);
      for (const ball of balls) {
        if (ball.shotAngle === null) continue;
        baseTotal += 1;
        const diff = Math.abs(((ball.shotAngle - preference + 540) % 360) - 180);
        if (diff < 60) baseNear += 1;
      }
    }

    expect(total).toBeGreaterThan(50);
    expect(near / total).toBeGreaterThan(baseNear / baseTotal);
  });

  it('an attacking field preset concedes differently from a defensive one', () => {
    const attacking = runInnings({ fieldPreset: 'ATTACKING_NEW_BALL' }, 500);
    const defensive = runInnings({ fieldPreset: 'BOUNDARY_PROTECTION' }, 500);
    expect(attacking.snap.completed[0].runs).not.toBe(defensive.snap.completed[0].runs);
  });
});

describe('formats', () => {
  const formats: MatchFormat[] = ['T20', 'ODI', 'MULTI_DAY'];

  for (const format of formats) {
    it(`plays a ${format} match through to a result`, () => {
      const live = createLiveMatch(setup({ format, seed: 8080 }));
      live.toEnd();
      const snap = live.snapshot();
      expect(snap.phase).toBe('COMPLETE');
      expect(snap.result).not.toBeNull();
      expect(snap.completed.length).toBeGreaterThanOrEqual(format === 'MULTI_DAY' ? 2 : 2);
    }, 60_000);
  }
});
