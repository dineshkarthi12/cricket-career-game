/**
 * Player development under the manager: a weekly training focus, coaches who
 * make it count, fatigue, recovery and injuries. Gradual: a few rating points
 * a season for a young player with a good coach and headroom, nothing for a
 * veteran at his ceiling - and decline after the early thirties.
 */
import { computeOverall } from '../ratings';
import type { Attributes } from '@/types';
import type { ManagedPlayer, ManagerState, StaffKind, TrainingFocus } from '@/types/manager';
import { MANAGER } from './config';
import type { ActionResult } from './scouting';
import { book, clamp, holds, produce, weekStamp } from './util';

type Key = [keyof Attributes, string];

const FOCUS_TARGETS: Record<TrainingFocus, Key[]> = {
  BATTING: [['batting', 'technique'], ['batting', 'timing'], ['batting', 'power'], ['batting', 'shotRange'], ['batting', 'vsSpin'], ['batting', 'vsPace']],
  BOWLING: [['bowling', 'accuracy'], ['bowling', 'control'], ['bowling', 'variation'], ['bowling', 'deathBowling'], ['bowling', 'newBall']],
  FIELDING: [['fielding', 'catching'], ['fielding', 'groundFielding'], ['fielding', 'throwing'], ['fielding', 'wicketKeeping']],
  FITNESS: [['physical', 'stamina'], ['physical', 'strength'], ['physical', 'speed'], ['physical', 'durability']],
  MENTAL: [['mental', 'temperament'], ['mental', 'matchAwareness'], ['mental', 'discipline']],
  REST: [],
};

const COACH_FOR: Record<TrainingFocus, StaffKind> = {
  BATTING: 'BATTING_COACH',
  BOWLING: 'BOWLING_COACH',
  FIELDING: 'FIELDING_COACH',
  FITNESS: 'FITNESS',
  MENTAL: 'ANALYST',
  REST: 'FITNESS',
};

/** Quality of the coach for a focus at a franchise: the user's staff, or an average AI set-up. */
export function coachQuality(state: ManagerState, franchiseId: string, focus: TrainingFocus): number {
  if (franchiseId !== state.franchiseId) return 58;
  const kind = COACH_FOR[focus];
  return Math.max(30, ...state.staff.filter((s) => s.kind === kind).map((s) => s.quality));
}

function headroom(p: ManagedPlayer): number {
  return clamp((p.potential - p.overall) / 12, 0, 1.4);
}

function ageFactor(age: number): number {
  if (age <= 21) return 1.25;
  if (age <= 24) return 1.05;
  if (age <= MANAGER.development.peakAge) return 0.8;
  if (age <= 30) return 0.45;
  return 0.15;
}

/** One week of training for one player. Returns rating points gained (for reports). */
export function trainPlayer(p: ManagedPlayer, quality: number, intensity = 1): number {
  if (p.injuredWeeks > 0 || p.trainingFocus === 'REST') return 0;
  const targets = FOCUS_TARGETS[p.trainingFocus].filter(([group]) => group !== 'bowling' || p.bowlingStyle !== 'NONE');
  if (targets.length === 0) return 0;
  const gain = MANAGER.development.weeklyGain * (0.45 + quality / 99) * ageFactor(p.age) * headroom(p) * intensity * (0.7 + p.attributes.mental.workRate / 160);
  let total = 0;
  for (const [group, key] of targets) {
    const id = `${group}.${key}`;
    p.progress[id] = (p.progress[id] ?? 0) + gain / targets.length * 2;
  }
  for (const [id, amount] of Object.entries(p.progress)) {
    if (amount < 1) continue;
    const [group, key] = id.split('.') as [keyof Attributes, string];
    const attrs = p.attributes[group] as unknown as Record<string, number>;
    if (attrs[key] === undefined) {
      delete p.progress[id];
      continue;
    }
    const whole = Math.floor(amount);
    attrs[key] = clamp(attrs[key] + whole, 1, 99);
    p.progress[id] = amount - whole;
    total += whole;
  }
  p.overall = computeOverall(p.attributes, p.role);
  return total;
}

/** A week for every contracted player: training, recovery, injuries healing. */
export function developmentWeek(draft: ManagerState): void {
  for (const f of Object.values(draft.franchises)) {
    for (const id of f.squadIds) {
      const p = draft.players[id];
      if (!p) continue;
      if (p.injuredWeeks > 0) p.injuredWeeks -= 1;
      const quality = coachQuality(draft, f.id, p.trainingFocus);
      const resting = p.trainingFocus === 'REST';
      trainPlayer(p, quality, f.isUser ? 1 : 0.85);
      // Training is work: it tires, rest restores.
      const recovery = MANAGER.development.recoveryPerWeek * (resting ? 1.6 : 1) * (0.8 + coachQuality(draft, f.id, 'FITNESS') / 250);
      p.condition.fatigue = clamp(p.condition.fatigue - recovery + (resting ? 0 : 4), 0, 100);
      p.condition.fitness = clamp(100 - p.condition.fatigue * 0.3 - (p.injuredWeeks > 0 ? 25 : 0), 30, 100);
    }
  }
  const user = draft.franchises[draft.franchiseId];
  book(draft, { id: `dev-${weekStamp(draft)}`, kind: 'DEVELOPMENT', amount: -MANAGER.development.costPerWeek * Math.max(1, Math.round(user.squadIds.length / 5)), note: 'Training and facilities' });
}

export function setTrainingFocus(state: ManagerState, playerId: string, focus: TrainingFocus): ActionResult {
  if (!holds(state, 'DEVELOPMENT')) return { ok: false, state, error: 'Player development is not part of your job yet.' };
  if (!state.franchises[state.franchiseId].squadIds.includes(playerId)) return { ok: false, state, error: 'Only your own players train with you.' };
  const p = state.players[playerId];
  if (focus === 'BOWLING' && p.bowlingStyle === 'NONE') return { ok: false, state, error: `${p.name} does not bowl.` };
  return { ok: true, state: produce(state, (d) => void (d.players[playerId].trainingFocus = focus)) };
}

/** A year older, at the end of the season: decline sets in, potential shifts a little, some retire. */
export function agePlayers(draft: ManagerState, rng: { next(): number; spread(): number; chance(p: number): boolean }): string[] {
  const retired: string[] = [];
  for (const p of Object.values(draft.players)) {
    if (p.retired) continue;
    p.age += 1;
    if (p.age > MANAGER.development.declineAge) {
      const loss = MANAGER.development.declinePerSeason * (1 + (p.age - MANAGER.development.declineAge) * 0.25);
      for (const group of ['batting', 'bowling', 'fielding', 'physical'] as const) {
        const attrs = p.attributes[group] as unknown as Record<string, number>;
        for (const key of Object.keys(attrs)) attrs[key] = clamp(Math.round(attrs[key] - loss * (group === 'physical' ? 1.4 : 0.8) + rng.spread()), 1, 99);
      }
      p.overall = computeOverall(p.attributes, p.role);
    }
    // Late bloomers and false dawns: hidden potential is never fixed.
    if (p.age <= 24) p.potential = clamp(Math.round(p.potential + rng.spread() * 3), p.overall, 97);
    const retireChance = p.age >= 39 ? 1 : p.age >= 36 ? 0.35 : p.age >= 34 && p.overall < 62 ? 0.25 : 0;
    if (rng.chance(retireChance)) {
      p.retired = true;
      retired.push(p.id);
      if (p.contract) {
        const f = draft.franchises[p.contract.franchiseId];
        if (f) f.squadIds = f.squadIds.filter((id) => id !== p.id);
        p.contract = null;
      }
    }
  }
  return retired;
}

