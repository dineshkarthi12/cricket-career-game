/**
 * Measuring how often a batter gets out at each intent - the statistical
 * check behind the defensive-batting rules. Pure and seeded: the same inputs
 * always give the same numbers, so a regression can be reproduced exactly.
 *
 * Used by the tests and by anyone tuning `MATCH` in config.ts.
 */
import { createInningsState, planNextDelivery, stepBall, strikerOf, type InningsSetup } from './innings';
import { createPitch, createWeather, newBall } from './conditions';
import { createRng, deriveSeed } from './rng';
import { generateXi } from './squad';
import type { BowlerPlan, SimPlayer } from './types';
import type { TouchShot } from './touch';
import { VENUES_BY_ID } from '@/data/venues';
import type { MatchFormat, PlayerRole } from '@/types';

export interface DismissalSample {
  /** Balls the measured batter faced. */
  balls: number;
  /** Times they were dismissed (any way, including run outs). */
  outs: number;
  /** Runs they scored. */
  runs: number;
  /** Balls faced per dismissal (Infinity when never out). */
  ballsPerDismissal: number;
  /** Dismissals by type. */
  byType: Record<string, number>;
}

export interface DismissalScenario {
  format: MatchFormat;
  /** Intent level the measured batter uses on every ball, 1-5. */
  level: number;
  /** Measured batter's batting strength (generated XI strength). */
  strength?: number;
  /** Opposition bowling strength. */
  bowlingStrength?: number;
  /** Wickets already down when the measured batter walks in. */
  wicketsDown?: number;
  /** Batting position of the measured batter. */
  position?: number;
  /** Ask for "leave" on every ball. */
  leave?: boolean;
  /** Ask to rotate the strike. */
  rotate?: boolean;
  /** Two-touch batting: the same tap on every ball, or one picked per ball. */
  touch?: TouchShot | ((ball: number, seen: BowlerPlan | null) => TouchShot);
  /** Number of innings to run. */
  innings: number;
  seed?: number;
  role?: PlayerRole;
}

/**
 * Put the measured batter in at `position` with `wicketsDown` already gone
 * (wickets in the last few overs, so the collapse effects are live), and play
 * until they are out or the innings ends.
 */
export function measureDismissals(scenario: DismissalScenario): DismissalSample {
  const venue = VENUES_BY_ID['venue-chepauk'];
  const seed = scenario.seed ?? 1234;
  const position = scenario.position ?? 5;
  const down = scenario.wicketsDown ?? 0;
  const byType: Record<string, number> = {};
  let balls = 0;
  let outs = 0;
  let runs = 0;
  const limit = scenario.format === 'T20' ? 20 : scenario.format === 'ODI' || scenario.format === 'ONE_DAY' ? 50 : null;

  for (let i = 0; i < scenario.innings; i += 1) {
    const s = deriveSeed(seed, i + 1);
    const rng = createRng(s);
    const batting: SimPlayer[] = generateXi('bat', scenario.strength ?? 66, createRng(s ^ 0x11)).map((p) => ({ ...p }));
    const me: SimPlayer = { ...batting[position - 1], id: 'me', name: 'Me', isUser: true, role: scenario.role ?? 'BATTER', bowlingStyle: 'NONE' };
    batting[position - 1] = me;
    const bowling = generateXi('bowl', scenario.bowlingStrength ?? 66, createRng(s ^ 0x22));
    const setup: InningsSetup = {
      number: 1,
      battingTeamId: 'bat',
      bowlingTeamId: 'bowl',
      batting,
      bowling,
      format: scenario.format,
      venue,
      conditions: {
        pitch: createPitch(rng, venue),
        weather: createWeather(rng, 11),
        ball: newBall(1),
        phase: limit === null ? 'NEW_BALL' : 'POWERPLAY',
        pressure: 0,
        underLights: false,
      },
      oversAvailable: limit,
      target: null,
      battingAtHome: true,
      knockout: false,
      day: 1,
      underLights: false,
    };
    const state = createInningsState(setup);
    // An early collapse: the first `down` wickets fell in the last couple of
    // overs, so the batter walks into a cluster of wickets.
    if (down > 0) {
      state.wickets = down;
      state.legalBalls = Math.min(state.maxBalls - 60, 6 * (2 + down));
      state.runs = 4 * down + 6;
      state.wicketBalls = Array.from({ length: down }, (_, k) => Math.max(0, state.legalBalls - 2 * (down - k)));
      for (let k = 0; k < down; k += 1) {
        const line = state.battingLines.get(state.batting[k].id)!;
        line.out = true;
      }
    }
    // Measured batter on strike, the next man at the other end.
    state.strikerIndex = position - 1;
    state.nonStrikerIndex = down < position - 1 ? down : position;
    state.nextBatterIndex = Math.max(position, state.nonStrikerIndex + 1);

    let guard = 0;
    while (!state.complete && guard < 2000) {
      guard += 1;
      const atCrease = state.batting[state.strikerIndex]?.id === 'me' || state.batting[state.nonStrikerIndex]?.id === 'me';
      if (!atCrease) break;
      const meOnStrike = strikerOf(state).id === 'me';
      const ball = stepBall(state, rng, {
        battingFor: 'me',
        intentLevel: scenario.level,
        leave: scenario.leave,
        rotate: scenario.rotate,
        touch:
          typeof scenario.touch === 'function'
            ? scenario.touch(guard, meOnStrike ? (planNextDelivery(state, s, scenario.level)?.plan ?? null) : null)
            : scenario.touch,
      });
      if (!ball) break;
      if (meOnStrike && ball.isLegalDelivery) balls += 1;
      if (meOnStrike) runs += ball.runsOffBat;
      if (ball.wicket && state.battingLines.get('me')?.out) {
        outs += 1;
        byType[ball.wicket.type] = (byType[ball.wicket.type] ?? 0) + 1;
        break;
      }
    }
  }
  return { balls, outs, runs, ballsPerDismissal: outs > 0 ? balls / outs : Infinity, byType };
}
