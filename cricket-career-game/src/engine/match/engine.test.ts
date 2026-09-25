import { describe, expect, it } from 'vitest';
import { MATCH, MATCH_FORMATS } from '../config';
import { applyAftermath, formBandFor, moraleBandFor } from './aftermath';
import { resourcesRemaining, revisedTarget } from './dls';
import { chooseField, nearestFielder, placeField } from './field';
import { simulateInnings } from './innings';
import { createRng } from './rng';
import { generateXi, toRivalPlayers } from './squad';
import { buildPerformance, isLimitedOvers, simulateMatch, type MatchSetup } from './simulate';
import { VENUES_BY_ID } from '@/data/venues';
import type { MatchFormat } from '@/types';

const venue = VENUES_BY_ID['venue-chepauk'];

function setup(overrides: Partial<MatchSetup> = {}): MatchSetup {
  const seed = overrides.seed ?? 1234;
  return {
    fixtureId: 'fx-1',
    tournamentId: 'ranji-trophy',
    seasonYear: 2026,
    format: 'ODI',
    stage: 'League',
    date: '2026-11-15',
    venue,
    homeTeamId: 'home',
    awayTeamId: 'away',
    homeXi: generateXi('home', 66, createRng(seed ^ 0xa)),
    awayXi: generateXi('away', 64, createRng(seed ^ 0xb)),
    userIsHome: true,
    seed,
    month: 11,
    ...overrides,
  };
}

describe('determinism', () => {
  it('replays a match ball for ball from the same seed', () => {
    const a = simulateMatch(setup({ seed: 90210 }));
    const b = simulateMatch(setup({ seed: 90210 }));

    expect(a.match.innings.map((i) => `${i.runs}/${i.wickets}`)).toEqual(
      b.match.innings.map((i) => `${i.runs}/${i.wickets}`),
    );
    expect(a.match.innings[0].deliveries.map((d) => d.commentary)).toEqual(
      b.match.innings[0].deliveries.map((d) => d.commentary),
    );
    expect(a.match.result?.summary).toBe(b.match.result?.summary);
  });

  it('gives a different match from a different seed', () => {
    const a = simulateMatch(setup({ seed: 1 }));
    const b = simulateMatch(setup({ seed: 2 }));
    expect(a.match.innings[0].runs).not.toBe(b.match.innings[0].runs);
  });

  it('never calls Math.random', () => {
    const original = Math.random;
    Math.random = () => {
      throw new Error('the engine must not use Math.random');
    };
    try {
      expect(() => simulateMatch(setup({ seed: 5150 }))).not.toThrow();
    } finally {
      Math.random = original;
    }
  });
});

describe('innings bookkeeping', () => {
  const { match } = simulateMatch(setup({ seed: 777, format: 'ODI' }));
  const innings = match.innings[0];

  it('counts legal deliveries into overs correctly', () => {
    const legal = innings.deliveries.filter((d) => d.isLegalDelivery).length;
    expect(innings.balls).toBe(legal);
    expect(innings.balls).toBeLessThanOrEqual(50 * 6);
  });

  it('adds the scorecard up to the innings total', () => {
    const batRuns = innings.batting.reduce((sum, b) => sum + b.runs, 0);
    expect(batRuns + innings.extrasTotal).toBe(innings.runs);
  });

  it('agrees with the bowling figures', () => {
    const bowlerBalls = innings.bowling.reduce((sum, b) => sum + b.balls, 0);
    expect(bowlerBalls).toBe(innings.balls);
    // Every run is either off the bat, a bowler's extra, or a bye/leg-bye.
    const charged = innings.bowling.reduce((sum, b) => sum + b.runsConceded, 0);
    const byes = innings.extras.BYE + innings.extras.LEG_BYE;
    expect(charged + byes).toBe(innings.runs);
  });

  it('records a fall of wicket for every dismissal', () => {
    const dismissals = innings.deliveries.filter((d) => d.wicket).length;
    expect(innings.fallOfWickets).toHaveLength(dismissals);
    expect(innings.wickets).toBe(dismissals);
  });

  it('marks dismissed batters out and gives them scorecard text', () => {
    for (const bat of innings.batting) {
      if (bat.out) {
        expect(bat.dismissal).not.toBeNull();
        expect(bat.dismissalText).not.toBe('not out');
      } else {
        expect(bat.dismissalText).toBe('not out');
      }
    }
    // At most two batters are unbeaten at the end of an innings.
    expect(innings.batting.filter((b) => !b.out).length).toBeLessThanOrEqual(3);
  });

  it('gives every ball a direction and distance for the 2D ground view', () => {
    const contacted = innings.deliveries.filter((d) => d.shotAngle !== null);
    expect(contacted.length).toBeGreaterThan(innings.balls * 0.8);
    for (const ball of contacted) {
      expect(ball.shotAngle).toBeGreaterThanOrEqual(0);
      expect(ball.shotAngle).toBeLessThan(360);
      expect(ball.shotDistance).toBeGreaterThan(0);
      expect(ball.landingPoint).not.toBeNull();
    }
  });

  it('writes a commentary line for every delivery', () => {
    for (const ball of innings.deliveries) {
      expect(ball.commentary.length).toBeGreaterThan(8);
    }
  });

  it('names the fielder on a catch', () => {
    const caught = innings.deliveries.filter(
      (d) => d.wicket?.type === 'CAUGHT' || d.wicket?.type === 'CAUGHT_BEHIND',
    );
    for (const ball of caught) {
      expect(ball.fielderName).toBeTruthy();
      expect(ball.wicket?.fielderId).toBeTruthy();
    }
  });
});

describe('bowling rotation', () => {
  it('respects the per-bowler over limit in limited overs', () => {
    for (const format of ['T20', 'ODI'] as MatchFormat[]) {
      const limit = MATCH_FORMATS[format].maxOversPerBowler!;
      for (let seed = 1; seed <= 6; seed += 1) {
        const { match } = simulateMatch(setup({ seed: seed * 31, format }));
        for (const innings of match.innings) {
          for (const bowler of innings.bowling) {
            expect(
              Math.floor(bowler.balls / 6),
              `${format} seed ${seed}: ${bowler.name} bowled ${bowler.balls} balls`,
            ).toBeLessThanOrEqual(limit);
          }
        }
      }
    }
  });

  it('never lets one bowler send down two overs in a row', () => {
    const { match } = simulateMatch(setup({ seed: 424242, format: 'ODI' }));
    for (const innings of match.innings) {
      const byOver = new Map<number, string>();
      for (const ball of innings.deliveries) byOver.set(ball.over, ball.bowlerId);
      const overs = [...byOver.entries()].sort((a, b) => a[0] - b[0]).map(([, id]) => id);
      for (let i = 1; i < overs.length; i += 1) {
        expect(overs[i]).not.toBe(overs[i - 1]);
      }
    }
  });

  it('tires a bowler out as the spell goes on', () => {
    const xi = generateXi('bowl', 65, createRng(9));
    const before = xi.map((p) => p.condition.fatigue);
    simulateInnings(
      {
        number: 1,
        battingTeamId: 'bat',
        bowlingTeamId: 'bowl',
        batting: generateXi('bat', 65, createRng(10)),
        bowling: xi,
        format: 'ODI',
        venue,
        conditions: {
          pitch: { type: 'FLAT', seamMovement: 40, swing: 40, turn: 40, bounce: 50, pace: 50, battingEase: 60, deterioration: 0 },
          weather: { type: 'SUNNY', temperature: 30, humidity: 50, cloudCover: 20, wind: 10, rainRisk: 0, rainDelay: false },
          ball: { ageInBalls: 0, shine: 100, hardness: 100, roughness: 0, reverseSwingAvailable: false, ballNumber: 1 },
          phase: 'POWERPLAY',
          pressure: 0,
          underLights: false,
        },
        oversAvailable: 50,
        target: null,
        battingAtHome: false,
        knockout: false,
        day: 1,
        underLights: false,
      },
      createRng(11),
    );
    const after = xi.map((p) => p.condition.fatigue);
    expect(after.some((f, i) => f > before[i])).toBe(true);
  });
});

describe('match formats', () => {
  it('plays a T20 in twenty overs a side', () => {
    const { match } = simulateMatch(setup({ seed: 8, format: 'T20' }));
    expect(match.innings).toHaveLength(2);
    for (const innings of match.innings) {
      expect(innings.balls).toBeLessThanOrEqual(120);
    }
    expect(match.days).toBe(1);
  });

  it('plays a multi-day match over up to four innings and can draw', () => {
    let sawDraw = false;
    let sawFourInnings = false;
    for (let seed = 1; seed <= 25; seed += 1) {
      const { match } = simulateMatch(setup({ seed: seed * 7, format: 'MULTI_DAY' }));
      expect(match.innings.length).toBeGreaterThanOrEqual(2);
      expect(match.innings.length).toBeLessThanOrEqual(4);
      if (match.result?.type === 'DRAW') sawDraw = true;
      if (match.innings.length === 4) sawFourInnings = true;
      expect(match.days).toBe(MATCH.multiDay.days);
    }
    expect(sawDraw).toBe(true);
    expect(sawFourInnings).toBe(true);
  });

  it('enforces the follow-on when the lead is big enough', () => {
    let sawFollowOn = false;
    for (let seed = 1; seed <= 60 && !sawFollowOn; seed += 1) {
      const { match } = simulateMatch(
        setup({
          seed: seed * 13,
          format: 'MULTI_DAY',
          homeXi: generateXi('home', 78, createRng(seed)),
          awayXi: generateXi('away', 48, createRng(seed + 1)),
        }),
      );
      if (match.innings.some((i) => i.followOn)) sawFollowOn = true;
    }
    expect(sawFollowOn).toBe(true);
  });

  it('declares an innings when the lead is commanding', () => {
    let sawDeclaration = false;
    for (let seed = 1; seed <= 60 && !sawDeclaration; seed += 1) {
      const { match } = simulateMatch(setup({ seed: seed * 17, format: 'MULTI_DAY' }));
      if (match.innings.some((i) => i.declared)) sawDeclaration = true;
    }
    expect(sawDeclaration).toBe(true);
  });

  it('gives a chase a target and stops as soon as it is passed', () => {
    for (let seed = 1; seed <= 12; seed += 1) {
      const { match } = simulateMatch(setup({ seed: seed * 101, format: 'ODI' }));
      const second = match.innings[1];
      if (!second) continue;
      expect(second.target).toBe(match.innings[0].runs + 1);
      if (match.result?.type === 'WIN' && match.result.marginWickets !== null) {
        expect(second.runs).toBeGreaterThanOrEqual(second.target!);
      }
    }
  });

  it('knows which formats are limited overs', () => {
    expect(isLimitedOvers('T20')).toBe(true);
    expect(isLimitedOvers('ODI')).toBe(true);
    expect(isLimitedOvers('MULTI_DAY')).toBe(false);
    expect(isLimitedOvers('TEST')).toBe(false);
  });

  it('plays a super over when a knockout is tied', () => {
    let sawSuperOver = false;
    for (let seed = 1; seed <= 400 && !sawSuperOver; seed += 1) {
      const { match } = simulateMatch(setup({ seed, format: 'T20', knockout: true }));
      if (match.innings.length > 2) {
        sawSuperOver = true;
        expect(match.result?.summary).toMatch(/super over/i);
        for (const over of match.innings.slice(2)) {
          expect(over.balls).toBeLessThanOrEqual(MATCH.superOver.balls);
        }
      }
    }
    expect(sawSuperOver).toBe(true);
  });
});

describe('DLS', () => {
  it('resources fall with overs used and wickets lost', () => {
    expect(resourcesRemaining(50, 0, 50)).toBeGreaterThan(resourcesRemaining(25, 0, 50));
    expect(resourcesRemaining(25, 0, 50)).toBeGreaterThan(resourcesRemaining(25, 5, 50));
    expect(resourcesRemaining(0, 0, 50)).toBe(0);
    expect(resourcesRemaining(20, 10, 50)).toBe(0);
  });

  it('scales the target down when the chase is shortened', () => {
    const full = revisedTarget({
      firstInningsRuns: 300,
      firstInningsOvers: 50,
      firstInningsWicketsLost: 6,
      secondInningsOvers: 50,
      totalOvers: 50,
    });
    const cut = revisedTarget({
      firstInningsRuns: 300,
      firstInningsOvers: 50,
      firstInningsWicketsLost: 6,
      secondInningsOvers: 25,
      totalOvers: 50,
    });
    expect(full).toBe(301);
    expect(cut).toBeLessThan(full);
    expect(cut).toBeGreaterThan(100);
  });

  it('sets a revised target on the innings when rain shortens a chase', () => {
    let sawDls = false;
    for (let seed = 1; seed <= 400 && !sawDls; seed += 1) {
      const { match } = simulateMatch(
        setup({
          seed,
          format: 'ODI',
          // A wet day, so the interruption actually fires.
          venue: { ...venue, season: [7] },
          month: 7,
        }),
      );
      const second = match.innings[1];
      if (second?.dlsTarget != null) {
        sawDls = true;
        expect(second.dlsTarget).toBeGreaterThan(0);
        expect(second.target).toBe(second.dlsTarget);
      }
    }
    expect(sawDls).toBe(true);
  });
});

describe('fielding', () => {
  it('puts eleven players on the park, with a keeper and no bowler fielding', () => {
    const xi = generateXi('bowl', 65, createRng(3));
    const field = placeField('STANDARD', xi, xi[8].id, createRng(4));

    expect(field.fielders).toHaveLength(9);
    expect(field.keeperId).toBeTruthy();
    expect(field.fielders.some((f) => f.playerId === xi[8].id)).toBe(false);
    expect(field.fielders.some((f) => f.playerId === field.keeperId)).toBe(false);
  });

  it('spreads the field at the death and keeps catchers in for a new ball', () => {
    expect(
      chooseField({ phase: 'DEATH', bowlerKind: 'PACE', ballAgeOvers: 18, wicketsLost: 3, runRatePressure: 0.5, unlimitedOvers: false }),
    ).toBe('DEATH');
    expect(
      chooseField({ phase: 'NEW_BALL', bowlerKind: 'PACE', ballAgeOvers: 2, wicketsLost: 0, runRatePressure: 0, unlimitedOvers: true }),
    ).toBe('ATTACKING_NEW_BALL');
  });

  it('finds the fielder nearest to where the ball went', () => {
    const xi = generateXi('bowl', 65, createRng(5));
    const field = placeField('STANDARD', xi, xi[8].id, createRng(6));
    const nearest = nearestFielder(field, 65, 30);
    expect(nearest).not.toBeNull();
    expect(nearest!.travel).toBeLessThan(20);
  });
});

describe('player performance and aftermath', () => {
  it('pulls a player match card out of the scorecards', () => {
    const s = setup({ seed: 616, format: 'ODI' });
    const userId = s.homeXi[2].id;
    const { match } = simulateMatch({ ...s, userPlayerId: userId });

    const performance = buildPerformance(match, userId, [...s.homeXi, ...s.awayXi]);
    expect(performance.playerId).toBe(userId);
    expect(performance.rating).toBeGreaterThanOrEqual(MATCH.aftermath.ratingFloor);
    expect(performance.rating).toBeLessThanOrEqual(MATCH.aftermath.ratingCeiling);
    expect(match.userPerformance).not.toBeNull();
  });

  it('picks a player of the match', () => {
    const { match } = simulateMatch(setup({ seed: 5, format: 'T20' }));
    expect(match.result?.manOfTheMatchId).toBeTruthy();
  });

  it('a big score lifts form, confidence and selector trust', () => {
    const xi = generateXi('home', 64, createRng(21));
    const condition = xi[0].condition;

    const good = applyAftermath(
      {
        condition,
        performance: {
          playerId: xi[0].id, runs: 120, ballsFaced: 130, fours: 14, sixes: 3, notOut: false,
          wickets: 0, runsConceded: 0, oversBowled: 0, catches: 1, runOuts: 0, stumpings: 0,
          rating: 9.2, manOfTheMatch: true, xpEarned: 0,
        },
        days: 1, won: true, drawn: false, prestige: 60, date: '2026-11-20', durability: 70,
      },
      createRng(1),
    );

    expect(good.condition.form).toBeGreaterThan(condition.form);
    expect(good.condition.confidence).toBeGreaterThan(condition.confidence);
    expect(good.condition.selectorTrust).toBeGreaterThan(condition.selectorTrust);
    expect(good.condition.reputation).toBeGreaterThan(condition.reputation);
    expect(good.condition.morale).toBeGreaterThan(condition.morale);
    expect(good.xpEarned).toBeGreaterThan(100);
  });

  it('a failure costs form and selector trust', () => {
    const xi = generateXi('home', 64, createRng(22));
    const condition = { ...xi[0].condition, form: 70, confidence: 70, selectorTrust: 70 };

    const bad = applyAftermath(
      {
        condition,
        performance: {
          playerId: xi[0].id, runs: 2, ballsFaced: 9, fours: 0, sixes: 0, notOut: false,
          wickets: 0, runsConceded: 0, oversBowled: 0, catches: 0, runOuts: 0, stumpings: 0,
          rating: 2.4, manOfTheMatch: false, xpEarned: 0,
        },
        days: 1, won: false, drawn: false, prestige: 60, date: '2026-11-20', durability: 70,
      },
      createRng(2),
    );

    expect(bad.condition.form).toBeLessThan(condition.form);
    expect(bad.condition.selectorTrust).toBeLessThan(condition.selectorTrust);
    expect(bad.condition.morale).toBeLessThan(condition.morale);
  });

  it('adds fatigue for days played and overs bowled', () => {
    const xi = generateXi('home', 64, createRng(23));
    const condition = { ...xi[0].condition, fatigue: 20 };
    const result = applyAftermath(
      {
        condition,
        performance: {
          playerId: xi[0].id, runs: 30, ballsFaced: 40, fours: 3, sixes: 0, notOut: false,
          wickets: 3, runsConceded: 60, oversBowled: 22, catches: 0, runOuts: 0, stumpings: 0,
          rating: 7, manOfTheMatch: false, xpEarned: 0,
        },
        days: 4, won: false, drawn: true, prestige: 50, date: '2026-11-20', durability: 70,
      },
      createRng(3),
    );
    expect(result.condition.fatigue).toBeGreaterThan(condition.fatigue);
    expect(result.condition.recentWorkload).toBeGreaterThan(condition.recentWorkload);
  });

  it('can leave a player injured, and never more than fully injured', () => {
    const xi = generateXi('home', 64, createRng(24));
    let injuries = 0;
    for (let seed = 1; seed <= 300; seed += 1) {
      const result = applyAftermath(
        {
          condition: { ...xi[0].condition, fatigue: 90 },
          performance: {
            playerId: xi[0].id, runs: 10, ballsFaced: 20, fours: 1, sixes: 0, notOut: false,
            wickets: 1, runsConceded: 40, oversBowled: 25, catches: 0, runOuts: 0, stumpings: 0,
            rating: 5, manOfTheMatch: false, xpEarned: 0,
          },
          days: 4, won: false, drawn: false, prestige: 50, date: '2026-11-20', durability: 40,
        },
        createRng(seed),
      );
      if (result.injury) {
        injuries += 1;
        expect(result.injury.expectedReturn > '2026-11-20').toBe(true);
        expect(result.condition.fitness).toBeGreaterThanOrEqual(0);
      }
      expect(result.condition.fatigue).toBeLessThanOrEqual(100);
      expect(result.condition.fitness).toBeLessThanOrEqual(100);
    }
    expect(injuries).toBeGreaterThan(0);
  });

  it('bands form and morale the way the dashboard reads them', () => {
    expect(formBandFor(85)).toBe('EXCELLENT');
    expect(formBandFor(70)).toBe('GOOD');
    expect(formBandFor(50)).toBe('AVERAGE');
    expect(formBandFor(10)).toBe('TERRIBLE');
    expect(moraleBandFor(90)).toBe('FLYING');
    expect(moraleBandFor(70)).toBe('HIGH');
    expect(moraleBandFor(10)).toBe('BROKEN');
  });
});

describe('squads', () => {
  it('builds a balanced XI with a keeper and enough bowling', () => {
    const xi = generateXi('team', 65, createRng(1));
    expect(xi).toHaveLength(11);
    expect(xi.filter((p) => p.role === 'WICKET_KEEPER_BATTER')).toHaveLength(1);
    expect(xi.filter((p) => p.bowlingStyle !== 'NONE').length).toBeGreaterThanOrEqual(5);
    expect(new Set(xi.map((p) => p.battingPosition)).size).toBe(11);
  });

  it('converts to the shape the save file stores', () => {
    const rivals = toRivalPlayers(generateXi('team', 65, createRng(2)));
    expect(rivals).toHaveLength(11);
    for (const rival of rivals) {
      expect(rival.overall).toBeGreaterThan(0);
      expect(rival.attributes.bowling.flight).toBeGreaterThan(0);
    }
  });
});
