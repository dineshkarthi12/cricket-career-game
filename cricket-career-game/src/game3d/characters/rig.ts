/**
 * Procedural rigged cricketers.
 *
 * Each character is a real `THREE.SkinnedMesh` bound to a real `THREE.Skeleton`.
 * The body is modelled from anatomical shapes (a lathed torso, tapered limbs
 * with rounded joints, a head with a face, hands and shoes) and skinned
 * automatically: every vertex of a flexible part is weighted between its bone
 * and the neighbouring bones by distance to each bone's segment, so shoulders,
 * elbows, wrists, the spine, hips and knees bend smoothly instead of folding
 * like hinges. Equipment (pads, helmet, gloves, shoes) is rigid.
 *
 * This is an original, procedural model - not a scanned or purchased asset -
 * and the Lab labels it as such. Bone names follow the Mixamo convention so a
 * licensed rigged model can drive or replace it (`characters/retarget.ts`).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface BoneSpec {
  name: string;
  parent: string | null;
  /** Rest position relative to the parent, metres. Character faces +Z, left is +X. */
  pos: [number, number, number];
}

const side = (s: 'Left' | 'Right', x: number) => (s === 'Left' ? x : -x);

function limbBones(s: 'Left' | 'Right'): BoneSpec[] {
  return [
    { name: `${s}Shoulder`, parent: 'Spine2', pos: [side(s, 0.05), 0.12, 0] },
    { name: `${s}Arm`, parent: `${s}Shoulder`, pos: [side(s, 0.13), 0, 0] },
    { name: `${s}ForeArm`, parent: `${s}Arm`, pos: [0, -0.3, 0] },
    { name: `${s}Hand`, parent: `${s}ForeArm`, pos: [0, -0.27, 0] },
    { name: `${s}UpLeg`, parent: 'Hips', pos: [side(s, 0.095), -0.05, 0] },
    { name: `${s}Leg`, parent: `${s}UpLeg`, pos: [0, -0.44, 0] },
    { name: `${s}Foot`, parent: `${s}Leg`, pos: [0, -0.42, 0] },
    { name: `${s}ToeBase`, parent: `${s}Foot`, pos: [0, -0.06, 0.12] },
  ];
}

export const BONES: BoneSpec[] = [
  { name: 'Hips', parent: null, pos: [0, 1.0, 0] },
  { name: 'Spine', parent: 'Hips', pos: [0, 0.1, 0] },
  { name: 'Spine1', parent: 'Spine', pos: [0, 0.14, 0] },
  { name: 'Spine2', parent: 'Spine1', pos: [0, 0.14, 0] },
  { name: 'Neck', parent: 'Spine2', pos: [0, 0.17, 0] },
  { name: 'Head', parent: 'Neck', pos: [0, 0.08, 0] },
  ...limbBones('Left'),
  ...limbBones('Right'),
];

export const BONE_NAMES = BONES.map((b) => b.name);
export const HIPS_HEIGHT = 1.0;

/** Bones a clip or an imported skeleton must have for the cricket clips to drive it. */
export const REQUIRED_BONES = [
  'Hips', 'Spine', 'Spine2', 'Neck', 'Head',
  'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot',
];

export type Outfit = 'BATTER' | 'KEEPER' | 'FIELDER' | 'BOWLER' | 'UMPIRE';
export type Detail = 'low' | 'high';

export interface Kit {
  shirt: string;
  trim: string;
  trousers: string;
  skin: string;
  helmet: string;
  /** Hair colour; defaults to near-black. */
  hair?: string;
}

// ------------------------------------------------------------------ rest pose

function restWorldPositions(): Map<string, THREE.Vector3> {
  const map = new Map<string, THREE.Vector3>();
  for (const b of BONES) {
    const p = new THREE.Vector3(...b.pos);
    if (b.parent) p.add(map.get(b.parent)!);
    map.set(b.name, p);
  }
  return map;
}

const REST = restWorldPositions();
const P = (name: string) => REST.get(name)!.clone();

/** World position of a bone in the rest pose (used by IK and tests). */
export function restPosition(name: string): THREE.Vector3 {
  return P(name);
}

/** Each bone's segment in the rest pose: from the joint to its child (or a leaf extension). */
const LEAF_END: Record<string, [number, number, number]> = {
  Head: [0, 0.2, 0.02],
  LeftHand: [0, -0.1, 0],
  RightHand: [0, -0.1, 0],
  LeftToeBase: [0, -0.01, 0.08],
  RightToeBase: [0, -0.01, 0.08],
};
const SEGMENT = new Map<string, [THREE.Vector3, THREE.Vector3]>();
for (const b of BONES) {
  const a = P(b.name);
  const child = BONES.find((c) => c.parent === b.name && !c.name.includes('Shoulder') && !c.name.includes('UpLeg'));
  const end = child ? P(child.name) : a.clone().add(new THREE.Vector3(...(LEAF_END[b.name] ?? [0, 0.05, 0])));
  SEGMENT.set(b.name, [a, end]);
}

const _ab = new THREE.Vector3();
const _ap = new THREE.Vector3();
function distToSegment(p: THREE.Vector3, bone: string): number {
  const [a, b] = SEGMENT.get(bone)!;
  _ab.subVectors(b, a);
  _ap.subVectors(p, a);
  const t = Math.max(0, Math.min(1, _ap.dot(_ab) / Math.max(1e-9, _ab.lengthSq())));
  return _ap.sub(_ab.multiplyScalar(t)).length();
}

// ------------------------------------------------------------------ shape helpers

/** A tapered tube from a to b with rounded ends, in rest-pose world space. */
function tube(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, radial: number, rings = 4, caps = true): THREE.BufferGeometry {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const parts: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(r1, r0, len, radial, rings, true)];
  if (caps) {
    const top = new THREE.SphereGeometry(r1, radial, Math.max(3, radial / 3), 0, Math.PI * 2, 0, Math.PI / 2);
    top.translate(0, len / 2, 0);
    const bottom = new THREE.SphereGeometry(r0, radial, Math.max(3, radial / 3), 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    bottom.translate(0, -len / 2, 0);
    parts.push(top, bottom);
  }
  const g = mergeGeometries(parts.map((p) => p.toNonIndexed()))!;
  parts.forEach((p) => p.dispose());
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  g.applyQuaternion(q);
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

function ellipsoid(c: THREE.Vector3, rx: number, ry: number, rz: number, w: number, h: number): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, w, h);
  g.scale(rx, ry, rz);
  g.translate(c.x, c.y, c.z);
  return g;
}

function roundedBox(c: THREE.Vector3, sx: number, sy: number, sz: number, round = 0.35, seg = 3): THREE.BufferGeometry {
  // A box pushed toward an ellipsoid: soft edges without many triangles.
  const g = new THREE.BoxGeometry(1, 1, 1, seg, seg, seg);
  const pos = g.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i);
    const s = v.clone().normalize().multiplyScalar(0.5);
    v.lerp(s.multiplyScalar(1.15), round);
    pos.setXYZ(i, v.x * sx, v.y * sy, v.z * sz);
  }
  g.computeVertexNormals();
  g.translate(c.x, c.y, c.z);
  return g;
}

/** A body shell turned on the Y axis from (radius, height) pairs, squashed front-to-back. */
function lathe(profile: [number, number][], depth: number, radial: number, cx = 0, cz = 0): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), radial);
  g.scale(1, 1, depth);
  g.translate(cx, 0, cz);
  return g;
}

// ------------------------------------------------------------------ parts

interface Part {
  geometry: THREE.BufferGeometry;
  color: string;
  /** Bones this part may be weighted to (by distance). One bone = rigid. */
  bones: string[];
  /** Shading variation: darken toward the bottom of the part. */
  shade?: number;
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function partsFor(outfit: Outfit, kit: Kit, detail: Detail): Part[] {
  const R = detail === 'high' ? 14 : 9;
  const padded = outfit === 'BATTER' || outfit === 'KEEPER';
  const umpire = outfit === 'UMPIRE';
  const shirt = umpire ? '#f3efe3' : kit.shirt;
  const trousers = umpire ? '#1c2232' : kit.trousers;
  const shoe = umpire ? '#14181f' : '#f4f4f2';
  const hair = kit.hair ?? '#17110d';
  const parts: Part[] = [];
  const add = (geometry: THREE.BufferGeometry, color: string, bones: string[], shade = 0) => parts.push({ geometry, color, bones, shade });

  // --- torso: shirt from the waist to the collar, trousers below ---------------
  add(
    lathe(
      [
        [0.001, 0.93], [0.152, 0.93], [0.156, 0.99], [0.146, 1.07], [0.15, 1.16], [0.168, 1.26], [0.185, 1.36], [0.19, 1.43],
        [0.17, 1.49], [0.12, 1.525], [0.07, 1.545], [0.001, 1.548],
      ],
      0.62,
      R + 4,
    ),
    shirt,
    ['Hips', 'Spine', 'Spine1', 'Spine2'],
    0.12,
  );
  if (umpire) {
    // The umpire's coat hangs to mid-thigh.
    add(lathe([[0.172, 0.74], [0.178, 0.86], [0.17, 0.98], [0.162, 1.08], [0.001, 1.081]], 0.7, R + 4), '#f3efe3', ['Hips', 'Spine'], 0.15);
  }
  add(lathe([[0.001, 0.82], [0.135, 0.82], [0.158, 0.9], [0.158, 0.98], [0.001, 0.981]], 0.7, R + 4), trousers, ['Hips', 'LeftUpLeg', 'RightUpLeg'], 0.1);
  add(lathe([[0.16, 0.955], [0.161, 0.985], [0.001, 0.986]], 0.68, R + 4), umpire ? '#111' : '#1a1a1a', ['Hips']);
  // Collar and a trim stripe across the chest.
  add(new THREE.TorusGeometry(0.075, 0.016, 6, R + 2).rotateX(Math.PI / 2).scale(1, 1, 0.8).translate(0, 1.535, 0), umpire ? '#1c2232' : kit.trim, ['Spine2', 'Neck']);
  if (!umpire) add(lathe([[0.188, 1.405], [0.19, 1.425], [0.001, 1.426]], 0.63, R + 4), kit.trim, ['Spine2']);

  // --- neck and head ---------------------------------------------------------------
  add(tube(v(0, 1.5, -0.005), v(0, 1.66, 0.005), 0.052, 0.046, R), kit.skin, ['Spine2', 'Neck', 'Head']);
  const head = v(0, 1.72, 0.012);
  add(ellipsoid(head, 0.094, 0.112, 0.105, R + 2, R), kit.skin, ['Head']);
  add(ellipsoid(v(0, 1.655, 0.045), 0.07, 0.05, 0.07, R, 6), kit.skin, ['Head']); // jaw
  add(new THREE.ConeGeometry(0.016, 0.04, 6).rotateX(Math.PI / 2).translate(0, 1.71, 0.125), kit.skin, ['Head']); // nose
  for (const s of [-1, 1]) {
    add(ellipsoid(v(s * 0.094, 1.715, 0.005), 0.012, 0.026, 0.018, 6, 5), kit.skin, ['Head']); // ears
    add(ellipsoid(v(s * 0.034, 1.735, 0.1), 0.012, 0.009, 0.006, 6, 4), '#f5f2ea', ['Head']); // eyes
    add(ellipsoid(v(s * 0.034, 1.735, 0.105), 0.006, 0.007, 0.004, 5, 4), '#1d1410', ['Head']);
    add(new THREE.BoxGeometry(0.032, 0.007, 0.01).rotateZ(s * -0.12).translate(s * 0.034, 1.758, 0.104), hair, ['Head']); // brows
  }
  add(new THREE.BoxGeometry(0.036, 0.006, 0.008).translate(0, 1.67, 0.108), '#7a3f33', ['Head']); // mouth

  if (padded) {
    // Helmet: shell, peak, grille bars, ear guards, neck guard.
    const shell = new THREE.SphereGeometry(0.128, R + 2, 8, 0, Math.PI * 2, 0, Math.PI * 0.58).scale(1, 1.02, 1.08).translate(0, 1.722, 0.0);
    add(shell, kit.helmet, ['Head']);
    add(new THREE.CylinderGeometry(0.135, 0.135, 0.01, R + 2, 1, false, -Math.PI * 0.45, Math.PI * 0.9).scale(1, 1, 1.2).translate(0, 1.762, 0.03), kit.helmet, ['Head']);
    for (const y of [1.705, 1.672, 1.64]) add(new THREE.TorusGeometry(0.128, 0.0045, 4, R + 2, Math.PI * 0.8).rotateX(Math.PI / 2).rotateY(Math.PI * 0.1).scale(1, 1, 1.12).translate(0, y, 0.0), '#c9ced8', ['Head']);
    add(new THREE.BoxGeometry(0.006, 0.08, 0.006).translate(0, 1.672, 0.142), '#c9ced8', ['Head']);
    for (const s of [-1, 1]) add(ellipsoid(v(s * 0.122, 1.69, 0.005), 0.012, 0.05, 0.05, 8, 6), kit.helmet, ['Head']);
    add(new THREE.BoxGeometry(0.13, 0.05, 0.012).translate(0, 1.64, -0.105), kit.helmet, ['Head']);
  } else if (umpire) {
    add(new THREE.CylinderGeometry(0.1, 0.11, 0.08, R + 2).translate(0, 1.8, 0.0), '#f3efe3', ['Head']);
    add(new THREE.CylinderGeometry(0.21, 0.21, 0.01, R + 4).translate(0, 1.765, 0.01), '#f3efe3', ['Head']);
    add(new THREE.CylinderGeometry(0.102, 0.102, 0.018, R + 2).translate(0, 1.775, 0), '#1c2232', ['Head']);
  } else {
    add(new THREE.SphereGeometry(0.114, R + 2, 7, 0, Math.PI * 2, 0, Math.PI * 0.5).scale(1, 0.85, 1.05).translate(0, 1.745, 0.0), kit.shirt, ['Head']);
    add(new THREE.CylinderGeometry(0.12, 0.12, 0.01, R + 2, 1, false, -Math.PI * 0.4, Math.PI * 0.8).scale(1, 1, 1.45).translate(0, 1.75, 0.055), kit.trim, ['Head']);
    // Hair below the cap.
    add(new THREE.SphereGeometry(0.098, R, 6, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.3).scale(1, 1, 1.05).translate(0, 1.73, -0.006), hair, ['Head']);
  }

  // --- arms -----------------------------------------------------------------------
  for (const s of ['Left', 'Right'] as const) {
    const sh = P(`${s}Shoulder`);
    const arm = P(`${s}Arm`);
    const elbow = P(`${s}ForeArm`);
    const wrist = P(`${s}Hand`);
    const sign = s === 'Left' ? 1 : -1;
    // Deltoid: the shoulder cap where the arm meets the torso.
    add(ellipsoid(v(arm.x - sign * 0.01, arm.y - 0.02, 0), 0.07, 0.07, 0.068, R, 7), shirt, [`${s}Shoulder`, `${s}Arm`, 'Spine2']);
    add(tube(sh, arm, 0.06, 0.06, R, 2, false), shirt, ['Spine2', `${s}Shoulder`, `${s}Arm`]);
    // Short sleeve, then the bare upper arm and forearm.
    const sleeveEnd = arm.clone().lerp(elbow, 0.5);
    add(tube(arm, sleeveEnd, 0.058, 0.054, R, 3), shirt, [`${s}Shoulder`, `${s}Arm`]);
    add(tube(sleeveEnd, elbow, 0.044, 0.038, R, 3), kit.skin, [`${s}Arm`, `${s}ForeArm`]);
    add(tube(elbow, wrist, 0.039, 0.028, R, 4), kit.skin, [`${s}Arm`, `${s}ForeArm`, `${s}Hand`]);
    // Hand: palm, fingers curled forward, thumb - or a glove.
    const gloved = padded;
    const glove = outfit === 'KEEPER' ? '#e8e2d6' : '#f6f6f2';
    const hc = gloved ? glove : kit.skin;
    const g = gloved ? 1.25 : 1;
    add(roundedBox(v(wrist.x, wrist.y - 0.05, 0.004), 0.07 * g, 0.085 * g, 0.03 * g), hc, [`${s}Hand`]);
    add(roundedBox(v(wrist.x, wrist.y - 0.105, 0.022), 0.066 * g, 0.05 * g, 0.034 * g).rotateX(0), hc, [`${s}Hand`]);
    add(tube(v(wrist.x + sign * 0.03 * g, wrist.y - 0.03, 0.01), v(wrist.x + sign * 0.035 * g, wrist.y - 0.075, 0.035), 0.012 * g, 0.011 * g, 6, 2), hc, [`${s}Hand`]);
    if (gloved) add(tube(v(wrist.x, wrist.y + 0.01, 0), v(wrist.x, wrist.y - 0.025, 0), 0.042, 0.042, R, 1), outfit === 'KEEPER' ? '#a0522d' : kit.trim, [`${s}Hand`]);
  }

  // --- legs -----------------------------------------------------------------------
  for (const s of ['Left', 'Right'] as const) {
    const hip = P(`${s}UpLeg`);
    const knee = P(`${s}Leg`);
    const ankle = P(`${s}Foot`);
    add(tube(v(hip.x * 0.92, hip.y + 0.02, 0), knee, 0.088, 0.06, R, 5), trousers, ['Hips', `${s}UpLeg`, `${s}Leg`]);
    add(ellipsoid(knee, 0.06, 0.06, 0.062, R, 6), trousers, [`${s}UpLeg`, `${s}Leg`]);
    add(tube(knee, v(ankle.x, ankle.y + 0.04, 0), 0.058, 0.042, R, 5), trousers, [`${s}UpLeg`, `${s}Leg`, `${s}Foot`]);
    // Calf.
    add(ellipsoid(v(knee.x, knee.y - 0.14, -0.018), 0.05, 0.1, 0.045, R, 6), trousers, [`${s}Leg`]);
    // Shoe: upper, sole and toe cap.
    add(roundedBox(v(ankle.x, 0.055, 0.045), 0.098, 0.085, 0.24, 0.45), shoe, [`${s}Foot`]);
    add(roundedBox(v(ankle.x, 0.012, 0.05), 0.104, 0.024, 0.262, 0.3), umpire ? '#0a0a0a' : '#c9cdd4', [`${s}Foot`]);
    add(roundedBox(v(ankle.x, 0.045, 0.16), 0.09, 0.06, 0.07, 0.5), shoe, [`${s}ToeBase`]);
    if (padded) {
      // Batting pads: curved front, vertical ribs, knee roll, straps.
      const pad = new THREE.BoxGeometry(0.17, 0.52, 0.06, 4, 8, 1);
      const pp = pad.getAttribute('position');
      for (let i = 0; i < pp.count; i += 1) pp.setZ(i, pp.getZ(i) - (pp.getX(i) * pp.getX(i)) * 3.2);
      pad.computeVertexNormals();
      pad.translate(knee.x, knee.y - 0.2, 0.075);
      const padColour = outfit === 'KEEPER' ? '#f1ece0' : '#fafaf7';
      add(pad, padColour, [`${s}Leg`]);
      for (const x of [-0.045, 0, 0.045]) add(new THREE.CylinderGeometry(0.014, 0.014, 0.42, 6).translate(knee.x + x, knee.y - 0.2, 0.1), '#ececE6', [`${s}Leg`]);
      add(new THREE.CylinderGeometry(0.045, 0.045, 0.17, 8).rotateZ(Math.PI / 2).translate(knee.x, knee.y + 0.01, 0.075), padColour, [`${s}Leg`]);
      add(new THREE.BoxGeometry(0.16, 0.11, 0.05).rotateX(-0.25).translate(knee.x, knee.y + 0.1, 0.07), padColour, [`${s}Leg`]);
      for (const y of [-0.08, -0.3]) add(new THREE.BoxGeometry(0.2, 0.02, 0.13).translate(knee.x, knee.y + y, 0.02), '#2a2f3a', [`${s}Leg`]);
    }
  }
  return parts;
}

function buildGeometry(outfit: Outfit, kit: Kit, detail: Detail): THREE.BufferGeometry {
  const index = new Map(BONE_NAMES.map((n, i) => [n, i]));
  const pieces: THREE.BufferGeometry[] = [];
  const color = new THREE.Color();
  const p = new THREE.Vector3();
  for (const part of partsFor(outfit, kit, detail)) {
    const g = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry;
    if (g !== part.geometry) part.geometry.dispose();
    if (g.getAttribute('uv')) g.deleteAttribute('uv');
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    const pos = g.getAttribute('position');
    const nrm = g.getAttribute('normal');
    const n = pos.count;
    const colors = new Float32Array(n * 3);
    const skinIndex = new Uint16Array(n * 4);
    const skinWeight = new Float32Array(n * 4);
    color.set(part.color).convertSRGBToLinear();
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < n; i += 1) {
      minY = Math.min(minY, pos.getY(i));
      maxY = Math.max(maxY, pos.getY(i));
    }
    for (let i = 0; i < n; i += 1) {
      p.fromBufferAttribute(pos, i);
      // Gentle baked shading: a little darker underneath and lower down.
      const t = maxY > minY ? (p.y - minY) / (maxY - minY) : 1;
      const k = (1 - (part.shade ?? 0) * (1 - t)) * (0.94 + 0.06 * nrm.getY(i));
      colors[i * 3] = color.r * k;
      colors[i * 3 + 1] = color.g * k;
      colors[i * 3 + 2] = color.b * k;
      if (part.bones.length === 1) {
        skinIndex[i * 4] = index.get(part.bones[0])!;
        skinWeight[i * 4] = 1;
        continue;
      }
      // Automatic weights: inverse fourth power of the distance to each bone segment, best two kept.
      const ws = part.bones
        .map((b) => ({ b, w: 1 / (Math.pow(distToSegment(p, b), 4) + 1e-7) }))
        .sort((x, y) => y.w - x.w)
        .slice(0, 2);
      const total = ws.reduce((a, x) => a + x.w, 0);
      ws.forEach((x, j) => {
        skinIndex[i * 4 + j] = index.get(x.b)!;
        skinWeight[i * 4 + j] = x.w / total;
      });
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
    pieces.push(g);
  }
  const merged = mergeGeometries(pieces, false);
  for (const piece of pieces) piece.dispose();
  if (!merged) throw new Error('rig: could not merge body parts');
  merged.computeBoundingSphere();
  return merged;
}

const geometryCache = new Map<string, THREE.BufferGeometry>();

function cachedGeometry(outfit: Outfit, kit: Kit, detail: Detail): THREE.BufferGeometry {
  const key = `${outfit}|${kit.shirt}|${kit.trim}|${kit.trousers}|${kit.skin}|${kit.helmet}|${kit.hair ?? ''}|${detail}`;
  let g = geometryCache.get(key);
  if (!g) {
    g = buildGeometry(outfit, kit, detail);
    geometryCache.set(key, g);
  }
  return g;
}

/** Free the shared geometry cache (when the 3D view unmounts). */
export function disposeRigCache(): void {
  for (const g of geometryCache.values()) g.dispose();
  geometryCache.clear();
}

export interface RiggedCharacter {
  /** Place, rotate and scale this in the world. */
  root: THREE.Group;
  mesh: THREE.SkinnedMesh;
  skeleton: THREE.Skeleton;
  bones: Record<string, THREE.Bone>;
  /** A node the batting clips animate: the bat handle's position and direction. */
  batControl: THREE.Object3D;
  material: THREE.Material;
  /** Number of triangles in the body mesh. */
  triangles: number;
}

let sharedMaterial: THREE.MeshStandardMaterial | null = null;

function material(): THREE.MeshStandardMaterial {
  if (!sharedMaterial) {
    sharedMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.68, metalness: 0.0 });
  }
  return sharedMaterial;
}

export function disposeRigMaterial(): void {
  sharedMaterial?.dispose();
  sharedMaterial = null;
}

/** Build one skinned, rigged character. Geometry and material are shared; the skeleton is its own. */
export function createCharacter(outfit: Outfit, kit: Kit, name = 'Character', detail: Detail = 'high'): RiggedCharacter {
  const bones: Record<string, THREE.Bone> = {};
  for (const spec of BONES) {
    const bone = new THREE.Bone();
    bone.name = spec.name;
    bone.position.set(...spec.pos);
    bones[spec.name] = bone;
    if (spec.parent) bones[spec.parent].add(bone);
  }
  const skeleton = new THREE.Skeleton(BONE_NAMES.map((n) => bones[n]));
  const geometry = cachedGeometry(outfit, kit, detail);
  const mesh = new THREE.SkinnedMesh(geometry, material());
  mesh.name = `${name}-mesh`;
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  const root = new THREE.Group();
  root.name = name;
  mesh.add(bones.Hips);
  mesh.bind(skeleton);
  root.add(mesh);
  const batControl = new THREE.Object3D();
  batControl.name = 'BatControl';
  root.add(batControl);
  return { root, mesh, skeleton, bones, batControl, material: mesh.material as THREE.Material, triangles: geometry.getAttribute('position').count / 3 };
}

export const DEFAULT_KIT: Kit = { shirt: '#1e5ef0', trim: '#f5c518', trousers: '#16336f', skin: '#b07a52', helmet: '#0f1b33' };

export const SKIN_TONES = ['#8d5a3b', '#b07a52', '#c99a72', '#e0b896', '#6b4429', '#a36b45'];
export const HAIR_COLOURS = ['#17110d', '#2b1d14', '#3d2a1c', '#0b0b0b', '#5a3d26'];
