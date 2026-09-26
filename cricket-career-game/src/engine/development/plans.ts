/** Sensible starting plans, one per role, used for new careers and the simulation. */
import { newId } from '../id';
import type { BowlingStyle, DrillId, PlayerRole, TrainingIntensity, TrainingPlan, TrainingSession } from '@/types';

type Spec = [DrillId, TrainingIntensity];

const BATTER: Spec[] = [
  ['NETS_PACE', 'NORMAL'],
  ['NETS_SPIN', 'NORMAL'],
  ['DEFENCE', 'NORMAL'],
  ['FIELDING', 'NORMAL'],
  ['ENDURANCE', 'NORMAL'],
  ['FOCUS', 'LIGHT'],
  ['REST', 'LIGHT'],
];

const KEEPER: Spec[] = [
  ['KEEPING', 'NORMAL'],
  ['NETS_PACE', 'NORMAL'],
  ['NETS_SPIN', 'NORMAL'],
  ['SPEED', 'NORMAL'],
  ['DEFENCE', 'LIGHT'],
  ['FOCUS', 'LIGHT'],
  ['REST', 'LIGHT'],
];

const PACER: Spec[] = [
  ['BOWL_ACCURACY', 'NORMAL'],
  ['BOWL_PACE', 'NORMAL'],
  ['BOWL_VARIATIONS', 'LIGHT'],
  ['STRENGTH', 'NORMAL'],
  ['ENDURANCE', 'NORMAL'],
  ['FIELDING', 'LIGHT'],
  ['REST', 'LIGHT'],
];

const SPINNER: Spec[] = [
  ['SPIN_BOWLING', 'NORMAL'],
  ['BOWL_ACCURACY', 'NORMAL'],
  ['BOWL_VARIATIONS', 'NORMAL'],
  ['FIELDING', 'NORMAL'],
  ['NETS_SPIN', 'LIGHT'],
  ['ENDURANCE', 'LIGHT'],
  ['REST', 'LIGHT'],
];

const ALLROUNDER: Spec[] = [
  ['NETS_PACE', 'NORMAL'],
  ['BOWL_ACCURACY', 'NORMAL'],
  ['NETS_SPIN', 'LIGHT'],
  ['BOWL_VARIATIONS', 'LIGHT'],
  ['FIELDING', 'NORMAL'],
  ['ENDURANCE', 'NORMAL'],
  ['REST', 'LIGHT'],
];

const SPIN_STYLES: BowlingStyle[] = ['OFF_SPIN', 'LEG_SPIN', 'LEFT_ARM_ORTHODOX', 'LEFT_ARM_WRIST_SPIN'];

function specsFor(role: PlayerRole, bowling: BowlingStyle): Spec[] {
  const spinner = SPIN_STYLES.includes(bowling);
  switch (role) {
    case 'WICKET_KEEPER_BATTER':
      return KEEPER;
    case 'PACE_BOWLER':
      return PACER;
    case 'SPIN_BOWLER':
      return SPINNER;
    case 'BATTING_ALLROUNDER':
    case 'BOWLING_ALLROUNDER':
      return spinner
        ? ALLROUNDER.map(([drill, i]) => [drill === 'BOWL_ACCURACY' ? 'SPIN_BOWLING' : drill, i] as Spec)
        : ALLROUNDER;
    default:
      return BATTER;
  }
}

export function sessionFrom(drill: DrillId, intensity: TrainingIntensity, aggression: number | null): TrainingSession {
  return { id: newId('ses'), drill, intensity, aggression };
}

/** Nets and match simulation practise the player's preferred aggression by default. */
export function defaultAggressionFor(drill: DrillId, preferred: number): number | null {
  if (['NETS_PACE', 'NETS_SPIN', 'POWER_HITTING', 'DEFENCE', 'MATCH_SIM'].includes(drill)) {
    if (drill === 'DEFENCE') return Math.max(1, preferred - 1);
    if (drill === 'POWER_HITTING') return Math.min(5, preferred + 1);
    return preferred;
  }
  if (['BOWL_ACCURACY', 'BOWL_PACE', 'BOWL_VARIATIONS', 'DEATH_BOWLING', 'SPIN_BOWLING'].includes(drill)) return 3;
  return null;
}

export function defaultPlanFor(role: PlayerRole, bowling: BowlingStyle, preferredAggression = 3): TrainingPlan {
  return {
    id: newId('plan'),
    name: 'Coach’s plan',
    sessions: specsFor(role, bowling).map(([drill, intensity]) =>
      sessionFrom(drill, intensity, defaultAggressionFor(drill, preferredAggression)),
    ),
    lifestyle: { sleep: 'NORMAL', diet: 'BALANCED', recovery: 'STRETCHING' },
    studyFocus: 40,
    lastAppliedOn: null,
    weeksActive: 0,
  };
}
