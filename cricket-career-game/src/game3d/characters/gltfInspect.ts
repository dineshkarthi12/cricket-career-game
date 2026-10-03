/**
 * Imported character models: load a GLB/glTF, read its skeleton and clips,
 * and decide - explicitly - whether the cricket clips can drive it.
 *
 * Nothing here retargets silently. A skeleton is compatible only when every
 * bone the cricket clips need is present (after stripping a known prefix
 * such as `mixamorig:`); otherwise the report says which bones are missing
 * and the model can only play its own clips.
 */
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { REQUIRED_BONES } from './rig';

export interface SkeletonReport {
  boneCount: number;
  bones: string[];
  /** Name normalisation applied (e.g. 'mixamorig:'), if any. */
  prefix: string | null;
  root: string | null;
  hasHips: boolean;
  missingForCricketClips: string[];
  compatibleWithCricketClips: boolean;
}

export interface ModelReport {
  url: string;
  ok: boolean;
  error: string | null;
  skinnedMeshes: number;
  meshes: number;
  triangles: number;
  clips: { name: string; duration: number; tracks: number }[];
  skeleton: SkeletonReport | null;
  /** Height of the model's bounding box, metres - to catch unit/scale mistakes. */
  height: number;
}

const PREFIXES = ['mixamorig:', 'mixamorig_', 'mixamorig', 'Armature_', 'Armature|'];

export function normaliseBoneName(name: string): { name: string; prefix: string | null } {
  for (const p of PREFIXES) if (name.startsWith(p)) return { name: name.slice(p.length), prefix: p };
  return { name, prefix: null };
}

/** Compare a skeleton's bone names against what the cricket clips drive. */
export function inspectSkeleton(boneNames: string[]): SkeletonReport {
  let prefix: string | null = null;
  const normalised = new Set<string>();
  for (const n of boneNames) {
    const r = normaliseBoneName(n);
    if (r.prefix) prefix = r.prefix;
    normalised.add(r.name);
  }
  const missing = REQUIRED_BONES.filter((b) => !normalised.has(b));
  return {
    boneCount: boneNames.length,
    bones: boneNames,
    prefix,
    root: boneNames[0] ?? null,
    hasHips: normalised.has('Hips'),
    missingForCricketClips: missing,
    compatibleWithCricketClips: missing.length === 0,
  };
}

export function reportFromGltf(url: string, gltf: Pick<GLTF, 'scene' | 'animations'>): ModelReport {
  let skinned = 0;
  let meshes = 0;
  let triangles = 0;
  const bones: string[] = [];
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      meshes += 1;
      const g = (o as THREE.Mesh).geometry;
      triangles += g.index ? g.index.count / 3 : g.getAttribute('position').count / 3;
    }
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) {
      skinned += 1;
      for (const b of (o as THREE.SkinnedMesh).skeleton.bones) if (!bones.includes(b.name)) bones.push(b.name);
    }
  });
  const box = new THREE.Box3().setFromObject(gltf.scene);
  return {
    url,
    ok: true,
    error: null,
    skinnedMeshes: skinned,
    meshes,
    triangles: Math.round(triangles),
    clips: gltf.animations.map((c) => ({ name: c.name, duration: Math.round(c.duration * 100) / 100, tracks: c.tracks.length })),
    skeleton: skinned ? inspectSkeleton(bones) : null,
    height: Math.round((box.max.y - box.min.y) * 100) / 100,
  };
}

/** Parse a GLB already in memory (tests, drag-and-drop). */
export function parseGlb(data: ArrayBuffer, url = 'memory.glb'): Promise<{ gltf: GLTF; report: ModelReport }> {
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(data, '', (gltf) => resolve({ gltf, report: reportFromGltf(url, gltf) }), (err) => reject(err));
  });
}

/** Fetch and inspect a model. A missing file is a report, not an exception. */
export async function inspectModel(url: string): Promise<ModelReport> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} - file not installed`);
    const type = res.headers.get('content-type') ?? '';
    if (type.includes('text/html')) throw new Error('file not installed (the server returned a web page)');
    const { report, gltf } = await parseGlb(await res.arrayBuffer(), url);
    disposeGltf(gltf);
    return report;
  } catch (e) {
    return { url, ok: false, error: e instanceof Error ? e.message : String(e), skinnedMeshes: 0, meshes: 0, triangles: 0, clips: [], skeleton: null, height: 0 };
  }
}

export function disposeGltf(gltf: Pick<GLTF, 'scene'>): void {
  gltf.scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      for (const v of Object.values(m)) if (v instanceof THREE.Texture) v.dispose();
      m.dispose();
    }
  });
}
