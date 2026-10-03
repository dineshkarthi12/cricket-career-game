/**
 * Every animation state the cricket scene uses, and honestly where its motion
 * comes from. The Lab screen renders this table; states without a source are
 * never played.
 */
export type AnimationSource =
  /** Hand-authored keyframes in `clips.ts` on the procedural rig. */
  | 'PROCEDURAL_KEYFRAMES'
  /** A clip from an imported, licensed model on its own skeleton. */
  | 'IMPORTED'
  /** An imported clip retargeted onto another skeleton. */
  | 'RETARGETED'
  /** Not an animation clip: an engine event or the blending system itself. */
  | 'SYSTEM'
  | 'UNAVAILABLE';

export interface StateInfo {
  state: string;
  clip: string | null;
  loop: boolean;
  source: AnimationSource;
  note: string;
}

const P = 'PROCEDURAL_KEYFRAMES' as const;

export const ANIMATION_STATES: StateInfo[] = [
  { state: 'Idle', clip: 'Idle', loop: true, source: P, note: 'Standing, breathing.' },
  { state: 'BattingIdle', clip: 'BattingIdle', loop: true, source: P, note: 'Batting stance, bat tapping. Arms by IK to the bat.' },
  { state: 'BowlingRunUp', clip: 'BowlingRunUp', loop: true, source: P, note: 'Run cycle; the scene moves the bowler to the crease.' },
  { state: 'BowlingDelivery', clip: 'BowlingDelivery', loop: false, source: P, note: 'Pace action: bound, coil, release at 0.42 s, follow-through.' },
  { state: 'SpinDelivery', clip: 'SpinDelivery', loop: false, source: P, note: 'Spinner’s shorter action, release at 0.40 s.' },
  { state: 'BattingDefence', clip: 'BattingDefence', loop: false, source: P, note: 'Front-foot block, dead bat.' },
  { state: 'BattingDrive', clip: 'BattingDrive', loop: false, source: P, note: 'Front-foot drive, contact at 0.42 s.' },
  { state: 'BattingPull', clip: 'BattingPull', loop: false, source: P, note: 'Back-foot pull, horizontal bat to leg.' },
  { state: 'BattingCut', clip: 'BattingCut', loop: false, source: P, note: 'Back-foot cut to the off side.' },
  { state: 'BattingSweep', clip: 'BattingSweep', loop: false, source: P, note: 'Down on one knee, sweeping to leg.' },
  { state: 'BattingLoftedShot', clip: 'BattingLoftedShot', loop: false, source: P, note: 'Lofted drive, high finish.' },
  { state: 'BattingLeave', clip: 'BattingLeave', loop: false, source: P, note: 'Bat raised out of the line.' },
  { state: 'MissedShot', clip: 'MissedShot', loop: false, source: P, note: 'Swing inside the line; only played when the engine records a miss.' },
  { state: 'Contact', clip: null, loop: false, source: 'SYSTEM', note: 'Not a clip: the moment the engine’s outcome says bat met ball (sound, ball deflection).' },
  { state: 'RunBetweenWickets', clip: 'RunBetweenWickets', loop: true, source: P, note: 'Run cycle carrying the bat.' },
  { state: 'Sprint', clip: 'Sprint', loop: true, source: P, note: 'Fielder chasing.' },
  { state: 'FieldingReady', clip: 'FieldingReady', loop: true, source: P, note: 'Crouched, walking in.' },
  { state: 'FieldingStop', clip: 'FieldingStop', loop: false, source: P, note: 'Bend and gather.' },
  { state: 'FieldingDive', clip: 'FieldingDive', loop: false, source: P, note: 'Diving stop (whole-body roll on the hips bone).' },
  { state: 'Catching', clip: 'Catching', loop: false, source: P, note: 'Hands up, catch absorbed to the chest.' },
  { state: 'Throwing', clip: 'Throwing', loop: false, source: P, note: 'Side-on overarm throw.' },
  { state: 'WicketkeeperReady', clip: 'WicketkeeperReady', loop: true, source: P, note: 'Deep crouch.' },
  { state: 'WicketkeeperAction', clip: 'WicketkeeperAction', loop: false, source: P, note: 'Rise and take the ball.' },
  { state: 'Celebration', clip: 'Celebration', loop: false, source: P, note: 'Jump, arms up.' },
  { state: 'DismissalReaction', clip: 'DismissalReaction', loop: false, source: P, note: 'Head down, hands on hips.' },
  { state: 'WalkBack', clip: 'WalkBack', loop: true, source: P, note: 'Head-down walk off.' },
  { state: 'Walk', clip: 'Walk', loop: true, source: P, note: 'Ordinary walk (generic locomotion).' },
  { state: 'UmpireIdle', clip: 'UmpireIdle', loop: true, source: P, note: 'Umpire, hands together.' },
  { state: 'UmpireOut', clip: 'UmpireOut', loop: false, source: P, note: 'Finger raised.' },
  { state: 'UmpireFour', clip: 'UmpireFour', loop: false, source: P, note: 'Arm waved across the body.' },
  { state: 'UmpireSix', clip: 'UmpireSix', loop: false, source: P, note: 'Both arms raised.' },
  { state: 'UmpireWide', clip: 'UmpireWide', loop: false, source: P, note: 'Arms out to the sides.' },
  { state: 'Transition', clip: null, loop: false, source: 'SYSTEM', note: 'Not a clip: cross-fades between any two states (AnimationController).' },
];

export const STATE_INFO: Record<string, StateInfo> = Object.fromEntries(ANIMATION_STATES.map((s) => [s.state, s]));

/** States that use the bat-and-IK batting rig. */
export const BATTING_STATES = new Set([
  'BattingIdle', 'BattingDefence', 'BattingDrive', 'BattingPull', 'BattingCut', 'BattingSweep', 'BattingLoftedShot', 'BattingLeave', 'MissedShot',
]);

/** Motion that the brief asked for but no licensed asset was found for. Listed in the Lab. */
export const MISSING_AUTHENTIC_MOTION = [
  'Motion-captured cricket batting shots (drive, pull, cut, sweep, loft, defence)',
  'Motion-captured fast and spin bowling actions',
  'Motion-captured wicketkeeping, diving and catching',
  'Umpire signal motion capture',
];
