import { describe, expect, it } from 'vitest';
import { createNewCareer } from '../newCareer';
import { applyProSeason } from './season';
import { activeTrend, FAN_POST_KINDS, fansAfterMatch, postKindFor, withFollowerPoint } from './fans';
import { mediaAfterMatch, spotlightMoment } from './media';
import { FANS } from '../config';
import { en } from '@/i18n/en';
import type { GameState, Match, PlayerMatchPerformance } from '@/types';

function proCareer(): GameState {
  let state = createNewCareer({ firstName: 'Pro', lastName: 'Player', dateOfBirth: '1998-03-10', startStageId: 'RANJI_TROPHY', seed: 7, startDate: '2026-06-01', creationRole: 'BATTER' });
  state = { ...state, career: { ...state.career, stages: { ...state.career.stages, SENIOR_STATE: { ...state.career.stages.SENIOR_STATE, status: 'COMPLETED', completedOn: '2025-11-01' } } } };
  return applyProSeason(state, 2026, '2026-06-01');
}

/** One of the player's IPL matches, won by their side. */
function match(state: GameState, perf: Partial<PlayerMatchPerformance>, id = 'm1'): Match {
  const [home, away] = Object.values(state.teams).filter((t) => t.kind === 'FRANCHISE');
  return {
    id,
    fixtureId: `fx-${id}`,
    tournamentId: 'ipl',
    seasonYear: 2026,
    format: 'T20',
    stage: 'LEAGUE',
    date: '2027-04-02',
    homeTeamId: home.id,
    awayTeamId: away.id,
    userIsHome: true,
    result: { type: 'WIN', winningTeamId: home.id, margin: 10, marginType: 'RUNS', summary: '' },
    userPerformance: { playerId: state.player.id, runs: 0, ballsFaced: 0, fours: 0, sixes: 0, notOut: false, wickets: 0, runsConceded: 0, oversBowled: 0, catches: 0, runOuts: 0, stumpings: 0, rating: 6, manOfTheMatch: false, xpEarned: 0, ...perf },
  } as unknown as Match;
}

describe('fans', () => {
  it('has a string for every kind of fan post, in every wording', () => {
    for (const [kind, n] of Object.entries(FAN_POST_KINDS)) {
      for (let i = 1; i <= n; i += 1) expect(en, `fan.post.${kind}.${i}`).toHaveProperty(`fan.post.${kind}.${i}`);
      expect(en).not.toHaveProperty(`fan.post.${kind}.${n + 1}`);
    }
  });

  it('reads the day the way a fan would', () => {
    const state = proCareer();
    expect(postKindFor(match(state, { runs: 104, ballsFaced: 58 }))).toBe('HUNDRED');
    expect(postKindFor(match(state, { wickets: 5, runsConceded: 21, oversBowled: 4 }))).toBe('FIVE_FOR');
    expect(postKindFor(match(state, { runs: 0, ballsFaced: 3 }))).toBe('DUCK');
    expect(postKindFor(match(state, { runs: 4, ballsFaced: 9 }))).toBe('CHEAP');
    expect(postKindFor(match(state, { runsConceded: 52, oversBowled: 4 }))).toBe('EXPENSIVE');
    expect(postKindFor(match(state, { runs: 23, ballsFaced: 19, notOut: true }))).toBe('QUIET');
  });

  it('after a hundred: three posts, a trending hashtag and a point on the chart', () => {
    const state = proCareer();
    const after = fansAfterMatch(state, match(state, { runs: 112, ballsFaced: 61, manOfTheMatch: true }));
    const fans = after.pro.fans;
    expect(fans.posts).toHaveLength(FANS.postsPerMatch);
    expect(fans.posts!.filter((p) => p.key.startsWith('fan.post.HUNDRED.'))).toHaveLength(2);
    expect(fans.posts!.some((p) => p.key.startsWith('fan.post.WIN.'))).toBe(true);
    expect(new Set(fans.posts!.map((p) => p.handle)).size).toBe(FANS.postsPerMatch);
    expect(fans.posts!.every((p) => p.params.runs === 112 && p.mood !== 'TROLL')).toBe(true);
    expect(fans.trend).toMatchObject({ tag: '#Player112', date: '2027-04-02' });
    expect(activeTrend(fans, '2027-04-05')?.tag).toBe('#Player112');
    expect(activeTrend(fans, '2027-04-20')).toBeNull();
    expect(fans.history).toEqual([{ date: '2027-04-02', followers: fans.followers }]);
  });

  it('says it differently the next time', () => {
    const state = proCareer();
    const once = fansAfterMatch(state, match(state, { runs: 101, ballsFaced: 60 }, 'm1'));
    const twice = fansAfterMatch(once, match(once, { runs: 120, ballsFaced: 70 }, 'm2'));
    const keys = (posts: typeof twice.pro.fans.posts) => posts!.filter((p) => p.key.startsWith('fan.post.HUNDRED.')).map((p) => p.key);
    const first = keys(twice.pro.fans.posts!.slice(3));
    const second = keys(twice.pro.fans.posts!.slice(0, 3));
    expect(second.filter((k) => first.includes(k))).toEqual([]);
  });

  it('never repeats a line within one match, even after many quiet days', () => {
    let state = proCareer();
    for (let i = 0; i < 6; i += 1) {
      state = fansAfterMatch(state, match(state, { runs: 20, ballsFaced: 18, notOut: true }, `q${i}`));
      const latest = state.pro.fans.posts!.slice(0, 3).map((p) => p.key);
      expect(new Set(latest).size).toBe(3);
    }
  });

  it('trolls a duck, and the big stage feeds the feed through the media', () => {
    const state = proCareer();
    const after = mediaAfterMatch(state, match(state, { runs: 0, ballsFaced: 2, rating: 3 }));
    expect(after.pro.fans.posts!.filter((p) => p.mood === 'TROLL').length).toBeGreaterThanOrEqual(2);
    expect(after.pro.fans.trend ?? null).toBeNull();
  });

  it('marks each follower milestone once, with a note in the inbox', () => {
    const state = proCareer();
    const big = spotlightMoment(state, 120_000);
    expect(big.pro.fans.milestones).toEqual([10_000, 100_000]);
    expect(big.inbox[0].subject).toBe('100K followers!');
    expect(big.career.events.at(-1)?.title).toBe('100K followers');
    const again = spotlightMoment(big, 10);
    expect(again.pro.fans.milestones).toEqual([10_000, 100_000]);
    expect(again.inbox.length).toBe(big.inbox.length);
  });

  it('works on a save from before fans posted, and keeps the chart short', () => {
    const state = proCareer();
    const old: GameState = { ...state, pro: { ...state.pro, fans: { followers: 500, sentiment: 55, pressure: 0, stories: [] } } };
    expect(fansAfterMatch(old, match(old, { runs: 30, ballsFaced: 20 })).pro.fans.posts).toHaveLength(3);
    let fans = old.pro.fans;
    for (let i = 0; i < FANS.historyKept + 40; i += 1) fans = withFollowerPoint({ ...fans, followers: fans.followers + 1 }, `2027-01-${String((i % 28) + 1).padStart(2, '0')}-${i}`);
    expect(fans.history!.length).toBeLessThanOrEqual(FANS.historyKept);
    expect(fans.history!.at(-1)!.followers).toBe(fans.followers);
  });
});
