import { describe, expect, it } from 'vitest';
import { callForBall, callForResult } from './calls';
import { VOICE_LINES, voiceLine, type VoiceMoment } from '@/data/voiceLines';
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
const bat = (playerId: string, name: string, runs: number, balls: number, out = false): BatterInningsLine => ({ playerId, name, battingPosition: 1, runs, balls, fours: 0, sixes: 0, strikeRate: 0, out, dismissal: null, dismissalText: '' });
const bowl = (wickets: number): BowlerInningsLine => ({ playerId: 'bw', name: 'Sanjay Pillai', overs: 3, balls: 18, maidens: 0, runsConceded: 20, wickets, wides: 0, noBalls: 0, economy: 6 });
const lines = (batting: BatterInningsLine[], wickets = 0, fow: Innings['fallOfWickets'] = []) => ({ batting, bowling: [bowl(wickets)], fallOfWickets: fow });

describe('match sound calls', () => {
  it('roars for a six and names the batter', () => {
    const call = callForBall(ball({ runsOffBat: 6, isBoundarySix: true }), lines([bat('me', 'Arjun Varadan', 26, 14)]), 'me');
    expect(call.moment).toBe('SIX');
    expect(call.priority).toBe(3);
    expect(call.sfx).toEqual(['BAT_BIG', 'ROAR']);
    expect(call.mine).toBe(true);
    expect(call.line).not.toMatch(/\{/);
  });

  it('cheers a four, and calls ones, twos and threes', () => {
    expect(callForBall(ball({ runsOffBat: 4, isBoundaryFour: true }), lines([bat('me', 'A', 8, 5)]), 'me').moment).toBe('FOUR');
    expect(callForBall(ball({ runsOffBat: 1 }), lines([bat('me', 'A', 5, 5)]), 'me').moment).toBe('SINGLE');
    expect(callForBall(ball({ runsOffBat: 2 }), lines([bat('me', 'A', 6, 5)]), 'me').moment).toBe('TWO');
    expect(callForBall(ball({ runsOffBat: 3 }), lines([bat('me', 'A', 7, 5)]), 'me').moment).toBe('THREE');
  });

  it('knows a duck, a golden duck and a run out of the non-striker', () => {
    const out = (runs: number, balls: number) => lines([bat('me', 'Arjun Varadan', runs, balls, true)], 1, [{ wicketNumber: 1, runs: 10, over: 2, playerId: 'me' }]);
    const bowled = ball({ wicket: { type: 'BOWLED', bowlerId: 'bw', fielderId: null } });
    expect(callForBall(bowled, out(0, 4), 'me').moment).toBe('DUCK');
    expect(callForBall(bowled, out(0, 1), 'me').moment).toBe('GOLDEN_DUCK');
    const duck = callForBall(bowled, out(0, 4), 'me');
    expect(duck.sfx).toContain('STUMPS');
    expect(duck.sfx).toContain('GROAN');
    const runOut = callForBall(
      ball({ strikerId: 'st', wicket: { type: 'RUN_OUT', bowlerId: null, fielderId: 'f' } }),
      lines([bat('st', 'Striker', 12, 10), bat('me', 'Arjun Varadan', 30, 20, true)], 0, [{ wicketNumber: 1, runs: 50, over: 8, playerId: 'me' }]),
      'me',
    );
    expect(runOut.moment).toBe('RUN_OUT');
    expect(runOut.mine).toBe(true);
    expect(runOut.line).not.toContain('Striker');
  });

  it('marks a fifty, a hundred and a five-for over the shot itself', () => {
    expect(callForBall(ball({ runsOffBat: 4, isBoundaryFour: true }), lines([bat('me', 'A', 52, 40)]), 'me').moment).toBe('FIFTY');
    expect(callForBall(ball({ runsOffBat: 1 }), lines([bat('me', 'A', 100, 90)]), 'me').moment).toBe('HUNDRED');
    const five = callForBall(ball({ strikerId: 'x', bowlerId: 'bw', wicket: { type: 'CAUGHT', bowlerId: 'bw', fielderId: 'f' } }), lines([bat('x', 'X', 20, 15, true)], 5, [{ wicketNumber: 5, runs: 90, over: 15, playerId: 'x' }]), 'bw');
    expect(five.moment).toBe('FIVE_FOR');
    expect(five.priority).toBe(3);
  });

  it('calls the result for the player side', () => {
    const r = { type: 'WIN_BY_RUNS', winningTeamId: 'tn', summary: 'Won by 20 runs', marginRuns: 20, marginWickets: null, manOfTheMatchId: null } as never;
    expect(callForResult(r, 'tn', () => 'Tamil Nadu').moment).toBe('WIN');
    expect(callForResult(r, 'ka', () => 'Tamil Nadu').line).toContain('Tamil Nadu');
  });

  it('fills every line and never repeats the same line twice running', () => {
    for (const moment of Object.keys(VOICE_LINES) as VoiceMoment[]) {
      for (let i = 0; i < 20; i += 1) {
        const line = voiceLine(moment, { batter: 'A', bowler: 'B', fielder: 'C', team: 'D' }, `seed-${i}`);
        expect(line).not.toMatch(/\{|\}/);
        if (VOICE_LINES[moment].length > 1) expect(voiceLine(moment, { batter: 'A', bowler: 'B', fielder: 'C', team: 'D' }, `seed-${i}`, line)).not.toBe(line);
      }
    }
  });
});
