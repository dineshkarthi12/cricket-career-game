import type { PersonalityTrait } from '@/types';

/**
 * What each personality trait does. Every number here is a multiplier or an
 * offset read by the development engine; 1 / 0 means "no effect".
 */
export interface TraitDefinition {
  id: PersonalityTrait;
  label: string;
  description: string;
  /** Training gains. */
  training: number;
  /** Weekly injury chance. */
  injury: number;
  /** Fatigue recovered each week, added. */
  recovery: number;
  /** Offsets to attribute ceilings, `group.key` -> points. */
  ceilings: Record<string, number>;
  /** Temperament in big matches (knockouts, high prestige) and early in an innings. */
  bigMatch: number;
  nervousStart: number;
  /** Captaincy stress relief, 0-1. */
  captaincy: number;
  /** Traits that cannot be combined with this one. */
  excludes: PersonalityTrait[];
}

export const TRAITS: TraitDefinition[] = [
  {
    id: 'HARD_WORKER',
    label: 'Hard worker',
    description: 'First in the nets, last to leave. Training goes further.',
    training: 1.15,
    injury: 1.05,
    recovery: 0,
    ceilings: { 'mental.workRate': 10, 'mental.discipline': 5 },
    bigMatch: 0,
    nervousStart: 0,
    captaincy: 0,
    excludes: ['EASILY_DISTRACTED'],
  },
  {
    id: 'BIG_MATCH_TEMPERAMENT',
    label: 'Big-match temperament',
    description: 'Rises to the occasion: calmer in knockouts and finals.',
    training: 1,
    injury: 1,
    recovery: 0,
    ceilings: { 'mental.temperament': 6 },
    bigMatch: 12,
    nervousStart: 0,
    captaincy: 0.1,
    excludes: ['NERVOUS_STARTER'],
  },
  {
    id: 'NERVOUS_STARTER',
    label: 'Nervous starter',
    description: 'Scratchy early on; fine once settled. Pressure bites harder.',
    training: 1,
    injury: 1,
    recovery: 0,
    ceilings: { 'mental.temperament': -5 },
    bigMatch: -6,
    nervousStart: -10,
    captaincy: -0.1,
    excludes: ['BIG_MATCH_TEMPERAMENT'],
  },
  {
    id: 'INJURY_PRONE',
    label: 'Injury-prone',
    description: 'The body breaks down more often than it should.',
    training: 1,
    injury: 1.6,
    recovery: -2,
    ceilings: { 'physical.durability': -12 },
    bigMatch: 0,
    nervousStart: 0,
    captaincy: 0,
    excludes: ['FITNESS_FREAK'],
  },
  {
    id: 'NATURAL_LEADER',
    label: 'Natural leader',
    description: 'Team-mates follow. Captaincy comes easier and costs less.',
    training: 1,
    injury: 1,
    recovery: 0,
    ceilings: { 'mental.leadership': 14, 'mental.matchAwareness': 4 },
    bigMatch: 3,
    nervousStart: 0,
    captaincy: 0.35,
    excludes: [],
  },
  {
    id: 'FITNESS_FREAK',
    label: 'Fitness freak',
    description: 'Lives in the gym. Fitter, recovers faster, fewer injuries.',
    training: 1.03,
    injury: 0.85,
    recovery: 4,
    ceilings: { 'physical.stamina': 6, 'physical.durability': 6, 'physical.speed': 3 },
    bigMatch: 0,
    nervousStart: 0,
    captaincy: 0,
    excludes: ['INJURY_PRONE'],
  },
  {
    id: 'LATE_BLOOMER',
    label: 'Late bloomer',
    description: 'Behind the age group as a boy, still growing into their early twenties.',
    training: 1,
    injury: 1,
    recovery: 0,
    ceilings: {},
    bigMatch: 0,
    nervousStart: 0,
    captaincy: 0,
    excludes: ['EARLY_BLOOMER'],
  },
  {
    id: 'EARLY_BLOOMER',
    label: 'Early bloomer',
    description: 'Ahead of the age group early; the others will catch up.',
    training: 1,
    injury: 1,
    recovery: 0,
    ceilings: {},
    bigMatch: 0,
    nervousStart: 0,
    captaincy: 0,
    excludes: ['LATE_BLOOMER'],
  },
  {
    id: 'QUICK_LEARNER',
    label: 'Quick learner',
    description: 'Picks up a new skill in days rather than weeks.',
    training: 1.12,
    injury: 1,
    recovery: 0,
    ceilings: {},
    bigMatch: 0,
    nervousStart: 0,
    captaincy: 0,
    excludes: ['EASILY_DISTRACTED'],
  },
  {
    id: 'EASILY_DISTRACTED',
    label: 'Easily distracted',
    description: 'Talented, but the mind wanders. Training sticks less.',
    training: 0.88,
    injury: 1,
    recovery: 0,
    ceilings: { 'mental.discipline': -8, 'batting.concentration': -4 },
    bigMatch: 0,
    nervousStart: -3,
    captaincy: -0.05,
    excludes: ['HARD_WORKER', 'QUICK_LEARNER'],
  },
];

export const TRAITS_BY_ID: Record<PersonalityTrait, TraitDefinition> = Object.fromEntries(
  TRAITS.map((trait) => [trait.id, trait]),
) as Record<PersonalityTrait, TraitDefinition>;

/** True when a set of traits is allowed together (2-3, no exclusions). */
export function validTraitSet(traits: PersonalityTrait[]): boolean {
  if (traits.length < 2 || traits.length > 3) return false;
  if (new Set(traits).size !== traits.length) return false;
  return traits.every((id) => TRAITS_BY_ID[id].excludes.every((other) => !traits.includes(other)));
}

/** Product of one numeric effect over a set of traits. */
export function traitProduct(traits: PersonalityTrait[], key: 'training' | 'injury'): number {
  return traits.reduce((product, id) => product * (TRAITS_BY_ID[id]?.[key] ?? 1), 1);
}

/** Sum of one additive effect over a set of traits. */
export function traitSum(
  traits: PersonalityTrait[],
  key: 'recovery' | 'bigMatch' | 'nervousStart' | 'captaincy',
): number {
  return traits.reduce((sum, id) => sum + (TRAITS_BY_ID[id]?.[key] ?? 0), 0);
}
