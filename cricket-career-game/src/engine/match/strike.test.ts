import { describe, expect, it } from 'vitest';
import { simulateMatch } from './simulate';
import { createLiveMatch } from './live';
import { generateXi } from './squad';
import { createRng } from './rng';
import { VENUES_BY_ID } from '@/data/venues';
import type { Ball } from '@/types';

const venue = Object.values(VENUES_BY_ID)[0];

/**
 * Who should face the next ball: the batters cross on an odd number of runs
 * (1, 3, or odd byes and leg byes), not on 0, 2, 4 or 6; at the end of an
 * over the other batter faces the new bowler. After a wicket, or a batter
 * retiring hurt, a new batter comes in, so those are left out.
 */
function expectedStriker(ball: Ball, overEnded: boolean): string {
  const ran = ball.runsOffBat + (ball.extras && (ball.extras.type === 'BYE' || ball.extras.type === 'LEG_BYE') ? ball.extras.runs : 0);
  let cross = !(ball.isBoundaryFour || ball.isBoundarySix) && ran % 2 === 1;
  if (overEnded) cross = !cross;
  return cross ? ball.nonStrikerId : ball.strikerId;
}

describe('the strike', () => {
  it('changes on odd runs and at the end of every over, never on 0, 2, 4 or 6', () => {
    let checked = 0;
    let odd = 0;
    let boundaries = 0;
    for (const format of ['T20', 'ODI'] as const) {
      for (let seed = 1; seed <= 6; seed += 1) {
        const { match } = simulateMatch({
          fixtureId: 'fx', tournamentId: 't', seasonYear: 2026, format, stage: 'League', date: '2026-11-15', venue,
          homeTeamId: 'home', awayTeamId: 'away', homeXi: generateXi('home', 66, createRng(seed)), awayXi: generateXi('away', 64, createRng(seed + 50)),
          userIsHome: true, seed, month: 11,
        });
        for (const innings of match.innings) {
          const d = innings.deliveries;
          for (let i = 0; i + 1 < d.length; i += 1) {
            const [a, b] = [d[i], d[i + 1]];
            if (a.wicket || ![a.strikerId, a.nonStrikerId].includes(b.strikerId)) continue;
            checked += 1;
            if (a.runsOffBat % 2 === 1) odd += 1;
            if (a.isBoundaryFour || a.isBoundarySix) boundaries += 1;
            expect(b.strikerId, `${format} ${seed} over ${a.over}.${a.ballInOver}`).toBe(expectedStriker(a, b.over !== a.over));
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(2000);
    expect(odd).toBeGreaterThan(300);
    expect(boundaries).toBeGreaterThan(100);
  });

  it('works the same ball by ball in a live match, with the player batting', () => {
    let checked = 0;
    let mine = 0;
    for (let seed = 1; seed <= 4; seed += 1) {
      const homeXi = generateXi('home', 66, createRng(seed));
      const userId = homeXi[0].id;
      const live = createLiveMatch({
        fixtureId: 'fx', tournamentId: 't', seasonYear: 2026, format: 'T20', stage: 'League', date: '2026-11-15', venue,
        homeTeamId: 'home', awayTeamId: 'away', homeXi, awayXi: generateXi('away', 64, createRng(seed + 50)),
        userTeamId: 'home', userPlayerId: userId, userIsCaptain: false, seed, month: 11,
      });
      live.doToss();
      for (let guard = 0; guard < 600; guard += 1) {
        const snap = live.snapshot();
        if (snap.phase === 'COMPLETE') break;
        if (snap.question) {
          live.answer({ timing: 0.5, review: false });
          continue;
        }
        if (snap.phase === 'INNINGS_BREAK') {
          live.startNextInnings();
          continue;
        }
        const before = snap.current;
        const ball = live.nextBall({ battingFor: userId });
        const after = live.snapshot().current;
        if (!ball || !before || !after || ball.wicket || after.number !== before.number) continue;
        if (![ball.strikerId, ball.nonStrikerId].includes(after.strikerId)) continue;
        checked += 1;
        if (ball.strikerId === userId || ball.nonStrikerId === userId) mine += 1;
        const overEnded = ball.isLegalDelivery && ball.ballInOver === 6;
        expect(after.strikerId).toBe(expectedStriker(ball, overEnded));
        expect(after.nonStrikerId).toBe(after.strikerId === ball.strikerId ? ball.nonStrikerId : ball.strikerId);
      }
    }
    expect(checked).toBeGreaterThan(300);
    expect(mine).toBeGreaterThan(30);
  });
});
