/** Editing the weekly plan. Any change to the sessions resets the consistency bonus. */
import { TRAINING } from '../config';
import type { Lifestyle, TrainingPlan, TrainingSession } from '@/types';

export function withSessions(plan: TrainingPlan, sessions: TrainingSession[]): TrainingPlan {
  const trimmed = sessions.slice(0, TRAINING.maxSessions);
  const same =
    trimmed.length === plan.sessions.length &&
    trimmed.every((s, i) => {
      const o = plan.sessions[i];
      return o && o.drill === s.drill && o.intensity === s.intensity && o.aggression === s.aggression;
    });
  return { ...plan, sessions: trimmed, weeksActive: same ? plan.weeksActive : 0 };
}

export function withLifestyle(plan: TrainingPlan, lifestyle: Partial<Lifestyle>): TrainingPlan {
  return { ...plan, lifestyle: { ...plan.lifestyle, ...lifestyle } };
}

export function withStudyFocus(plan: TrainingPlan, studyFocus: number): TrainingPlan {
  return { ...plan, studyFocus: Math.max(0, Math.min(100, Math.round(studyFocus))) };
}
