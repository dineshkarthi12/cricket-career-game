import type { AttributeGroup, DrillCategory, DrillId } from '@/types';

/** An attribute a drill builds, and how much of the session goes into it. */
export interface DrillTarget {
  group: AttributeGroup;
  key: string;
  weight: number;
}

export interface Drill {
  id: DrillId;
  label: string;
  category: DrillCategory;
  description: string;
  targets: DrillTarget[];
  /** Fatigue added by one NORMAL session. */
  fatigue: number;
  /** 0-3 load on the body; raises the weekly injury chance. */
  injuryLoad: number;
  /** Which aggression bar this drill practises, if any. */
  practises: 'BATTING' | 'BOWLING' | null;
  /** Only useful to players who bowl / keep. */
  requires?: 'BOWLER' | 'SPINNER' | 'PACER' | 'KEEPER';
}

const t = (group: AttributeGroup, key: string, weight: number): DrillTarget => ({ group, key, weight });

export const DRILLS: Drill[] = [
  {
    id: 'NETS_PACE',
    label: 'Nets vs Pace',
    category: 'BATTING',
    description: 'Throwdowns and the bowling machine at speed: judging length, playing late.',
    targets: [t('batting', 'vsPace', 1), t('batting', 'technique', 0.5), t('batting', 'vsSwing', 0.5), t('batting', 'footwork', 0.3)],
    fatigue: 5,
    injuryLoad: 0.6,
    practises: 'BATTING',
  },
  {
    id: 'NETS_SPIN',
    label: 'Nets vs Spin',
    category: 'BATTING',
    description: 'Using the feet, sweeping, reading the hand of the spinner.',
    targets: [t('batting', 'vsSpin', 1), t('batting', 'footwork', 0.6), t('batting', 'timing', 0.4)],
    fatigue: 4,
    injuryLoad: 0.3,
    practises: 'BATTING',
  },
  {
    id: 'POWER_HITTING',
    label: 'Power Hitting',
    category: 'BATTING',
    description: 'Range hitting: clearing the rope, the lofted drive, the slog sweep.',
    targets: [t('batting', 'power', 1), t('batting', 'shotRange', 0.6), t('physical', 'strength', 0.3)],
    fatigue: 6,
    injuryLoad: 0.8,
    practises: 'BATTING',
  },
  {
    id: 'DEFENCE',
    label: 'Defence & Leaving',
    category: 'BATTING',
    description: 'The forward defence, soft hands, knowing where off stump is.',
    targets: [t('batting', 'technique', 1), t('batting', 'concentration', 0.6), t('batting', 'vsSwing', 0.4)],
    fatigue: 3,
    injuryLoad: 0.3,
    practises: 'BATTING',
  },
  {
    id: 'BOWL_ACCURACY',
    label: 'Line & Length',
    category: 'BOWLING',
    description: 'Hitting a target on a good length, over after over.',
    targets: [t('bowling', 'accuracy', 1), t('bowling', 'control', 0.7), t('bowling', 'newBall', 0.3)],
    fatigue: 5,
    injuryLoad: 0.8,
    practises: 'BOWLING',
    requires: 'BOWLER',
  },
  {
    id: 'BOWL_PACE',
    label: 'Pace & Seam',
    category: 'BOWLING',
    description: 'Run-up, action and hitting the deck hard: pace, seam and bounce.',
    targets: [t('bowling', 'pace', 1), t('bowling', 'seam', 0.6), t('bowling', 'bounce', 0.4), t('bowling', 'swing', 0.3)],
    fatigue: 8,
    injuryLoad: 1.8,
    practises: 'BOWLING',
    requires: 'PACER',
  },
  {
    id: 'BOWL_VARIATIONS',
    label: 'Variations',
    category: 'BOWLING',
    description: 'Slower balls, cutters, the googly - something different when it is needed.',
    targets: [t('bowling', 'variation', 1), t('bowling', 'swing', 0.4), t('bowling', 'control', 0.3)],
    fatigue: 5,
    injuryLoad: 0.9,
    practises: 'BOWLING',
    requires: 'BOWLER',
  },
  {
    id: 'DEATH_BOWLING',
    label: 'Death Bowling',
    category: 'BOWLING',
    description: 'Yorkers and wide lines under pressure at the end of an innings.',
    targets: [t('bowling', 'deathBowling', 1), t('bowling', 'accuracy', 0.4), t('mental', 'temperament', 0.2)],
    fatigue: 7,
    injuryLoad: 1.4,
    practises: 'BOWLING',
    requires: 'BOWLER',
  },
  {
    id: 'SPIN_BOWLING',
    label: 'Spin Bowling',
    category: 'BOWLING',
    description: 'Revolutions, flight and drift; bowling long spells to a plan.',
    targets: [t('bowling', 'spin', 1), t('bowling', 'flight', 0.7), t('bowling', 'variation', 0.3), t('bowling', 'control', 0.3)],
    fatigue: 4,
    injuryLoad: 0.5,
    practises: 'BOWLING',
    requires: 'SPINNER',
  },
  {
    id: 'FIELDING',
    label: 'Fielding & Catching',
    category: 'FIELDING',
    description: 'High catches, slip cordon, attacking the ball and the flat throw.',
    targets: [t('fielding', 'catching', 1), t('fielding', 'groundFielding', 0.7), t('fielding', 'throwing', 0.5), t('fielding', 'agility', 0.4)],
    fatigue: 5,
    injuryLoad: 0.9,
    practises: null,
  },
  {
    id: 'KEEPING',
    label: 'Wicketkeeping',
    category: 'FIELDING',
    description: 'Taking it clean standing back and up, footwork down the leg side.',
    targets: [t('fielding', 'wicketKeeping', 1), t('fielding', 'catching', 0.4), t('fielding', 'agility', 0.4)],
    fatigue: 5,
    injuryLoad: 1,
    practises: null,
    requires: 'KEEPER',
  },
  {
    id: 'STRENGTH',
    label: 'Strength',
    category: 'FITNESS',
    description: 'Gym work: legs, core and shoulders.',
    targets: [t('physical', 'strength', 1), t('physical', 'durability', 0.5), t('batting', 'power', 0.2)],
    fatigue: 7,
    injuryLoad: 1,
    practises: null,
  },
  {
    id: 'SPEED',
    label: 'Speed & Agility',
    category: 'FITNESS',
    description: 'Sprints, turns between the wickets, reaction work.',
    targets: [t('physical', 'speed', 1), t('fielding', 'agility', 0.5), t('batting', 'running', 0.5)],
    fatigue: 7,
    injuryLoad: 1.3,
    practises: null,
  },
  {
    id: 'ENDURANCE',
    label: 'Endurance',
    category: 'FITNESS',
    description: 'Running and yo-yo work: lasting a full day in the heat.',
    targets: [t('physical', 'stamina', 1), t('physical', 'durability', 0.4), t('batting', 'concentration', 0.2)],
    fatigue: 8,
    injuryLoad: 0.9,
    practises: null,
  },
  {
    id: 'TEMPERAMENT',
    label: 'Temperament',
    category: 'MENTAL',
    description: 'Pressure scenarios with the psychologist: breathing, routines, next ball.',
    targets: [t('mental', 'temperament', 1), t('mental', 'discipline', 0.5), t('mental', 'leadership', 0.3)],
    fatigue: 1,
    injuryLoad: 0,
    practises: null,
  },
  {
    id: 'FOCUS',
    label: 'Focus & Game Sense',
    category: 'MENTAL',
    description: 'Video of bowlers and fields; concentration for long innings.',
    targets: [t('mental', 'matchAwareness', 1), t('batting', 'concentration', 0.6), t('mental', 'discipline', 0.3)],
    fatigue: 1,
    injuryLoad: 0,
    practises: null,
  },
  {
    id: 'MATCH_SIM',
    label: 'Match Simulation',
    category: 'MATCH',
    description: 'Centre-wicket scenarios: a bit of everything, and match sharpness.',
    targets: [
      t('mental', 'matchAwareness', 0.5),
      t('batting', 'timing', 0.4),
      t('batting', 'running', 0.3),
      t('mental', 'temperament', 0.3),
      t('fielding', 'groundFielding', 0.3),
      t('bowling', 'control', 0.3),
    ],
    fatigue: 6,
    injuryLoad: 0.9,
    practises: 'BATTING',
  },
  {
    id: 'REST',
    label: 'Rest & Recovery',
    category: 'RECOVERY',
    description: 'Ice baths, massage, sleep. Nothing grows, fatigue comes down.',
    targets: [],
    fatigue: 0,
    injuryLoad: 0,
    practises: null,
  },
];

export const DRILLS_BY_ID: Record<DrillId, Drill> = Object.fromEntries(
  DRILLS.map((drill) => [drill.id, drill]),
) as Record<DrillId, Drill>;

export function getDrill(id: DrillId): Drill {
  return DRILLS_BY_ID[id];
}
