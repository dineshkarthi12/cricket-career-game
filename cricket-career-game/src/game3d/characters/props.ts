/** Simple procedural props: bat, ball, stumps. Geometry is shared and disposed with the scene. */
import * as THREE from 'three';

/** Grip offsets on the handle, in the bat's own space (blade along -Y). */
export const GRIP = { top: new THREE.Vector3(0, 0.07, 0), bottom: new THREE.Vector3(0, -0.06, 0) };

export function createBat(): THREE.Group {
  const bat = new THREE.Group();
  bat.name = 'Bat';
  const wood = new THREE.MeshStandardMaterial({ color: '#e6cf9c', roughness: 0.6 });
  const grip = new THREE.MeshStandardMaterial({ color: '#1f2a44', roughness: 0.9 });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 10), grip);
  handle.position.y = -0.0;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.108, 0.56, 0.045), wood);
  blade.position.y = -0.43;
  // The back of the blade is thicker toward the toe.
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.03), wood);
  spine.position.set(0, -0.47, -0.03);
  for (const m of [handle, blade, spine]) {
    m.castShadow = true;
    bat.add(m);
  }
  return bat;
}

export function createBall(): THREE.Mesh {
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.036, 14, 10),
    new THREE.MeshStandardMaterial({ color: '#c8102e', roughness: 0.35, emissive: '#3a0008' }),
  );
  ball.name = 'Ball';
  ball.castShadow = true;
  return ball;
}

/** Three stumps and two bails at one end; returns the bails so they can fly. */
export function createStumps(): { group: THREE.Group; bails: THREE.Mesh[] } {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#f1e6c8', roughness: 0.5 });
  const stumpGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.71, 10);
  for (const x of [-0.114, 0, 0.114]) {
    const s = new THREE.Mesh(stumpGeo, wood);
    s.position.set(x, 0.355, 0);
    s.castShadow = true;
    group.add(s);
  }
  const bailGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.11, 6);
  const bails = [-0.057, 0.057].map((x) => {
    const b = new THREE.Mesh(bailGeo, wood);
    b.rotation.z = Math.PI / 2;
    b.position.set(x, 0.715, 0);
    group.add(b);
    return b;
  });
  return { group, bails };
}
