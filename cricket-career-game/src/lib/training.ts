import { Brain, Dumbbell, Moon, Shield, Sparkles, Target, Zap, type LucideIcon } from 'lucide-react';
import type { ProgressTone } from '@/components';
import type { TrainingFocus, TrainingSlot } from '@/types';

interface FocusMeta {
  label: string;
  icon: LucideIcon;
  tone: ProgressTone;
  /** Tailwind classes for the rounded icon tile. */
  tile: string;
}

const FOCUS_META: Record<TrainingFocus, FocusMeta> = {
  BATTING_NETS: { label: 'Batting Nets', icon: Target, tone: 'blue', tile: 'bg-brand-blue-soft text-brand-blue' },
  POWER_HITTING: { label: 'Power Hitting', icon: Zap, tone: 'orange', tile: 'bg-brand-orange/15 text-brand-orange' },
  SPIN_PRACTICE: { label: 'Spin Practice', icon: Sparkles, tone: 'blue', tile: 'bg-brand-blue-soft text-brand-blue' },
  PACE_PRACTICE: { label: 'Pace Practice', icon: Zap, tone: 'blue', tile: 'bg-brand-blue-soft text-brand-blue' },
  BOWLING_NETS: { label: 'Bowling Nets', icon: Target, tone: 'blue', tile: 'bg-brand-blue-soft text-brand-blue' },
  DEATH_BOWLING: { label: 'Death Bowling', icon: Target, tone: 'red', tile: 'bg-brand-red/12 text-brand-red' },
  FIELDING_DRILLS: { label: 'Fielding Drills', icon: Shield, tone: 'green', tile: 'bg-brand-green/12 text-brand-green' },
  KEEPING_DRILLS: { label: 'Keeping Drills', icon: Shield, tone: 'green', tile: 'bg-brand-green/12 text-brand-green' },
  FITNESS: { label: 'Fitness', icon: Dumbbell, tone: 'green', tile: 'bg-brand-red/10 text-brand-red' },
  STRENGTH: { label: 'Strength', icon: Dumbbell, tone: 'green', tile: 'bg-brand-red/10 text-brand-red' },
  SPEED_WORK: { label: 'Speed Work', icon: Zap, tone: 'green', tile: 'bg-brand-green/12 text-brand-green' },
  MENTAL_TRAINING: { label: 'Mental Training', icon: Brain, tone: 'blue', tile: 'bg-brand-blue-soft text-brand-blue' },
  MATCH_SIMULATION: { label: 'Match Simulation', icon: Target, tone: 'blue', tile: 'bg-brand-blue-soft text-brand-blue' },
  REST_RECOVERY: { label: 'Rest & Recovery', icon: Moon, tone: 'red', tile: 'bg-brand-blue-soft text-brand-blue' },
};

export const focusMeta = (focus: TrainingFocus): FocusMeta => FOCUS_META[focus];

/** Turn camelCase attribute keys into "Technique", "Match Awareness", ... */
export function attributeLabel(key: string): string {
  const spaced = key.replace(/([A-Z])/g, ' $1').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** "+ Technique" for a drill that builds, "- Fatigue" for one that recovers. */
export function slotEffect(slot: TrainingSlot): string {
  if (slot.focus === 'REST_RECOVERY') return '- Fatigue';
  const key = slot.attributeKeys[0];
  return key ? `+ ${attributeLabel(key)}` : '+ Condition';
}
