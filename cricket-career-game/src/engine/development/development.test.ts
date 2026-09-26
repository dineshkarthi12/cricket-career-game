import { describe, expect, it } from 'vitest';
import { createRng } from '../match/rng';
import { computeOverall } from '../ratings';
import {
  addXp,
  buildCareerPlayer,
  createProfile,
  declineAt,
  defaultPlanFor,
  energyBudget,
  expectedFitness,
  fitnessStandard,
  formStreak,
  gainMultiplier,
  headroomFactor,
  learningRateAt,
  maturityAt,
  runFitnessTest,
  runTrainingWeek,
  sessionFrom,
  studyWeek,
  weeklyInjuryChance,
  xpForLevel,
  type CreationInput,
  type EnergyInput,
} from './index';
import type { Player, TrainingPlan, TrainingSession } from '@/types';

const BASE: Omit<CreationInput, 'age'> = {
  role: 'BATTER',
  battingApproach: 'STROKE_MAKER',
  bowlingStyle: 'RIGHT_ARM_MEDIUM',
  traits: ['HARD_WORKER', 'NATURAL_LEADER'],
  preferredAggression: 3,
};

function makePlayer(age = 10, seed = 7, overrides: Partial<Omit<CreationInput, 'age'>> = {}): Player {
  const dob = `${2026 - age}-01-15`;
  return buildCareerPlayer(
    {
      firstName: 'Test',
      lastName: 'Player',
      dateOfBirth: dob,
      hometown: 'Chennai',
      state: 'Tamil Nadu',
      country: 'India',
      battingStyle: 'RIGHT_HAND_BAT',
      bowlingStyle: overrides.bowlingStyle ?? BASE.bowlingStyle,
      shirtNumber: 18,
      motto: '',
    },
    { ...BASE, ...overrides },
    '2026-06-01',
    createRng(seed),
  );
}

function planOf(sessions: TrainingSession[], patch: Partial<TrainingPlan> = {}): TrainingPlan {
  return {
    id: 'p',
    name: 'p',
    sessions,
    lifestyle: { sleep: 'NORMAL', diet: 'BALANCED', recovery: 'NONE' },
    studyFocus: 0,
    lastAppliedOn: null,
    weeksActive: 0,
    ...patch,
  };
}

/** Train the same plan for n weeks, returning the player. */
function train(player: Player, plan: TrainingPlan, weeks: number, seed = 1): Player {
  let p = player;
  let date = '2026-06-01';
  for (let i = 0; i < weeks; i += 1) {
    date = new Date(Date.parse(`${date}T00:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10);
    p = runTrainingWeek({ player: p, plan, date, examWeek: false, fraction: 1, rng: createRng(seed + i) }).player;
    // Keep injuries out of the gain measurements.
    p = { ...p, condition: { ...p.condition, injury: null } };
  }
  return p;
}

describe('creation', () => {
  it('keeps hidden potential in 60-95 and lands the ceilings on it', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const profile = createProfile({ ...BASE, age: 10 }, createRng(seed));
      expect(profile.development.hiddenPotential).toBeGreaterThanOrEqual(60);
      expect(profile.development.hiddenPotential).toBeLessThanOrEqual(95);
      const ceiling = computeOverall(profile.potential, profile.role);
      expect(Math.abs(ceiling - profile.development.hiddenPotential)).toBeLessThanOrEqual(2);
    }
  });

  it('starts older players further along, and every starter is raw', () => {
    const at8 = createProfile({ ...BASE, age: 8, hiddenPotential: 80 }, createRng(3));
    const at12 = createProfile({ ...BASE, age: 12, hiddenPotential: 80 }, createRng(3));
    const ovr8 = computeOverall(at8.attributes, at8.role);
    const ovr12 = computeOverall(at12.attributes, at12.role);
    expect(ovr12).toBeGreaterThan(ovr8);
    expect(ovr12).toBeLessThan(45);
  });

  it('shapes attributes by role and bowling type', () => {
    const batter = createProfile({ ...BASE, age: 11, hiddenPotential: 80 }, createRng(5));
    const pacer = createProfile(
      { ...BASE, role: 'BOWLER', bowlingStyle: 'RIGHT_ARM_FAST', age: 11, hiddenPotential: 80 },
      createRng(5),
    );
    const spinner = createProfile(
      { ...BASE, role: 'BOWLER', bowlingStyle: 'LEG_SPIN', age: 11, hiddenPotential: 80 },
      createRng(5),
    );
    const keeper = createProfile({ ...BASE, role: 'WICKETKEEPER', age: 11, hiddenPotential: 80 }, createRng(5));
    expect(pacer.role).toBe('PACE_BOWLER');
    expect(spinner.role).toBe('SPIN_BOWLER');
    expect(keeper.role).toBe('WICKET_KEEPER_BATTER');
    expect(batter.potential.batting.technique).toBeGreaterThan(pacer.potential.batting.technique);
    expect(pacer.potential.bowling.pace).toBeGreaterThan(spinner.potential.bowling.pace);
    expect(spinner.potential.bowling.spin).toBeGreaterThan(pacer.potential.bowling.spin);
    expect(keeper.potential.fielding.wicketKeeping).toBeGreaterThan(batter.potential.fielding.wicketKeeping + 30);
  });

  it('gives a comfort profile centred on the preferred aggression', () => {
    const profile = createProfile({ ...BASE, preferredAggression: 4, age: 10 }, createRng(2));
    const { batting } = profile.development.comfort;
    expect(batting[3]).toBe(Math.max(...batting));
    expect(batting[0]).toBeLessThan(batting[2]);
  });

  it('never exposes the hidden potential in the coach hints', () => {
    const profile = createProfile({ ...BASE, age: 10, hiddenPotential: 91 }, createRng(9));
    expect(profile.development.coachHints.join(' ')).not.toMatch(/\d/);
    expect(profile.development.coachHints.length).toBeGreaterThan(0);
  });
});

describe('age curve', () => {
  it('matures steeply through the teens and levels out by 24', () => {
    expect(maturityAt(10)).toBeLessThan(maturityAt(14));
    expect(maturityAt(14)).toBeLessThan(maturityAt(18));
    expect(maturityAt(24)).toBe(1);
    expect(maturityAt(30)).toBe(1);
  });

  it('learns fastest young and slowly after 30', () => {
    expect(learningRateAt(14)).toBeGreaterThan(learningRateAt(22));
    expect(learningRateAt(22)).toBeGreaterThan(learningRateAt(28));
    expect(learningRateAt(31)).toBeLessThan(learningRateAt(14) * 0.3);
  });

  it('declines slowly after 32-33 and faster after 36, physical first', () => {
    expect(declineAt(30, 'physical')).toBe(0);
    expect(declineAt(34, 'physical')).toBeGreaterThan(0);
    const slow = declineAt(35, 'batting') - declineAt(34, 'batting');
    const fast = declineAt(38, 'batting') - declineAt(37, 'batting');
    expect(fast).toBeGreaterThan(slow * 1.8);
    expect(declineAt(36, 'physical')).toBeGreaterThan(declineAt(36, 'batting'));
    expect(declineAt(36, 'mental')).toBeLessThan(declineAt(36, 'batting'));
  });

  it('shifts the curve for late and early bloomers', () => {
    expect(maturityAt(15, ['LATE_BLOOMER'])).toBeLessThan(maturityAt(15));
    expect(maturityAt(15, ['EARLY_BLOOMER'])).toBeGreaterThan(maturityAt(15));
    expect(learningRateAt(23, ['LATE_BLOOMER'])).toBeGreaterThan(learningRateAt(23));
  });
});

describe('training gains', () => {
  const nets = [sessionFrom('NETS_PACE', 'NORMAL', 3), sessionFrom('NETS_PACE', 'NORMAL', 3), sessionFrom('REST', 'LIGHT', null)];

  it('gains more per week at 14 than at 30 for the same drill', () => {
    const young = makePlayer(14, 11);
    const old = { ...makePlayer(14, 11), dateOfBirth: '1996-01-15' };
    // Give both the same headroom.
    old.attributes = structuredClone(young.attributes);
    const y = train(young, planOf(nets), 12);
    const o = train(old, planOf(nets), 12);
    expect(y.attributes.batting.vsPace - young.attributes.batting.vsPace).toBeGreaterThan(
      o.attributes.batting.vsPace - old.attributes.batting.vsPace,
    );
  });

  it('trains the drill\'s own attributes, not others', () => {
    const player = makePlayer(13, 4);
    const after = train(player, planOf(nets), 16);
    expect(after.attributes.batting.vsPace - player.attributes.batting.vsPace).toBeGreaterThan(
      after.attributes.bowling.spin - player.attributes.bowling.spin,
    );
  });

  it('has diminishing returns near the ceiling', () => {
    expect(headroomFactor(30)).toBeGreaterThan(headroomFactor(10));
    expect(headroomFactor(10)).toBeGreaterThan(headroomFactor(2));
    expect(headroomFactor(0)).toBe(0);
    const player = makePlayer(24, 6);
    player.attributes.batting.vsPace = player.potential.batting.vsPace;
    const after = train(player, planOf(nets), 20);
    expect(after.attributes.batting.vsPace).toBeLessThanOrEqual(player.potential.batting.vsPace);
  });

  it('is scaled by traits, coaching, fatigue and form', () => {
    const base = { age: 15, traits: [], coachQuality: 50, workRate: 60, fatigue: 20, confidence: 55, weeksActive: 0 };
    expect(gainMultiplier({ ...base, traits: ['HARD_WORKER'] })).toBeGreaterThan(gainMultiplier(base));
    expect(gainMultiplier({ ...base, traits: ['EASILY_DISTRACTED'] })).toBeLessThan(gainMultiplier(base));
    expect(gainMultiplier({ ...base, coachQuality: 90 })).toBeGreaterThan(gainMultiplier(base));
    expect(gainMultiplier({ ...base, fatigue: 90 })).toBeLessThan(gainMultiplier(base));
    expect(gainMultiplier({ ...base, confidence: 90 })).toBeGreaterThan(gainMultiplier(base));
    expect(gainMultiplier({ ...base, weeksActive: 10 })).toBeGreaterThan(gainMultiplier(base));
  });

  it('stops at the energy budget, and exam weeks halve it', () => {
    const input: EnergyInput = { age: 13, traits: [], fatigue: 20, examWeek: false, studyFocus: 0, lifestyle: { sleep: 'NORMAL', diet: 'BALANCED', recovery: 'NONE' } };
    const normal = energyBudget(input);
    expect(energyBudget({ ...input, examWeek: true })).toBeLessThanOrEqual(Math.ceil(normal / 2));
    expect(energyBudget({ ...input, studyFocus: 100 })).toBeLessThan(normal);
    const hard = Array.from({ length: 7 }, () => sessionFrom('ENDURANCE', 'HARD', null));
    const player = makePlayer(13, 2);
    const result = runTrainingWeek({ player, plan: planOf(hard), date: '2026-06-08', examWeek: false, fraction: 1, rng: createRng(1) });
    expect(result.report.energyUsed).toBeLessThanOrEqual(result.report.energyBudget);
  });

  it('builds comfort at the aggression level practised', () => {
    const player = makePlayer(12, 8, { preferredAggression: 2 });
    const plan = planOf([sessionFrom('NETS_PACE', 'NORMAL', 5), sessionFrom('NETS_SPIN', 'NORMAL', 5)]);
    const after = train(player, plan, 10);
    expect(after.development.comfort.batting[4]).toBeGreaterThan(player.development.comfort.batting[4] + 15);
  });
});

describe('fatigue and recovery', () => {
  it('hard weeks pile fatigue up; rest brings it down', () => {
    const hard = planOf(Array.from({ length: 5 }, () => sessionFrom('ENDURANCE', 'HARD', null)));
    const rest = planOf([sessionFrom('REST', 'LIGHT', null), sessionFrom('REST', 'LIGHT', null)], {
      lifestyle: { sleep: 'FULL', diet: 'BALANCED', recovery: 'FULL' },
    });
    const player = makePlayer(18, 3);
    const tired = train(player, hard, 3);
    expect(tired.condition.fatigue).toBeGreaterThan(player.condition.fatigue + 20);
    const rested = train(tired, rest, 2);
    expect(rested.condition.fatigue).toBeLessThan(tired.condition.fatigue - 25);
  });

  it('recovers faster with full sleep and a recovery routine', () => {
    const tiredPlayer = { ...makePlayer(20, 3) };
    tiredPlayer.condition = { ...tiredPlayer.condition, fatigue: 80 };
    const poor = planOf([], { lifestyle: { sleep: 'SHORT', diet: 'CARELESS', recovery: 'NONE' } });
    const good = planOf([], { lifestyle: { sleep: 'FULL', diet: 'STRICT', recovery: 'FULL' } });
    const a = runTrainingWeek({ player: tiredPlayer, plan: poor, date: '2026-06-08', examWeek: false, fraction: 1, rng: createRng(1) });
    const b = runTrainingWeek({ player: tiredPlayer, plan: good, date: '2026-06-08', examWeek: false, fraction: 1, rng: createRng(1) });
    expect(b.player.condition.fatigue).toBeLessThan(a.player.condition.fatigue);
  });
});

describe('injuries', () => {
  const base = { fatigue: 30, load: 5, durability: 50, traits: [], lifestyle: 1, rushed: false };

  it('rises with fatigue and workload', () => {
    expect(weeklyInjuryChance({ ...base, fatigue: 85 })).toBeGreaterThan(weeklyInjuryChance(base) * 2.5);
    expect(weeklyInjuryChance({ ...base, load: 15 })).toBeGreaterThan(weeklyInjuryChance(base));
    expect(weeklyInjuryChance({ ...base, durability: 90 })).toBeLessThan(weeklyInjuryChance(base));
    expect(weeklyInjuryChance({ ...base, traits: ['INJURY_PRONE'] })).toBeGreaterThan(weeklyInjuryChance(base) * 1.5);
    expect(weeklyInjuryChance({ ...base, rushed: true })).toBeGreaterThan(weeklyInjuryChance(base) * 2);
  });

  it('injures overtrained players far more often in practice', () => {
    const count = (plan: TrainingPlan, fatigue: number) => {
      let injuries = 0;
      const player = makePlayer(20, 12);
      for (let i = 0; i < 400; i += 1) {
        const p = { ...player, condition: { ...player.condition, fatigue } };
        const result = runTrainingWeek({ player: p, plan, date: '2026-06-08', examWeek: false, fraction: 1, rng: createRng(500 + i) });
        if (result.injury) injuries += 1;
      }
      return injuries;
    };
    const light = planOf([sessionFrom('FOCUS', 'LIGHT', null), sessionFrom('NETS_SPIN', 'LIGHT', 3), sessionFrom('REST', 'LIGHT', null)]);
    const heavy = planOf(Array.from({ length: 4 }, () => sessionFrom('SPEED', 'HARD', null)));
    const lightInjuries = count(light, 15);
    const heavyInjuries = count(heavy, 75);
    expect(heavyInjuries).toBeGreaterThan(lightInjuries * 3);
    // An ordinary week is not a lottery ticket for an injury.
    expect(lightInjuries / 400).toBeLessThan(0.02);
  });

  it('gives young fast bowlers stress fractures and side strains under a heavy load', () => {
    const pacer = makePlayer(17, 21, { role: 'BOWLER', bowlingStyle: 'RIGHT_ARM_FAST' });
    const heavy = planOf(Array.from({ length: 4 }, () => sessionFrom('BOWL_PACE', 'HARD', 3)));
    const types: string[] = [];
    for (let i = 0; i < 1500 && types.length < 60; i += 1) {
      const p = { ...pacer, condition: { ...pacer.condition, fatigue: 70 } };
      const result = runTrainingWeek({ player: p, plan: heavy, date: '2026-06-08', examWeek: false, fraction: 1, rng: createRng(900 + i) });
      if (result.injury?.type) types.push(result.injury.type);
    }
    const bowlingInjuries = types.filter((t) => t === 'BACK_STRESS_FRACTURE' || t === 'SIDE_STRAIN').length;
    expect(bowlingInjuries / types.length).toBeGreaterThan(0.3);
  });
});

describe('fitness tests, studies, XP and form', () => {
  it('raises the pass mark with the level', () => {
    expect(fitnessStandard('INDIA_SENIOR_CAMP').yoyo).toBeGreaterThan(fitnessStandard('STATE_U16').yoyo);
    expect(fitnessStandard('STATE_U16').yoyo).toBeGreaterThan(fitnessStandard('BEGINNER').yoyo);
  });

  it('fails a tired, unfit player and passes a fit one', () => {
    const fit = makePlayer(20, 5);
    fit.attributes.physical.stamina = 85;
    fit.attributes.physical.speed = 80;
    fit.condition = { ...fit.condition, fatigue: 5, fitness: 95 };
    const unfit = { ...fit, attributes: structuredClone(fit.attributes), condition: { ...fit.condition, fatigue: 90, fitness: 60 } };
    unfit.attributes.physical.stamina = 40;
    expect(expectedFitness(fit).yoyo).toBeGreaterThan(expectedFitness(unfit).yoyo);
    expect(runFitnessTest(fit, 'SENIOR_STATE', '2026-08-01', 'Camp', createRng(1)).passed).toBe(true);
    expect(runFitnessTest(unfit, 'SENIOR_STATE', '2026-08-01', 'Camp', createRng(1)).passed).toBe(false);
  });

  it('lets grades slide when studies are ignored', () => {
    let studies = { grades: 60, family: 70 };
    for (let i = 0; i < 20; i += 1) studies = studyWeek(studies, 0, false, 13).studies;
    expect(studies.grades).toBeLessThan(60);
    let good = { grades: 60, family: 70 };
    for (let i = 0; i < 20; i += 1) good = studyWeek(good, 80, false, 13).studies;
    expect(good.grades).toBeGreaterThan(60);
    // Adults are not at school.
    expect(studyWeek({ grades: 60, family: 70 }, 0, false, 20).studies.grades).toBe(60);
  });

  it('levels up on the XP curve', () => {
    const result = addXp({ xp: 0, level: 1, xpToNextLevel: xpForLevel(1) }, xpForLevel(1) + xpForLevel(2) + 5);
    expect(result.level).toBe(3);
    expect(result.xp).toBe(5);
    expect(xpForLevel(12)).toBeGreaterThan(1000);
    expect(xpForLevel(12)).toBeLessThan(1400);
  });

  it('spots hot streaks and slumps', () => {
    expect(formStreak([7.2, 8, 7.5])).toBe('HOT');
    expect(formStreak([3, 4, 2.5])).toBe('COLD');
    expect(formStreak([7, 3, 8])).toBeNull();
  });

  it('builds a sensible default plan for every role', () => {
    const pacer = defaultPlanFor('PACE_BOWLER', 'RIGHT_ARM_FAST');
    expect(pacer.sessions.some((s) => s.drill === 'BOWL_PACE')).toBe(true);
    const keeper = defaultPlanFor('WICKET_KEEPER_BATTER', 'NONE');
    expect(keeper.sessions.some((s) => s.drill === 'KEEPING')).toBe(true);
  });
});
