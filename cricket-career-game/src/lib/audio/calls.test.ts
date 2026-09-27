import { describe, expect, it } from 'vitest';
import { sfxForBall, sfxForResult } from './calls';
import type { Ball, BatterInningsLine, BowlerInningsLine, Innings } from '@/types';

function ball(p: Partial<Ball>): Ball {
  return {
    id: 'b1', over: 0, ballInOver: 1, ballNumber: 1, bowlerId: 'bw', strikerId: 'me', nonStrikerId: 'ns',
    line: 'OFF_STUMP', length: 'GOOD', speed: 130, variation: null, intent: 'NORMAL', shot: 'DRIVE', contactQuality: 70,
    runsOffBat: 0, extras: null, isLegalDelivery: true, isBoundaryFour: false, isBoundarySix: false, wicket: null,
    landingPoint: null, shotAngle: 20, shotDistance: 30, fielderName: 'Ravi Kumar', commentary: '', phase: 'POWERPLAY',
    ...p,
  } as Ball;
}
const bat = (playerId: string, runs: number, balls: number, out = false): BatterInningsLine => ({ playerId, name: playerId, battingPosition: 1, runs, balls, fours: 0, sixes: 0, strikeRate: 0, out, dismissal: null, dismissalText: '' });
const bowl = (wickets: number): BowlerInningsLine => ({ playerId: 'bw', name: 'Bowler', overs: 3, balls: 18, maidens: 0, runsConceded: 20, wickets, wides: 0, noBalls: 0, economy: 6 });
const lines = (batting: BatterInningsLine[], wickets = 0, fow: Innings['fallOfWickets'] = []) => ({ batting, bowling: [bowl(wickets)], fallOfWickets: fow });

describe('match sound effects', () => {
  it('cracks and roars for a six, cheers a four', () => {
    expect(sfxForBall(ball({ runsOffBat: 6, isBoundarySix: true }), lines([bat('me', 20, 12)]), 'me')).toEqual(['BAT_BIG', 'ROAR']);
    expect(sfxForBall(ball({ runsOffBat: 4, isBoundaryFour: true }), lines([bat('me', 8, 5)]), 'me')).toEqual(['BAT', 'CHEER']);
  });

  it('plays the bat for ones and twos, and a clap for three', () => {
    expect(sfxForBall(ball({ runsOffBat: 1 }), lines([bat('me', 5, 5)]), 'me')).toEqual(['BAT']);
    expect(sfxForBall(ball({ runsOffBat: 2 }), lines([bat('me', 6, 5)]), 'me')).toEqual(['BAT']);
    expect(sfxForBall(ball({ runsOffBat: 3 }), lines([bat('me', 7, 5)]), 'me')).toEqual(['BAT', 'LIGHT_CLAP']);
    expect(sfxForBall(ball({ shot: null, shotAngle: null }), lines([bat('me', 7, 5)]), 'me')).toEqual([]);
  });

  it('rattles the stumps and groans for a duck or the player out; roars for an opponent', () => {
    const bowled = ball({ strikerId: 'x', wicket: { type: 'BOWLED', bowlerId: 'bw', fielderId: null } });
    expect(sfxForBall(bowled, lines([bat('x', 0, 3, true)], 1, [{ wicketNumber: 1, runs: 4, over: 1, playerId: 'x' }]), 'me')).toEqual(['STUMPS', 'GROAN']);
    expect(sfxForBall(bowled, lines([bat('x', 23, 20, true)], 1, [{ wicketNumber: 1, runs: 40, over: 6, playerId: 'x' }]), 'me')).toEqual(['STUMPS', 'ROAR']);
    const runOut = ball({ strikerId: 'st', wicket: { type: 'RUN_OUT', bowlerId: null, fielderId: 'f' } });
    expect(sfxForBall(runOut, lines([bat('st', 5, 5), bat('me', 30, 20, true)], 0, [{ wicketNumber: 1, runs: 50, over: 8, playerId: 'me' }]), 'me')).toEqual(['STUMPS', 'GROAN']);
    expect(sfxForBall(ball({ wicket: { type: 'LBW', bowlerId: 'bw', fielderId: null }, strikerId: 'x' }), lines([bat('x', 12, 9, true)], 1, [{ wicketNumber: 1, runs: 20, over: 3, playerId: 'x' }]), 'me')[0]).toBe('APPEAL');
  });

  it('applauds a fifty, a hundred and a five-for', () => {
    expect(sfxForBall(ball({ runsOffBat: 4, isBoundaryFour: true }), lines([bat('me', 52, 40)]), 'me')).toContain('APPLAUSE');
    expect(sfxForBall(ball({ runsOffBat: 1 }), lines([bat('me', 100, 90)]), 'me')).toContain('APPLAUSE');
    const five = ball({ strikerId: 'x', wicket: { type: 'CAUGHT', bowlerId: 'bw', fielderId: 'f' } });
    expect(sfxForBall(five, lines([bat('x', 20, 15, true)], 5, [{ wicketNumber: 5, runs: 90, over: 15, playerId: 'x' }]), 'bw')).toContain('APPLAUSE');
  });

  it('cheers a win and claps politely otherwise', () => {
    const r = { type: 'WIN_BY_RUNS', winningTeamId: 'tn', summary: 'Won by 20 runs', marginRuns: 20, marginWickets: null, manOfTheMatchId: null } as never;
    expect(sfxForResult(r, 'tn')).toEqual(['APPLAUSE', 'ROAR']);
    expect(sfxForResult(r, 'ka')).toEqual(['LIGHT_CLAP']);
  });
});
