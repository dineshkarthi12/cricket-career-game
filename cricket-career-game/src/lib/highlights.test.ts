import { describe, expect, it } from 'vitest';
import { headlineOf, inningsHighlights, overSummaries } from './highlights';
import type { Ball } from '@/types';

let n = 0;
function ball(patch: Partial<Ball>): Ball {
  n += 1;
  const legal = patch.isLegalDelivery ?? true;
  return {
    id: `b${n}`, over: 0, ballInOver: 1, ballNumber: n, bowlerId: 'bowler', strikerId: 'bat', nonStrikerId: 'other',
    line: 'OFF_STUMP', length: 'GOOD', speed: 130, variation: null, intent: 'NORMAL', shot: 'DRIVE', contactQuality: 60,
    runsOffBat: 0, extras: null, isLegalDelivery: legal, isBoundaryFour: false, isBoundarySix: false, wicket: null,
    landingPoint: null, shotAngle: null, shotDistance: null, fielderName: null, commentary: '', phase: 'MIDDLE',
    ...patch,
  } as Ball;
}

const names = (id: string) => ({ bat: 'Rahul', bowler: 'Starc', other: 'Gill' })[id as 'bat'] ?? '';

describe('commentary highlights', () => {
  it('marks fours, sixes, a fifty with its balls and boundaries, and the team milestones', () => {
    const balls: Ball[] = [];
    for (let i = 0; i < 8; i += 1) balls.push(ball({ runsOffBat: 6, isBoundarySix: true }));
    balls.push(ball({ runsOffBat: 1 }));
    balls.push(ball({ runsOffBat: 4, isBoundaryFour: true }));
    const h = inningsHighlights(balls, names, 'Tamil Nadu');
    expect(h.get(balls[0].id)?.map((x) => x.kind)).toEqual(['SIX']);
    // 48 after eight sixes, 49 after the single, 53 after the four: the fifty.
    const fifty = h.get(balls[9].id)!.find((x) => x.kind === 'FIFTY');
    expect(fifty?.text).toContain('FIFTY for Rahul');
    expect(fifty?.text).toContain('off 10 balls (1x4, 8x6)');
    expect(h.get(balls[9].id)!.some((x) => x.kind === 'PARTNERSHIP')).toBe(true);
    expect(headlineOf(h.get(balls[9].id))?.kind).toBe('FIFTY');
  });

  it('marks wickets, five-fors and hat-tricks', () => {
    const out = { type: 'BOWLED' as const, bowlerId: 'bowler', fielderId: null };
    const balls = [ball({}), ball({ wicket: out }), ball({ wicket: out }), ball({ wicket: out }), ball({}), ball({ wicket: out }), ball({ wicket: out })];
    const h = inningsHighlights(balls, names, 'Kerala');
    expect(h.get(balls[1].id)?.[0].text).toContain('OUT! Rahul');
    expect(h.get(balls[1].id)?.[0].text).toContain('Kerala 0/1');
    expect(h.get(balls[3].id)?.some((x) => x.kind === 'HAT_TRICK')).toBe(true);
    expect(h.get(balls[6].id)?.some((x) => x.kind === 'FIVE_FOR')).toBe(true);
    expect(headlineOf(h.get(balls[3].id))?.kind).toBe('HAT_TRICK');
    // A plain dot ball is not a highlight.
    expect(h.has(balls[0].id)).toBe(false);
  });

  it('summarises each completed over', () => {
    const balls = [1, 2, 3, 4, 5, 6].map((b) => ball({ over: 0, ballInOver: b, runsOffBat: b === 3 ? 4 : 1, isBoundaryFour: b === 3 }));
    const summary = overSummaries(balls).get(balls[5].id);
    expect(summary).toEqual({ over: 1, runs: 9, wickets: 0, total: 9, totalWickets: 0 });
  });
});
