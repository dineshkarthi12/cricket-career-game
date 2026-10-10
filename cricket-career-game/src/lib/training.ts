import {
  Brain,
  Dumbbell,
  Moon,
  Shield,
  Swords,
  Target,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { ProgressTone } from '@/components';
import { DRILLS_BY_ID } from '@/data/drills';
import { TRAITS_BY_ID } from '@/data/traits';
import { INJURIES_BY_TYPE } from '@/data/injuries';
import { attributeLabel as engineAttributeLabel } from '@/engine/development/labels';
import { sessionEnergy } from '@/engine/development/training';
import { isKey, tr } from '@/i18n/core';
import type { DrillCategory, DrillId, GameState, InjurySeverity, InjuryType, PersonalityTrait } from '@/types';

interface CategoryMeta {
  label: string;
  icon: LucideIcon;
  tone: ProgressTone;
  /** Tailwind classes for the rounded icon tile. */
  tile: string;
}

const CATEGORY_META: Record<DrillCategory, CategoryMeta> = {
  BATTING: { get label() { return tr('misc.drillcat.BATTING'); }, icon: Target, tone: 'blue', tile: 'bg-brand-blue-soft text-brand-blue' },
  BOWLING: { get label() { return tr('misc.drillcat.BOWLING'); }, icon: Zap, tone: 'orange', tile: 'bg-brand-orange/15 text-brand-orange' },
  FIELDING: { get label() { return tr('misc.drillcat.FIELDING'); }, icon: Shield, tone: 'green', tile: 'bg-brand-green/12 text-brand-green' },
  FITNESS: { get label() { return tr('misc.drillcat.FITNESS'); }, icon: Dumbbell, tone: 'green', tile: 'bg-brand-red/10 text-brand-red' },
  MENTAL: { get label() { return tr('misc.drillcat.MENTAL'); }, icon: Brain, tone: 'blue', tile: 'bg-brand-blue-soft text-brand-blue' },
  MATCH: { get label() { return tr('misc.drillcat.MATCH'); }, icon: Swords, tone: 'navy', tile: 'bg-brand-navy/10 text-brand-navy' },
  RECOVERY: { get label() { return tr('misc.drillcat.RECOVERY'); }, icon: Moon, tone: 'red', tile: 'bg-brand-blue-soft text-brand-blue' },
};

export const categoryMeta = (category: DrillCategory): CategoryMeta => CATEGORY_META[category];

export const drillMeta = (drill: DrillId): CategoryMeta => CATEGORY_META[DRILLS_BY_ID[drill].category];

/** An attribute's name in the game's language: "Technique", "Match Awareness", ... */
export function attributeLabel(key: string): string {
  const k = `misc.attr.${key}`;
  return isKey(k) ? tr(k) : engineAttributeLabel(key);
}

/** The same, for an attribute id such as `batting.technique`. */
export const attributeIdLabel = (id: string): string => attributeLabel(id.split('.')[1] ?? id);

/** "+ Technique": the attribute a drill builds most. */
export function drillEffect(drill: DrillId): string {
  if (drill === 'REST') return tr('misc.train.effectRest');
  const target = DRILLS_BY_ID[drill].targets[0];
  return target ? tr('misc.train.effect', { name: attributeLabel(target.key) }) : tr('misc.train.effectCondition');
}

const translated = (key: string, english: string): string => (isKey(key) ? tr(key) : english);

export const drillLabel = (id: DrillId): string => translated(`misc.drill.${id}`, DRILLS_BY_ID[id]?.label ?? id);
export const drillDescription = (id: DrillId): string => translated(`misc.drill.${id}.desc`, DRILLS_BY_ID[id]?.description ?? '');
export const traitLabel = (id: PersonalityTrait): string => translated(`misc.trait.${id}`, TRAITS_BY_ID[id]?.label ?? id);
export const traitDescription = (id: PersonalityTrait): string => translated(`misc.trait.${id}.desc`, TRAITS_BY_ID[id]?.description ?? '');

/** An injury's name, body part and rehab note; the saved English when the type is unknown (old saves). */
export const injuryName = (type: InjuryType | undefined, saved: string): string => (type ? translated(`misc.inj.${type}`, saved) : saved);
export const injuryPart = (type: InjuryType | undefined, saved: string): string => (type ? translated(`misc.inj.${type}.part`, saved) : saved);
export const injuryNote = (type: InjuryType): string => translated(`misc.inj.${type}.note`, INJURIES_BY_TYPE[type]?.rehabNote ?? '');
export const severityLabel = (severity: InjurySeverity): string => translated(`misc.sev.${severity}`, severity.toLowerCase());

export interface FocusRow {
  category: DrillCategory;
  label: string;
  effect: string;
  /** 0-100: share of the week's energy, or fatigue for the rest row. */
  value: number;
  tone: ProgressTone;
  icon: LucideIcon;
  tile: string;
}

/**
 * The Training Focus card: one row per kind of work in this week's plan,
 * with its share of the week's energy. Rest shows the fatigue it is fighting.
 */
export function trainingFocusRows(state: GameState, limit = 4): FocusRow[] {
  const sessions = state.trainingPlan.sessions;
  const total = sessions.reduce((sum, s) => sum + sessionEnergy(s), 0) || 1;
  const byCategory = new Map<DrillCategory, { energy: number; drills: Map<DrillId, number> }>();
  for (const session of sessions) {
    const category = DRILLS_BY_ID[session.drill]?.category;
    if (!category) continue;
    const entry = byCategory.get(category) ?? { energy: 0, drills: new Map() };
    const energy = sessionEnergy(session);
    entry.energy += energy;
    entry.drills.set(session.drill, (entry.drills.get(session.drill) ?? 0) + energy + 0.1);
    byCategory.set(category, entry);
  }
  const rows: FocusRow[] = [...byCategory.entries()].map(([category, entry]) => {
    const meta = CATEGORY_META[category];
    const top = [...entry.drills.entries()].sort((a, b) => b[1] - a[1])[0][0];
    return {
      category,
      label: meta.label,
      effect: drillEffect(top),
      value: category === 'RECOVERY' ? state.player.condition.fatigue : (entry.energy / total) * 100,
      tone: meta.tone,
      icon: meta.icon,
      tile: meta.tile,
    };
  });
  // Work first, heaviest first; rest last.
  return rows
    .sort((a, b) => (a.category === 'RECOVERY' ? 1 : 0) - (b.category === 'RECOVERY' ? 1 : 0) || b.value - a.value)
    .slice(0, limit);
}
