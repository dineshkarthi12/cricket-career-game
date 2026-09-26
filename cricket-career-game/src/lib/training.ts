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
import { attributeLabel as engineAttributeLabel } from '@/engine/development/labels';
import { sessionEnergy } from '@/engine/development/training';
import type { DrillCategory, DrillId, GameState } from '@/types';

interface CategoryMeta {
  label: string;
  icon: LucideIcon;
  tone: ProgressTone;
  /** Tailwind classes for the rounded icon tile. */
  tile: string;
}

const CATEGORY_META: Record<DrillCategory, CategoryMeta> = {
  BATTING: { label: 'Batting Nets', icon: Target, tone: 'blue', tile: 'bg-brand-blue-soft text-brand-blue' },
  BOWLING: { label: 'Bowling', icon: Zap, tone: 'orange', tile: 'bg-brand-orange/15 text-brand-orange' },
  FIELDING: { label: 'Fielding', icon: Shield, tone: 'green', tile: 'bg-brand-green/12 text-brand-green' },
  FITNESS: { label: 'Fitness', icon: Dumbbell, tone: 'green', tile: 'bg-brand-red/10 text-brand-red' },
  MENTAL: { label: 'Mental Training', icon: Brain, tone: 'blue', tile: 'bg-brand-blue-soft text-brand-blue' },
  MATCH: { label: 'Match Simulation', icon: Swords, tone: 'navy', tile: 'bg-brand-navy/10 text-brand-navy' },
  RECOVERY: { label: 'Rest & Recovery', icon: Moon, tone: 'red', tile: 'bg-brand-blue-soft text-brand-blue' },
};

export const categoryMeta = (category: DrillCategory): CategoryMeta => CATEGORY_META[category];

export const drillMeta = (drill: DrillId): CategoryMeta => CATEGORY_META[DRILLS_BY_ID[drill].category];

export const attributeLabel = engineAttributeLabel;

/** "+ Technique": the attribute a drill builds most. */
export function drillEffect(drill: DrillId): string {
  if (drill === 'REST') return '- Fatigue';
  const target = DRILLS_BY_ID[drill].targets[0];
  return target ? `+ ${attributeLabel(target.key)}` : '+ Condition';
}

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
