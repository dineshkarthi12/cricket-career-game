/**
 * A week of training. The plan's sessions are run in order until the week's
 * energy runs out; each builds its drill's attributes by an amount that
 * depends on age, the ceiling, traits, coaching, fatigue and form, and adds
 * fatigue and injury load. Lifestyle and rest bring fatigue back down.
 *
 * Attributes are integers, so gains accumulate as fractions in
 * `development.progress` and whole points are paid out as they complete.
 */
import { DEVELOPMENT, TRAINING } from '../config';
import { computeOverall } from '../ratings';
import type { Rng } from '../match/rng';
import { formBandFor, moraleBandFor } from '../match/aftermath';
import { DRILLS_BY_ID, type Drill } from '@/data/drills';
import { traitProduct, traitSum } from '@/data/traits';
import {
  ageInYears,
  attributeRefs,
  declineRate,
  cloneAttributes,
  getAttr,
  learningRateAt,
  reachableAt,
  setAttr,
} from './curves';
import { coachNote } from './coach';
import { createInjury, pickInjuryType, rushedRecently, weeklyInjuryChance } from './injuries';
import { attributeLabel } from './labels';
import { atSchool } from './studies';
import type {
  AggressionComfort,
  AttributeChange,
  AttributeGroup,
  DevelopmentState,
  DrillId,
  Injury,
  Lifestyle,
  PersonalityTrait,
  Player,
  TrainingPlan,
  TrainingSession,
  WeeklyReport,
} from '@/types';

/* ------------------------------- energy -------------------------------- */

export function sessionEnergy(session: Pick<TrainingSession, 'drill' | 'intensity'>): number {
  if (session.drill === 'REST') return 0;
  return TRAINING.intensity[session.intensity].energy;
}

export function planEnergy(sessions: Pick<TrainingSession, 'drill' | 'intensity'>[]): number {
  return sessions.reduce((sum, session) => sum + sessionEnergy(session), 0);
}

export interface EnergyInput {
  age: number;
  traits: PersonalityTrait[];
  fatigue: number;
  examWeek: boolean;
  studyFocus: number;
  lifestyle: Lifestyle;
}

/** Energy available for training this week. */
export function energyBudget(input: EnergyInput): number {
  let budget = interpolateTable(TRAINING.energyByAge, input.age);
  if (input.traits.includes('FITNESS_FREAK')) budget += 1;
  if (input.fatigue >= TRAINING.tiredFatigue) budget -= TRAINING.tiredEnergyPenalty;
  budget += TRAINING.lifestyle.sleep[input.lifestyle.sleep].energy;
  budget -= TRAINING.lifestyle.recovery[input.lifestyle.recovery].energy;
  if (atSchool(input.age)) budget -= (Math.max(0, Math.min(100, input.studyFocus)) / 100) * TRAINING.studyEnergy;
  if (input.examWeek) budget *= TRAINING.examEnergyShare;
  return Math.max(2, Math.round(budget));
}

function interpolateTable(table: readonly (readonly [number, number])[], x: number): number {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i += 1) {
    if (x <= table[i][0]) {
      const [x0, y0] = table[i - 1];
      const [x1, y1] = table[i];
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return table[table.length - 1][1];
}

/** Can this player usefully run this drill? Spin drills need a spinner, and so on. */
export function drillAllowed(drill: Drill, player: Pick<Player, 'bowlingStyle' | 'role'>): boolean {
  switch (drill.requires) {
    case 'BOWLER':
      return player.bowlingStyle !== 'NONE';
    case 'PACER':
      return player.bowlingStyle !== 'NONE' && !isSpin(player.bowlingStyle);
    case 'SPINNER':
      return isSpin(player.bowlingStyle);
    case 'KEEPER':
      return player.role === 'WICKET_KEEPER_BATTER';
    default:
      return true;
  }
}

function isSpin(style: Player['bowlingStyle']): boolean {
  return style === 'OFF_SPIN' || style === 'LEG_SPIN' || style === 'LEFT_ARM_ORTHODOX' || style === 'LEFT_ARM_WRIST_SPIN';
}

/* ----------------------------- the gain model ---------------------------- */

export interface GainContext {
  age: number;
  traits: PersonalityTrait[];
  coachQuality: number;
  workRate: number;
  /** 0-100. */
  fatigue: number;
  /** 0-100. */
  confidence: number;
  weeksActive: number;
}

/** Everything except the headroom, as one multiplier. */
export function gainMultiplier(ctx: GainContext): number {
  const learning = learningRateAt(ctx.age, ctx.traits);
  const traits = traitProduct(ctx.traits, 'training');
  const coach = 0.85 + (ctx.coachQuality / 100) * 0.3;
  const workRate = 0.8 + (ctx.workRate / 100) * 0.35;
  const over = Math.max(0, ctx.fatigue - TRAINING.fatigueGainThreshold);
  const tired = 1 - (over / (100 - TRAINING.fatigueGainThreshold)) * (1 - TRAINING.tiredGainFloor);
  const form = 0.95 + (ctx.confidence / 100) * 0.1;
  const consistency = 1 + Math.min(TRAINING.consistencyCap, ctx.weeksActive * TRAINING.consistencyPerWeek);
  return learning * traits * coach * workRate * tired * form * consistency;
}

/** Diminishing returns: 1 far below the reachable level, 0 at it. */
export function headroomFactor(room: number): number {
  if (room <= 0) return 0;
  return 1 - Math.exp(-room / DEVELOPMENT.headroomScale);
}

/* ------------------------------- the week -------------------------------- */

export interface TrainingWeekInput {
  player: Player;
  plan: TrainingPlan;
  date: string;
  /** Exam week: half the energy. */
  examWeek: boolean;
  /** Share of the week available for training, 0-1 (a match took the rest). */
  fraction: number;
  rng: Rng;
}

export interface TrainingWeekResult {
  player: Player;
  report: WeeklyReport;
  injury: Injury | null;
}

function lifestyleInjury(lifestyle: Lifestyle): number {
  return (
    TRAINING.lifestyle.sleep[lifestyle.sleep].injury *
    TRAINING.lifestyle.diet[lifestyle.diet].injury *
    TRAINING.lifestyle.recovery[lifestyle.recovery].injury
  );
}

function lifestyleRecovery(lifestyle: Lifestyle): number {
  return TRAINING.lifestyle.sleep[lifestyle.sleep].recovery + TRAINING.lifestyle.recovery[lifestyle.recovery].recovery;
}

/** Drills an injured player can still do. */
const REHAB_SAFE: DrillId[] = ['TEMPERAMENT', 'FOCUS', 'REST'];

/** Sessions that actually run this week, within the energy budget. */
export function sessionsThatRun(
  sessions: TrainingSession[],
  budget: number,
  player: Pick<Player, 'bowlingStyle' | 'role' | 'condition'>,
): TrainingSession[] {
  const injured = Boolean(player.condition.injury);
  const out: TrainingSession[] = [];
  let used = 0;
  for (const session of sessions.slice(0, TRAINING.maxSessions)) {
    const drill = DRILLS_BY_ID[session.drill];
    if (!drill || !drillAllowed(drill, player)) continue;
    if (injured && !REHAB_SAFE.includes(session.drill)) continue;
    const cost = sessionEnergy(session);
    if (used + cost > budget) continue;
    used += cost;
    out.push(session);
  }
  return out;
}

export function runTrainingWeek(input: TrainingWeekInput): TrainingWeekResult {
  const { plan, rng } = input;
  const before = input.player;
  const dev = before.development;
  const traits = dev.traits;
  const age = ageInYears(before.dateOfBirth, input.date);
  const fraction = Math.max(0, Math.min(1, input.fraction));

  const budget = Math.round(
    energyBudget({
      age,
      traits,
      fatigue: before.condition.fatigue,
      examWeek: input.examWeek,
      studyFocus: plan.studyFocus,
      lifestyle: plan.lifestyle,
    }) * fraction,
  );
  const sessions = sessionsThatRun(plan.sessions, budget, before);
  const energyUsed = planEnergy(sessions);

  const attributes = cloneAttributes(before.attributes);
  const progress: Record<string, number> = { ...dev.progress };
  const comfort: AggressionComfort = { batting: [...dev.comfort.batting], bowling: [...dev.comfort.bowling] };
  const gained: Record<string, number> = {};

  let fatigue = before.condition.fatigue;
  let load = 0;
  let paceLoad = 0;
  let xp = 0;
  let rests = 0;
  let matchFitness = dev.matchFitness;

  const credit = (group: AttributeGroup, key: string, amount: number) => {
    const id = `${group}.${key}`;
    progress[id] = (progress[id] ?? 0) + amount;
    const whole = progress[id] >= 1 ? Math.floor(progress[id]) : progress[id] <= -1 ? Math.ceil(progress[id]) : 0;
    if (whole !== 0) {
      const current = getAttr(attributes, group, key);
      const next = Math.max(1, Math.min(99, current + whole));
      setAttr(attributes, group, key, next);
      progress[id] -= whole;
      if (next !== current) gained[id] = (gained[id] ?? 0) + (next - current);
    }
  };

  const roomFor = (group: AttributeGroup, key: string) =>
    reachableAt(getAttr(before.potential, group, key), age, group, traits) -
    (getAttr(attributes, group, key) + (progress[`${group}.${key}`] ?? 0));

  // --- The sessions -------------------------------------------------------
  for (const session of sessions) {
    const drill = DRILLS_BY_ID[session.drill];
    const intensity = TRAINING.intensity[session.intensity];

    if (session.drill === 'REST') {
      rests += 1;
      continue;
    }

    const multiplier = gainMultiplier({
      age,
      traits,
      coachQuality: dev.coachQuality,
      workRate: attributes.mental.workRate,
      fatigue,
      confidence: before.condition.confidence,
      weeksActive: plan.weeksActive,
    });

    for (const target of drill.targets) {
      const gain = TRAINING.sessionGain * target.weight * intensity.gain * multiplier * headroomFactor(roomFor(target.group, target.key));
      if (gain > 0) credit(target.group, target.key, gain);
    }

    fatigue += drill.fatigue * intensity.fatigue;
    load += drill.injuryLoad * intensity.injury;
    if (drill.id === 'BOWL_PACE' || drill.id === 'DEATH_BOWLING' || (drill.id === 'BOWL_ACCURACY' && !isSpin(before.bowlingStyle))) {
      paceLoad += intensity.injury;
    }
    xp += TRAINING.xpPerSession * intensity.gain;

    if (drill.practises && session.aggression !== null) {
      practiseComfort(comfort, drill.practises, session.aggression, intensity.gain);
    }
    if (drill.id === 'MATCH_SIM') matchFitness += TRAINING.matchFitnessPerSim * intensity.gain;
  }

  // --- Growing up, experience and decline ---------------------------------
  const passive = DEVELOPMENT.passiveShare * learningRateAt(age, traits) * fraction;
  for (const ref of attributeRefs(attributes)) {
    const room = roomFor(ref.group, ref.key);
    if (room > 0) {
      let amount = passive * headroomFactor(room);
      if (ref.group === 'mental' && (ref.key === 'matchAwareness' || ref.key === 'temperament') && age < 34) {
        amount += DEVELOPMENT.experienceGrowth * fraction;
      }
      credit(ref.group, ref.key, Math.min(amount, room));
    } else if (age > DEVELOPMENT.decline.startAge && room < -0.25) {
      // Past the peak the reachable level falls; the body follows it down.
      credit(ref.group, ref.key, room * DEVELOPMENT.decline.weeklyPull * Math.max(0.5, fraction));
    }
    // Use it or lose it: past the peak everything erodes a little every week,
    // and only training (which is worth less and less) holds it back.
    const erosion = declineRate(age, ref.group, traits) / 52;
    if (erosion > 0) credit(ref.group, ref.key, -erosion);
  }

  // Comfort at levels never practised fades a little.
  decayComfort(comfort);

  // --- Fatigue, fitness, match fitness ------------------------------------
  const peakFatigue = Math.min(100, fatigue);
  const recovery =
    TRAINING.weeklyRecovery * Math.max(0.5, fraction) +
    rests * TRAINING.restRecovery +
    lifestyleRecovery(plan.lifestyle) +
    traitSum(traits, 'recovery') +
    (before.condition.injury ? 8 : 0);
  const fatigueAfter = clamp(peakFatigue - recovery, 0, 100);

  const stamina = attributes.physical.stamina;
  const injuryDrag = before.condition.injury ? before.condition.injury.attributePenalty * 3 : 0;
  const fitnessTarget = clamp(96 - Math.max(0, fatigueAfter - 35) * 0.55 + (stamina - 50) * 0.06 - injuryDrag, 30, 100);
  const fitnessAfter = clamp(
    before.condition.fitness +
      (fitnessTarget - before.condition.fitness) * 0.35 +
      TRAINING.lifestyle.diet[plan.lifestyle.diet].fitness,
    0,
    100,
  );
  if (!before.condition.injury) matchFitness += TRAINING.matchFitnessPerWeek;
  matchFitness = clamp(matchFitness, 0, 100);

  // --- Injury -------------------------------------------------------------
  let injury: Injury | null = null;
  if (!before.condition.injury && energyUsed > 0) {
    const chance =
      weeklyInjuryChance({
        fatigue: peakFatigue,
        load,
        durability: attributes.physical.durability,
        traits,
        lifestyle: lifestyleInjury(plan.lifestyle),
        rushed: rushedRecently(dev, input.date),
      }) * Math.max(0.3, fraction);
    if (rng.chance(chance)) {
      const type = pickInjuryType({ role: before.role, context: 'TRAINING', age, paceLoad }, rng);
      injury = createInjury(type, input.date, rng, dev.injuryHistory.some((h) => h.type === type));
    }
  }

  // --- Morale -------------------------------------------------------------
  const moraleDelta =
    TRAINING.lifestyle.sleep[plan.lifestyle.sleep].morale +
    TRAINING.lifestyle.diet[plan.lifestyle.diet].morale +
    (fatigueAfter > 80 ? -1.5 : 0);
  const morale = clamp(before.condition.morale + moraleDelta, 0, 100);

  const overall = computeOverall(attributes, before.role);
  const changes: AttributeChange[] = Object.entries(gained)
    .filter(([, delta]) => delta !== 0)
    .map(([id, delta]) => ({ key: id, label: attributeLabel(id.split('.')[1]), delta }))
    .sort((a, b) => b.delta - a.delta);

  const development: DevelopmentState = { ...dev, progress, comfort, matchFitness: round(matchFitness) };

  const reportBase: Omit<WeeklyReport, 'coachNote' | 'id'> = {
    weekOf: input.date,
    age: Math.floor(age),
    energyUsed,
    energyBudget: budget,
    changes,
    fatigue: [round(before.condition.fatigue), round(fatigueAfter)],
    fitness: [round(before.condition.fitness), round(fitnessAfter)],
    overall: [before.overall, overall],
    xpEarned: Math.round(xp),
    injury: injury?.name ?? null,
    examWeek: input.examWeek,
  };

  const player: Player = {
    ...before,
    attributes,
    overall,
    development,
    condition: {
      ...before.condition,
      fatigue: round(fatigueAfter),
      fitness: round(injury ? Math.max(0, fitnessAfter - injury.attributePenalty * 3) : fitnessAfter),
      morale: round(morale),
      moraleBand: moraleBandFor(morale),
      formBand: formBandFor(before.condition.form),
      injury: injury ?? before.condition.injury,
    },
  };

  return {
    player,
    injury,
    report: { ...reportBase, id: `wk-${input.date}`, coachNote: coachNote(reportBase, development) },
  };
}

/** Practising at a level builds comfort there, and a little either side. */
export function practiseComfort(
  comfort: AggressionComfort,
  bar: 'BATTING' | 'BOWLING',
  level: number,
  intensityGain: number,
): void {
  const values = bar === 'BATTING' ? comfort.batting : comfort.bowling;
  const index = Math.max(0, Math.min(4, Math.round(level) - 1));
  const bump = (i: number, share: number) => {
    if (i < 0 || i > 4) return;
    values[i] = clamp(values[i] + TRAINING.comfortGain * intensityGain * share * (1 - values[i] / 100), 0, 100);
  };
  bump(index, 1);
  bump(index - 1, TRAINING.comfortNeighbourShare);
  bump(index + 1, TRAINING.comfortNeighbourShare);
}

/** Comfort above a floor slowly fades without practice. */
function decayComfort(comfort: AggressionComfort): void {
  for (const values of [comfort.batting, comfort.bowling]) {
    for (let i = 0; i < values.length; i += 1) {
      if (values[i] > 20) values[i] = round(values[i] - TRAINING.comfortDecay);
    }
  }
}

/** Contact penalty (0-1 scale of the engine's config) at a level, from comfort. */
export function comfortShortfall(comfort: number[] | undefined, level: number): number {
  if (!comfort) return 0;
  const value = comfort[Math.max(0, Math.min(4, Math.round(level) - 1))] ?? 100;
  return clamp(1 - value / 100, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
