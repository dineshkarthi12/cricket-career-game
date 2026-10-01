import { describe, expect, it } from 'vitest';
import { createNewCareer } from '../newCareer';
import { claimChallenge, currentChallenges, localDay, recordMatch, recordTraining, weekStart } from './challenges';
import { migrate } from '@/save/migrate';
import type { GameState, Match, PlayerRole } from '@/types';

const NOW = new Date(2026, 9, 1, 15, 0); // Thu 1 Oct 2026, local time

function career(role: PlayerRole = 'BATTER'): GameState {
  const state = createNewCareer({ firstName: 'Dinesh', lastName: 'Kumar', dateOfBirth: '2014-04-12', startDate: '2026-06-01' });
  return { ...state, player: { ...state.player, role } };
}

function match(state: GameState, id: string, line: { runs: number; balls: number; fours: number; sixes: number; out: boolean; wickets?: number; won?: boolean }): Match {
  const me = state.player.id;
  return {
    id,
    userPlayed: true,
    status: 'COMPLETED',
    userIsHome: true,
    homeTeamId: 'home',
    awayTeamId: 'away',
    result: { type: 'WIN', winningTeamId: line.won === false ? 'away' : 'home', summary: '', marginRuns: 1, marginWickets: null, manOfTheMatchId: null },
    innings: [
      {
        batting: [{ playerId: me, name: 'Me', battingPosition: 3, runs: line.runs, balls: line.balls, fours: line.fours, sixes: line.sixes, strikeRate: 0, out: line.out, dismissal: null, dismissalText: '' }],
        bowling: [],
      },
      { batting: [], bowling: [{ playerId: me, name: 'Me', overs: 4, balls: 24, maidens: 0, runsConceded: 30, wickets: line.wickets ?? 0, wides: 0, noBalls: 0, economy: 7.5 }] },
    ],
  } as unknown as Match;
}

describe('challenge periods', () => {
  it('uses the local date and a Monday week', () => {
    expect(localDay(NOW)).toBe('2026-10-01');
    expect(weekStart('2026-10-01')).toBe('2026-09-28');
    expect(weekStart('2026-09-28')).toBe('2026-09-28');
  });

  it('gives three daily and three weekly challenges, the same all day', () => {
    const state = career();
    const a = currentChallenges(state, NOW);
    const b = currentChallenges(state, new Date(2026, 9, 1, 23, 59));
    expect(a.filter((c) => c.period === 'DAILY')).toHaveLength(3);
    expect(a.filter((c) => c.period === 'WEEKLY')).toHaveLength(3);
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
    expect(currentChallenges(state, new Date(2026, 9, 2)).filter((c) => c.period === 'DAILY').map((c) => c.id)).not.toEqual(
      a.filter((c) => c.period === 'DAILY').map((c) => c.id),
    );
  });

  it('never asks a Pure Batter or a keeper to take wickets', () => {
    for (const role of ['BATTER', 'WICKET_KEEPER'] as PlayerRole[]) {
      const state = career(role);
      for (let d = 1; d <= 60; d += 1) {
        const list = currentChallenges(state, new Date(2026, 9, d));
        expect(list.some((c) => /take \d+ wickets?/i.test(c.text))).toBe(false);
      }
    }
  });
});

describe('progress comes from real activity only', () => {
  it('counts a match once, and only the player’s own figures', () => {
    let state = career();
    const m = match(state, 'm1', { runs: 34, balls: 30, fours: 4, sixes: 1, out: false });
    state = recordMatch(state, m, NOW);
    state = recordMatch(state, m, NOW);
    expect(state.challenges!.log).toHaveLength(1);
    const boundaries = currentChallenges(state, NOW).find((c) => c.key === 'w-4s');
    if (boundaries) expect(boundaries.progress).toBe(5);
  });

  it('ignores a match the player did not play', () => {
    const state = career();
    const m = { ...match(state, 'm2', { runs: 80, balls: 40, fours: 9, sixes: 3, out: false }), userPlayed: false };
    expect(recordMatch(state, m, NOW).challenges!.log).toHaveLength(0);
  });

  it('a not-out 30 needs the player not to be out', () => {
    const state = career();
    // Search the days until the 30-not-out challenge comes up, then test it.
    for (let d = 1; d <= 40; d += 1) {
      const day = new Date(2026, 9, d, 12);
      const c = currentChallenges(state, day).find((x) => x.key === 'd-30no');
      if (!c) continue;
      let s = recordMatch(state, match(state, `x${d}`, { runs: 45, balls: 40, fours: 5, sixes: 0, out: true }), day);
      expect(currentChallenges(s, day).find((x) => x.key === 'd-30no')!.complete).toBe(false);
      s = recordMatch(s, match(s, `y${d}`, { runs: 31, balls: 28, fours: 3, sixes: 0, out: false }), day);
      expect(currentChallenges(s, day).find((x) => x.key === 'd-30no')!.complete).toBe(true);
      return;
    }
    throw new Error('The 30 not out challenge never came up in 40 days');
  });

  it('counts finished training weeks', () => {
    const before = career();
    const report = { ...(before.player.development.weeklyReports[0] ?? {}), id: 'wk-new', energyUsed: 40 } as GameState['player']['development']['weeklyReports'][number];
    const after = { ...before, player: { ...before.player, development: { ...before.player.development, weeklyReports: [report, ...before.player.development.weeklyReports] } } };
    const recorded = recordTraining(before, after, NOW);
    expect(recorded.challenges!.log.filter((e) => e.kind === 'TRAINING')).toHaveLength(1);
    expect(recordTraining(before, before, NOW).challenges!.log).toHaveLength(0);
  });
});

describe('claiming', () => {
  /** A state with every playable challenge done today. */
  function busyDay(): GameState {
    let state = career();
    for (let i = 0; i < 4; i += 1) {
      state = recordMatch(state, match(state, `big${i}`, { runs: 60, balls: 45, fours: 6, sixes: 2, out: false, won: true }), NOW);
    }
    const report = { ...(state.player.development.weeklyReports[0] ?? {}), id: 'wk-a', energyUsed: 40 } as GameState['player']['development']['weeklyReports'][number];
    const later = { ...state, player: { ...state.player, development: { ...state.player.development, weeklyReports: [report] } } };
    state = recordTraining({ ...state, player: { ...state.player, development: { ...state.player.development, weeklyReports: [] } } }, later, NOW);
    return state;
  }

  it('pays XP once, and refuses the same claim again (as after a reload)', () => {
    const state = busyDay();
    const done = currentChallenges(state, NOW).find((c) => c.complete)!;
    expect(done).toBeDefined();
    const first = claimChallenge(state, done.id, NOW);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.state.challenges!.xpEarned).toBe(done.xp);
    // A reload is a save round trip: the claim survives it.
    const reloaded = JSON.parse(JSON.stringify(first.state)) as GameState;
    const second = claimChallenge(reloaded, done.id, NOW);
    expect(second).toEqual({ ok: false, reason: 'Already claimed.' });
  });

  it('refuses unfinished and expired challenges', () => {
    const state = career();
    const open = currentChallenges(state, NOW)[0];
    expect(claimChallenge(state, open.id, NOW)).toEqual({ ok: false, reason: 'Not finished yet.' });
    expect(claimChallenge(state, 'd:2026-09-01:d-play', NOW)).toEqual({ ok: false, reason: 'That challenge has ended.' });
  });
});

describe('saves', () => {
  it('a v9 career migrates to v10 with empty challenges', () => {
    const state = career();
    const old = { ...state, version: 9 } as GameState;
    delete old.challenges;
    const result = migrate(old);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.version).toBe(10);
      expect(result.value.challenges).toEqual({ log: [], claimed: [], xpEarned: 0 });
      expect(result.value.player).toEqual(state.player);
    }
  });
});
