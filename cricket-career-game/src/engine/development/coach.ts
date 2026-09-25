/**
 * What the coaches think. The true potential is hidden; the coaches have an
 * estimate that is noisy when the player is young, biased by bloomer traits
 * and recent form, and firms up with age and better coaching.
 */
import type { Rng } from '../match/rng';
import { attributeRefs, cloneAttributes, getAttr, setAttr } from './curves';
import type { Attributes, DevelopmentState, PersonalityTrait, WeeklyReport } from '@/types';

/** How far off the coaches can be at this age (one "standard deviation"). */
function uncertaintyAt(age: number, coachQuality: number): number {
  const byAge = age < 13 ? 9 : age < 16 ? 7 : age < 19 ? 5 : age < 23 ? 3.5 : 2;
  return byAge * (1.25 - coachQuality / 200);
}

/** Coaches underrate late bloomers and overrate early ones while they are young. */
function bloomerBias(age: number, traits: PersonalityTrait[]): number {
  if (age >= 20) return 0;
  const fade = (20 - age) / 10;
  if (traits.includes('LATE_BLOOMER')) return -7 * fade;
  if (traits.includes('EARLY_BLOOMER')) return 6 * fade;
  return 0;
}

export function initialCoachEstimate(
  hiddenPotential: number,
  age: number,
  traits: PersonalityTrait[],
  rng: Rng,
): number {
  const noise = rng.spread() * uncertaintyAt(age, 45) * 1.6;
  return Math.round(clamp(hiddenPotential + bloomerBias(age, traits) + noise, 40, 99));
}

/**
 * Once a month the estimate moves towards the truth (plus the bias of the
 * moment: coaches get carried away by a hot streak).
 */
export function refineEstimate(
  development: DevelopmentState,
  age: number,
  form: number,
  currentOverall: number,
  rng: Rng,
): number {
  const truth = development.hiddenPotential;
  const formBias = ((form - 50) / 50) * 2.5;
  const target =
    truth +
    bloomerBias(age, development.traits) +
    formBias +
    rng.spread() * uncertaintyAt(age, development.coachQuality);
  const pull = 0.12 + development.coachQuality / 1000;
  const next = development.coachEstimate + (target - development.coachEstimate) * pull;
  // Nobody estimates a ceiling below what the player already is.
  return Math.round(clamp(Math.max(next, currentOverall), 40, 99));
}

/** Vague words about the ceiling. Never a number. */
export function coachHints(development: DevelopmentState, age: number): string[] {
  const hints: string[] = [];
  const e = development.coachEstimate;
  if (e >= 88) hints.push('Special talent - could play for India');
  else if (e >= 82) hints.push('High ceiling');
  else if (e >= 75) hints.push('Solid first-class prospect');
  else if (e >= 68) hints.push('Good domestic cricketer in the making');
  else hints.push('Needs to keep working - the ceiling is not obvious yet');

  const traits = development.traits;
  if (traits.includes('LATE_BLOOMER') && age < 22) hints.push('Late bloomer - give it time');
  if (traits.includes('EARLY_BLOOMER') && age < 18) hints.push('Ahead of the age group - others will catch up');
  if (traits.includes('HARD_WORKER')) hints.push('First in the nets, last to leave');
  if (traits.includes('QUICK_LEARNER')) hints.push('Picks things up quickly');
  if (traits.includes('EASILY_DISTRACTED')) hints.push('Talent is there; the focus comes and goes');
  if (traits.includes('INJURY_PRONE')) hints.push('Has to manage the body carefully');
  if (traits.includes('NATURAL_LEADER')) hints.push('Others follow - a future captain');
  return hints.slice(0, 3);
}

/**
 * The "Potential" envelope on the Skill Development radar: the coaches'
 * estimate, not the truth. Per-attribute ceilings are scaled by how far the
 * coaches over- or under-rate the player, and never drawn below today.
 */
export function estimatedCeilings(
  potential: Attributes,
  current: Attributes,
  development: DevelopmentState,
): Attributes {
  const ratio = development.coachEstimate / Math.max(1, development.hiddenPotential);
  const out = cloneAttributes(potential);
  for (const ref of attributeRefs(out)) {
    const estimate = getAttr(potential, ref.group, ref.key) * ratio;
    setAttr(out, ref.group, ref.key, Math.round(clamp(Math.max(estimate, getAttr(current, ref.group, ref.key)), 1, 99)));
  }
  return out;
}

/** The coach's message after a week. */
export function coachNote(report: Omit<WeeklyReport, 'coachNote' | 'id'>, development: DevelopmentState): string {
  const best = [...report.changes].sort((a, b) => b.delta - a.delta)[0];
  const [fatigueBefore, fatigueAfter] = report.fatigue;
  if (report.injury) return `Frustrating end to the week - the ${report.injury.toLowerCase()} means rehab first. Listen to the physio.`;
  if (report.examWeek) return 'Exam week, so a lighter load. Get the papers done - the nets will still be here.';
  if (fatigueAfter >= 75) return `You are running on empty (fatigue ${Math.round(fatigueAfter)}). Rest this week or you will break down.`;
  if (report.energyUsed === 0) return 'No work done this week. The body recovered, but nothing moved forward.';
  if (report.energyUsed < report.energyBudget * 0.5) return 'Light week. Fine now and then, but the ones who make it put the hours in.';
  if (best && best.delta >= 1) {
    const extra =
      development.traits.includes('HARD_WORKER') && fatigueAfter < 60 ? ' The extra hours are showing.' : '';
    return `Great improvement in your ${best.label.toLowerCase()} this week.${extra}`;
  }
  if (fatigueAfter > fatigueBefore + 10) return 'Solid work, but the fatigue is creeping up. Build some rest in.';
  return 'Steady week. Keep stacking these up - it adds up over a season.';
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
