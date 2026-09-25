import { describe, expect, it } from 'vitest';
import {
  boundaryDistance,
  circlePath,
  direction,
  drawAngle,
  grassBands,
  groundBox,
  pointAt,
  regionOf,
  shotEnd,
  PITCH_LENGTH,
} from './ground';

const venue = { squareBoundary: 66, straightBoundary: 74 };
const box = groundBox(venue);

describe('ground geometry', () => {
  it('sizes the ground from its boundaries', () => {
    expect(box.width).toBe((66 + 7) * 2);
    expect(box.height).toBe((74 + 7) * 2);
    expect(box.centre).toEqual({ x: box.width / 2, y: box.height / 2 });
  });

  it('puts the two ends a pitch length apart, striker below centre', () => {
    expect(box.striker.y - box.bowler.y).toBeCloseTo(PITCH_LENGTH, 6);
    expect(box.striker.x).toBe(box.bowler.x);
    expect(box.striker.y).toBeGreaterThan(box.centre.y);
  });

  it('maps the four cardinal shot angles to the right screen directions', () => {
    expect(direction(0).y).toBeCloseTo(-1, 6); // straight, up the screen
    expect(direction(90).x).toBeCloseTo(1, 6); // off side, screen right
    expect(direction(180).y).toBeCloseTo(1, 6); // behind the keeper
    expect(direction(270).x).toBeCloseTo(-1, 6); // square leg, screen left
  });

  it('mirrors a left-hander', () => {
    expect(direction(90, true).x).toBeCloseTo(-1, 6);
    expect(drawAngle(90, true)).toBe(270);
    expect(drawAngle(90, false)).toBe(90);
  });

  it('makes a straight drive travel further than a hook', () => {
    const straight = boundaryDistance(box, 0);
    const behind = boundaryDistance(box, 180);
    const square = boundaryDistance(box, 90);
    // The striker stands towards the bottom of the oval, so the long boundary
    // is the one they are driving towards.
    expect(straight).toBeGreaterThan(behind);
    expect(straight).toBeGreaterThan(square);
    expect(straight).toBeCloseTo(74 + PITCH_LENGTH / 2, 0);
    expect(behind).toBeCloseTo(74 - PITCH_LENGTH / 2, 0);
  });

  it('lands every boundary point on the rope', () => {
    for (let angle = 0; angle < 360; angle += 15) {
      const p = pointAt(box.striker, angle, boundaryDistance(box, angle));
      const dx = (p.x - box.centre.x) / 66;
      const dy = (p.y - box.centre.y) / 74;
      expect(dx * dx + dy * dy).toBeCloseTo(1, 6);
    }
  });

  it('never draws a shot past the rope', () => {
    const end = shotEnd(box, 0, 500);
    expect(end.y).toBeGreaterThanOrEqual(0);
    expect(end.y).toBeCloseTo(box.centre.y - 74, 6);
  });

  it('stops a fielded ball where it was stopped', () => {
    const end = shotEnd(box, 90, 20);
    expect(end.x - box.striker.x).toBeCloseTo(20, 6);
  });

  it('draws the circle around both sets of stumps', () => {
    const path = circlePath(box);
    expect(path.startsWith('M ')).toBe(true);
    expect(path.split('A')).toHaveLength(3);
  });

  it('stripes the outfield', () => {
    const bands = grassBands(box, 12);
    expect(bands).toHaveLength(6);
    expect(bands[0].height).toBeCloseTo(box.height / 12, 6);
  });

  it('names the regions of the field', () => {
    expect(regionOf(0)).toBe('straight');
    expect(regionOf(90)).toBe('point');
    expect(regionOf(180)).toBe('behind');
    expect(regionOf(270)).toBe('square leg');
    expect(regionOf(-45)).toBe('mid-wicket');
  });
});
