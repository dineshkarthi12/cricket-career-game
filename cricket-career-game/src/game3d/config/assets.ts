/**
 * The 3D asset manifest: every model and animation source the game knows
 * about, where it came from, its licence, and its real status. The Lab
 * screen and docs/assets/ASSET_MANIFEST.md show the same table.
 *
 * Status values are deliberately blunt. "DOWNLOADED AND VERIFIED" is only
 * used for a file that is in this repository and was parsed by the test
 * suite.
 */
export type AssetStatus =
  | 'FOUND AND VERIFIED'
  | 'DOWNLOADED AND VERIFIED'
  | 'REQUIRES MANUAL DOWNLOAD'
  | 'LICENSE NEEDS CONFIRMATION'
  | 'INCOMPATIBLE'
  | 'NOT FOUND'
  | 'BUILT IN (PROCEDURAL)';

export interface AssetEntry {
  id: string;
  name: string;
  source: string;
  url: string;
  status: AssetStatus;
  license: string;
  attribution: string | null;
  /** Local path when installed (relative to the site root). */
  path: string | null;
  format: string;
  skeleton: string;
  clips: string;
  cricketSpecific: boolean;
  notes: string;
}

export const ASSETS: AssetEntry[] = [
  {
    id: 'procedural-cricketer',
    name: 'Procedural cricketer rig (this project)',
    source: 'Cricket Career 26 source code',
    url: 'src/game3d/characters/rig.ts',
    status: 'BUILT IN (PROCEDURAL)',
    license: 'Same as this project',
    attribution: null,
    path: null,
    format: 'Generated at runtime (THREE.SkinnedMesh)',
    skeleton: '22 bones, Mixamo-style names (Hips, Spine, Spine1, Spine2, Neck, Head, Left/Right Shoulder, Arm, ForeArm, Hand, UpLeg, Leg, Foot, ToeBase)',
    clips: '41 hand-keyed clips (clips.ts), spline-smoothed - procedural, not motion capture',
    cricketSpecific: true,
    notes: 'Low-poly stylised players. Used for every character in the match scene.',
  },
  {
    id: 'khronos-rigged-figure',
    name: 'RiggedFigure (glTF Sample Assets)',
    source: 'Khronos Group glTF-Sample-Assets (GitHub)',
    url: 'https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/RiggedFigure',
    status: 'DOWNLOADED AND VERIFIED',
    license: 'CC BY 4.0 (© 2017 Cesium)',
    attribution: 'RiggedFigure by Cesium, CC BY 4.0, via the Khronos glTF Sample Assets',
    path: '/assets/players/third-party/RiggedFigure.glb',
    format: 'GLB',
    skeleton: '19 joints, Cesium naming - no Hips/Spine/Arm names',
    clips: '1 generic clip (not cricket)',
    cricketSpecific: false,
    notes: 'Pipeline test fixture only: proves GLB loading, skeleton inspection and clip detection. Its skeleton is INCOMPATIBLE with the cricket clips and it is never shown as a cricketer.',
  },
  {
    id: 'mixamo',
    name: 'Mixamo characters and animations',
    source: 'Adobe Mixamo',
    url: 'https://www.mixamo.com/',
    status: 'REQUIRES MANUAL DOWNLOAD',
    license: 'Free with an Adobe account; usable in projects, raw files may not be redistributed. Confirm current terms on the site.',
    attribution: null,
    path: '/assets/players/mixamo/',
    format: 'FBX (convert to GLB in Blender)',
    skeleton: 'mixamorig:* - compatible after prefix stripping',
    clips: 'Generic sports motions; search results include a few "cricket" items whose availability must be checked when logged in',
    cricketSpecific: false,
    notes: 'Blocked here: needs an Adobe login (and the site is not reachable from this environment). Follow docs/assets/ASSET_MANIFEST.md to add one.',
  },
  {
    id: 'fab-sketchfab',
    name: 'Cricket player models on Fab / Sketchfab',
    source: 'Fab (Epic) / Sketchfab',
    url: 'https://www.fab.com/ and https://sketchfab.com/search?q=cricket+player&type=models',
    status: 'LICENSE NEEDS CONFIRMATION',
    license: 'Per-asset (CC-BY, Standard, or paid). Must be checked asset by asset.',
    attribution: null,
    path: null,
    format: 'Usually FBX / GLB',
    skeleton: 'Varies',
    clips: 'Varies; most cricket models are static or unrigged',
    cricketSpecific: true,
    notes: 'Not downloaded: requires an account, and each asset’s licence must be read before use. Not reachable from this environment.',
  },
  {
    id: 'kenney-quaternius',
    name: 'Kenney / Quaternius CC0 animated characters',
    source: 'kenney.nl, quaternius.com',
    url: 'https://kenney.nl/assets/animated-characters-1',
    status: 'REQUIRES MANUAL DOWNLOAD',
    license: 'CC0 (public domain) per the publishers’ pages - confirm on download',
    attribution: null,
    path: '/assets/players/cc0/',
    format: 'FBX / GLB',
    skeleton: 'Own rigs (not Mixamo names) - would need a bone map',
    clips: 'Idle, walk, run, jump - generic locomotion only, no cricket actions',
    cricketSpecific: false,
    notes: 'Blocked by this environment’s network policy. Useful only for ordinary walking/running.',
  },
  {
    id: 'poly-haven',
    name: 'Poly Haven HDRIs and grass textures',
    source: 'Poly Haven',
    url: 'https://polyhaven.com/',
    status: 'REQUIRES MANUAL DOWNLOAD',
    license: 'CC0',
    attribution: null,
    path: '/assets/textures/',
    format: 'HDR / JPG',
    skeleton: 'n/a',
    clips: 'n/a',
    cricketSpecific: false,
    notes: 'Optional lighting/texture upgrade. The stadium currently uses procedural canvas textures.',
  },
];
