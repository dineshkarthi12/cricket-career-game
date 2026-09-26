import { describe, expect, it } from 'vitest';
import { simulateTrainingCareer, summariseByAge } from './simulation';

/**
 * 50 careers of training only, from age 10 to 35: a player who never plays a
 * match, just follows the coach's plan week after week. Prints the table in
 * PROGRESS.md and holds the age curve to realistic bands.
 */
describe('50 training-only careers, age 10 to 35', () => {
  const careers = Array.from({ length: 50 }, (_, i) => simulateTrainingCareer(1000 + i, 10, 35));
  const rows = summariseByAge(careers);
  const at = (age: number) => rows.find((r) => r.age === age)!;

  it('prints the attribute progression by age', () => {
    const lines = [
      'Age | OVR mean | p10 | p90 | % of potential | Bat | Bowl | Field | Phys | Mental',
      ...rows.map(
        (r) =>
          `${r.age} | ${r.meanOverall} | ${r.p10} | ${r.p90} | ${Math.round(r.shareOfPotential * 100)}% | ` +
          `${r.groups.batting} | ${r.groups.bowling} | ${r.groups.fielding} | ${r.groups.physical} | ${r.groups.mental}`,
      ),
    ];
    const injuries = careers.reduce((sum, c) => sum + c.injuries, 0) / careers.length;
    const weeksOut = careers.reduce((sum, c) => sum + c.weeksInjured, 0) / careers.length;
    const peakAges = careers.map((c) => c.peakAge).sort((a, b) => a - b);
    lines.push(
      `Injuries per career ${injuries.toFixed(1)}, weeks injured ${weeksOut.toFixed(0)}; ` +
        `peak age median ${peakAges[25]} (p10 ${peakAges[5]}, p90 ${peakAges[45]})`,
    );
    console.log(lines.join('\n'));
    expect(rows.length).toBe(26);
  });

  it('grows every year until 24', () => {
    for (let age = 11; age <= 24; age += 1) {
      expect(at(age).meanOverall).toBeGreaterThan(at(age - 1).meanOverall);
    }
  });

  it('starts raw and reaches first-class standard by the mid-twenties', () => {
    expect(at(10).meanOverall).toBeLessThan(30);
    expect(at(16).meanOverall).toBeGreaterThan(40);
    expect(at(16).meanOverall).toBeLessThan(58);
    expect(at(24).meanOverall).toBeGreaterThan(62);
  });

  it('peaks between 26 and 32, close to (but not over) potential', () => {
    const peakRow = rows.reduce((best, r) => (r.meanOverall > best.meanOverall ? r : best));
    expect(peakRow.age).toBeGreaterThanOrEqual(26);
    expect(peakRow.age).toBeLessThanOrEqual(33);
    expect(peakRow.shareOfPotential).toBeGreaterThan(0.85);
    expect(peakRow.shareOfPotential).toBeLessThanOrEqual(1);
    for (const career of careers) expect(career.peakOverall).toBeLessThanOrEqual(career.hiddenPotential + 1);
    const peakAges = careers.map((c) => c.peakAge).sort((a, b) => a - b);
    expect(peakAges[25]).toBeGreaterThanOrEqual(26);
    expect(peakAges[25]).toBeLessThanOrEqual(31);
  });

  it('holds a plateau from 26 to 31, then declines, physical first', () => {
    expect(Math.abs(at(31).meanOverall - at(27).meanOverall)).toBeLessThan(3);
    expect(at(35).meanOverall).toBeLessThan(at(32).meanOverall - 2);
    const physicalDrop = at(32).groups.physical - at(35).groups.physical;
    const battingDrop = at(32).groups.batting - at(35).groups.batting;
    expect(physicalDrop).toBeGreaterThan(battingDrop);
    // Mental keeps growing with experience.
    expect(at(35).groups.mental).toBeGreaterThanOrEqual(at(30).groups.mental);
  });

  it('separates the talented from the rest', () => {
    for (const age of [16, 24, 30]) expect(at(age).p90 - at(age).p10).toBeGreaterThan(8);
    const high = careers.filter((c) => c.hiddenPotential >= 80);
    const low = careers.filter((c) => c.hiddenPotential <= 68);
    const mean = (cs: typeof careers) => cs.reduce((s, c) => s + c.peakOverall, 0) / cs.length;
    expect(mean(high)).toBeGreaterThan(mean(low) + 8);
  });

  it('injures a training-only player now and then, not constantly', () => {
    const injuries = careers.reduce((sum, c) => sum + c.injuries, 0) / careers.length;
    expect(injuries).toBeGreaterThan(4);
    expect(injuries).toBeLessThan(30);
  });
}, 120_000);
