import { describe, expect, it } from 'vitest';
import { variants } from '@/i18n/core';
import { VENUES_BY_ID } from '@/data/venues';
import { alertText } from '@/lib/matchText';
import { commentaryFor, renderCommentary } from './commentary';
import { createLiveMatch } from './live';
import { createRng } from './rng';
import { generateXi } from './squad';
import { simulateMatch, type MatchSetup } from './simulate';

const TAMIL = /[஀-௿]/;

function setup(seed: number): MatchSetup {
  return {
    fixtureId: 'fx-1',
    tournamentId: 'ranji-trophy',
    seasonYear: 2026,
    format: 'T20',
    stage: 'League',
    date: '2026-11-15',
    venue: VENUES_BY_ID['venue-chepauk'],
    homeTeamId: 'home',
    awayTeamId: 'away',
    homeXi: generateXi('home', 66, createRng(seed ^ 0xa)),
    awayXi: generateXi('away', 64, createRng(seed ^ 0xb)),
    userIsHome: true,
    seed,
    month: 11,
  };
}

describe('commentary in two languages', () => {
  it('a fixed seeded over reads the same in English as before, and in Tamil from the same codes', () => {
    const { match } = simulateMatch(setup(4242));
    const over = match.innings[0].deliveries.filter((b) => b.over === 0);
    expect(over.length).toBeGreaterThanOrEqual(6);
    const names = [...match.innings[0].batting, ...match.innings[0].bowling].map((l) => l.name);
    for (const ball of over) {
      expect(ball.commentaryCode?.length).toBeGreaterThan(0);
      // The stored English is exactly what the codes say in English.
      expect(renderCommentary(ball.commentaryCode!, 'en')).toBe(ball.commentary);
      expect(commentaryFor(ball, 'en')).toBe(ball.commentary);
      const ta = commentaryFor(ball, 'ta');
      expect(ta).toMatch(TAMIL);
      expect(ta).not.toBe(ball.commentary);
      // Every variable filled in, no stray keys.
      expect(ta).not.toMatch(/[{}@]|cv\./);
      expect(ball.commentary).not.toMatch(/[{}@]|cv\./);
      // Player names stay in English, in both.
      const named = names.filter((n) => ball.commentary.includes(n));
      for (const n of named) expect(ta).toContain(n);
    }
  });

  it('every ball of a whole match renders cleanly in Tamil', () => {
    for (const seed of [1, 77, 9001]) {
      const { match } = simulateMatch(setup(seed));
      for (const innings of match.innings) {
        for (const ball of innings.deliveries) {
          const ta = commentaryFor(ball, 'ta');
          expect(ta, ball.commentary).toMatch(TAMIL);
          expect(ta, ball.commentary).not.toMatch(/[{}@]|cv\.|undefined/);
        }
      }
    }
  });

  it('has 4-6 variants for each big event, in both languages', () => {
    for (const family of ['cv.six', 'cv.four', 'cv.dot', 'cv.bowled', 'cv.lbw', 'cv.caught', 'cv.rope', 'cv.behind', 'cv.cab', 'cv.stumped', 'cv.runOut', 'cv.hitWicket', 'cv.drop', 'hl.fifty', 'hl.hundred', 'hl.fiveFor']) {
      const n = variants(family);
      expect(n, family).toBeGreaterThanOrEqual(4);
      expect(n, family).toBeLessThanOrEqual(6);
    }
  });

  it('phrasing varies across a match', () => {
    const { match } = simulateMatch(setup(31337));
    const used = new Set(match.innings.flatMap((i) => i.deliveries.flatMap((b) => b.commentaryCode?.map((p) => p.k) ?? [])));
    expect([...used].filter((k) => k.startsWith('cv.dot.')).length).toBeGreaterThanOrEqual(3);
    expect([...used].filter((k) => k.startsWith('cv.four.')).length).toBeGreaterThanOrEqual(2);
  });

  it('a ball saved before the codes existed keeps its English, in either language', () => {
    const old = { commentary: 'Kohli drives it beautifully — four runs.' };
    expect(commentaryFor(old, 'ta')).toBe(old.commentary);
    expect(commentaryFor(old, 'en')).toBe(old.commentary);
  });

  it('live alerts read in Tamil too, and old ones keep their English', () => {
    const live = createLiveMatch({ ...setup(5), userTeamId: 'home' });
    live.doToss();
    live.toEnd();
    const alerts = live.snapshot().alerts;
    expect(alerts.length).toBeGreaterThan(0);
    for (const alert of alerts) {
      expect(alertText(alert, 'en')).toBe(alert.text);
      if (alert.code) expect(alertText(alert, 'ta')).toMatch(TAMIL);
    }
    expect(alertText({ kind: 'WICKET', text: 'Wicket! 10/1.' }, 'ta')).toBe('Wicket! 10/1.');
    expect(alertText({ kind: 'RESULT', text: 'Won by 3 runs' }, 'ta')).toBe('3 ரன் வித்தியாசத்தில் வெற்றி');
  });
});
