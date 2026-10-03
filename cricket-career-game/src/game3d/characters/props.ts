/** Simple procedural props: bat, ball, stumps. Geometry is shared and disposed with the scene. */
import * as THREE from 'three';

/** Grip offsets on the handle, in the bat's own space (blade along -Y). */
export const GRIP = { top: new THREE.Vector3(0, 0.07, 0), bottom: new THREE.Vector3(0, -0.06, 0) };

export function createBat(): THREE.Group {
  const bat = new THREE.Group();
  bat.name = 'Bat';
  const wood = new THREE.MeshStandardMaterial({ color: '#e9d3a2', roughness: 0.55 });
  const grip = new THREE.MeshStandardMaterial({ color: '#1f2a44', roughness: 0.95 });
  const sticker = new THREE.MeshStandardMaterial({ color: '#1e5ef0', roughness: 0.5 });
  // Blade outline (x across the face, y along the bat), extruded with rounded edges.
  const shape = new THREE.Shape();
  shape.moveTo(-0.054, -0.84);
  shape.quadraticCurveTo(-0.056, -0.865, -0.03, -0.868);
  shape.lineTo(0.03, -0.868);
  shape.quadraticCurveTo(0.056, -0.865, 0.054, -0.84);
  shape.lineTo(0.054, -0.2);
  shape.quadraticCurveTo(0.05, -0.155, 0.018, -0.145);
  shape.lineTo(-0.018, -0.145);
  shape.quadraticCurveTo(-0.05, -0.155, -0.054, -0.2);
  shape.closePath();
  const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 2, curveSegments: 6 }), wood);
  blade.position.z = -0.015;
  // The thick spine on the back of the blade, highest near the sweet spot.
  const spine = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.42, 4, 8), wood);
  spine.scale.set(1.2, 1, 0.9);
  spine.position.set(0, -0.53, -0.026);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.016, 0.3, 10), grip);
  handle.position.y = 0.0;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.019, 8, 6), grip);
  knob.position.y = 0.15;
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.16), sticker);
  label.position.set(0, -0.32, 0.024);
  for (const m of [blade, spine, handle, knob, label]) {
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
  // The seam: a raised white ring, so spin is visible as the ball rotates.
  const seam = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.0035, 4, 24), new THREE.MeshStandardMaterial({ color: '#f4efe4', roughness: 0.6 }));
  seam.name = 'Seam';
  ball.add(seam);
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
