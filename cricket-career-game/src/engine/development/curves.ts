/**
 * The age curve. Three shapes drive a whole career:
 *
 * - **maturity**: the share of an attribute's ceiling a body and mind of this
 *   age can reach. It climbs steeply through the teens and levels out at ~24.
 * - **learning rate**: how much a week of training is worth. Fast when young,
 *   slow after 30.
 * - **decline**: past ~31 the ceiling itself comes down - physical first,
 *   then fielding, bowling and batting; faster after ~36.
 *
 * Together: growth until ~24, a peak from ~26 to ~31, a slow decline after
 * 32-33 and a faster one after 36.
 */
import { DEVELOPMENT } from '../config';
import type { AttributeGroup, Attributes, PersonalityTrait } from '@/types';

/** Linear interpolation through a `[x, y]` table, flat beyond both ends. */
export function interpolate(table: readonly (readonly [number, number])[], x: number): number {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i += 1) {
    const [x1, y1] = table[i];
    if (x <= x1) {
      const [x0, y0] = table[i - 1];
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return table[table.length - 1][1];
}

/** Age shifted by the bloomer traits: a late bloomer is "younger" than their years. */
export function developmentalAge(age: number, traits: PersonalityTrait[]): number {
  if (traits.includes('LATE_BLOOMER')) return age - DEVELOPMENT.lateBloomerLag;
  if (traits.includes('EARLY_BLOOMER')) return age + DEVELOPMENT.earlyBloomerLead;
  return age;
}

/** 0-1 share of the ceiling reachable at this age. */
export function maturityAt(age: number, traits: PersonalityTrait[] = []): number {
  return interpolate(DEVELOPMENT.maturity, developmentalAge(age, traits));
}

/**
 * How much a week of training is worth at this age. A late bloomer keeps
 * learning quickly for longer; an early bloomer slows sooner.
 */
export function learningRateAt(age: number, traits: PersonalityTrait[] = []): number {
  const shifted = traits.includes('LATE_BLOOMER')
    ? age - DEVELOPMENT.lateBloomerLag * 0.6
    : traits.includes('EARLY_BLOOMER')
      ? age + DEVELOPMENT.earlyBloomerLead * 0.6
      : age;
  return interpolate(DEVELOPMENT.learningRate, shifted);
}

/** Points the ceiling of an attribute group has come down by at this age. */
export function declineAt(age: number, group: AttributeGroup, traits: PersonalityTrait[] = []): number {
  const cfg = DEVELOPMENT.decline;
  // Fitness freaks hold on to their bodies a little longer.
  const start = cfg.startAge + (traits.includes('FITNESS_FREAK') ? 1 : 0);
  if (age <= start) return 0;
  const slowYears = Math.min(age, cfg.fastAge) - start;
  const fastYears = Math.max(0, age - cfg.fastAge);
  return slowYears * cfg.perYear[group] + fastYears * cfg.fastPerYear[group];
}

/** Points a year an attribute group is losing at this age (0 before the peak ends). */
export function declineRate(age: number, group: AttributeGroup, traits: PersonalityTrait[] = []): number {
  const cfg = DEVELOPMENT.decline;
  const start = cfg.startAge + (traits.includes('FITNESS_FREAK') ? 1 : 0);
  if (age <= start) return 0;
  return (age <= cfg.fastAge ? cfg.perYear[group] : cfg.fastPerYear[group]) * cfg.erosionShare;
}

/** The level an attribute can be at, at this age: ceiling x maturity - decline. */
export function reachableAt(
  ceiling: number,
  age: number,
  group: AttributeGroup,
  traits: PersonalityTrait[] = [],
): number {
  return Math.max(1, ceiling * maturityAt(age, traits) - declineAt(age, group, traits));
}

/** Fractional age on a date, from a date of birth. */
export function ageInYears(dateOfBirth: string, onDate: string): number {
  const dob = Date.parse(`${dateOfBirth}T00:00:00Z`);
  const on = Date.parse(`${onDate}T00:00:00Z`);
  return (on - dob) / (365.2425 * 86_400_000);
}

/* --------------------------- attribute helpers --------------------------- */

export const ATTRIBUTE_GROUPS: AttributeGroup[] = ['batting', 'bowling', 'fielding', 'physical', 'mental'];

export interface AttributeRef {
  group: AttributeGroup;
  key: string;
  /** `group.key`. */
  id: string;
}

/** Every attribute in a set, in a stable order. */
export function attributeRefs(attributes: Attributes): AttributeRef[] {
  const refs: AttributeRef[] = [];
  for (const group of ATTRIBUTE_GROUPS) {
    for (const key of Object.keys(attributes[group])) {
      refs.push({ group, key, id: `${group}.${key}` });
    }
  }
  return refs;
}

export function getAttr(attributes: Attributes, group: AttributeGroup, key: string): number {
  return (attributes[group] as unknown as Record<string, number>)[key] ?? 0;
}

export function setAttr(attributes: Attributes, group: AttributeGroup, key: string, value: number): void {
  (attributes[group] as unknown as Record<string, number>)[key] = value;
}

export function cloneAttributes(attributes: Attributes): Attributes {
  return {
    batting: { ...attributes.batting },
    bowling: { ...attributes.bowling },
    fielding: { ...attributes.fielding },
    physical: { ...attributes.physical },
    mental: { ...attributes.mental },
  };
}
