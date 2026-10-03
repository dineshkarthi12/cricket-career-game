/**
 * Ball flight for the 3D scene, as simple ballistic segments. Pure maths, no
 * Three.js, so it is unit-tested. The scene only ever draws the ball along a
 * path built from the authority's resolved outcome - it never decides one.
 */
import type { DeliveryLength, DeliveryLine } from '@/types';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Segment {
  from: Vec3;
  to: Vec3;
  /** Start and end, ms on the delivery's timeline. */
  t0: number;
  t1: number;
  /** Extra height at the middle of the segment (a parabola), metres. */
  apex: number;
  /**
   * Sideways movement through the air (swing), metres: the ball starts and
   * ends on its line but bends between, most late in the flight.
   */
  curve?: number;
}

export const GRAVITY = 9.81;

/** Ground geometry, metres. The striker's stumps are at -Z, the bowler's at +Z. */
export const PITCH = {
  strikerStumpsZ: -10.06,
  bowlerStumpsZ: 10.06,
  creaseOffset: 1.22,
  /** Where the striker stands (just in front of the popping crease). */
  strikerZ: -9.2,
  keeperZ: -12.6,
  boundaryRadius: 66,
  ballRadius: 0.036,
};

export const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Position along a segment at time `t` (clamped to the segment). */
export function pointOn(seg: Segment, t: number): Vec3 {
  const u = seg.t1 <= seg.t0 ? 1 : Math.max(0, Math.min(1, (t - seg.t0) / (seg.t1 - seg.t0)));
  // u - u^3 peaks at u = 0.58: the bend comes late, like swing.
  const bend = seg.curve ? seg.curve * 2.6 * (u - u * u * u) : 0;
  return {
    x: lerp(seg.from.x, seg.to.x, u) + bend,
    y: lerp(seg.from.y, seg.to.y, u) + 4 * seg.apex * u * (1 - u),
    z: lerp(seg.from.z, seg.to.z, u),
  };
}

/** Position along a whole path at time `t`. Before the first segment, its start; after the last, its end. */
export function pointOnPath(path: Segment[], t: number): Vec3 {
  if (path.length === 0) return v3(0, 0, 0);
  if (t <= path[0].t0) return path[0].from;
  for (const seg of path) if (t <= seg.t1) return pointOn(seg, t);
  return path[path.length - 1].to;
}

/** Apex height of a parabola that stays in the air `ms` milliseconds under gravity. */
export function apexForFlight(ms: number): number {
  const s = ms / 1000;
  return (GRAVITY * s * s) / 8;
}

/** Sideways offset of each line at the batter, for a right-hander (off side is -X). */
const LINE_X: Record<DeliveryLine, number> = {
  WIDE_OFF: -0.85,
  OUTSIDE_OFF: -0.32,
  OFF_STUMP: -0.11,
  MIDDLE: 0,
  LEG_STUMP: 0.11,
  DOWN_LEG: 0.42,
};

/** Where the ball pitches, as a distance in front of the striker's stumps, metres. */
const BOUNCE_FROM_STUMPS: Record<DeliveryLength, number | null> = {
  YORKER: 1.0,
  FULL: 2.8,
  GOOD: 5.4,
  SHORT_OF_GOOD: 7.0,
  SHORT: 9.0,
  FULL_TOSS: null,
};

/** Height of the ball as it reaches the batter. */
const HEIGHT_AT_BAT: Record<DeliveryLength, number> = {
  YORKER: 0.12,
  FULL: 0.38,
  GOOD: 0.72,
  SHORT_OF_GOOD: 1.0,
  SHORT: 1.45,
  FULL_TOSS: 0.95,
};

export function lineX(line: DeliveryLine, leftHanded: boolean): number {
  return LINE_X[line] * (leftHanded ? -1 : 1);
}

/**
 * The delivery from the bowler's hand to the batter: release, pitch, arrival
 * at `arrivalMs` (the ideal contact moment the timing window is built on).
 */
export function deliveryPath(input: {
  release: Vec3;
  releaseMs: number;
  arrivalMs: number;
  line: DeliveryLine;
  length: DeliveryLength;
  leftHanded: boolean;
  spin: boolean;
  wide?: boolean;
  bouncer?: boolean;
  /** Swing in the air, metres sideways at most (+X positive). */
  swing?: number;
  /** Turn off the pitch, metres sideways between bounce and bat (+X positive). */
  turn?: number;
}): Segment[] {
  const x = input.wide ? lineX('WIDE_OFF', input.leftHanded) * 1.25 : lineX(input.line, input.leftHanded);
  const arriveY = input.bouncer ? 1.75 : HEIGHT_AT_BAT[input.length];
  const arrival = v3(x, arriveY, PITCH.strikerZ + 0.25);
  const bounceDist = BOUNCE_FROM_STUMPS[input.length];
  if (bounceDist === null) {
    return [{ from: input.release, to: arrival, t0: input.releaseMs, t1: input.arrivalMs, apex: input.spin ? 0.5 : 0.15, curve: input.swing ?? 0 }];
  }
  // A spinning ball pitches off the line and turns back onto it.
  const bounce = v3(x * 0.85 - (input.turn ?? 0), 0, PITCH.strikerStumpsZ + bounceDist);
  const total = Math.hypot(arrival.z - input.release.z, arrival.x - input.release.x);
  const first = Math.hypot(bounce.z - input.release.z, bounce.x - input.release.x);
  const tb = input.releaseMs + (input.arrivalMs - input.releaseMs) * Math.min(0.95, first / total);
  return [
    { from: input.release, to: bounce, t0: input.releaseMs, t1: tb, apex: input.spin ? 0.7 : 0.18, curve: input.swing ?? 0 },
    { from: bounce, to: arrival, t0: tb, t1: input.arrivalMs, apex: Math.max(0.05, (arrival.y - 0) * 0.35) },
  ];
}

/** Unit direction on the ground for a shot angle (0 straight, 90 off side square, 180 fine, 270 square leg). */
export function shotDirection(angleDeg: number, leftHanded: boolean): { x: number; z: number } {
  const a = (angleDeg * Math.PI) / 180;
  // A right-hander's off side is -X; the engine mirrors left-handers.
  return { x: -Math.sin(a) * (leftHanded ? -1 : 1), z: Math.cos(a) };
}

/** A point `distance` metres from the striker in the direction of `angleDeg`. */
export function groundPoint(angleDeg: number, distance: number, leftHanded: boolean, height = 0): Vec3 {
  const d = shotDirection(angleDeg, leftHanded);
  return v3(d.x * distance, height, PITCH.strikerZ + d.z * distance);
}

/** Distance from the ground's centre, metres. */
export function radius(p: Vec3): number {
  return Math.hypot(p.x, p.z);
}

/** Clamp a ground point inside the rope. */
export function insideRope(p: Vec3, margin = 3): Vec3 {
  const r = radius(p);
  const max = PITCH.boundaryRadius - margin;
  if (r <= max) return p;
  return v3((p.x / r) * max, p.y, (p.z / r) * max);
}

/** Where a shot travelling from the striker at this angle crosses the rope. */
export function ropeCrossing(angleDeg: number, leftHanded: boolean, beyond = 0): Vec3 {
  const d = shotDirection(angleDeg, leftHanded);
  // Solve |s + t d| = R for t > 0, s = (0, strikerZ).
  const sz = PITCH.strikerZ;
  const b = 2 * sz * d.z;
  const c = sz * sz - PITCH.boundaryRadius * PITCH.boundaryRadius;
  const t = (-b + Math.sqrt(b * b - 4 * c)) / 2 + beyond;
  return v3(d.x * t, 0, sz + d.z * t);
}

/**
 * How a delivery moves, for the picture: swing for seamers, turn for
 * spinners, from the delivery type and the bowler's arm. The authority has
 * already decided the line the ball arrives on; this only shapes the path to it.
 */
export function movementFor(input: { deliveryType: string; bowlingStyle: string; speed: number; seed: number }): { swing: number; turn: number } {
  const left = input.bowlingStyle.startsWith('LEFT_ARM');
  const r = ((input.seed >>> 0) % 1000) / 1000;
  switch (input.deliveryType) {
    case 'SWING':
      return { swing: (r < 0.5 ? -1 : 1) * (0.22 + r * 0.18), turn: 0 };
    case 'FAST':
    case 'SLOWER':
      return { swing: (r - 0.5) * 0.12, turn: 0 };
    case 'STOCK_SPIN':
    case 'FLIGHTED':
    case 'QUICKER':
    case 'MYSTERY': {
      // Finger spin from a right-armer turns into a right-hander (+X); wrist spin away (-X).
      const wrist = input.bowlingStyle === 'LEG_SPIN' || input.bowlingStyle === 'LEFT_ARM_WRIST_SPIN';
      let dir = wrist ? -1 : 1;
      if (left) dir *= -1;
      if (input.deliveryType === 'MYSTERY') dir *= -1;
      const amount = input.deliveryType === 'QUICKER' ? 0.08 : input.deliveryType === 'FLIGHTED' ? 0.32 : 0.22;
      return { swing: 0, turn: dir * amount };
    }
    default:
      return { swing: 0, turn: 0 };
  }
}
