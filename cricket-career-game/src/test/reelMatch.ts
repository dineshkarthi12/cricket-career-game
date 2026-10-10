/**
 * A hand-made match for the highlights tests: a hundred, a five-for (one
 * wicket an overturned review) and a chase won off the last ball.
 */
import { VENUES_BY_ID } from '@/data/venues';
import { createPitch, createWeather, newBall } from '@/engine/match/conditions';
import { createRng } from '@/engine/match/rng';
import type { Ball, DismissalType, Innings, Match } from '@/types';

let seq = 0;
/** One delivery. */
export function ball(strikerId: string, bowlerId: string, o: { runs?: number; four?: boolean; six?: boolean; out?: DismissalType; review?: 'OVERTURNED'; fielder?: string } = {}): Ball {
  seq += 1;
  const runs = o.six ? 6 : o.four ? 4 : (o.runs ?? 0);
  return {
    id: `b${seq}`, over: 0, ballInOver: 1, ballNumber: seq, bowlerId, strikerId, nonStrikerId: 'x', line: 'OFF_STUMP', length: 'GOOD', speed: 130, variation: null, intent: 'NORMAL', shot: null,
    contactQuality: 50, runsOffBat: runs, extras: null, isLegalDelivery: true, isBoundaryFour: Boolean(o.four), isBoundarySix: Boolean(o.six),
    wicket: o.out ? { type: o.out, bowlerId, fielderId: null } : null, landingPoint: null, shotAngle: null, shotDistance: null, fielderName: o.fielder ?? null,
    review: o.review ? { by: 'BATTING', outcome: o.review } : null, commentary: '', phase: 'MIDDLE',
  } as unknown as Ball;
}

export function innings(battingTeamId: string, deliveries: Ball[], names: Record<string, string>, target: number | null = null): Innings {
  const batting = new Map<string, { runs: number; balls: number }>();
  const bowling = new Map<string, { wickets: number }>();
  const fallOfWickets: Innings['fallOfWickets'] = [];
  let runs = 0;
  for (const d of deliveries) {
    const b = batting.get(d.strikerId) ?? { runs: 0, balls: 0 };
    b.runs += d.runsOffBat;
    b.balls += 1;
    batting.set(d.strikerId, b);
    runs += d.runsOffBat;
    const w = bowling.get(d.bowlerId) ?? { wickets: 0 };
    if (d.wicket) {
      w.wickets += 1;
      fallOfWickets.push({ wicketNumber: fallOfWickets.length + 1, runs, over: 0, playerId: d.strikerId });
    }
    bowling.set(d.bowlerId, w);
  }
  return {
    id: `inn-${battingTeamId}`, number: 1, battingTeamId, bowlingTeamId: 'other', runs, wickets: fallOfWickets.length, balls: deliveries.length, overs: 0,
    extras: {} as never, extrasTotal: 0,
    batting: [...batting].map(([playerId, b], i) => ({ playerId, name: names[playerId] ?? playerId, battingPosition: i + 1, runs: b.runs, balls: b.balls, fours: 0, sixes: 0, strikeRate: 0, out: false, dismissal: null, dismissalText: '' })),
    bowling: [...bowling].map(([playerId, w]) => ({ playerId, name: names[playerId] ?? playerId, overs: 0, balls: 0, maidens: 0, runsConceded: 0, wickets: w.wickets, wides: 0, noBalls: 0, economy: 0 })),
    fallOfWickets, deliveries, target, allOut: false,
  } as unknown as Innings;
}

export const NAMES: Record<string, string> = { smith: 'Steve Smith', root: 'Joe Root', me: 'Arjun Varadan', bumrah: 'Jasprit Bumrah', a1: 'Batter One', a2: 'Batter Two', a3: 'Batter Three', a4: 'Batter Four', a5: 'Batter Five', b1: 'Pat Cummins' };

/**
 * Innings 1: Smith makes a hundred off boundaries (a six on the way, the
 * fifty and the hundred both off fours) and Bumrah (the player) is hit.
 * Innings 2: the player takes five wickets, one an overturned review, and
 * the chase is won off the last ball with a four.
 */
export function reelMatch(): Match {
  seq = 0;
  const first: Ball[] = [];
  for (let i = 0; i < 11; i += 1) first.push(ball('smith', 'me', { four: true })); // 44
  first.push(ball('smith', 'me', { six: true })); // 50 - a six brings up the fifty
  for (let i = 0; i < 12; i += 1) first.push(ball('smith', 'b1', { four: true })); // 98
  first.push(ball('smith', 'b1', { runs: 1 })); // 99
  first.push(ball('smith', 'b1', { four: true })); // 103 - the hundred
  const second: Ball[] = [];
  for (const [i, id] of ['a1', 'a2', 'a3', 'a4', 'a5'].entries()) {
    second.push(ball(id, 'me', { runs: 2 }));
    second.push(ball(id, 'me', { out: i === 2 ? 'LBW' : 'BOWLED', review: i === 2 ? 'OVERTURNED' : undefined }));
  }
  for (let i = 0; i < 20; i += 1) second.push(ball('root', 'bumrah', { four: true }));
  const inns = [innings('eng', first, NAMES), innings('ind', second, NAMES, 104)];
  // The last ball wins it.
  return {
    id: 'm', fixtureId: 'f', tournamentId: 'ipl', seasonYear: 2026, format: 'T20', stage: 'League', date: '2026-04-01', days: 1, homeTeamId: 'eng', awayTeamId: 'ind', userIsHome: false, userPlayed: true,
    tossWinnerTeamId: null, tossDecision: null, status: 'COMPLETED', conditions: { pitch: createPitch(createRng(1), VENUES_BY_ID['venue-chepauk']), weather: createWeather(createRng(2), 4), ball: newBall(1), phase: 'MIDDLE', pressure: 0, underLights: true } as never, venueId: 'venue-chepauk', innings: inns, currentInningsIndex: 1, fielders: [],
    result: { type: 'WIN', winningTeamId: 'ind', summary: 'Won by 5 wickets', marginRuns: null, marginWickets: 5, manOfTheMatchId: null }, userPerformance: null,
  } as unknown as Match;
}

