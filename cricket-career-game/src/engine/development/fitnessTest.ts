/**
 * Fitness tests at camps: the yo-yo intermittent recovery test and a 20 m
 * sprint. Pass marks rise with the level; failing costs selector trust.
 */
import { FITNESS_TEST } from '../config';
import type { Rng } from '../match/rng';
import type { CareerStageId, FitnessTestResult, Player } from '@/types';

export interface FitnessStandard {
  yoyo: number;
  sprint: number;
}

/** Pass marks by stage. Senior India camps use 17.1 on the yo-yo. */
const STANDARDS: Partial<Record<CareerStageId, FitnessStandard>> = {
  BEGINNER: { yoyo: 12, sprint: 3.85 },
  DISTRICT_AGE_GROUP: { yoyo: 13.5, sprint: 3.65 },
  STATE_U16: { yoyo: 15, sprint: 3.5 },
  U19_PATHWAY: { yoyo: 16, sprint: 3.4 },
  INDIA_U19: { yoyo: 16.3, sprint: 3.35 },
  U23_EMERGING: { yoyo: 16.5, sprint: 3.32 },
};

const SENIOR: FitnessStandard = { yoyo: 16.5, sprint: 3.3 };
const INTERNATIONAL: FitnessStandard = { yoyo: 17.1, sprint: 3.2 };

const INTERNATIONAL_STAGES: CareerStageId[] = [
  'INDIA_A',
  'INDIA_SENIOR_CAMP',
  'INTERNATIONAL_DEBUT',
  'ESTABLISH_INDIA',
  'ICC_TOURNAMENTS',
  'INTERNATIONAL_STAR',
  'LEGACY',
];

export function fitnessStandard(stageId: CareerStageId): FitnessStandard {
  if (INTERNATIONAL_STAGES.includes(stageId)) return INTERNATIONAL;
  return STANDARDS[stageId] ?? SENIOR;
}

/** Expected yo-yo level and sprint time, before the day's luck. */
export function expectedFitness(player: Player): FitnessStandard {
  const { stamina, speed } = player.attributes.physical;
  const { fitness, fatigue } = player.condition;
  const injured = player.condition.injury ? 1.5 : 0;
  return {
    yoyo:
      FITNESS_TEST.yoyoBase +
      (stamina / 100) * FITNESS_TEST.yoyoStamina +
      ((fitness - 75) / 100) * FITNESS_TEST.yoyoFitness -
      (fatigue / 100) * FITNESS_TEST.yoyoFatigue -
      injured,
    sprint:
      FITNESS_TEST.sprintBase -
      (speed / 100) * FITNESS_TEST.sprintSpeed +
      fatigue * FITNESS_TEST.sprintFatigue +
      injured * 0.08,
  };
}

/** Yo-yo levels run 5, 9, 11, 12, 13... in steps of .1 to .8; round to a readable figure. */
function roundYoyo(level: number): number {
  return Math.round(level * 10) / 10;
}

export function runFitnessTest(
  player: Player,
  stageId: CareerStageId,
  date: string,
  label: string,
  rng: Rng,
): FitnessTestResult {
  const expected = expectedFitness(player);
  const standard = fitnessStandard(stageId);
  const yoyo = roundYoyo(expected.yoyo + rng.spread() * 0.7);
  const sprint = Math.round((expected.sprint + rng.spread() * 0.06) * 100) / 100;
  return {
    id: `fit-${date}-${label.replace(/\W+/g, '-').toLowerCase()}`,
    date,
    label,
    yoyo,
    yoyoTarget: standard.yoyo,
    sprint,
    sprintTarget: standard.sprint,
    passed: yoyo >= standard.yoyo && sprint <= standard.sprint,
  };
}
