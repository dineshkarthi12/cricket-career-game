import { describe, expect, it } from 'vitest';
import { fieldProblems, outsideCount } from './fieldRules';
import type { FieldSetting, PlacedFielder } from '@/engine/match/types';

const venue = { squareBoundary: 66, straightBoundary: 74 };

function fielder(id: string, angle: number, distance: number): PlacedFielder {
  return {
    playerId: id,
    name: id,
    position: id,
    angle,
    distance,
    ring: 'INNER',
    catching: 50,
    groundFielding: 50,
    throwing: 50,
    agility: 50,
  };
}

function field(spots: [number, number][]): FieldSetting {
  return {
    name: 'custom',
    fielders: spots.map(([a, d], i) => fielder(`f${i}`, a, d)),
    keeperId: 'k',
    keeperName: 'Keeper',
    keeperSkill: 50,
  };
}

const ring: [number, number][] = [
  [160, 14], [95, 22], [60, 24], [20, 28], [340, 28], [300, 24], [265, 22], [135, 45], [225, 45],
];

describe('field rules', () => {
  it('counts the deep fielders, not everyone past 27 m from the bat', () => {
    expect(outsideCount(field(ring), venue)).toBe(2);
  });

  it('accepts a normal powerplay field', () => {
    expect(fieldProblems(field(ring), venue, 'T20', 2)).toEqual([]);
  });

  it('flags too many out during the powerplay', () => {
    const spread = ring.map(([a]) => [a, 60] as [number, number]);
    const problems = fieldProblems(field(spread), venue, 'T20', 2);
    expect(problems.some((p) => p.includes('outside the circle'))).toBe(true);
  });

  it('enforces two behind square on the leg side in every format', () => {
    const leggy = field([...ring.slice(0, 6), [200, 30], [215, 40], [250, 50]]);
    expect(fieldProblems(leggy, venue, 'MULTI_DAY', 30).some((p) => p.includes('behind square'))).toBe(true);
  });

  it('has no circle in a multi-day game', () => {
    const spread = ring.map(([a]) => [a, 60] as [number, number]);
    expect(fieldProblems(field(spread), venue, 'MULTI_DAY', 5).some((p) => p.includes('circle'))).toBe(false);
  });
});
