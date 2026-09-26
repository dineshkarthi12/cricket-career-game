import type { InjuryType, PlayerRole } from '@/types';

/** Where an injury happened. Some only happen in matches. */
export type InjuryContext = 'TRAINING' | 'MATCH';

export interface InjuryDefinition {
  type: InjuryType;
  name: string;
  bodyPart: string;
  /** Realistic recovery, in weeks. */
  weeks: [number, number];
  /** Base relative likelihood. */
  weight: number;
  /** Relative likelihood by role, on top of `weight`. */
  roleWeight: Partial<Record<PlayerRole, number>>;
  /** Only in matches (a blow to the head, a ball on the finger). */
  matchOnly: boolean;
  /** Extra likelihood for young fast bowlers under a heavy load. */
  youngPaceWorkload: number;
  /** Physical attribute points lost while carrying it. */
  penalty: number;
  /** What the physio says about the rehab. */
  rehabNote: string;
}

export const INJURIES: InjuryDefinition[] = [
  {
    type: 'NIGGLE',
    name: 'Muscle niggle',
    bodyPart: 'Calf',
    weeks: [0.5, 1.5],
    weight: 34,
    roleWeight: {},
    matchOnly: false,
    youngPaceWorkload: 0,
    penalty: 1,
    rehabNote: 'A few days of rest and massage.',
  },
  {
    type: 'HAMSTRING',
    name: 'Hamstring strain',
    bodyPart: 'Hamstring',
    weeks: [2, 6],
    weight: 16,
    roleWeight: { OPENING_BATTER: 1.2, PACE_BOWLER: 1.2 },
    matchOnly: false,
    youngPaceWorkload: 0,
    penalty: 4,
    rehabNote: 'Graded running, then sprinting. Rushing it is how it tears again.',
  },
  {
    type: 'SIDE_STRAIN',
    name: 'Side strain',
    bodyPart: 'Side',
    weeks: [4, 8],
    weight: 5,
    roleWeight: { PACE_BOWLER: 4, BOWLING_ALLROUNDER: 2.5, BATTING_ALLROUNDER: 1.5 },
    matchOnly: false,
    youngPaceWorkload: 0.6,
    penalty: 3,
    rehabNote: 'No bowling until the intercostal has healed, then a slow build-up.',
  },
  {
    type: 'BACK_STRESS_FRACTURE',
    name: 'Lumbar stress fracture',
    bodyPart: 'Lower back',
    weeks: [12, 24],
    weight: 0.6,
    roleWeight: { PACE_BOWLER: 5, BOWLING_ALLROUNDER: 3 },
    matchOnly: false,
    youngPaceWorkload: 4,
    penalty: 6,
    rehabNote: 'Months off bowling, core strength and a scan before any return.',
  },
  {
    type: 'FINGER_FRACTURE',
    name: 'Fractured finger',
    bodyPart: 'Finger',
    weeks: [4, 6],
    weight: 5,
    roleWeight: { WICKET_KEEPER_BATTER: 3 },
    matchOnly: false,
    youngPaceWorkload: 0,
    penalty: 2,
    rehabNote: 'Splinted. Fitness work carries on; no catching until it knits.',
  },
  {
    type: 'ANKLE_SPRAIN',
    name: 'Ankle sprain',
    bodyPart: 'Ankle',
    weeks: [1, 4],
    weight: 10,
    roleWeight: { PACE_BOWLER: 1.4 },
    matchOnly: false,
    youngPaceWorkload: 0,
    penalty: 3,
    rehabNote: 'Strapping, balance work and a jog test.',
  },
  {
    type: 'CONCUSSION',
    name: 'Concussion',
    bodyPart: 'Head',
    weeks: [1, 2],
    weight: 3,
    roleWeight: { WICKET_KEEPER_BATTER: 1.4, OPENING_BATTER: 1.3 },
    matchOnly: true,
    youngPaceWorkload: 0,
    penalty: 1,
    rehabNote: 'Graduated return protocol. No shortcuts with a head injury.',
  },
  {
    type: 'SHOULDER',
    name: 'Shoulder injury',
    bodyPart: 'Shoulder',
    weeks: [3, 10],
    weight: 5,
    roleWeight: { SPIN_BOWLER: 1.6, PACE_BOWLER: 1.3 },
    matchOnly: false,
    youngPaceWorkload: 0.3,
    penalty: 4,
    rehabNote: 'Rotator-cuff strengthening before throwing or bowling again.',
  },
  {
    type: 'KNEE',
    name: 'Knee injury',
    bodyPart: 'Knee',
    weeks: [4, 16],
    weight: 3,
    roleWeight: { PACE_BOWLER: 1.8, WICKET_KEEPER_BATTER: 1.5 },
    matchOnly: false,
    youngPaceWorkload: 0.4,
    penalty: 5,
    rehabNote: 'Quad and landing mechanics work. A long one if it is ligament.',
  },
  {
    type: 'GROIN',
    name: 'Groin strain',
    bodyPart: 'Groin',
    weeks: [2, 5],
    weight: 6,
    roleWeight: { PACE_BOWLER: 1.4, WICKET_KEEPER_BATTER: 1.3 },
    matchOnly: false,
    youngPaceWorkload: 0,
    penalty: 3,
    rehabNote: 'Adductor loading, then change-of-direction work.',
  },
];

export const INJURIES_BY_TYPE: Record<InjuryType, InjuryDefinition> = Object.fromEntries(
  INJURIES.map((injury) => [injury.type, injury]),
) as Record<InjuryType, InjuryDefinition>;
