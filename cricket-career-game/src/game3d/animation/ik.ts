/**
 * Two-bone arm IK: after the mixer has posed the body, bend each arm so its
 * hand lands on a target (both hands on the bat handle). Analytic, no
 * iteration, cheap enough to run for every batter every frame.
 */
import * as THREE from 'three';

const _s = new THREE.Vector3();
const _t = new THREE.Vector3();
const _e = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _pole = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _pq = new THREE.Quaternion();

/** Rotate `bone` so its child (rest offset `childRest`) points at `worldTarget`. */
function aim(bone: THREE.Bone, childRest: THREE.Vector3, worldTarget: THREE.Vector3): void {
  bone.parent!.updateWorldMatrix(true, false);
  bone.parent!.getWorldQuaternion(_pq);
  bone.getWorldPosition(_tmp);
  _dir.copy(worldTarget).sub(_tmp).normalize().applyQuaternion(_pq.invert());
  _q.setFromUnitVectors(_tmp.copy(childRest).normalize(), _dir);
  bone.quaternion.copy(_q);
  bone.updateWorldMatrix(false, true);
}

export interface ArmChain {
  upper: THREE.Bone;
  lower: THREE.Bone;
  hand: THREE.Bone;
}

/**
 * Solve one arm. `pole` (world) is where the elbow should bend towards.
 * When the target is out of reach the arm points straight at it.
 */
export function solveArm(chain: ArmChain, target: THREE.Vector3, pole: THREE.Vector3): void {
  const l1 = chain.lower.position.length();
  const l2 = chain.hand.position.length();
  chain.upper.getWorldPosition(_s);
  _t.copy(target);
  const toTarget = _tmp.copy(_t).sub(_s);
  const dist = Math.min(toTarget.length(), (l1 + l2) * 0.999);
  const d = toTarget.normalize();
  // Distance along the shoulder-target line to the elbow's foot, and its height off it.
  const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  _pole.copy(pole).sub(_s);
  _pole.sub(_e.copy(d).multiplyScalar(_pole.dot(d)));
  if (_pole.lengthSq() < 1e-8) _pole.set(0, -1, 0).sub(_e.copy(d).multiplyScalar(-d.y));
  _pole.normalize();
  const elbow = _e.copy(_s).add(d.clone().multiplyScalar(a)).add(_pole.multiplyScalar(h));
  const reach = _s.clone().add(d.multiplyScalar(dist));
  aim(chain.upper, chain.lower.position, elbow);
  aim(chain.lower, chain.hand.position, reach);
}
