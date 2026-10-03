/**
 * Cricket animation clips, authored as keyframes in code.
 *
 * HONEST LABEL: these are procedural, hand-keyed clips - not motion capture,
 * and not downloaded animation assets. No licensed cricket-specific motion
 * capture could be obtained in this environment (see
 * docs/assets/ASSET_MANIFEST.md). They are still genuine skeletal animation:
 * each clip is a `THREE.AnimationClip` of quaternion tracks on named bones,
 * played and cross-faded by a `THREE.AnimationMixer`.
 *
 * Conventions (character space): the character faces +Z, its left is +X.
 * Angles are degrees, Euler XYZ, relative to the rest pose (arms hanging).
 * For a hanging limb, X- swings it forward and X+ back; for the spine X+
 * leans forward. Left arm Z+ / right arm Z- lift the arms out to the side.
 *
 * Batting clips also key `BatControl` - the bat's grip point and direction -
 * and the arms reach it by IK (`ik.ts`), so both hands stay on the handle.
 * In a batter's space the bowler is at +X and the ball passes at about z=+0.35.
 */
import * as THREE from 'three';
import { BONE_NAMES, HIPS_HEIGHT } from '../characters/rig';

type V3 = [number, number, number];

export interface Pose {
  bones?: Partial<Record<string, V3>>;
  /** Offset of the hips from standing height, metres. Whole-body roll goes in `bones.Hips`. */
  hips?: V3;
  /** Bat grip position (character space), blade direction, and roll about the blade, degrees. */
  bat?: { pos: V3; dir: V3; roll?: number };
}

export interface Key {
  t: number;
  pose: Pose;
}

const D = THREE.MathUtils.DEG2RAD;
const DOWN = new THREE.Vector3(0, -1, 0);

function quat(e: V3): THREE.Quaternion {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(e[0] * D, e[1] * D, e[2] * D, 'XYZ'));
}

/** The bat's orientation: blade along `dir` from the grip, rolled about its length. */
export function batQuaternion(dir: V3, roll = 0): THREE.Quaternion {
  const d = new THREE.Vector3(...dir).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(DOWN, d);
  if (roll) q.premultiply(new THREE.Quaternion().setFromAxisAngle(d, roll * D));
  return q;
}

const SAMPLE_FPS = 30;

/**
 * Resample a keyframe track with a Hermite spline whose tangents come from
 * the neighbouring keys (non-uniform Catmull-Rom). Motion keeps its velocity
 * through each key instead of moving at constant speed between poses and
 * snapping - the main cause of a "robotic" look. One-shot clips ease in and
 * out at their ends; looping clips wrap their tangents so the cycle is seamless.
 */
export function smoothValues(times: number[], values: number[], stride: number, loop: boolean, quaternion: boolean): { times: number[]; values: number[] } {
  const n = times.length;
  if (n < 3) return { times, values };
  const at = (i: number, c: number) => values[i * stride + c];
  const tangent = (i: number, c: number): number => {
    if (i === 0 || i === n - 1) {
      if (!loop) return 0;
      // Loop: neighbours across the seam (first and last keys hold the same pose).
      const span = times[1] - times[0] + (times[n - 1] - times[n - 2]);
      return (at(1, c) - at(n - 2, c)) / span;
    }
    return (at(i + 1, c) - at(i - 1, c)) / (times[i + 1] - times[i - 1]);
  };
  const outT: number[] = [];
  const outV: number[] = [];
  const duration = times[n - 1];
  const steps = Math.max(n, Math.round(duration * SAMPLE_FPS));
  let seg = 0;
  for (let s = 0; s <= steps; s += 1) {
    const t = (duration * s) / steps;
    while (seg < n - 2 && t > times[seg + 1]) seg += 1;
    const t0 = times[seg];
    const t1 = times[seg + 1];
    const h = t1 - t0;
    const u = h > 0 ? Math.min(1, Math.max(0, (t - t0) / h)) : 0;
    const u2 = u * u;
    const u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1;
    const h10 = u3 - 2 * u2 + u;
    const h01 = -2 * u3 + 3 * u2;
    const h11 = u3 - u2;
    outT.push(t);
    const start = outV.length;
    for (let c = 0; c < stride; c += 1) {
      outV.push(h00 * at(seg, c) + h10 * h * tangent(seg, c) + h01 * at(seg + 1, c) + h11 * h * tangent(seg + 1, c));
    }
    if (quaternion) {
      const len = Math.hypot(outV[start], outV[start + 1], outV[start + 2], outV[start + 3]) || 1;
      for (let c = 0; c < 4; c += 1) outV[start + c] /= len;
    }
  }
  return { times: outT, values: outV };
}

function smoothTrack(track: THREE.KeyframeTrack, loop: boolean): THREE.KeyframeTrack {
  const quaternion = track instanceof THREE.QuaternionKeyframeTrack;
  const stride = quaternion ? 4 : 3;
  const r = smoothValues(Array.from(track.times), Array.from(track.values), stride, loop, quaternion);
  return quaternion ? new THREE.QuaternionKeyframeTrack(track.name, r.times, r.values) : new THREE.VectorKeyframeTrack(track.name, r.times, r.values);
}

/**
 * Build a clip from poses. Bones missing from a key are at rest in that key,
 * so every key is a complete pose and clips start and end cleanly. Tracks are
 * spline-smoothed (`smoothValues`).
 */
export function buildClip(name: string, keys: Key[], options: { loop?: boolean } = {}): THREE.AnimationClip {
  const times = keys.map((k) => k.t);
  const tracks: THREE.KeyframeTrack[] = [];
  const used = new Set<string>();
  for (const k of keys) for (const b of Object.keys(k.pose.bones ?? {})) used.add(b);
  for (const bone of BONE_NAMES) {
    if (!used.has(bone)) continue;
    const values: number[] = [];
    let prev: THREE.Quaternion | null = null;
    for (const k of keys) {
      const q = quat(k.pose.bones?.[bone] ?? [0, 0, 0]);
      // Keep neighbouring keys on the same hemisphere so slerp takes the short way.
      if (prev && prev.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
      values.push(q.x, q.y, q.z, q.w);
      prev = q;
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, values));
  }
  if (keys.some((k) => k.pose.hips)) {
    const values = keys.flatMap((k) => {
      const h = k.pose.hips ?? [0, 0, 0];
      return [h[0], HIPS_HEIGHT + h[1], h[2]];
    });
    tracks.push(new THREE.VectorKeyframeTrack('Hips.position', times, values));
  }
  if (keys.some((k) => k.pose.bat)) {
    const pos: number[] = [];
    const rot: number[] = [];
    let prev: THREE.Quaternion | null = null;
    let last = keys.find((k) => k.pose.bat)!.pose.bat!;
    for (const k of keys) {
      const b = k.pose.bat ?? last;
      last = b;
      pos.push(...b.pos);
      const q = batQuaternion(b.dir, b.roll);
      if (prev && prev.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
      rot.push(q.x, q.y, q.z, q.w);
      prev = q;
    }
    tracks.push(new THREE.VectorKeyframeTrack('BatControl.position', times, pos));
    tracks.push(new THREE.QuaternionKeyframeTrack('BatControl.quaternion', times, rot));
  }
  return new THREE.AnimationClip(name, keys[keys.length - 1].t, tracks.map((t) => smoothTrack(t, Boolean(options.loop))));
}

// ------------------------------------------------------------------ poses

const STANCE: Pose = {
  hips: [0, -0.07, 0],
  bones: {
    LeftUpLeg: [-14, 0, 9], RightUpLeg: [-14, 0, -9],
    LeftLeg: [26, 0, 0], RightLeg: [26, 0, 0],
    LeftFoot: [-12, 0, 0], RightFoot: [-12, 0, 0],
    Spine: [10, 0, 0], Spine2: [12, 0, 0],
    Neck: [5, 40, 0], Head: [8, 38, 0],
  },
  bat: { pos: [-0.04, 0.86, 0.3], dir: [-0.25, -1, 0.18], roll: 0 },
};

/** Bat raised as the bowler releases. */
const BACKLIFT: Pose = {
  hips: [0, -0.07, 0],
  bones: { ...STANCE.bones, Spine2: [10, -8, 0] },
  bat: { pos: [-0.16, 1.18, 0.24], dir: [-0.55, 0.8, -0.05], roll: 0 },
};

const FRONT_FOOT = (stride: number, lean: number): Partial<Record<string, V3>> => ({
  LeftUpLeg: [-18, 0, 9 + stride], RightUpLeg: [-4, 0, -12],
  LeftLeg: [34, 0, 0], RightLeg: [14, 0, 0],
  LeftFoot: [-14, 0, 0], RightFoot: [-6, 0, 0],
  Spine: [12 + lean, 0, -8], Spine2: [16 + lean, 0, -6],
  Neck: [16, 38, 0], Head: [14, 36, 0],
});

/** Seconds into every shot clip at which the bat meets the ball. */
export const SHOT_CONTACT_SEC = 0.42;

function shot(name: string, contact: Pose, follow: Pose, extra: Key[] = []): THREE.AnimationClip {
  return buildClip(name, [
    { t: 0, pose: STANCE },
    { t: 0.22, pose: BACKLIFT },
    { t: SHOT_CONTACT_SEC, pose: contact },
    ...extra,
    { t: 0.9, pose: follow },
    { t: 1.35, pose: follow },
  ]);
}

const DRIVE_CONTACT: Pose = { hips: [0.14, -0.13, 0], bones: FRONT_FOOT(24, 6), bat: { pos: [0.26, 0.72, 0.38], dir: [0.12, -1, 0.04], roll: 90 } };
const DRIVE_FOLLOW: Pose = { hips: [0.16, -0.1, 0], bones: { ...FRONT_FOOT(24, 2), Spine2: [10, 25, -6] }, bat: { pos: [0.24, 1.36, 0.22], dir: [0.55, 0.8, -0.25], roll: 90 } };

const DEFENCE_CONTACT: Pose = { hips: [0.1, -0.12, 0], bones: FRONT_FOOT(16, 8), bat: { pos: [0.2, 0.78, 0.38], dir: [0.05, -1, 0.04], roll: 90 } };

const LOFT_CONTACT: Pose = { hips: [0.12, -0.1, 0], bones: { ...FRONT_FOOT(20, -4), Spine2: [6, 10, -4] }, bat: { pos: [0.3, 0.86, 0.36], dir: [0.45, -0.88, 0.05], roll: 90 } };
const LOFT_FOLLOW: Pose = { hips: [0.1, -0.05, 0], bones: { ...FRONT_FOOT(20, -6), Spine2: [0, 35, -4], Neck: [-10, 40, 0], Head: [-15, 35, 0] }, bat: { pos: [0.12, 1.62, 0.05], dir: [0.25, 0.92, -0.3], roll: 90 } };

const BACK_FOOT: Partial<Record<string, V3>> = {
  LeftUpLeg: [-8, 0, 6], RightUpLeg: [-20, 0, -4],
  LeftLeg: [16, 0, 0], RightLeg: [22, 0, 0],
  LeftFoot: [-8, 0, 0], RightFoot: [-6, 0, 0],
  Spine: [4, 0, 4], Spine2: [6, 0, 0],
  Neck: [6, 38, 0], Head: [4, 36, 0],
};

const CUT_CONTACT: Pose = { hips: [-0.04, -0.08, 0.06], bones: { ...BACK_FOOT, Spine2: [8, -18, 0] }, bat: { pos: [0.02, 1.0, 0.42], dir: [0.1, -0.35, 0.93], roll: 0 } };
const CUT_FOLLOW: Pose = { hips: [-0.04, -0.07, 0.06], bones: { ...BACK_FOOT, Spine2: [8, -10, 0] }, bat: { pos: [-0.05, 0.98, 0.28], dir: [-0.7, -0.35, 0.6], roll: 0 } };

const PULL_CONTACT: Pose = { hips: [-0.06, -0.06, 0], bones: { ...BACK_FOOT, Spine2: [2, 18, 0] }, bat: { pos: [0.08, 1.2, 0.3], dir: [0.4, 0.05, 0.92], roll: -90 } };
const PULL_FOLLOW: Pose = { hips: [-0.06, -0.05, 0], bones: { ...BACK_FOOT, Spine2: [2, 50, 0], Spine: [4, 15, 0] }, bat: { pos: [0.0, 1.32, -0.05], dir: [-0.45, 0.35, -0.82], roll: -90 } };

const SWEEP_BODY: Partial<Record<string, V3>> = {
  LeftUpLeg: [-75, 0, 30], LeftLeg: [80, 0, 0], LeftFoot: [-5, 0, 0],
  RightUpLeg: [10, 0, -10], RightLeg: [95, 0, 0], RightFoot: [40, 0, 0],
  Spine: [30, 0, -10], Spine2: [25, 10, 0], Neck: [10, 35, 0], Head: [15, 35, 0],
};
const SWEEP_CONTACT: Pose = { hips: [0.12, -0.44, 0], bones: SWEEP_BODY, bat: { pos: [0.3, 0.42, 0.42], dir: [0.75, -0.55, 0.35], roll: 90 } };
const SWEEP_FOLLOW: Pose = { hips: [0.12, -0.44, 0], bones: { ...SWEEP_BODY, Spine2: [25, 40, 0] }, bat: { pos: [0.22, 0.55, 0.05], dir: [0.3, -0.35, -0.88], roll: 90 } };

const LEAVE_POSE: Pose = { hips: [-0.02, -0.06, 0], bones: { ...BACK_FOOT, Spine2: [4, -8, 0] }, bat: { pos: [-0.12, 1.55, 0.02], dir: [-0.25, 0.95, -0.15], roll: 0 } };

// ------------------------------------------------------------------ cycles

function runCycle(name: string, period: number, stride: number, armSwing: number, lean: number, batArm = false): THREE.AnimationClip {
  // Four poses per step (contact, down, passing, up); the second step mirrors the first.
  const step = (left: boolean, phase: 0 | 1 | 2 | 3): Pose => {
    const f = left ? 'Left' : 'Right';
    const b = left ? 'Right' : 'Left';
    const reach = [-stride, -stride * 0.55, -stride * 0.1, stride * 0.15][phase];
    const back = [stride * 0.55, stride * 0.3, -stride * 0.45, -stride * 0.85][phase];
    const frontKnee = [12, 38, 70, 95][phase];
    const backKnee = [35, 20, 95, 70][phase];
    const swing = left ? armSwing : -armSwing;
    const bones: Partial<Record<string, V3>> = {
      [`${f}UpLeg`]: [reach, 0, left ? 3 : -3],
      [`${b}UpLeg`]: [back, 0, left ? -3 : 3],
      [`${f}Leg`]: [frontKnee, 0, 0],
      [`${b}Leg`]: [backKnee, 0, 0],
      [`${f}Foot`]: [phase === 0 ? -12 : phase === 1 ? 5 : 20, 0, 0],
      [`${b}Foot`]: [phase === 0 ? 25 : phase === 1 ? 35 : -5, 0, 0],
      LeftArm: [swing * (phase < 2 ? 1 : 0.4), 0, 9],
      RightArm: batArm ? [-38, 0, -10] : [-swing * (phase < 2 ? 1 : 0.4), 0, -9],
      LeftForeArm: [-82, 0, 0],
      RightForeArm: [batArm ? -50 : -82, 0, 0],
      Hips: [0, left ? -6 : 6, 0],
      Spine: [lean, 0, 0],
      Spine2: [3, left ? 10 : -10, 0],
      Neck: [-lean * 0.5, left ? -4 : 4, 0],
    };
    return { hips: [0, [-0.035, -0.06, 0.01, 0.04][phase], 0], bones };
  };
  const q = period / 8;
  return buildClip(
    name,
    [
      { t: 0, pose: step(true, 0) },
      { t: q, pose: step(true, 1) },
      { t: 2 * q, pose: step(true, 2) },
      { t: 3 * q, pose: step(true, 3) },
      { t: 4 * q, pose: step(false, 0) },
      { t: 5 * q, pose: step(false, 1) },
      { t: 6 * q, pose: step(false, 2) },
      { t: 7 * q, pose: step(false, 3) },
      { t: period, pose: step(true, 0) },
    ],
    { loop: true },
  );
}

function walkCycle(name: string, headDown = 0): THREE.AnimationClip {
  const a = (front: boolean): Pose => ({
    hips: [0, -0.015, 0],
    bones: {
      LeftUpLeg: [front ? -22 : 16, 0, 2], RightUpLeg: [front ? 16 : -22, 0, -2],
      LeftLeg: [front ? 8 : 28, 0, 0], RightLeg: [front ? 28 : 8, 0, 0],
      LeftArm: [front ? 16 : -14, 0, 6], RightArm: [front ? -14 : 16, 0, -6],
      LeftForeArm: [-15, 0, 0], RightForeArm: [-15, 0, 0],
      Spine: [3, 0, 0], Neck: [headDown, 0, 0], Head: [headDown * 0.6, 0, 0],
    },
  });
  return buildClip(name, [
    { t: 0, pose: a(true) },
    { t: 0.55, pose: a(false) },
    { t: 1.1, pose: a(true) },
  ], { loop: true });
}

// ------------------------------------------------------------------ bowling

/** Seconds into the delivery clips at which the ball leaves the hand. */
export const RELEASE_SEC = { PACE: 0.42, SPIN: 0.4 } as const;

function delivery(name: string, spin: boolean): THREE.AnimationClip {
  const r = spin ? RELEASE_SEC.SPIN : RELEASE_SEC.PACE;
  const jump = spin ? 0.06 : 0.16;
  return buildClip(name, [
    { t: 0, pose: { hips: [0, jump, 0], bones: { LeftUpLeg: [-60, 0, 0], LeftLeg: [80, 0, 0], RightUpLeg: [10, 0, 0], RightLeg: [45, 0, 0], LeftArm: [-120, 0, 10], RightArm: [-60, 0, -10], LeftForeArm: [-40, 0, 0], RightForeArm: [-70, 0, 0], Spine: [-4, 0, 0] } } },
    { t: r * 0.48, pose: { hips: [0, 0, 0], bones: { LeftUpLeg: [-50, 0, 0], LeftLeg: [40, 0, 0], RightUpLeg: [6, 0, 0], RightLeg: [12, 0, 0], LeftArm: [-165, 0, 15], RightArm: [40, 0, -10], RightForeArm: [-10, 0, 0], Spine: [-6, 0, 0], Spine2: [0, -60, 0], Neck: [0, 30, 0], Head: [0, 25, 0] } } },
    { t: r * 0.76, pose: { hips: [0, -0.05, 0], bones: { LeftUpLeg: [-35, 0, 0], LeftLeg: [6, 0, 0], RightUpLeg: [25, 0, 0], RightLeg: [35, 0, 0], LeftArm: [-120, 0, 30], RightArm: [110, 0, -5], Spine: [4, 0, 0], Spine2: [0, -30, 0], Neck: [0, 15, 0], Head: [0, 10, 0] } } },
    { t: r, pose: { hips: [0, -0.06, 0], bones: { LeftUpLeg: [-30, 0, 0], LeftLeg: [4, 0, 0], RightUpLeg: [30, 0, 0], RightLeg: [45, 0, 0], LeftArm: [-40, 0, 25], RightArm: [spin ? 175 : 192, 0, -6], Spine: [spin ? 12 : 22, 0, 0], Spine2: [0, 8, 0] } } },
    { t: r + 0.14, pose: { hips: [0, -0.1, 0], bones: { LeftUpLeg: [-12, 0, 0], LeftLeg: [18, 0, 0], RightUpLeg: [-45, 0, 0], RightLeg: [40, 0, 0], LeftArm: [10, 0, 30], RightArm: [300, 0, 28], Spine: [spin ? 25 : 42, 0, 0], Spine2: [0, 38, 0] } } },
    { t: r + 0.34, pose: { hips: [0, -0.06, 0], bones: { LeftUpLeg: [-25, 0, 0], LeftLeg: [30, 0, 0], RightUpLeg: [-10, 0, 0], RightLeg: [40, 0, 0], LeftArm: [20, 0, 15], RightArm: [345, 0, 25], Spine: [25, 0, 0], Spine2: [0, 20, 0] } } },
    { t: r + 0.6, pose: { hips: [0, -0.02, 0], bones: { LeftUpLeg: [-10, 0, 0], RightUpLeg: [-8, 0, 0], LeftLeg: [12, 0, 0], RightLeg: [12, 0, 0], Spine: [8, 0, 0] } } },
  ]);
}

// ------------------------------------------------------------------ fielding

const READY: Pose = {
  hips: [0, -0.12, 0],
  bones: {
    LeftUpLeg: [-28, 0, 12], RightUpLeg: [-28, 0, -12], LeftLeg: [48, 0, 0], RightLeg: [48, 0, 0],
    LeftFoot: [-20, 0, 0], RightFoot: [-20, 0, 0], Spine: [26, 0, 0], Spine2: [10, 0, 0], Neck: [-20, 0, 0],
    LeftArm: [-40, 0, 12], RightArm: [-40, 0, -12], LeftForeArm: [-30, 0, 0], RightForeArm: [-30, 0, 0],
  },
};

const KEEPER_READY: Pose = {
  hips: [0, -0.52, 0],
  bones: {
    LeftUpLeg: [-90, 0, 28], RightUpLeg: [-90, 0, -28], LeftLeg: [118, 0, 0], RightLeg: [118, 0, 0],
    LeftFoot: [-28, 0, 0], RightFoot: [-28, 0, 0], Spine: [38, 0, 0], Spine2: [8, 0, 0], Neck: [-30, 0, 0],
    LeftArm: [-38, 0, -6], RightArm: [-38, 0, 6], LeftForeArm: [-25, 0, 0], RightForeArm: [-25, 0, 0],
  },
};

function throwing(): THREE.AnimationClip {
  return buildClip('Throwing', [
    { t: 0, pose: READY },
    { t: 0.2, pose: { hips: [0, -0.04, 0], bones: { LeftUpLeg: [-30, 0, 0], LeftLeg: [10, 0, 0], RightUpLeg: [15, 0, 0], RightLeg: [25, 0, 0], Spine2: [0, -65, 0], LeftArm: [-90, 0, 20], RightArm: [100, 0, -30], RightForeArm: [-60, 0, 0], Neck: [0, 40, 0] } } },
    { t: 0.34, pose: { hips: [0, -0.06, 0], bones: { LeftUpLeg: [-30, 0, 0], RightUpLeg: [20, 0, 0], RightLeg: [30, 0, 0], Spine: [10, 0, 0], Spine2: [0, -20, 0], LeftArm: [-30, 0, 30], RightArm: [200, 0, -20], RightForeArm: [-70, 0, 0] } } },
    { t: 0.42, pose: { hips: [0, -0.08, 0], bones: { LeftUpLeg: [-25, 0, 0], RightUpLeg: [5, 0, 0], RightLeg: [30, 0, 0], Spine: [28, 0, 0], Spine2: [0, 25, 0], LeftArm: [10, 0, 25], RightArm: [270, 0, 10], RightForeArm: [-5, 0, 0] } } },
    { t: 0.7, pose: { hips: [0, -0.08, 0], bones: { LeftUpLeg: [-15, 0, 0], RightUpLeg: [-30, 0, 0], RightLeg: [35, 0, 0], Spine: [32, 0, 0], Spine2: [0, 35, 0], RightArm: [330, 0, 35] } } },
    { t: 1.1, pose: { hips: [0, -0.02, 0], bones: { Spine: [6, 0, 0] } } },
  ]);
}

function catching(): THREE.AnimationClip {
  const hands: Pose = { hips: [0, -0.08, 0], bones: { ...READY.bones, Spine: [8, 0, 0], Neck: [-25, 0, 0], LeftArm: [-115, 0, -14], RightArm: [-115, 0, 14], LeftForeArm: [-35, 0, 0], RightForeArm: [-35, 0, 0] } };
  const absorb: Pose = { hips: [0, -0.16, 0], bones: { ...READY.bones, Spine: [18, 0, 0], Neck: [10, 0, 0], LeftArm: [-70, 0, -18], RightArm: [-70, 0, 18], LeftForeArm: [-95, 0, 0], RightForeArm: [-95, 0, 0] } };
  return buildClip('Catching', [
    { t: 0, pose: READY },
    { t: 0.3, pose: hands },
    { t: 0.5, pose: hands },
    { t: 0.75, pose: absorb },
    { t: 1.4, pose: absorb },
  ]);
}

function fieldingStop(): THREE.AnimationClip {
  const low: Pose = {
    hips: [0, -0.42, 0],
    bones: { LeftUpLeg: [-80, 0, 10], LeftLeg: [100, 0, 0], RightUpLeg: [-30, 0, -10], RightLeg: [110, 0, 0], Spine: [55, 0, 0], Spine2: [15, 0, 0], Neck: [-30, 0, 0], RightArm: [-75, 0, 0], LeftArm: [-60, 0, 10], RightForeArm: [-10, 0, 0], LeftForeArm: [-20, 0, 0] },
  };
  return buildClip('FieldingStop', [
    { t: 0, pose: READY },
    { t: 0.3, pose: low },
    { t: 0.55, pose: low },
    { t: 0.9, pose: READY },
  ]);
}

function dive(): THREE.AnimationClip {
  const flying: Pose = { hips: [0.35, -0.55, 0], bones: { Hips: [0, 0, 70], LeftArm: [0, 0, 165], RightArm: [0, 0, -140], LeftUpLeg: [0, 0, 10], RightUpLeg: [0, 0, -20], RightLeg: [30, 0, 0], Spine: [0, 0, 5], Neck: [0, 0, -40] } };
  const ground: Pose = { hips: [0.55, -0.82, 0], bones: { ...flying.bones, Hips: [0, 0, 85] } };
  return buildClip('FieldingDive', [
    { t: 0, pose: READY },
    { t: 0.25, pose: flying },
    { t: 0.45, pose: ground },
    { t: 1.2, pose: ground },
    { t: 1.8, pose: READY },
  ]);
}

function keeperCatch(): THREE.AnimationClip {
  const take: Pose = { hips: [0, -0.3, 0], bones: { ...KEEPER_READY.bones, LeftUpLeg: [-55, 0, 25], RightUpLeg: [-55, 0, -25], LeftLeg: [70, 0, 0], RightLeg: [70, 0, 0], Spine: [15, 0, 0], LeftArm: [-80, 0, -10], RightArm: [-80, 0, 10], LeftForeArm: [-50, 0, 0], RightForeArm: [-50, 0, 0] } };
  return buildClip('WicketkeeperAction', [
    { t: 0, pose: KEEPER_READY },
    { t: 0.25, pose: take },
    { t: 0.6, pose: { ...take, bones: { ...take.bones, LeftForeArm: [-100, 0, 0], RightForeArm: [-100, 0, 0] } } },
    { t: 1.2, pose: { ...take, bones: { ...take.bones, LeftForeArm: [-100, 0, 0], RightForeArm: [-100, 0, 0] } } },
  ]);
}

function celebration(): THREE.AnimationClip {
  const up: Pose = { hips: [0, 0.3, 0], bones: { LeftArm: [0, 0, 165], RightArm: [0, 0, -165], LeftUpLeg: [-40, 0, 6], RightUpLeg: [-30, 0, -6], LeftLeg: [70, 0, 0], RightLeg: [60, 0, 0], Neck: [-20, 0, 0] } };
  const land: Pose = { hips: [0, -0.12, 0], bones: { LeftArm: [-30, 0, 60], RightArm: [-30, 0, -60], LeftForeArm: [-110, 0, 0], RightForeArm: [-110, 0, 0], LeftUpLeg: [-25, 0, 8], RightUpLeg: [-25, 0, -8], LeftLeg: [45, 0, 0], RightLeg: [45, 0, 0] } };
  return buildClip('Celebration', [
    { t: 0, pose: { hips: [0, -0.1, 0], bones: { LeftUpLeg: [-25, 0, 0], RightUpLeg: [-25, 0, 0], LeftLeg: [45, 0, 0], RightLeg: [45, 0, 0] } } },
    { t: 0.25, pose: up },
    { t: 0.5, pose: land },
    { t: 0.75, pose: up },
    { t: 1.0, pose: land },
    { t: 1.6, pose: { bones: { LeftArm: [0, 0, 150], RightArm: [0, 0, -150] } } },
  ]);
}

function dismissal(): THREE.AnimationClip {
  const slump: Pose = { hips: [0, -0.02, 0], bones: { Neck: [32, 0, 0], Head: [22, 0, 0], Spine: [12, 0, 0], LeftArm: [10, 0, 38], RightArm: [10, 0, -38], LeftForeArm: [-95, 0, 0], RightForeArm: [-95, 0, 0] } };
  return buildClip('DismissalReaction', [
    { t: 0, pose: STANCE },
    { t: 0.5, pose: slump },
    { t: 1.6, pose: { ...slump, bones: { ...slump.bones, Neck: [38, -10, 0] } } },
  ]);
}

function idle(): THREE.AnimationClip {
  const a: Pose = { bones: { Spine2: [2, 0, 0], LeftArm: [0, 0, 7], RightArm: [0, 0, -7], LeftForeArm: [-8, 0, 0], RightForeArm: [-8, 0, 0] } };
  const b: Pose = { hips: [0, -0.008, 0], bones: { Spine2: [4, 0, 0], LeftArm: [2, 0, 9], RightArm: [2, 0, -9], LeftForeArm: [-10, 0, 0], RightForeArm: [-10, 0, 0], Head: [0, 6, 0] } };
  return buildClip('Idle', [
    { t: 0, pose: a },
    { t: 1.5, pose: b },
    { t: 3, pose: a },
  ], { loop: true });
}

function battingIdle(): THREE.AnimationClip {
  const tap: Pose = { ...STANCE, bat: { ...STANCE.bat!, pos: [-0.04, 0.89, 0.3] } };
  return buildClip('BattingIdle', [
    { t: 0, pose: STANCE },
    { t: 0.8, pose: tap },
    { t: 1.6, pose: STANCE },
  ], { loop: true });
}

function keeperIdle(): THREE.AnimationClip {
  return buildClip('WicketkeeperReady', [
    { t: 0, pose: KEEPER_READY },
    { t: 1, pose: { ...KEEPER_READY, hips: [0, -0.5, 0] } },
    { t: 2, pose: KEEPER_READY },
  ], { loop: true });
}

function fieldingReady(): THREE.AnimationClip {
  return buildClip('FieldingReady', [
    { t: 0, pose: READY },
    { t: 0.6, pose: { ...READY, hips: [0, -0.1, 0] } },
    { t: 1.2, pose: READY },
  ], { loop: true });
}

function umpire(name: string, signal: Pose, wave = false): THREE.AnimationClip {
  const keys: Key[] = [{ t: 0, pose: {} }, { t: 0.35, pose: signal }];
  if (wave) {
    const b = signal.bones ?? {};
    keys.push(
      { t: 0.65, pose: { bones: { ...b, RightArm: [-90, 45, 0] } } },
      { t: 0.95, pose: { bones: { ...b, RightArm: [-90, -35, 0] } } },
      { t: 1.25, pose: { bones: { ...b, RightArm: [-90, 45, 0] } } },
    );
  }
  keys.push({ t: 1.9, pose: signal }, { t: 2.4, pose: {} });
  return buildClip(name, keys);
}


// ------------------------------------------------------------------ more batting

/** The batter's trigger as the bowler arrives: a small back-and-across step and the backlift. */
function battingReady(): THREE.AnimationClip {
  const trigger: Pose = {
    hips: [-0.02, -0.08, 0.02],
    bones: { ...STANCE.bones, RightUpLeg: [-18, 0, -6], LeftUpLeg: [-12, 0, 7], Spine2: [10, -6, 0] },
    bat: { pos: [-0.14, 1.12, 0.25], dir: [-0.5, 0.82, -0.05], roll: 0 },
  };
  return buildClip('BattingReady', [
    { t: 0, pose: STANCE },
    { t: 0.3, pose: trigger },
    { t: 0.55, pose: BACKLIFT },
    { t: 1.2, pose: BACKLIFT },
  ]);
}

const BACK_DEFENCE: Pose = { hips: [-0.06, -0.05, 0.05], bones: { ...BACK_FOOT, Spine: [8, 0, 0], Spine2: [10, -6, 0], Neck: [14, 36, 0], Head: [12, 34, 0] }, bat: { pos: [0.06, 0.98, 0.37], dir: [0.02, -1, 0.06], roll: 90 } };

const COVER_BODY = (lean: number): Partial<Record<string, V3>> => ({
  LeftUpLeg: [-30, 0, 22], RightUpLeg: [-2, 0, -12],
  LeftLeg: [38, 0, 0], RightLeg: [16, 0, 0],
  LeftFoot: [-14, 0, 0], RightFoot: [-6, 0, 0],
  Spine: [14 + lean, -6, -8], Spine2: [18 + lean, -12, -6],
  Neck: [18, 40, 0], Head: [16, 34, 0],
});
const COVER_CONTACT: Pose = { hips: [0.13, -0.14, 0.06], bones: COVER_BODY(6), bat: { pos: [0.22, 0.74, 0.47], dir: [0.12, -1, 0.18], roll: 70 } };
const COVER_FOLLOW: Pose = { hips: [0.14, -0.1, 0.06], bones: { ...COVER_BODY(2), Spine2: [10, 10, -6] }, bat: { pos: [0.12, 1.34, 0.42], dir: [0.3, 0.75, 0.6], roll: 70 } };

// ------------------------------------------------------------------ running

function runTurn(): THREE.AnimationClip {
  const reach: Pose = {
    hips: [0, -0.22, 0],
    bones: { Spine: [38, 0, 0], Spine2: [12, 0, 0], LeftUpLeg: [-70, 0, 6], LeftLeg: [85, 0, 0], RightUpLeg: [15, 0, -6], RightLeg: [60, 0, 0], RightArm: [-70, 0, -8], RightForeArm: [-15, 0, 0], LeftArm: [25, 0, 12], LeftForeArm: [-40, 0, 0] },
  };
  return buildClip('RunTurn', [
    { t: 0, pose: { bones: { Spine: [16, 0, 0], RightArm: [-38, 0, -10], RightForeArm: [-50, 0, 0], LeftForeArm: [-82, 0, 0] } } },
    { t: 0.22, pose: reach },
    { t: 0.5, pose: { hips: [0, -0.06, 0], bones: { Spine: [18, 0, 0], RightArm: [-38, 0, -10], RightForeArm: [-50, 0, 0], LeftForeArm: [-82, 0, 0] } } },
  ]);
}

function slideBat(): THREE.AnimationClip {
  const slide: Pose = {
    hips: [0, -0.3, 0],
    bones: { Spine: [45, 0, 0], Spine2: [12, 0, 0], Neck: [-25, 0, 0], LeftUpLeg: [-78, 0, 8], LeftLeg: [70, 0, 0], RightUpLeg: [30, 0, -6], RightLeg: [35, 0, 0], RightFoot: [30, 0, 0], RightArm: [-82, 0, -6], RightForeArm: [-6, 0, 0], LeftArm: [30, 0, 20], LeftForeArm: [-30, 0, 0] },
  };
  return buildClip('SlideBat', [
    { t: 0, pose: { hips: [0, -0.03, 0], bones: { Spine: [16, 0, 0], RightArm: [-38, 0, -10], RightForeArm: [-50, 0, 0] } } },
    { t: 0.28, pose: slide },
    { t: 1.0, pose: slide },
    { t: 1.5, pose: { hips: [0, -0.02, 0], bones: { Spine: [6, 0, 0], RightArm: [-20, 0, -8], RightForeArm: [-30, 0, 0] } } },
  ]);
}

// ------------------------------------------------------------------ reactions

function appeal(): THREE.AnimationClip {
  const shout: Pose = {
    hips: [0, -0.04, 0],
    bones: { Hips: [0, 20, 0], Spine: [-8, 0, 0], Spine2: [-12, 10, 0], Neck: [-18, 0, 0], LeftArm: [-165, 0, 25], RightArm: [-150, 0, -30], LeftForeArm: [-15, 0, 0], RightForeArm: [-20, 0, 0], LeftUpLeg: [-30, 0, 5], LeftLeg: [40, 0, 0], RightUpLeg: [5, 0, -4] },
  };
  return buildClip('BowlerAppeal', [
    { t: 0, pose: {} },
    { t: 0.22, pose: shout },
    { t: 0.5, pose: { ...shout, bones: { ...shout.bones, LeftArm: [-175, 0, 20], RightArm: [-160, 0, -25] } } },
    { t: 1.3, pose: shout },
  ]);
}

function disappointment(): THREE.AnimationClip {
  const hands: Pose = { bones: { Neck: [-22, 0, 0], Head: [-10, 0, 0], Spine2: [-6, 0, 0], LeftArm: [-140, 0, 45], RightArm: [-140, 0, -45], LeftForeArm: [-125, 0, 0], RightForeArm: [-125, 0, 0] } };
  return buildClip('Disappointment', [
    { t: 0, pose: {} },
    { t: 0.35, pose: hands },
    { t: 1.4, pose: { ...hands, bones: { ...hands.bones, Neck: [-10, 15, 0] } } },
    { t: 2.0, pose: { bones: { Neck: [15, 0, 0], LeftArm: [5, 0, 30], RightArm: [5, 0, -30], LeftForeArm: [-90, 0, 0], RightForeArm: [-90, 0, 0] } } },
  ]);
}

function keeperCollect(): THREE.AnimationClip {
  const take: Pose = { hips: [0, -0.32, 0], bones: { ...KEEPER_READY.bones, LeftUpLeg: [-55, 0, 25], RightUpLeg: [-55, 0, -25], LeftLeg: [70, 0, 0], RightLeg: [70, 0, 0], Spine: [18, 0, 0], LeftArm: [-80, 0, -10], RightArm: [-80, 0, 10], LeftForeArm: [-55, 0, 0], RightForeArm: [-55, 0, 0] } };
  const toStumps: Pose = { hips: [0, -0.2, 0.2], bones: { ...take.bones, Spine: [35, 0, 0], Spine2: [0, 25, 0], LeftArm: [-70, 25, -10], RightArm: [-70, 25, 10], LeftForeArm: [-25, 0, 0], RightForeArm: [-25, 0, 0] } };
  return buildClip('WicketkeeperCollect', [
    { t: 0, pose: KEEPER_READY },
    { t: 0.22, pose: take },
    { t: 0.5, pose: toStumps },
    { t: 1.2, pose: toStumps },
  ]);
}

// ------------------------------------------------------------------ registry

/**
 * The mirror image of a clip, for left-handed batters and left-arm bowlers:
 * Left and Right tracks swap, and every rotation and x offset is reflected.
 * (Bones rest with identity rotations, so reflecting x maps a quaternion
 * (x, y, z, w) to (x, -y, -z, w).)
 */
export function mirrorClip(clip: THREE.AnimationClip): THREE.AnimationClip {
  const tracks = clip.tracks.map((track) => {
    const [node, prop] = track.name.split('.');
    const swapped = node.startsWith('Left') ? `Right${node.slice(4)}` : node.startsWith('Right') ? `Left${node.slice(5)}` : node;
    const values = Float32Array.from(track.values);
    if (prop === 'quaternion') {
      for (let i = 0; i < values.length; i += 4) {
        values[i + 1] = -values[i + 1];
        values[i + 2] = -values[i + 2];
      }
      return new THREE.QuaternionKeyframeTrack(`${swapped}.${prop}`, Array.from(track.times), Array.from(values));
    }
    for (let i = 0; i < values.length; i += 3) values[i] = -values[i];
    return new THREE.VectorKeyframeTrack(`${swapped}.${prop}`, Array.from(track.times), Array.from(values));
  });
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

const cache: { right: Record<string, THREE.AnimationClip> | null; left: Record<string, THREE.AnimationClip> | null } = { right: null, left: null };

/** Every clip, built once; `mirrored` gives the left-handed set. */
export function cricketClips(mirrored = false): Record<string, THREE.AnimationClip> {
  if (mirrored) {
    cache.left ??= Object.fromEntries(Object.entries(cricketClips(false)).map(([k, c]) => [k, mirrorClip(c)]));
    return cache.left;
  }
  if (cache.right) return cache.right;
  const list = [
    idle(),
    battingIdle(),
    shot('BattingDrive', DRIVE_CONTACT, DRIVE_FOLLOW),
    shot('BattingCoverDrive', COVER_CONTACT, COVER_FOLLOW),
    shot('BattingBackDefence', BACK_DEFENCE, BACK_DEFENCE, [{ t: 0.62, pose: BACK_DEFENCE }]),
    battingReady(),
    runTurn(),
    slideBat(),
    appeal(),
    disappointment(),
    keeperCollect(),
    umpire('UmpireNoBall', { bones: { RightArm: [0, 0, -88], RightForeArm: [0, 0, 0] } }),
    umpire('UmpireBye', { bones: { RightArm: [-165, 0, -12], RightForeArm: [-8, 0, 0] } }),
    shot('BattingDefence', DEFENCE_CONTACT, { ...DEFENCE_CONTACT, bat: { pos: [0.18, 0.8, 0.36], dir: [0.02, -1, 0.04], roll: 90 } }, [{ t: 0.62, pose: DEFENCE_CONTACT }]),
    shot('BattingLoftedShot', LOFT_CONTACT, LOFT_FOLLOW),
    shot('BattingCut', CUT_CONTACT, CUT_FOLLOW),
    shot('BattingPull', PULL_CONTACT, PULL_FOLLOW),
    shot('BattingSweep', SWEEP_CONTACT, SWEEP_FOLLOW),
    // Played and missed: a drive whose bat comes through inside the line, head turning to the keeper.
    shot('MissedShot', { ...DRIVE_CONTACT, bat: { pos: [0.18, 0.8, 0.2], dir: [0.1, -1, -0.15], roll: 90 } }, { ...DRIVE_CONTACT, bones: { ...DRIVE_CONTACT.bones, Neck: [10, -30, 0], Head: [0, -20, 0] }, bat: { pos: [0.1, 1.0, 0.18], dir: [0.4, 0.2, -0.3], roll: 90 } }),
    buildClip('BattingLeave', [
      { t: 0, pose: STANCE },
      { t: 0.25, pose: BACKLIFT },
      { t: SHOT_CONTACT_SEC, pose: LEAVE_POSE },
      { t: 1.0, pose: LEAVE_POSE },
      { t: 1.35, pose: { ...LEAVE_POSE, bones: { ...LEAVE_POSE.bones, Neck: [6, 0, 0], Head: [4, -20, 0] } } },
    ]),
    runCycle('BowlingRunUp', 0.62, 42, 55, 14),
    delivery('BowlingDelivery', false),
    delivery('SpinDelivery', true),
    runCycle('RunBetweenWickets', 0.64, 44, 40, 16, true),
    runCycle('Sprint', 0.56, 50, 60, 18),
    walkCycle('WalkBack', 18),
    walkCycle('Walk'),
    fieldingReady(),
    fieldingStop(),
    dive(),
    catching(),
    throwing(),
    keeperIdle(),
    keeperCatch(),
    celebration(),
    dismissal(),
    buildClip('UmpireIdle', [{ t: 0, pose: { bones: { LeftArm: [-8, 0, 10], RightArm: [-8, 0, -10], LeftForeArm: [-60, 0, 0], RightForeArm: [-60, 0, 0] } } }, { t: 1, pose: { hips: [0, -0.01, 0], bones: { LeftArm: [-11, 0, 10], RightArm: [-11, 0, -10], LeftForeArm: [-64, 0, 0], RightForeArm: [-64, 0, 0], Head: [0, 8, 0] } } }, { t: 2, pose: { bones: { LeftArm: [-8, 0, 10], RightArm: [-8, 0, -10], LeftForeArm: [-60, 0, 0], RightForeArm: [-60, 0, 0] } } }], { loop: true }),
    umpire('UmpireOut', { bones: { RightArm: [-178, 0, 4], RightForeArm: [0, 0, 0], Neck: [-5, 0, 0] } }),
    umpire('UmpireFour', { bones: { RightArm: [-90, 45, 0] } }, true),
    umpire('UmpireSix', { bones: { LeftArm: [0, 0, 175], RightArm: [0, 0, -175] } }),
    umpire('UmpireWide', { bones: { LeftArm: [0, 0, 90], RightArm: [0, 0, -90] } }),
  ];
  cache.right = Object.fromEntries(list.map((c) => [c.name, c]));
  return cache.right;
}
