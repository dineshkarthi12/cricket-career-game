import { describe, expect, it } from 'vitest';
import { MAX_CLIPS, hasBallByBall, pickClips } from './clips';
import { NAMES, ball, innings, reelMatch as demo } from '@/test/reelMatch';

describe('the highlights clip picker', () => {
  it('finds the hundred, the five-for and the last-ball finish, in match order', () => {
    const clips = pickClips(demo(), 'me', 'Arjun Varadan', { max: 100 });
    const first = clips.filter((c) => c.inningsIndex === 0);
    // A six, the fifty (off that six), the hundred (off a four) - and the four hit off the player is not theirs.
    expect(first.map((c) => c.kinds[0])).toEqual(['FIFTY', 'HUNDRED']);
    expect(first[0].kinds).toEqual(['FIFTY', 'SIX']);
    expect(first[0].title).toBe('FIFTY - Smith 50(12)');
    expect(first[1].title).toBe('HUNDRED - Smith 103(26)');
    const second = clips.filter((c) => c.inningsIndex === 1);
    const wickets = second.filter((c) => c.kinds.includes('WICKET'));
    expect(wickets).toHaveLength(5);
    expect(wickets.every((c) => c.mine)).toBe(true);
    expect(wickets[0].title).toBe('WICKET - Varadan b. One 2(2)');
    expect(wickets[2].kinds).toEqual(['WICKET', 'DRS']);
    expect(wickets[2].title).toBe('WICKET - Varadan lbw Three 2(2)');
    const finish = second.at(-1)!;
    expect(finish.kinds[0]).toBe('WINNING_RUNS');
    expect(finish.title).toBe('WINNING RUNS - Root 80(20)');
    expect(finish.score).toEqual({ runs: 90, wickets: 5, overs: '5.0' });
    // Match order throughout.
    const keys = clips.map((c) => c.inningsIndex * 1000 + c.ballIndex);
    expect(keys).toEqual([...keys].sort((a, b) => a - b));
  });

  it('cuts a long reel to the biggest moments, still in match order', () => {
    const clips = pickClips(demo(), 'me', 'Arjun Varadan');
    expect(clips.length).toBeLessThanOrEqual(MAX_CLIPS);
    const kinds = clips.flatMap((c) => c.kinds);
    expect(kinds).toContain('HUNDRED');
    expect(kinds).toContain('WINNING_RUNS');
    expect(clips.filter((c) => c.kinds.includes('WICKET'))).toHaveLength(5);
    const keys = clips.map((c) => c.inningsIndex * 1000 + c.ballIndex);
    expect(keys).toEqual([...keys].sort((a, b) => a - b));
  });

  it('"Your moments only" keeps the player’s own balls', () => {
    const mine = pickClips(demo(), 'me', 'Arjun Varadan', { mineOnly: true });
    expect(mine.length).toBe(6); // the fifty six off them, and the five wickets
    expect(mine.every((c) => c.mine)).toBe(true);
    // The player's own boundaries count even when they are nothing special.
    const batting = pickClips({ ...demo(), result: null, innings: [innings('ind', [ball('me', 'b1', { four: true }), ball('me', 'b1', { runs: 1 })], NAMES)] }, 'me', null, { mineOnly: true });
    expect(batting.map((c) => c.title)).toEqual(['FOUR - Varadan 4(1)']);
  });

  it('only matches that kept their ball-by-ball can be replayed', () => {
    expect(hasBallByBall(demo())).toBe(true);
    const archived = { ...demo(), innings: demo().innings.map((i) => ({ ...i, deliveries: [] })) };
    expect(hasBallByBall(archived)).toBe(false);
    expect(pickClips(archived, 'me')).toEqual([]);
  });
});
