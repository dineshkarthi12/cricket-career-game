/**
 * The live controller in career mode: the player's own moments, their calls
 * as captain, and nothing else.
 */
import { describe, expect, it } from 'vitest';
import { createLiveMatch, timedChance, type LiveMatchSetup } from './live';
import { createRng } from './rng';
import { generateXi } from './squad';
import { DEFAULT_DELEGATION } from '../career/captaincy';
import { VENUES_BY_ID } from '@/data/venues';
import type { MatchFormat } from '@/types';

const venue = VENUES_BY_ID['venue-chepauk'];

function setup(
  seed: number,
  opts: { format?: MatchFormat; userIndex?: number; captain?: boolean; delegateReviews?: boolean } = {},
): LiveMatchSetup {
  const homeXi = generateXi('home', 64, createRng(seed ^ 0xa));
  const awayXi = generateXi('away', 64, createRng(seed ^ 0xb));
  const user = homeXi[opts.userIndex ?? 3];
  user.isUser = true;
  return {
    fixtureId: 'fx',
    tournamentId: 'vijay-hazare',
    seasonYear: 2026,
    format: opts.format ?? 'ODI',
    stage: 'League',
    date: '2026-11-15',
    venue,
    homeTeamId: 'home',
    awayTeamId: 'away',
    homeXi,
    awayXi,
    userTeamId: 'home',
    userPlayerId: user.id,
    userIsCaptain: opts.captain ?? false,
    delegate: { ...DEFAULT_DELEGATION, reviews: opts.delegateReviews ?? false },
    seed,
    month: 11,
  };
}

/** Play out answering every question the same way; count the outcomes. */
function playAnswering(s: LiveMatchSetup, answer: { timing?: number; review?: boolean }) {
  const live = createLiveMatch(s);
  live.doToss();
  const questions: string[] = [];
  let guard = 0;
  while (live.snapshot().phase !== 'COMPLETE' && guard < 6000) {
    guard += 1;
    const snap = live.snapshot();
    if (snap.question) {
      questions.push(snap.question.kind);
      live.answer(answer);
    } else if (snap.phase === 'INNINGS_BREAK') {
      if (snap.followOnChoice) live.chooseFollowOn(false);
      live.startNextInnings();
    } else if (live.nextBall() === null && !live.snapshot().question) {
      // Innings over; the loop picks up the break.
    }
  }
  return { live, questions };
}

describe('the player’s own moments', () => {
  it('asks only about catches and run-outs that come to the player', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const s = setup(seed);
      const userId = s.userPlayerId!;
      const live = createLiveMatch(s);
      live.doToss();
      let guard = 0;
      while (live.snapshot().phase !== 'COMPLETE' && guard < 4000) {
        guard += 1;
        const snap = live.snapshot();
        if (snap.question) {
          if (snap.question.kind === 'CATCH' || snap.question.kind === 'RUN_OUT') {
            expect(snap.question.fielderId).toBe(userId);
            expect(snap.involvement.fielding).toBe(true);
            return;
          }
          live.answer({ review: false });
        } else if (snap.phase === 'INNINGS_BREAK') live.startNextInnings();
        else live.nextBall();
      }
    }
    throw new Error('no chance came to the player in 60 matches');
  }, 60_000);

  it('rewards good timing: a clean tap holds more than a bad one', () => {
    let good = 0;
    let bad = 0;
    for (let seed = 1; seed <= 80; seed += 1) {
      const a = playAnswering(setup(seed), { timing: 1, review: false });
      const b = playAnswering(setup(seed), { timing: 0, review: false });
      good += a.live.snapshot().moments.filter((m) => m.kind !== 'REVIEW' && m.success).length;
      bad += b.live.snapshot().moments.filter((m) => m.kind !== 'REVIEW' && m.success).length;
    }
    expect(good).toBeGreaterThan(bad);
  }, 120_000);

  it('turns timing into odds, within sensible bounds', () => {
    expect(timedChance(0.9, 1)).toBeGreaterThan(timedChance(0.9, 0.5));
    expect(timedChance(0.9, 0)).toBeLessThan(0.9);
    expect(timedChance(0.3, 1)).toBeLessThanOrEqual(0.99);
    expect(timedChance(0.01, 0)).toBeGreaterThanOrEqual(0.02);
  });

  it('lets a batter review their own dismissal, but not a team-mate’s', () => {
    // Not captain: the only review that is theirs is their own dismissal.
    for (let seed = 1; seed <= 200; seed += 1) {
      const s = setup(seed, { captain: false });
      const live = createLiveMatch(s);
      live.doToss();
      let guard = 0;
      while (live.snapshot().phase !== 'COMPLETE' && guard < 4000) {
        guard += 1;
        const snap = live.snapshot();
        if (snap.question?.kind === 'REVIEW') {
          expect(snap.question.side).toBe('BATTING');
          expect(snap.question.batterId).toBe(s.userPlayerId);
          return;
        }
        if (snap.question) live.answer({ timing: 0.5 });
        else if (snap.phase === 'INNINGS_BREAK') live.startNextInnings();
        else live.nextBall();
      }
    }
    throw new Error('the player was never given out lbw or caught behind');
  }, 120_000);
});

describe('captaincy calls', () => {
  it('puts the side’s reviews to a captain, and not when delegated', () => {
    let asked = 0;
    let askedDelegated = 0;
    for (let seed = 1; seed <= 40; seed += 1) {
      asked += playAnswering(setup(seed, { captain: true }), { review: false }).questions.filter(
        (q) => q === 'REVIEW',
      ).length;
      askedDelegated += playAnswering(
        setup(seed, { captain: true, delegateReviews: true }),
        { review: false },
      ).questions.filter((q) => q === 'REVIEW').length;
    }
    expect(asked).toBeGreaterThan(0);
    // Delegated: only the player's own dismissals are theirs to review.
    expect(askedDelegated).toBeLessThan(asked);
  }, 120_000);

  it('never lets a player who is not captain declare', () => {
    const live = createLiveMatch(setup(3, { format: 'MULTI_DAY', captain: false }));
    live.doToss();
    live.nextOver();
    expect(live.snapshot().canDeclare).toBe(false);
    expect(live.declare()).toBe(false);
  });

  it('never asks a player who is not captain about the follow-on', () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const live = createLiveMatch(setup(seed, { format: 'MULTI_DAY', captain: false }));
      live.toEnd();
      expect(live.snapshot().followOnChoice).toBeNull();
    }
  }, 120_000);

  it('suggests a bowler without changing the match', () => {
    const plain = createLiveMatch(setup(21, { captain: true, delegateReviews: true }));
    const advised = createLiveMatch(setup(21, { captain: true, delegateReviews: true }));
    plain.doToss();
    advised.doToss();
    for (let over = 0; over < 12; over += 1) {
      expect(advised.suggestBowler()).not.toBeNull();
      plain.nextOver();
      advised.nextOver();
    }
    expect(advised.snapshot().current?.runs).toBe(plain.snapshot().current?.runs);
    expect(advised.snapshot().current?.wickets).toBe(plain.snapshot().current?.wickets);
  });

  it('will not let a captain bowl someone beyond their quota', () => {
    const live = createLiveMatch(setup(5, { format: 'T20', captain: true, delegateReviews: true }));
    live.doToss();
    // Keep asking for the same bowler every other over.
    let chosen: string | null = null;
    for (let over = 0; over < 20 && live.snapshot().phase === 'IN_PLAY'; over += 1) {
      const options = live.availableBowlers();
      if (!chosen) chosen = options[0]?.id ?? null;
      live.nextOver({ bowlerId: chosen ?? undefined });
    }
    const line = live.snapshot().current?.bowling.find((b) => b.playerId === chosen);
    const done = live.snapshot().completed[0]?.bowling.find((b) => b.playerId === chosen);
    expect(Math.floor((line ?? done)!.balls / 6)).toBeLessThanOrEqual(4);
  });
});

describe('sim until the player is involved', () => {
  it('stops with the player on strike, bowling, or asked something', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const live = createLiveMatch(setup(seed));
      live.doToss();
      live.untilInvolved();
      const snap = live.snapshot();
      if (snap.phase !== 'IN_PLAY') continue;
      const i = snap.involvement;
      expect(i.onStrike || i.bowling || snap.question !== null).toBe(true);
    }
  });

  it('names the bowler before the first ball when the player is on', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const s = setup(seed, { userIndex: 9 });
      const live = createLiveMatch(s);
      live.doToss();
      if (!live.snapshot().userBowling) continue;
      live.untilInvolved();
      const snap = live.snapshot();
      if (snap.involvement.bowling) {
        expect(snap.current?.bowlerId).toBe(s.userPlayerId);
        // Not a ball of this over bowled yet, or partway - either way it is theirs.
        return;
      }
    }
    throw new Error('the player never bowled');
  });

  it('changes nothing about the match compared with bowling it ball by ball', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const a = createLiveMatch(setup(seed));
      const b = createLiveMatch(setup(seed));
      a.doToss();
      b.doToss();
      a.untilInvolved();
      // Only a stop part-way through an innings says anything here.
      if (!a.snapshot().current || a.snapshot().question) continue;
      const target = a.snapshot().current!.balls;
      while (b.snapshot().current!.balls < target) b.nextBall();
      expect(b.snapshot().current?.runs).toBe(a.snapshot().current?.runs);
      expect(b.snapshot().current?.wickets).toBe(a.snapshot().current?.wickets);
      return;
    }
    throw new Error('no stop part-way through an innings');
  });
});

describe('multi-day alerts', () => {
  it('calls stumps and announces each new day', () => {
    const live = createLiveMatch(setup(9, { format: 'MULTI_DAY' }));
    live.toEnd();
    const kinds = live.snapshot().alerts.map((a) => a.kind);
    expect(kinds).toContain('SESSION');
  }, 60_000);
});
