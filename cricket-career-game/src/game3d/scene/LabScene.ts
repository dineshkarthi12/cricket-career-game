/** A small turntable scene for inspecting one rigged cricketer and its clips. */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Cricketer } from '../characters/Cricketer';
import { DEFAULT_KIT, disposeRigCache, disposeRigMaterial, type Outfit } from '../characters/rig';
import { createStumps } from '../characters/props';
import { Renderer3D } from '../render/Renderer3D';
import type { Quality } from './Stadium';

export class LabScene {
  private scene = new THREE.Scene();
  private renderer: Renderer3D;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private character: Cricketer | null = null;
  private skeletonHelper: THREE.SkeletonHelper | null = null;
  private disposables: { dispose(): void }[] = [];
  speed = 1;

  constructor(container: HTMLElement, quality: Quality) {
    this.renderer = new Renderer3D(container, quality);
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.05, 200);
    this.camera.position.set(2.6, 1.6, 3.4);
    this.controls = new OrbitControls(this.camera, this.renderer.renderer.domElement);
    this.controls.target.set(0, 0.95, 0);
    this.controls.enableDamping = true;
    this.controls.minDistance = 1.2;
    this.controls.maxDistance = 9;
    this.renderer.onResize = (w, h) => {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    };
    this.renderer.resize();
    this.scene.background = new THREE.Color('#e8effe');
    const groundGeo = new THREE.CircleGeometry(6, 48);
    const groundMat = new THREE.MeshStandardMaterial({ color: '#4c9a44', roughness: 0.95 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    const pitchGeo = new THREE.PlaneGeometry(3.05, 6);
    const pitchMat = new THREE.MeshStandardMaterial({ color: '#c9b183', roughness: 0.9 });
    const pitch = new THREE.Mesh(pitchGeo, pitchMat);
    pitch.rotation.x = -Math.PI / 2;
    pitch.position.y = 0.004;
    pitch.receiveShadow = true;
    const stumps = createStumps();
    stumps.group.position.set(0, 0, -1.1);
    this.scene.add(ground, pitch, stumps.group);
    this.disposables.push(groundGeo, groundMat, pitchGeo, pitchMat);
    stumps.group.traverse((o) => o instanceof THREE.Mesh && this.disposables.push(o.geometry, o.material as THREE.Material));
    const hemi = new THREE.HemisphereLight('#ffffff', '#5a7a4a', 1.2);
    const sun = new THREE.DirectionalLight('#ffffff', 2.2);
    sun.position.set(3, 6, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    this.scene.add(hemi, sun);
    this.renderer.start((dt) => {
      this.character?.update(dt * this.speed);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    });
  }

  setCharacter(outfit: Outfit, leftHanded: boolean): Cricketer {
    this.character?.dispose();
    if (this.skeletonHelper) {
      this.scene.remove(this.skeletonHelper);
      this.skeletonHelper.dispose();
      this.skeletonHelper = null;
    }
    const c = new Cricketer({ outfit, kit: DEFAULT_KIT, name: 'LabCricketer', leftHanded, withBat: outfit === 'BATTER' });
    // Face the camera's side so batting shots read side-on.
    c.root.rotation.y = outfit === 'BATTER' ? -Math.PI / 2 * (leftHanded ? -1 : 1) : 0;
    this.scene.add(c.root);
    this.character = c;
    return c;
  }

  showSkeleton(on: boolean): void {
    if (on && this.character && !this.skeletonHelper) {
      this.skeletonHelper = new THREE.SkeletonHelper(this.character.rig.mesh);
      this.scene.add(this.skeletonHelper);
    } else if (!on && this.skeletonHelper) {
      this.scene.remove(this.skeletonHelper);
      this.skeletonHelper.dispose();
      this.skeletonHelper = null;
    }
  }

  play(state: string): boolean {
    return this.character?.play(state, { token: `${state}-${performance.now()}`, then: state.startsWith('Batting') || state === 'MissedShot' ? 'BattingIdle' : undefined }) ?? false;
  }

  get stats() {
    return this.renderer.stats;
  }

  dispose(): void {
    this.character?.dispose();
    this.skeletonHelper?.dispose();
    this.controls.dispose();
    for (const d of this.disposables) d.dispose();
    this.renderer.dispose();
    disposeRigCache();
    disposeRigMaterial();
  }
}
