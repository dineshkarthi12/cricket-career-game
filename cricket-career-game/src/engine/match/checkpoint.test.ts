import { describe, expect, it } from 'vitest';
import { CheckpointError, describeCheckpoint, recordLiveMatch, restoreLiveMatch, type RecordedLiveMatch } from './checkpoint';
import type { LiveMatchSetup } from './live';
import { createRng } from './rng';
import { generateXi } from './squad';
import { VENUES_BY_ID } from '@/data/venues';
import { DEFAULT_DELEGATION } from '../career/captaincy';
import type { MatchFormat } from '@/types';

const venue = VENUES_BY_ID['venue-chepauk'];

function setup(seed: number, format: MatchFormat = 'T20', captain = false): LiveMatchSetup {
  const homeXi = generateXi('home', 64, createRng(seed ^ 0xa));
  const awayXi = generateXi('away', 64, createRng(seed ^ 0xb));
  const user = homeXi[1];
  user.isUser = true;
  return {
    fixtureId: `fx-${seed}`,
    tournamentId: format === 'T20' ? 'syed-mushtaq-ali' : format === 'ODI' ? 'vijay-hazare' : 'ranji-trophy',
    seasonYear: 2026,
    format,
    stage: 'League',
    date: '2026-11-15',
    venue,
    homeTeamId: 'home',
    awayTeamId: 'away',
    homeXi,
    awayXi,
    userTeamId: 'home',
    userPlayerId: user.id,
    userIsCaptain: captain,
    delegate: { ...DEFAULT_DELEGATION },
    seed,
    month: 11,
  };
}

/**
 * A player at the controls: a deterministic mix of every kind of call, as the
 * screen makes them. `step` is the call number, so both copies of a match get
 * exactly the same inputs.
 */
function drive(live: RecordedLiveMatch, from: number, to: number, userId: string): number {
  let step = from;
  for (; step < to; step += 1) {
    const snap = live.snapshot();
    if (snap.phase === 'COMPLETE') break;
    if (snap.phase === 'TOSS') live.doToss(step % 2 ? 'BAT' : 'BOWL');
    else if (snap.phase === 'INNINGS_BREAK') {
      if (snap.followOnChoice) live.chooseFollowOn(step % 2 === 0);
      else live.startNextInnings();
    } else if (snap.question) live.answer({ timing: (step % 10) / 10, review: step % 3 === 0 });
    else {
      live.prepareNextOver({ bowlingFor: userId, bowlingAggression: 1 + (step % 5) });
      if (snap.involvement.onStrike) live.peekDelivery(1 + (step % 5));
      const level = 1 + ((step * 7) % 5);
      if (step % 37 === 0) live.nextOver({ battingFor: userId, intentLevel: level });
      else live.nextBall({ battingFor: userId, bowlingFor: userId, intentLevel: level, playIn: step % 4 === 0, touch: step % 6 === 0 ? { side: 'LEG', timing: 'GOOD' } : null });
    }
  }
  return step;
}

/** The scorecard, without the generated ids. */
function card(live: RecordedLiveMatch) {
  const done = live.finished();
  expect(done).toBeTruthy();
  const m = done!.match;
  return {
    result: { ...m.result, manOfTheMatchId: m.result?.manOfTheMatchId },
    innings: m.innings.map((i) => ({
      runs: i.runs,
      wickets: i.wickets,
      balls: i.balls,
      batting: i.batting.map((b) => [b.playerId, b.runs, b.balls, b.dismissalText]),
      bowling: i.bowling.map((b) => [b.playerId, b.balls, b.runsConceded, b.wickets]),
      deliveries: i.deliveries.map((d) => [d.bowlerId, d.strikerId, d.runsOffBat, d.line, d.length, Boolean(d.wicket)]),
    })),
    performance: m.userPerformance,
  };
}

/** A snapshot without the generated ids (innings, balls, alerts get fresh ones on a replay). */
function stripIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripIds);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([k]) => k !== 'id' && k !== 'ballId').map(([k, v]) => [k, stripIds(v)]));
  return value;
}

/** Through JSON, as IndexedDB stores it. */
const roundTrip = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe('match checkpoints', () => {
  for (const [format, seed, cut] of [['T20', 11, 90], ['ODI', 12, 260], ['MULTI_DAY', 13, 700]] as const) {
    it(`rebuilds a ${format} match mid-play, and both copies finish identically`, () => {
      const s = setup(seed, format, true);
      const userId = s.userPlayerId!;
      const original = recordLiveMatch(s);
      const at = drive(original, 0, cut, userId);
      expect(original.snapshot().phase).not.toBe('COMPLETE');

      const restored = restoreLiveMatch(roundTrip(original.checkpoint()));
      expect(stripIds(restored.snapshot())).toEqual(stripIds(original.snapshot()));

      drive(original, at, 100000, userId);
      drive(restored, at, 100000, userId);
      expect(original.snapshot().phase).toBe('COMPLETE');
      expect(card(restored)).toEqual(card(original));
    });
  }

  it('a reload after peeking gives the same delivery - and the same ball', () => {
    let checked = 0;
    for (let seed = 1; seed <= 40 && checked < 5; seed += 1) {
      const s = setup(seed);
      const live = recordLiveMatch(s);
      live.doToss();
      let guard = 0;
      while (live.snapshot().phase === 'IN_PLAY' && guard < 300) {
        guard += 1;
        const snap = live.snapshot();
        if (snap.question) {
          live.answer({ timing: 0.5 });
          continue;
        }
        live.prepareNextOver();
        if (!snap.involvement.onStrike) {
          live.nextBall();
          continue;
        }
        const seen = live.peekDelivery(5)!;
        expect(seen).toBeTruthy();
        // Reload: a fresh engine from the checkpoint.
        const reloaded = restoreLiveMatch(roundTrip(live.checkpoint()));
        // Asking again at a safer level does not re-plan the ball.
        expect(reloaded.peekDelivery(1)).toEqual(seen);
        const o = { battingFor: s.userPlayerId, intentLevel: 3 };
        const a = live.nextBall(o)!;
        const b = reloaded.nextBall(o)!;
        expect([b.line, b.length, b.runsOffBat, Boolean(b.wicket), b.commentary]).toEqual([a.line, a.length, a.runsOffBat, Boolean(a.wicket), a.commentary]);
        checked += 1;
        break;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(3);
  });

  it('keeps an open question across a reload', () => {
    for (let seed = 1; seed <= 80; seed += 1) {
      const s = setup(seed, 'T20', true);
      const live = recordLiveMatch(s);
      live.doToss();
      let guard = 0;
      while (live.snapshot().phase !== 'COMPLETE' && !live.snapshot().question && guard < 600) {
        guard += 1;
        if (live.snapshot().phase === 'INNINGS_BREAK') live.startNextInnings();
        else live.nextBall({ battingFor: s.userPlayerId, bowlingFor: s.userPlayerId });
      }
      const question = live.snapshot().question;
      if (!question) continue;
      const reloaded = restoreLiveMatch(roundTrip(live.checkpoint()));
      expect(reloaded.snapshot().question).toEqual(question);
      const a = live.answer({ timing: 0.9, review: true });
      const b = reloaded.answer({ timing: 0.9, review: true });
      expect(b?.commentary).toBe(a?.commentary);
      return;
    }
    throw new Error('no question came up in 80 matches');
  });

  it('rejects a corrupted or tampered checkpoint', () => {
    const s = setup(21);
    const live = recordLiveMatch(s);
    drive(live, 0, 40, s.userPlayerId!);
    const good = roundTrip(live.checkpoint());
    expect(() => restoreLiveMatch(null)).toThrow(CheckpointError);
    expect(() => restoreLiveMatch({ hello: 'world' })).toThrow(CheckpointError);
    expect(() => restoreLiveMatch({ ...good, version: 99 })).toThrow(CheckpointError);
    // A ball removed from the log no longer reaches the saved score.
    const ballAt = good.log.findIndex((a) => a.k === 'ball');
    expect(() => restoreLiveMatch({ ...good, log: good.log.filter((_, i) => i !== ballAt) })).toThrow(CheckpointError);
    expect(() => restoreLiveMatch({ ...good, fingerprint: { ...good.fingerprint, runs: good.fingerprint.runs + 6 } })).toThrow(CheckpointError);
    expect(() => restoreLiveMatch({ ...good, overrides: ['{not json'] })).toThrow(CheckpointError);
  });

  it('stays small: balls share their overrides', () => {
    const s = setup(31, 'ODI');
    const live = recordLiveMatch(s);
    drive(live, 0, 400, s.userPlayerId!);
    const c = live.checkpoint();
    expect(c.overrides.length).toBeLessThan(80);
    expect(JSON.stringify(c.log).length / c.log.length).toBeLessThan(40);
  });

  it('says where a resumed match picks up', () => {
    const s = setup(41);
    const live = recordLiveMatch(s);
    expect(describeCheckpoint(live.snapshot())).toBe('before the toss');
    live.doToss();
    for (let i = 0; i < 9 && !live.snapshot().question; i += 1) live.nextBall();
    expect(describeCheckpoint(live.snapshot())).toMatch(/^1st innings, \d+\.\d overs$/);
  });
});
