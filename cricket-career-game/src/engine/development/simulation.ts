/**
 * Training-only careers: a player created at 10 who does nothing but train,
 * week after week, until 35. The harness the development constants were
 * tuned against (see `simulation.test.ts` and PROGRESS.md).
 */
import { createRng, deriveSeed, type Rng } from '../match/rng';
import { TRAITS, validTraitSet } from '@/data/traits';
import { addDays, monthOf } from './dates';
import { ATTRIBUTE_GROUPS, ageInYears } from './curves';
import type { CreationRole } from './creation';
import { buildCareerPlayer } from './player';
import { defaultPlanFor } from './plans';
import { developmentWeek } from './week';
import type { AttributeGroup, BattingApproach, BowlingStyle, PersonalityTrait, Player } from '@/types';

export interface AgeSnapshot {
  age: number;
  overall: number;
  groups: Record<AttributeGroup, number>;
}

export interface SimulatedCareer {
  seed: number;
  role: CreationRole;
  bowlingStyle: BowlingStyle;
  traits: PersonalityTrait[];
  hiddenPotential: number;
  snapshots: AgeSnapshot[];
  injuries: number;
  weeksInjured: number;
  peakOverall: number;
  peakAge: number;
}

const ROLES: CreationRole[] = ['BATTER', 'BOWLER', 'ALLROUNDER', 'WICKETKEEPER'];
const BOWLING: BowlingStyle[] = ['RIGHT_ARM_FAST', 'LEFT_ARM_FAST', 'RIGHT_ARM_MEDIUM', 'OFF_SPIN', 'LEG_SPIN', 'LEFT_ARM_ORTHODOX'];
const APPROACHES: BattingApproach[] = ['ANCHOR', 'STROKE_MAKER', 'FINISHER'];

export function randomTraits(rng: Rng): PersonalityTrait[] {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const count = rng.chance(0.5) ? 2 : 3;
    const picked: PersonalityTrait[] = [];
    while (picked.length < count) {
      const trait = rng.pick(TRAITS).id;
      if (!picked.includes(trait)) picked.push(trait);
    }
    if (validTraitSet(picked)) return picked;
  }
  return ['HARD_WORKER', 'NATURAL_LEADER'];
}

function groupMeans(player: Player): Record<AttributeGroup, number> {
  const out = {} as Record<AttributeGroup, number>;
  for (const group of ATTRIBUTE_GROUPS) {
    const values = Object.values(player.attributes[group]) as number[];
    out[group] = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
  }
  return out;
}

export function simulateTrainingCareer(seed: number, startAge = 10, endAge = 35): SimulatedCareer {
  const rng = createRng(seed);
  const role = rng.pick(ROLES);
  const bowlingStyle: BowlingStyle =
    role === 'BATTER' || role === 'WICKETKEEPER' ? (rng.chance(0.5) ? 'NONE' : 'RIGHT_ARM_MEDIUM') : rng.pick(BOWLING);
  const traits = randomTraits(rng);
  const approach = rng.pick(APPROACHES);

  const dateOfBirth = '2000-07-01';
  const startDate = addDays(dateOfBirth, Math.round(startAge * 365.25));
  let player = buildCareerPlayer(
    {
      firstName: 'Sim',
      lastName: String(seed),
      dateOfBirth,
      hometown: 'Chennai',
      state: 'Tamil Nadu',
      country: 'India',
      battingStyle: 'RIGHT_HAND_BAT',
      bowlingStyle,
      shirtNumber: 7,
      motto: '',
    },
    { role, battingApproach: approach, bowlingStyle, traits, preferredAggression: rng.int(2, 4) },
    startDate,
    rng,
  );
  let plan = defaultPlanFor(player.role, bowlingStyle, player.development.preferredAggression);

  const snapshots: AgeSnapshot[] = [{ age: startAge, overall: player.overall, groups: groupMeans(player) }];
  let nextBirthday = startAge + 1;
  let injuries = 0;
  let weeksInjured = 0;
  let peakOverall = player.overall;
  let peakAge = startAge;

  let date = startDate;
  let week = 0;
  while (ageInYears(dateOfBirth, date) < endAge + 0.01) {
    const next = addDays(date, 7);
    const newMonth = monthOf(next) !== monthOf(date);
    if (player.condition.injury) weeksInjured += 1;
    const result = developmentWeek({
      player,
      plan,
      date: next,
      examWeek: false,
      fraction: 1,
      playedMatch: false,
      newMonth,
      rng: createRng(deriveSeed(seed, week)),
      quiet: true,
    });
    player = result.player;
    plan = result.plan;
    if (result.injuryStarted) injuries += 1;
    if (player.overall > peakOverall) {
      peakOverall = player.overall;
      peakAge = Math.floor(ageInYears(dateOfBirth, next));
    }
    date = next;
    week += 1;
    const age = ageInYears(dateOfBirth, date);
    if (age >= nextBirthday) {
      snapshots.push({ age: nextBirthday, overall: player.overall, groups: groupMeans(player) });
      nextBirthday += 1;
    }
  }

  return {
    seed,
    role,
    bowlingStyle,
    traits,
    hiddenPotential: player.development.hiddenPotential,
    snapshots,
    injuries,
    weeksInjured,
    peakOverall,
    peakAge,
  };
}

export interface AgeRow {
  age: number;
  meanOverall: number;
  p10: number;
  p90: number;
  /** Mean overall as a share of the hidden potential. */
  shareOfPotential: number;
  groups: Record<AttributeGroup, number>;
}

/** Roll many careers up into one row per age. */
export function summariseByAge(careers: SimulatedCareer[]): AgeRow[] {
  const ages = careers[0]?.snapshots.map((s) => s.age) ?? [];
  return ages.map((age) => {
    const rows = careers
      .map((career) => ({ career, snap: career.snapshots.find((s) => s.age === age) }))
      .filter((r): r is { career: SimulatedCareer; snap: AgeSnapshot } => Boolean(r.snap));
    const overalls = rows.map((r) => r.snap.overall).sort((a, b) => a - b);
    const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
    const groups = {} as Record<AttributeGroup, number>;
    for (const group of ATTRIBUTE_GROUPS) groups[group] = round(mean(rows.map((r) => r.snap.groups[group])));
    return {
      age,
      meanOverall: round(mean(overalls)),
      p10: overalls[Math.floor(overalls.length * 0.1)] ?? 0,
      p90: overalls[Math.min(overalls.length - 1, Math.floor(overalls.length * 0.9))] ?? 0,
      shareOfPotential: round(mean(rows.map((r) => r.snap.overall / r.career.hiddenPotential)) * 100) / 100,
      groups,
    };
  });
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
