/**
 * Geometry for the top-down 2D ground.
 *
 * Everything here is in metres, and every SVG that draws a ground uses a
 * metre-based viewBox, so a fielder 30 m from the bat is drawn 30 units from
 * the bat. No pixel maths anywhere else.
 *
 * Screen convention, looking straight down on the ground with the bowler's end
 * at the top and the striker's end at the bottom:
 *
 *   angle   0 -> straight down the ground (up the screen)
 *   angle  90 -> square on the off side   (screen right, right-hander)
 *   angle 180 -> back past the keeper     (down the screen)
 *   angle 270 -> square leg               (screen left, right-hander)
 *
 * A left-hander's shots are mirrored when drawn; the engine always records
 * angles from a right-hander's point of view.
 */
import type { Venue } from '@/types';

/** Length between the two popping creases, in metres. */
export const PITCH_LENGTH = 20.12;
/** Width of the prepared strip. */
export const PITCH_WIDTH = 3.05;
/** Distance from the popping crease back to the stumps. */
export const CREASE_TO_STUMPS = 1.22;
/** Radius of the fielding-restriction circle. */
export const CIRCLE_RADIUS = 27.43;
/** Grass beyond the rope that we still draw, so the oval is not flush. */
export const OUTFIELD_MARGIN = 7;

export interface Point {
  x: number;
  y: number;
}

export interface GroundBox {
  /** viewBox width in metres. */
  width: number;
  /** viewBox height in metres. */
  height: number;
  /** Centre of the ground, which is also the middle of the pitch. */
  centre: Point;
  /** Where the striker stands: the end all shot angles are measured from. */
  striker: Point;
  /** The bowler's end. */
  bowler: Point;
  /** Semi-axis across the square. */
  squareBoundary: number;
  /** Semi-axis straight down the ground. */
  straightBoundary: number;
}

/**
 * Lay a ground out from its boundary dimensions. The oval is an ellipse with
 * the square boundary across and the straight boundary up and down.
 */
export function groundBox(venue: Pick<Venue, 'squareBoundary' | 'straightBoundary'>): GroundBox {
  const a = venue.squareBoundary;
  const b = venue.straightBoundary;
  const width = (a + OUTFIELD_MARGIN) * 2;
  const height = (b + OUTFIELD_MARGIN) * 2;
  const centre = { x: width / 2, y: height / 2 };
  return {
    width,
    height,
    centre,
    striker: { x: centre.x, y: centre.y + PITCH_LENGTH / 2 },
    bowler: { x: centre.x, y: centre.y - PITCH_LENGTH / 2 },
    squareBoundary: a,
    straightBoundary: b,
  };
}

/** Unit vector for a shot angle, in screen coordinates. */
export function direction(angle: number, leftHanded = false): Point {
  const a = ((leftHanded ? -angle : angle) * Math.PI) / 180;
  return { x: Math.sin(a), y: -Math.cos(a) };
}

/** A point `distance` metres from `origin` along `angle`. */
export function pointAt(origin: Point, angle: number, distance: number, leftHanded = false): Point {
  const d = direction(angle, leftHanded);
  return { x: origin.x + d.x * distance, y: origin.y + d.y * distance };
}

/**
 * How far the rope is along a shot angle, measured from the striker. Solves the
 * ray/ellipse intersection, because the striker is not at the centre of the
 * oval - a straight drive has further to travel than a hook.
 */
export function boundaryDistance(box: GroundBox, angle: number, leftHanded = false): number {
  const d = direction(angle, leftHanded);
  const a = box.squareBoundary;
  const b = box.straightBoundary;
  // Striker offset from the centre of the ellipse.
  const ox = box.striker.x - box.centre.x;
  const oy = box.striker.y - box.centre.y;

  const qa = (d.x * d.x) / (a * a) + (d.y * d.y) / (b * b);
  const qb = 2 * ((ox * d.x) / (a * a) + (oy * d.y) / (b * b));
  const qc = (ox * ox) / (a * a) + (oy * oy) / (b * b) - 1;

  const disc = qb * qb - 4 * qa * qc;
  if (disc <= 0) return Math.min(a, b);
  return (-qb + Math.sqrt(disc)) / (2 * qa);
}

/** The point on the rope along a shot angle. */
export function boundaryPoint(box: GroundBox, angle: number, leftHanded = false): Point {
  return pointAt(box.striker, angle, boundaryDistance(box, angle, leftHanded), leftHanded);
}

/**
 * Where a shot finished. A ball that reached the rope stops there; anything
 * else stops where it was fielded, and nothing is drawn outside the ground.
 */
export function shotEnd(
  box: GroundBox,
  angle: number,
  distance: number,
  leftHanded = false,
): Point {
  const max = boundaryDistance(box, angle, leftHanded);
  return pointAt(box.striker, angle, Math.min(distance, max), leftHanded);
}

/**
 * The fielding-restriction circle: 27.43 m around each set of stumps, joined
 * down the sides. Returned as an SVG path.
 */
export function circlePath(box: GroundBox): string {
  const r = CIRCLE_RADIUS;
  const top = box.bowler.y + CREASE_TO_STUMPS;
  const bottom = box.striker.y - CREASE_TO_STUMPS;
  const cx = box.centre.x;
  return [
    `M ${cx - r} ${top}`,
    `A ${r} ${r} 0 0 1 ${cx + r} ${top}`,
    `L ${cx + r} ${bottom}`,
    `A ${r} ${r} 0 0 1 ${cx - r} ${bottom}`,
    'Z',
  ].join(' ');
}

/** Alternating mown bands across the outfield, as `{ y, height }` stripes. */
export function grassBands(box: GroundBox, count = 12): { y: number; height: number }[] {
  const band = box.height / count;
  const bands: { y: number; height: number }[] = [];
  for (let i = 0; i < count; i += 1) {
    if (i % 2 === 0) bands.push({ y: i * band, height: band });
  }
  return bands;
}

/** Rectangle of the prepared strip, for the SVG. */
export function pitchRect(box: GroundBox) {
  const length = PITCH_LENGTH + CREASE_TO_STUMPS * 2 + 1.5;
  return {
    x: box.centre.x - PITCH_WIDTH / 2,
    y: box.centre.y - length / 2,
    width: PITCH_WIDTH,
    height: length,
  };
}

/** The two popping creases and the return creases, as line segments. */
export function creaseLines(box: GroundBox): { x1: number; y1: number; x2: number; y2: number }[] {
  const halfWidth = PITCH_WIDTH / 2;
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (const y of [box.striker.y, box.bowler.y]) {
    lines.push({ x1: box.centre.x - halfWidth, y1: y, x2: box.centre.x + halfWidth, y2: y });
  }
  // Return creases run back from each popping crease.
  const dir = [1, -1];
  for (let i = 0; i < 2; i += 1) {
    const y = i === 0 ? box.striker.y : box.bowler.y;
    const back = y + dir[i] * 2.4;
    for (const x of [box.centre.x - 1.32, box.centre.x + 1.32]) {
      lines.push({ x1: x, y1: y, x2: x, y2: back });
    }
  }
  return lines;
}

/** Mirror an engine angle for a left-hander, so the drawing matches the bat. */
export function drawAngle(angle: number, leftHanded: boolean): number {
  return leftHanded ? (360 - angle) % 360 : angle;
}

/** Compass label for a shot angle, used by the wagon wheel legend. */
export function regionOf(angle: number): string {
  const a = ((angle % 360) + 360) % 360;
  if (a < 22.5 || a >= 337.5) return 'straight';
  if (a < 67.5) return 'cover';
  if (a < 112.5) return 'point';
  if (a < 157.5) return 'third man';
  if (a < 202.5) return 'behind';
  if (a < 247.5) return 'fine leg';
  if (a < 292.5) return 'square leg';
  return 'mid-wicket';
}
