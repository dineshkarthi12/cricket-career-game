/**
 * Two-touch batting: the player taps LEFT or RIGHT as the ball arrives.
 *
 * The tap picks a side of the wicket (leg or off, relative to the batter) and
 * its moment grades the timing (early, good, perfect, late). Neither decides
 * the ball on its own: both only nudge contact, wicket and boundary chances
 * inside `resolveDelivery`, which still weighs the delivery, the bowler, the
 * conditions and the batter's own skill. Perfect timing does not guarantee a
 * boundary and the "right" side does not make a batter safe.
 *
 * Pure TypeScript: the screen measures when the tap happened, `gradeTiming`
 * turns that into a grade, and the grade travels to the engine with the ball.
 */
import { MATCH } from '../config';
import type { DeliveryLength, DeliveryLine, Difficulty, ShotType } from '@/types';

/** Side of the wicket the batter plays to, relative to the batter. */
export type TouchSide = 'LEG' | 'OFF';
export type TimingGrade = 'EARLY' | 'GOOD' | 'PERFECT' | 'LATE';
/** Which half of the screen a control sits on. */
export type ScreenSide = 'LEFT' | 'RIGHT';

export interface TouchShot {
  side: TouchSide;
  timing: TimingGrade;
}

export const TIMING_GRADES: TimingGrade[] = ['EARLY', 'GOOD', 'PERFECT', 'LATE'];

/**
 * Seen from behind the batter (the match camera), a right-hander's leg side
 * is on the left of the screen and their off side on the right; a left-hander
 * is the mirror image.
 */
export function sideForScreen(screen: ScreenSide, leftHanded: boolean): TouchSide {
  const leg = leftHanded ? 'RIGHT' : 'LEFT';
  return screen === leg ? 'LEG' : 'OFF';
}

export function screenForSide(side: TouchSide, leftHanded: boolean): ScreenSide {
  const legScreen: ScreenSide = leftHanded ? 'RIGHT' : 'LEFT';
  return side === 'LEG' ? legScreen : legScreen === 'LEFT' ? 'RIGHT' : 'LEFT';
}

export interface TimingWindow {
  /** How long the ball takes from release to bat, in ms, on screen. */
  travelMs: number;
  /** Moment of ideal contact, ms after release. */
  idealMs: number;
  /** Half-width of the perfect window, ms. */
  perfectMs: number;
  /** Half-width of the good window (includes perfect), ms. */
  goodMs: number;
  /** After this the ball is past the bat: no shot was offered. */
  missMs: number;
}

/**
 * The timing window for one delivery. Quicker bowling gives less time and a
 * narrower window; a batter with better timing and footwork gets a wider one;
 * difficulty widens or narrows it.
 */
export function timingWindow(input: {
  /** Expected delivery speed in km/h. */
  speedKmh: number;
  /** Batter's timing attribute, 0-100. */
  batterTiming: number;
  /** Batter's footwork attribute, 0-100. */
  batterFootwork?: number;
  difficulty?: Difficulty;
}): TimingWindow {
  const cfg = MATCH.touch.window;
  const speed = Math.max(60, Math.min(160, input.speedKmh));
  // 20 m of pitch at this speed, slowed down so a person can play it.
  const travelMs = Math.round((20 / (speed / 3.6)) * 1000 * cfg.slowdown);
  const skill = (input.batterTiming * 0.7 + (input.batterFootwork ?? input.batterTiming) * 0.3) / 100;
  const skillScale = cfg.skillMin + (cfg.skillMax - cfg.skillMin) * Math.max(0, Math.min(1, skill));
  const paceScale = Math.max(0.75, Math.min(1.25, 120 / speed));
  const difficultyScale = cfg.difficulty[input.difficulty ?? 'REALISTIC'];
  const scale = skillScale * paceScale * difficultyScale;
  return {
    travelMs,
    idealMs: Math.round(travelMs * cfg.idealAt),
    perfectMs: Math.round(cfg.perfectMs * scale),
    goodMs: Math.round(cfg.goodMs * scale),
    missMs: Math.round(travelMs * cfg.idealAt + cfg.missAfterMs),
  };
}

/**
 * Grade a tap made `pressedAtMs` after release. Returns null when the ball had
 * already gone past (no shot offered).
 */
export function gradeTiming(pressedAtMs: number, window: TimingWindow): TimingGrade | null {
  if (pressedAtMs > window.missMs) return null;
  const offset = pressedAtMs - window.idealMs;
  if (Math.abs(offset) <= window.perfectMs) return 'PERFECT';
  if (Math.abs(offset) <= window.goodMs) return 'GOOD';
  return offset < 0 ? 'EARLY' : 'LATE';
}

/**
 * How naturally a delivery's line goes to one side: 1 is the obvious shot
 * (a ball down leg flicked to leg), near 0 is fighting the line (a wide one
 * dragged across to leg).
 */
export function lineFit(side: TouchSide, line: DeliveryLine): number {
  const off: Record<DeliveryLine, number> = {
    WIDE_OFF: 1,
    OUTSIDE_OFF: 0.92,
    OFF_STUMP: 0.7,
    MIDDLE: 0.45,
    LEG_STUMP: 0.2,
    DOWN_LEG: 0.08,
  };
  const leg: Record<DeliveryLine, number> = {
    DOWN_LEG: 1,
    LEG_STUMP: 0.92,
    MIDDLE: 0.72,
    OFF_STUMP: 0.42,
    OUTSIDE_OFF: 0.18,
    WIDE_OFF: 0.06,
  };
  return (side === 'OFF' ? off : leg)[line] ?? 0.5;
}

export interface TouchEffect {
  /** Added to contact quality (0-1 scale). */
  contact: number;
  /** Multiplies the wicket chance. */
  wicket: number;
  /** Multiplies the four chance. */
  four: number;
  /** Multiplies the six chance. */
  six: number;
  fit: number;
}

/**
 * What the tap does to this ball. A defensive block (level 1) feels only a
 * small part of it: a late block can still find the edge, but defending is
 * never scored as if it were an attacking shot.
 */
export function touchEffect(touch: TouchShot, line: DeliveryLine, intentLevel: number): TouchEffect {
  const cfg = MATCH.touch;
  const t = cfg.timing[touch.timing];
  const fit = lineFit(touch.side, line);
  const across = cfg.lineFit;
  let wicket = t.wicket * (1 + (across.neutral - fit) * across.wicket);
  let contact = t.contact + (fit - across.neutral) * across.contact;
  const boundary = Math.max(0.2, across.boundaryBase + fit * across.boundary);
  let four = t.four * boundary;
  let six = t.six * boundary;
  if (intentLevel <= 1) {
    const share = cfg.defendShare;
    wicket = 1 + (wicket - 1) * share;
    contact *= share;
    four = 1 + (four - 1) * share;
    six = 1;
  }
  return { contact, wicket: Math.max(0.3, wicket), four: Math.max(0, four), six: Math.max(0, six), fit };
}

/** A shot that belongs on the chosen side for this length. */
export function touchShot(
  side: TouchSide,
  length: DeliveryLength,
  intentLevel: number,
  spin: boolean,
  pick: (p: number) => boolean,
): ShotType {
  if (intentLevel <= 1) return 'DEFEND';
  const big = intentLevel >= 5;
  if (side === 'OFF') {
    switch (length) {
      case 'SHORT':
      case 'SHORT_OF_GOOD':
        return big && pick(0.4) ? 'RAMP' : 'CUT';
      case 'YORKER':
        return 'DRIVE';
      case 'FULL':
      case 'FULL_TOSS':
        return big || (intentLevel >= 4 && pick(0.35)) ? 'LOFT' : 'DRIVE';
      default:
        if (spin && intentLevel >= 4 && pick(0.3)) return 'REVERSE_SWEEP';
        return big ? 'LOFT' : 'DRIVE';
    }
  }
  switch (length) {
    case 'SHORT':
      return pick(0.55) ? 'PULL' : 'HOOK';
    case 'SHORT_OF_GOOD':
      return 'PULL';
    case 'YORKER':
      return 'FLICK';
    case 'FULL':
    case 'FULL_TOSS':
      return big ? 'LOFT' : 'FLICK';
    default:
      if (spin && intentLevel >= 3 && pick(0.45)) return 'SWEEP';
      return big ? 'LOFT' : 'FLICK';
  }
}

/** Where a shot to this side goes, in degrees from a right-hander's view. */
export function touchAngle(side: TouchSide, shot: ShotType, spread: number): number {
  const base: Partial<Record<ShotType, number>> = side === 'OFF'
    ? { CUT: 100, DRIVE: 45, LOFT: 30, RAMP: 160, REVERSE_SWEEP: 120, DEFEND: 40 }
    : { PULL: 280, HOOK: 255, FLICK: 315, SWEEP: 260, LOFT: 330, DEFEND: 330 };
  const centre = base[shot] ?? (side === 'OFF' ? 60 : 300);
  const angle = centre + spread;
  // Keep it on the chosen side of the wicket.
  return side === 'OFF' ? Math.max(5, Math.min(175, angle)) : Math.max(185, Math.min(355, angle));
}

/** Short, human description of a timing grade. */
export function timingLabel(grade: TimingGrade): string {
  switch (grade) {
    case 'PERFECT':
      return 'Perfect timing';
    case 'GOOD':
      return 'Good timing';
    case 'EARLY':
      return 'Too early';
    case 'LATE':
      return 'Too late';
  }
}
