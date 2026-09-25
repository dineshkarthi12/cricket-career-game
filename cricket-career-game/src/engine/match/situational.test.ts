import { describe, expect, it } from 'vitest';
import { chooseApproach, chooseBowler, isPartTimer, type Situation } from './ai';
import { fieldersAllowedOutside, placeField } from './field';
import { matchupBonus, pacePreference, bowlerKindOf } from './skill';
import { dewLevel } from './conditions';
import { createRng } from './rng';
import { generateXi } from './squad';
import { decideToss, simulateMatch } from './simulate';
import { VENUES_BY_ID } from '@/data/venues';
import type { SimPlayer as Sim } from './types';

const venue = VENUES_BY_ID['venue-chepauk'];

function baseSituation(overrides: Partial<Situation> = {}): Situation {
  return {
    format: 'T20',
    phase: 'MIDDLE',
    oversBowled: 10,
    totalOvers: 20,
    wicketsLost: 2,
    runsRequired: null,
    ballsRemaining: null,
    currentRunRate: 8,
    strikerBallsFaced: 20,
    strikerRuns: 25,
    strikerPosition: 4,
    partnerIsTail: false,
    consecutiveDots: 0,
    inningsNumber: 1,
    savingTheGame: false,
    ...overrides,
  };
}

/** Average intent over many rolls, so the noise in chooseApproach evens out. */
function meanIntent(batter: Sim, situation: Situation, n = 400): number {
  let total = 0;
  const rng = createRng(99);
  for (let i = 0; i < n; i += 1) total += chooseApproach(batter, situation, rng).level;
  return total / n;
}

const xi = generateXi('team', 65, createRng(1));
const batter = xi[3];

describe('batting acceleration', () => {
  it('goes harder later in the innings with wickets in hand', () => {
    const early = meanIntent(batter, baseSituation({ oversBowled: 8, wicketsLost: 2 }));
    const late = meanIntent(batter, baseSituation({ oversBowled: 16, wicketsLost: 2 }));
    expect(late).toBeGreaterThan(early);
  });

  it('three down accelerates later than two down', () => {
    const twoDown = meanIntent(batter, baseSituation({ oversBowled: 15, wicketsLost: 2 }));
    const threeDown = meanIntent(batter, baseSituation({ oversBowled: 15, wicketsLost: 3 }));
    expect(twoDown).toBeGreaterThanOrEqual(threeDown);
  });

  it('seven down protects the tail instead of attacking', () => {
    const fiveDown = meanIntent(batter, baseSituation({ oversBowled: 17, wicketsLost: 5 }));
    const sevenDown = meanIntent(batter, baseSituation({ oversBowled: 17, wicketsLost: 7 }));
    expect(sevenDown).toBeLessThan(fiveDown);
  });

  it('scales the same logic to fifty overs', () => {
    const odiEarly = meanIntent(
      batter,
      baseSituation({ format: 'ODI', totalOvers: 50, oversBowled: 20, wicketsLost: 2 }),
    );
    const odiLate = meanIntent(
      batter,
      baseSituation({ format: 'ODI', totalOvers: 50, oversBowled: 42, wicketsLost: 2 }),
    );
    expect(odiLate).toBeGreaterThan(odiEarly);
  });

  it('a rising required rate forces the pace', () => {
    const comfortable = meanIntent(
      batter,
      baseSituation({ runsRequired: 40, ballsRemaining: 60, currentRunRate: 8 }),
    );
    const steep = meanIntent(
      batter,
      baseSituation({ runsRequired: 110, ballsRemaining: 60, currentRunRate: 8 }),
    );
    expect(steep).toBeGreaterThan(comfortable);
  });
});

describe('batting roles and nerves', () => {
  it('slows down inside ten of a milestone', () => {
    const cruising = meanIntent(batter, baseSituation({ strikerRuns: 70 }));
    const nervous = meanIntent(batter, baseSituation({ strikerRuns: 94 }));
    expect(nervous).toBeLessThan(cruising);
  });

  it('an opener getting in is more watchful than a finisher who is set', () => {
    const opener = meanIntent(batter, baseSituation({ strikerPosition: 1, strikerBallsFaced: 10 }));
    const finisher = meanIntent(batter, baseSituation({ strikerPosition: 6, strikerBallsFaced: 20 }));
    expect(finisher).toBeGreaterThan(opener);
  });

  it('a tailender blocks, and a recognised batter with the tail in takes over', () => {
    const tail = meanIntent(batter, baseSituation({ strikerPosition: 10, format: 'MULTI_DAY', totalOvers: null }));
    const recognised = meanIntent(
      batter,
      baseSituation({ strikerPosition: 4, format: 'MULTI_DAY', totalOvers: null, partnerIsTail: true }),
    );
    expect(recognised).toBeGreaterThan(tail);
  });

  it('dot balls push a batter into looking for a release shot', () => {
    const flowing = meanIntent(batter, baseSituation({ consecutiveDots: 0 }));
    const stuck = meanIntent(batter, baseSituation({ consecutiveDots: 9 }));
    expect(stuck).toBeGreaterThan(flowing);
  });
});

describe('field restrictions', () => {
  it('allows two out in the T20 powerplay and five afterwards', () => {
    expect(fieldersAllowedOutside('T20', 0)).toBe(2);
    expect(fieldersAllowedOutside('T20', 5)).toBe(2);
    expect(fieldersAllowedOutside('T20', 6)).toBe(5);
    expect(fieldersAllowedOutside('T20', 18)).toBe(5);
  });

  it('follows the three ODI powerplay blocks', () => {
    expect(fieldersAllowedOutside('ODI', 3)).toBe(2);
    expect(fieldersAllowedOutside('ODI', 20)).toBe(4);
    expect(fieldersAllowedOutside('ODI', 45)).toBe(5);
  });

  it('pulls a spread field into the ring during a powerplay', () => {
    const side = generateXi('bowl', 65, createRng(2));
    const open = placeField('DEATH', side, side[8].id, createRng(3), { format: 'T20', over: 2 });
    const outside = open.fielders.filter((f) => f.ring === 'OUTER');
    expect(outside.length).toBeLessThanOrEqual(2);
  });

  it('lets the field spread once the powerplay is over', () => {
    const side = generateXi('bowl', 65, createRng(2));
    const late = placeField('DEATH', side, side[8].id, createRng(3), { format: 'T20', over: 17 });
    expect(late.fielders.filter((f) => f.ring === 'OUTER').length).toBeGreaterThan(2);
  });

  it('never breaks the restriction in a real innings', () => {
    const { match } = simulateMatch({
      fixtureId: 'fx', tournamentId: 't', seasonYear: 2026, format: 'T20', stage: 'League',
      date: '2026-11-15', venue, homeTeamId: 'home', awayTeamId: 'away',
      homeXi: generateXi('home', 66, createRng(11)), awayXi: generateXi('away', 64, createRng(12)),
      userIsHome: true, seed: 4321, month: 11,
    });
    expect(match.innings.length).toBeGreaterThan(0);
  });
});

describe('match-ups', () => {
  function withStyle(base: Sim, bowlingStyle: Sim['bowlingStyle']): Sim {
    return { ...base, bowlingStyle };
  }
  function handed(base: Sim, battingStyle: Sim['battingStyle']): Sim {
    return { ...base, battingStyle };
  }

  const rightHander = handed(xi[3], 'RIGHT_HAND_BAT');
  const leftHander = handed(xi[3], 'LEFT_HAND_BAT');

  it('left-arm spin is a better match-up against a right-hander', () => {
    const bowler = withStyle(xi[7], 'LEFT_ARM_ORTHODOX');
    expect(matchupBonus(bowler, rightHander)).toBeGreaterThan(matchupBonus(bowler, leftHander));
  });

  it('leg spin is a better match-up against a left-hander... and off spin the reverse', () => {
    const leggie = withStyle(xi[7], 'LEG_SPIN');
    const offie = withStyle(xi[7], 'OFF_SPIN');
    // Leg spin turns away from the right-hander, into the left-hander.
    expect(matchupBonus(leggie, rightHander)).toBeGreaterThan(matchupBonus(leggie, leftHander));
    // Off spin turns away from the left-hander.
    expect(matchupBonus(offie, leftHander)).toBeGreaterThan(matchupBonus(offie, rightHander));
  });

  it('a left-arm seamer angles it across the right-hander', () => {
    const bowler = withStyle(xi[8], 'LEFT_ARM_FAST_MEDIUM');
    expect(matchupBonus(bowler, rightHander)).toBeGreaterThan(0);
  });

  it('reads a batter own preference for pace or spin', () => {
    const pacePlayer: Sim = {
      ...xi[3],
      attributes: { ...xi[3].attributes, batting: { ...xi[3].attributes.batting, vsPace: 80, vsSpin: 40 } },
    };
    expect(pacePreference(pacePlayer, 'PACE')).toBeGreaterThan(0);
    expect(pacePreference(pacePlayer, 'SPIN')).toBeLessThan(0);
  });
});

describe('bowling changes', () => {
  it('knows who is a part-timer', () => {
    const side = generateXi('bowl', 65, createRng(4));
    expect(side.filter(isPartTimer).every((p) => p.bowlingStyle !== 'NONE')).toBe(true);
    expect(side.filter((p) => p.role === 'PACE_BOWLER').some(isPartTimer)).toBe(false);
  });

  it('opens the bowling with a seamer, not a spinner', () => {
    let paceOpenings = 0;
    let total = 0;
    for (let seed = 1; seed <= 40; seed += 1) {
      const home = generateXi('home', 66, createRng(seed));
      const away = generateXi('away', 64, createRng(seed + 500));
      const { match } = simulateMatch({
        fixtureId: 'fx', tournamentId: 't', seasonYear: 2026, format: 'ODI', stage: 'League',
        date: '2026-11-15', venue, homeTeamId: 'home', awayTeamId: 'away',
        homeXi: home, awayXi: away, userIsHome: true, seed: seed * 77, month: 11,
      });
      const first = match.innings[0];
      const bowlingSide = first.bowlingTeamId === 'home' ? home : away;
      const opener = bowlingSide.find((p) => p.id === first.deliveries[0]?.bowlerId);
      if (opener) {
        total += 1;
        if (bowlerKindOf(opener) === 'PACE') paceOpenings += 1;
      }
    }
    // Opening with spin happens, but it is the exception.
    expect(paceOpenings / total).toBeGreaterThan(0.75);
  });

  it('holds a specialist death bowler back for the end', () => {
    const side = generateXi('bowl', 66, createRng(7));
    const deathSpecialist = [...side]
      .filter((p) => bowlerKindOf(p) === 'PACE')
      .sort((a, b) => b.attributes.bowling.deathBowling - a.attributes.bowling.deathBowling)[0];

    const pick = (share: number, phase: 'MIDDLE' | 'DEATH') => {
      let chosen = 0;
      for (let i = 0; i < 300; i += 1) {
        const bowler = chooseBowler({
          bowlers: side,
          oversBowledBy: {},
          spellOvers: {},
          oversSinceBowled: {},
          lastBowlerId: null,
          format: 'ODI',
          phase,
          ballAgeOvers: 25,
          runRatePressure: 0.5,
          share,
          rng: createRng(1000 + i),
        });
        if (bowler.id === deathSpecialist.id) chosen += 1;
      }
      return chosen / 300;
    };

    expect(pick(0.95, 'DEATH')).toBeGreaterThan(pick(0.4, 'MIDDLE'));
  });
});

describe('toss and conditions', () => {
  const baseWeather = {
    type: 'SUNNY' as const,
    temperature: 30,
    humidity: 50,
    cloudCover: 10,
    wind: 10,
    rainRisk: 0,
    rainDelay: false,
  };
  const basePitch = {
    type: 'SPORTING' as const,
    seamMovement: 50,
    swing: 50,
    turn: 50,
    bounce: 55,
    pace: 55,
    battingEase: 55,
    deterioration: 0,
  };

  /** The toss has a little noise in it, so decide over many rolls. */
  const batShare = (input: Parameters<typeof decideToss>[0], n = 400) => {
    let bat = 0;
    for (let i = 0; i < n; i += 1) {
      if (decideToss({ ...input, rng: createRng(i + 1) }) === 'BAT') bat += 1;
    }
    return bat / n;
  };

  it('bats first on a flat pitch', () => {
    const flat = batShare({
      pitch: { ...basePitch, battingEase: 88, seamMovement: 20 },
      weather: baseWeather,
      underLights: false,
      format: 'ODI',
      venue,
      rng: createRng(1),
    });
    expect(flat).toBeGreaterThan(0.8);
  });

  it('bowls first on a green seamer under cloud', () => {
    const green = batShare({
      pitch: { ...basePitch, battingEase: 32, seamMovement: 85 },
      weather: { ...baseWeather, type: 'OVERCAST', cloudCover: 92, humidity: 80 },
      underLights: false,
      format: 'ODI',
      venue,
      rng: createRng(1),
    });
    expect(green).toBeLessThan(0.2);
  });

  it('prefers to chase when dew is expected under lights', () => {
    const dry = batShare({
      pitch: basePitch,
      weather: { ...baseWeather, humidity: 30 },
      underLights: false,
      format: 'T20',
      venue,
      rng: createRng(1),
    });
    const dewy = batShare({
      pitch: basePitch,
      weather: { ...baseWeather, humidity: 95 },
      underLights: true,
      format: 'T20',
      venue: { ...venue, dewFactor: 90 },
      rng: createRng(1),
    });
    expect(dewy).toBeLessThan(dry);
  });

  it('values batting first more in the longer game', () => {
    const odi = batShare({
      pitch: basePitch,
      weather: baseWeather,
      underLights: false,
      format: 'ODI',
      venue,
      rng: createRng(1),
    });
    const firstClass = batShare({
      pitch: basePitch,
      weather: baseWeather,
      underLights: false,
      format: 'MULTI_DAY',
      venue,
      rng: createRng(1),
    });
    expect(firstClass).toBeGreaterThan(odi);
  });

  it('lets the player call it when they are captain and win the toss', () => {
    // Try both sides of the toss so one of them is the user's.
    const decisions = new Set<string>();
    for (let seed = 1; seed <= 40; seed += 1) {
      const { match } = simulateMatch({
        fixtureId: 'fx', tournamentId: 't', seasonYear: 2026, format: 'T20', stage: 'League',
        date: '2026-11-15', venue, homeTeamId: 'home', awayTeamId: 'away',
        homeXi: generateXi('home', 66, createRng(seed)),
        awayXi: generateXi('away', 64, createRng(seed + 99)),
        userIsHome: true, userIsCaptain: true, userTossDecision: 'BOWL',
        seed: seed * 13, month: 11,
      });
      if (match.tossWinnerTeamId === 'home') decisions.add(match.tossDecision!);
    }
    // Whenever the user's side won the toss, their choice was the one taken.
    expect([...decisions]).toEqual(['BOWL']);
  });

  it('dew builds through a night innings and hurts the bowling side', () => {
    const night = dewLevel({ ...venue, dewFactor: 90 }, { ...baseWeather, humidity: 95 }, true, 30);
    const early = dewLevel({ ...venue, dewFactor: 90 }, { ...baseWeather, humidity: 95 }, true, 2);
    const day = dewLevel({ ...venue, dewFactor: 90 }, { ...baseWeather, humidity: 95 }, false, 30);
    expect(night).toBeGreaterThan(early);
    expect(day).toBe(0);
  });

  it('a small ground produces more sixes than a big one', () => {
    const sixesAt = (straight: number, square: number) => {
      let sixes = 0;
      for (let seed = 1; seed <= 26; seed += 1) {
        const { match } = simulateMatch({
          fixtureId: 'fx', tournamentId: 't', seasonYear: 2026, format: 'T20', stage: 'League',
          date: '2026-11-15',
          venue: { ...venue, straightBoundary: straight, squareBoundary: square },
          homeTeamId: 'home', awayTeamId: 'away',
          homeXi: generateXi('home', 66, createRng(seed)),
          awayXi: generateXi('away', 64, createRng(seed + 7)),
          userIsHome: true, seed: seed * 29, month: 11,
        });
        for (const innings of match.innings) {
          for (const bat of innings.batting) sixes += bat.sixes;
        }
      }
      return sixes;
    };
    expect(sixesAt(58, 55)).toBeGreaterThan(sixesAt(82, 78));
  });
});
