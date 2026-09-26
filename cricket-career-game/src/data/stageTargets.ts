import type { CareerStageId } from '@/types';

/**
 * What each stage asks of the player before the next one will look at them.
 * Shown on the Career Path screen. Meeting a target makes selection likely -
 * never certain: form, fitness, the rivals and the selectors' whims still
 * decide it.
 *
 * Runs at an average OR wickets (the player's best path counts), a minimum
 * number of matches, and a passed fitness test where one is set.
 */
export interface StageTarget {
  /** The step this case is for. */
  nextStageId: CareerStageId;
  /** Short description of the next step, e.g. "State U-16 trials". */
  step: string;
  /** Competitions whose matches count (empty = every match this season). */
  countFrom: string[];
  runs: number;
  average: number;
  wickets: number;
  minMatches: number;
  fitnessTest: boolean;
  /** Age limit of the NEXT level (under X on 1 September), if any. */
  nextAgeLimit: number | null;
}

export const STAGE_TARGETS: Partial<Record<CareerStageId, StageTarget>> = {
  BEGINNER: {
    nextStageId: 'DISTRICT_AGE_GROUP',
    step: 'District U-14 trials',
    countFrom: [],
    runs: 220,
    average: 25,
    wickets: 12,
    minMatches: 6,
    fitnessTest: true,
    nextAgeLimit: 14,
  },
  DISTRICT_AGE_GROUP: {
    nextStageId: 'STATE_U16',
    step: 'State U-16 trials',
    countFrom: ['district-league'],
    runs: 250,
    average: 30,
    wickets: 14,
    minMatches: 4,
    fitnessTest: true,
    nextAgeLimit: 16,
  },
  STATE_U16: {
    nextStageId: 'U19_PATHWAY',
    step: 'State U-19 trials',
    countFrom: ['vijay-merchant'],
    runs: 300,
    average: 35,
    wickets: 15,
    minMatches: 4,
    fitnessTest: true,
    nextAgeLimit: 19,
  },
  U19_PATHWAY: {
    nextStageId: 'INDIA_U19',
    step: 'India U-19 camp',
    countFrom: ['vinoo-mankad', 'cooch-behar'],
    runs: 500,
    average: 42,
    wickets: 25,
    minMatches: 8,
    fitnessTest: true,
    nextAgeLimit: 19,
  },
  INDIA_U19: {
    nextStageId: 'U23_EMERGING',
    step: 'U-23 / emerging squad',
    countFrom: ['u19-bilateral', 'u19-world-cup', 'vinoo-mankad', 'cooch-behar'],
    runs: 350,
    average: 32,
    wickets: 18,
    minMatches: 5,
    fitnessTest: true,
    nextAgeLimit: 23,
  },
  U23_EMERGING: {
    nextStageId: 'SENIOR_STATE',
    step: 'Senior state probables',
    countFrom: ['ck-nayudu', 'u23-state-a'],
    runs: 550,
    average: 42,
    wickets: 28,
    minMatches: 8,
    fitnessTest: true,
    nextAgeLimit: null,
  },
  SENIOR_STATE: {
    nextStageId: 'RANJI_TROPHY',
    step: 'A senior debut',
    countFrom: ['ranji-trophy', 'vijay-hazare', 'syed-mushtaq-ali', 'club-league'],
    runs: 450,
    average: 38,
    wickets: 22,
    minMatches: 6,
    fitnessTest: true,
    nextAgeLimit: null,
  },
  RANJI_TROPHY: {
    nextStageId: 'VIJAY_HAZARE',
    step: 'An established first-class place',
    countFrom: ['ranji-trophy'],
    runs: 550,
    average: 40,
    wickets: 28,
    minMatches: 6,
    fitnessTest: true,
    nextAgeLimit: null,
  },
  VIJAY_HAZARE: {
    nextStageId: 'SYED_MUSHTAQ_ALI',
    step: 'An established List-A place',
    countFrom: ['vijay-hazare'],
    runs: 300,
    average: 40,
    wickets: 14,
    minMatches: 5,
    fitnessTest: true,
    nextAgeLimit: null,
  },
  SYED_MUSHTAQ_ALI: {
    nextStageId: 'IPL_SCOUTING',
    step: 'IPL scouts (Phase 7)',
    countFrom: ['syed-mushtaq-ali'],
    runs: 250,
    average: 30,
    wickets: 12,
    minMatches: 5,
    fitnessTest: true,
    nextAgeLimit: null,
  },
};

/** The age limit (under X on 1 September) for playing at each stage. */
export const STAGE_AGE_LIMIT: Partial<Record<CareerStageId, number>> = {
  BEGINNER: 14,
  DISTRICT_AGE_GROUP: 14,
  STATE_U16: 16,
  U19_PATHWAY: 19,
  INDIA_U19: 19,
  U23_EMERGING: 23,
};

/** Human description of a target, e.g. "300+ runs at 35+ avg or 15+ wickets this season, and pass the fitness test". */
export function describeTarget(t: StageTarget): string {
  const parts = [`${t.runs}+ runs at ${t.average}+ avg or ${t.wickets}+ wickets this season`];
  if (t.minMatches) parts.push(`${t.minMatches}+ matches`);
  const tail = t.fitnessTest ? ', and pass the fitness test' : '';
  return `${t.step}: need ${parts.join(' in ')}${tail}`;
}
