/**
 * Procedural rigged cricketers.
 *
 * Each character is a real `THREE.SkinnedMesh` bound to a real `THREE.Skeleton`:
 * the body is built from simple solids, every vertex is skinned to one or two
 * bones, and keyframe clips (`animation/clips.ts`) rotate the bones. This is
 * an original, procedural model - not a scanned or purchased asset - and the
 * Lab screen labels it as such.
 *
 * Bone names follow the Mixamo convention (Hips, Spine, LeftArm, ...), so a
 * licensed Mixamo-rigged GLB and its clips can replace it later: see
 * `characters/gltfInspect.ts` and docs/assets/ASSET_MANIFEST.md.
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

export interface Kit {
  shirt: string;
  trim: string;
  trousers: string;
  skin: string;
  helmet: string;
}

interface Part {
  bone: string;
  geometry: THREE.BufferGeometry;
  /** Offset from the bone's rest world position. */
  at: [number, number, number];
  color: string;
  /** Blend the far end of a limb into its child bone so joints bend smoothly. */
  blend?: { child: string; axis: 'y'; from: number; to: number };
  rotate?: [number, number, number];
}

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

/** World position of a bone in the rest pose (used by IK and tests). */
export function restPosition(name: string): THREE.Vector3 {
  return REST.get(name)!.clone();
}

function capsule(radius: number, length: number, cap = 6, radial = 10): THREE.BufferGeometry {
  return new THREE.CapsuleGeometry(radius, Math.max(0.001, length), cap, radial);
}

function box(w: number, h: number, d: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, d, 2, 2, 2);
}

function sphere(r: number, w = 14, h = 10, phiLength = Math.PI * 2, thetaLength = Math.PI): THREE.BufferGeometry {
  return new THREE.SphereGeometry(r, w, h, 0, phiLength, 0, thetaLength);
}

function partsFor(outfit: Outfit, kit: Kit): Part[] {
  const padded = outfit === 'BATTER' || outfit === 'KEEPER';
  const umpire = outfit === 'UMPIRE';
  const shirt = umpire ? '#f4f1e8' : kit.shirt;
  const trousers = umpire ? '#1d2433' : kit.trousers;
  const parts: Part[] = [
    { bone: 'Hips', geometry: capsule(0.15, 0.08), at: [0, 0, 0], color: trousers, rotate: [0, 0, Math.PI / 2] },
    { bone: 'Spine', geometry: capsule(0.145, 0.1), at: [0, 0.08, 0], color: shirt },
    { bone: 'Spine1', geometry: capsule(0.16, 0.08), at: [0, 0.08, 0], color: shirt },
    { bone: 'Spine2', geometry: box(0.38, 0.22, 0.22), at: [0, 0.08, 0], color: shirt },
    { bone: 'Spine2', geometry: box(0.39, 0.035, 0.225), at: [0, 0.0, 0], color: umpire ? '#1d2433' : kit.trim },
    { bone: 'Neck', geometry: capsule(0.05, 0.06), at: [0, 0.03, 0], color: kit.skin },
    { bone: 'Head', geometry: sphere(0.105), at: [0, 0.1, 0.0], color: kit.skin },
    // A nose so the facing reads at a distance.
    { bone: 'Head', geometry: box(0.03, 0.04, 0.04), at: [0, 0.09, 0.105], color: kit.skin },
  ];
  if (padded) {
    parts.push(
      { bone: 'Head', geometry: sphere(0.122, 14, 8, Math.PI * 2, Math.PI * 0.55), at: [0, 0.115, -0.01], color: kit.helmet },
      { bone: 'Head', geometry: box(0.2, 0.012, 0.12), at: [0, 0.1, 0.08], color: kit.helmet },
      // Face grille.
      { bone: 'Head', geometry: box(0.17, 0.012, 0.012), at: [0, 0.07, 0.125], color: '#c9ced8' },
      { bone: 'Head', geometry: box(0.17, 0.012, 0.012), at: [0, 0.03, 0.12], color: '#c9ced8' },
    );
  } else if (umpire) {
    parts.push(
      { bone: 'Head', geometry: sphere(0.115, 14, 8, Math.PI * 2, Math.PI * 0.5), at: [0, 0.12, 0], color: '#f4f1e8' },
      { bone: 'Head', geometry: new THREE.CylinderGeometry(0.2, 0.2, 0.012, 20), at: [0, 0.13, 0], color: '#f4f1e8' },
    );
  } else {
    parts.push(
      { bone: 'Head', geometry: sphere(0.112, 14, 8, Math.PI * 2, Math.PI * 0.5), at: [0, 0.12, 0], color: kit.shirt },
      { bone: 'Head', geometry: box(0.15, 0.012, 0.11), at: [0, 0.135, 0.12], color: kit.trim },
    );
  }
  for (const s of ['Left', 'Right'] as const) {
    const glove = padded ? '#f5f5f2' : kit.skin;
    parts.push(
      { bone: `${s}Shoulder`, geometry: capsule(0.06, 0.08), at: [side(s, 0.07), -0.01, 0], color: shirt, rotate: [0, 0, Math.PI / 2] },
      { bone: `${s}Arm`, geometry: capsule(0.052, 0.22), at: [0, -0.15, 0], color: shirt, blend: { child: `${s}ForeArm`, axis: 'y', from: -0.22, to: -0.32 } },
      { bone: `${s}ForeArm`, geometry: capsule(0.043, 0.21), at: [0, -0.135, 0], color: kit.skin, blend: { child: `${s}Hand`, axis: 'y', from: -0.21, to: -0.29 } },
      { bone: `${s}Hand`, geometry: box(padded ? 0.085 : 0.07, 0.1, padded ? 0.085 : 0.05), at: [0, -0.05, 0], color: glove },
      { bone: `${s}UpLeg`, geometry: capsule(0.075, 0.32), at: [0, -0.22, 0], color: trousers, blend: { child: `${s}Leg`, axis: 'y', from: -0.34, to: -0.46 } },
      { bone: `${s}Leg`, geometry: capsule(0.058, 0.32), at: [0, -0.21, 0], color: trousers, blend: { child: `${s}Foot`, axis: 'y', from: -0.36, to: -0.44 } },
      { bone: `${s}Foot`, geometry: box(0.1, 0.07, 0.26), at: [0, -0.045, 0.06], color: umpire ? '#151a24' : '#f2f2f2' },
    );
    if (padded) {
      parts.push(
        { bone: `${s}Leg`, geometry: box(0.15, 0.46, 0.12), at: [0, -0.2, 0.05], color: '#f7f7f4' },
        { bone: `${s}Leg`, geometry: box(0.16, 0.1, 0.14), at: [0, 0.03, 0.05], color: '#ebebe6' },
      );
    }
  }
  if (outfit === 'UMPIRE') {
    // Umpire's coat skirt.
    parts.push({ bone: 'Hips', geometry: box(0.36, 0.2, 0.25), at: [0, -0.02, 0], color: '#f4f1e8' });
  }
  return parts;
}

function buildGeometry(outfit: Outfit, kit: Kit): THREE.BufferGeometry {
  const index = new Map(BONE_NAMES.map((n, i) => [n, i]));
  const pieces: THREE.BufferGeometry[] = [];
  const color = new THREE.Color();
  for (const part of partsFor(outfit, kit)) {
    let g = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry;
    g.deleteAttribute('uv');
    if (part.rotate) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...part.rotate)));
    const origin = REST.get(part.bone)!.clone().add(new THREE.Vector3(...part.at));
    g.translate(origin.x, origin.y, origin.z);
    const pos = g.getAttribute('position');
    const n = pos.count;
    const colors = new Float32Array(n * 3);
    const skinIndex = new Uint16Array(n * 4);
    const skinWeight = new Float32Array(n * 4);
    color.set(part.color).convertSRGBToLinear();
    const bone = index.get(part.bone)!;
    const boneRest = REST.get(part.bone)!;
    for (let i = 0; i < n; i += 1) {
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
      skinIndex[i * 4] = bone;
      skinWeight[i * 4] = 1;
      if (part.blend) {
        // Vertices near the joint share their weight with the next bone.
        const local = pos.getY(i) - boneRest.y;
        const t = Math.max(0, Math.min(1, (part.blend.from - local) / (part.blend.from - part.blend.to)));
        const w = t * t * (3 - 2 * t) * 0.5;
        skinIndex[i * 4 + 1] = index.get(part.blend.child)!;
        skinWeight[i * 4] = 1 - w;
        skinWeight[i * 4 + 1] = w;
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
    pieces.push(g);
    if (g !== part.geometry) part.geometry.dispose();
  }
  const merged = mergeGeometries(pieces, false);
  for (const p of pieces) p.dispose();
  if (!merged) throw new Error('rig: could not merge body parts');
  merged.computeBoundingSphere();
  return merged;
}

const geometryCache = new Map<string, THREE.BufferGeometry>();

function cachedGeometry(outfit: Outfit, kit: Kit): THREE.BufferGeometry {
  const key = `${outfit}|${kit.shirt}|${kit.trim}|${kit.trousers}|${kit.skin}|${kit.helmet}`;
  let g = geometryCache.get(key);
  if (!g) {
    g = buildGeometry(outfit, kit);
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
}

let sharedMaterial: THREE.MeshStandardMaterial | null = null;

function material(): THREE.MeshStandardMaterial {
  if (!sharedMaterial) {
    sharedMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.02 });
  }
  return sharedMaterial;
}

export function disposeRigMaterial(): void {
  sharedMaterial?.dispose();
  sharedMaterial = null;
}

/** Build one skinned, rigged character. Geometry and material are shared; the skeleton is its own. */
export function createCharacter(outfit: Outfit, kit: Kit, name = 'Character'): RiggedCharacter {
  const bones: Record<string, THREE.Bone> = {};
  for (const spec of BONES) {
    const bone = new THREE.Bone();
    bone.name = spec.name;
    bone.position.set(...spec.pos);
    bones[spec.name] = bone;
    if (spec.parent) bones[spec.parent].add(bone);
  }
  const skeleton = new THREE.Skeleton(BONE_NAMES.map((n) => bones[n]));
  const mesh = new THREE.SkinnedMesh(cachedGeometry(outfit, kit), material());
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
  return { root, mesh, skeleton, bones, batControl, material: mesh.material as THREE.Material };
}

export const DEFAULT_KIT: Kit = { shirt: '#1e5ef0', trim: '#f5c518', trousers: '#16336f', skin: '#b07a52', helmet: '#0f1b33' };

export const SKIN_TONES = ['#8d5a3b', '#b07a52', '#c99a72', '#e0b896', '#6b4429', '#a36b45'];
