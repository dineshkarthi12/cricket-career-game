/**
 * Field placements and what they do to a shot.
 *
 * Angles use the same convention as `Ball.shotAngle`: 0 straight down the
 * ground, 90 square on the off side, 180 back past the keeper, 270 square leg.
 * Everything is described for a right-handed batter and mirrored for a lefty.
 */
import { MATCH } from '../config';
import { clamp01, normalise } from './skill';
import type { Rng } from './rng';
import type { FieldSetting, PlacedFielder, SimPlayer } from './types';
import type { MatchPhase } from '@/types';

interface PositionSpec {
  name: string;
  angle: number;
  distance: number;
  ring: 'CLOSE' | 'INNER' | 'OUTER';
}

/** Every position the AI captain can use, with where it stands. */
export const FIELD_POSITIONS: Record<string, PositionSpec> = {
  slip: { name: 'slip', angle: 160, distance: 14, ring: 'CLOSE' },
  secondSlip: { name: 'second slip', angle: 165, distance: 15, ring: 'CLOSE' },
  thirdSlip: { name: 'third slip', angle: 170, distance: 15, ring: 'CLOSE' },
  gully: { name: 'gully', angle: 140, distance: 16, ring: 'CLOSE' },
  shortLeg: { name: 'short leg', angle: 250, distance: 9, ring: 'CLOSE' },
  legSlip: { name: 'leg slip', angle: 200, distance: 14, ring: 'CLOSE' },
  sillyPoint: { name: 'silly point', angle: 100, distance: 9, ring: 'CLOSE' },
  point: { name: 'point', angle: 95, distance: 28, ring: 'INNER' },
  backwardPoint: { name: 'backward point', angle: 115, distance: 30, ring: 'INNER' },
  cover: { name: 'cover', angle: 65, distance: 30, ring: 'INNER' },
  extraCover: { name: 'extra cover', angle: 48, distance: 31, ring: 'INNER' },
  midOff: { name: 'mid-off', angle: 22, distance: 30, ring: 'INNER' },
  midOn: { name: 'mid-on', angle: 338, distance: 30, ring: 'INNER' },
  midWicket: { name: 'mid-wicket', angle: 305, distance: 30, ring: 'INNER' },
  squareLeg: { name: 'square leg', angle: 272, distance: 29, ring: 'INNER' },
  backwardSquareLeg: { name: 'backward square leg', angle: 245, distance: 30, ring: 'INNER' },
  fineLeg: { name: 'fine leg', angle: 212, distance: 60, ring: 'OUTER' },
  shortFineLeg: { name: 'short fine leg', angle: 215, distance: 30, ring: 'INNER' },
  thirdMan: { name: 'third man', angle: 148, distance: 62, ring: 'OUTER' },
  deepPoint: { name: 'deep point', angle: 98, distance: 62, ring: 'OUTER' },
  deepCover: { name: 'deep cover', angle: 60, distance: 64, ring: 'OUTER' },
  longOff: { name: 'long-off', angle: 22, distance: 68, ring: 'OUTER' },
  longOn: { name: 'long-on', angle: 338, distance: 68, ring: 'OUTER' },
  deepMidWicket: { name: 'deep mid-wicket', angle: 302, distance: 64, ring: 'OUTER' },
  deepSquareLeg: { name: 'deep square leg', angle: 270, distance: 62, ring: 'OUTER' },
  cowCorner: { name: 'cow corner', angle: 320, distance: 66, ring: 'OUTER' },
};

/** Named field settings the AI captain picks between. */
const FIELD_PRESETS: Record<string, string[]> = {
  ATTACKING_NEW_BALL: ['slip', 'secondSlip', 'gully', 'point', 'cover', 'midOff', 'midOn', 'midWicket', 'shortFineLeg'],
  ATTACKING_SPIN: ['slip', 'sillyPoint', 'shortLeg', 'point', 'cover', 'midOff', 'midOn', 'midWicket', 'squareLeg'],
  STANDARD: ['slip', 'point', 'cover', 'extraCover', 'midOff', 'midOn', 'midWicket', 'squareLeg', 'thirdMan'],
  DEFENSIVE_RING: ['point', 'backwardPoint', 'cover', 'extraCover', 'midOff', 'midOn', 'midWicket', 'squareLeg', 'shortFineLeg'],
  BOUNDARY_PROTECTION: ['point', 'cover', 'midOff', 'midOn', 'longOff', 'longOn', 'deepMidWicket', 'deepSquareLeg', 'thirdMan'],
  DEATH: ['midOff', 'midOn', 'longOff', 'longOn', 'deepMidWicket', 'deepSquareLeg', 'deepPoint', 'thirdMan', 'fineLeg'],
  POWERPLAY: ['slip', 'point', 'cover', 'midOff', 'midOn', 'midWicket', 'squareLeg', 'thirdMan', 'fineLeg'],
};

/**
 * Choose a field. Limited-overs powerplays keep catchers in; the death spreads
 * the boundary; a new ball or a turning pitch brings the close catchers back.
 */
export function chooseField(input: {
  phase: MatchPhase;
  bowlerKind: 'PACE' | 'SPIN';
  ballAgeOvers: number;
  wicketsLost: number;
  runRatePressure: number;
  unlimitedOvers: boolean;
}): string {
  const { phase, bowlerKind, ballAgeOvers, runRatePressure, unlimitedOvers } = input;

  if (phase === 'DEATH') return 'DEATH';
  if (phase === 'POWERPLAY') return 'POWERPLAY';
  if (unlimitedOvers) {
    if (ballAgeOvers < 12) return 'ATTACKING_NEW_BALL';
    if (bowlerKind === 'SPIN') return 'ATTACKING_SPIN';
    return 'STANDARD';
  }
  if (runRatePressure > 0.6) return 'BOUNDARY_PROTECTION';
  return 'DEFENSIVE_RING';
}

/** Put eleven players on the park: keeper, bowler and nine in the field. */
export function placeField(
  presetName: string,
  fieldingSide: SimPlayer[],
  bowlerId: string,
  rng: Rng,
): FieldSetting {
  const preset = FIELD_PRESETS[presetName] ?? FIELD_PRESETS.STANDARD;

  // The best gloves in the side keep wicket; everyone else is available.
  const keeper =
    fieldingSide.find((p) => p.role === 'WICKET_KEEPER_BATTER') ??
    [...fieldingSide].sort(
      (a, b) => b.attributes.fielding.wicketKeeping - a.attributes.fielding.wicketKeeping,
    )[0];

  const available = fieldingSide.filter((p) => p.id !== bowlerId && p.id !== keeper.id);

  // Sharpest hands go to the catching positions.
  const byCatching = [...available].sort(
    (a, b) => b.attributes.fielding.catching - a.attributes.fielding.catching,
  );

  const fielders: PlacedFielder[] = preset.slice(0, available.length).map((key, index) => {
    const spec = FIELD_POSITIONS[key] ?? FIELD_POSITIONS.point;
    const player = spec.ring === 'CLOSE' ? byCatching[index] : available[index];
    const f = player.attributes.fielding;
    return {
      playerId: player.id,
      name: player.name,
      position: spec.name,
      // A couple of degrees of drift so two matches never look identical.
      angle: (spec.angle + rng.spread() * 4 + 360) % 360,
      distance: Math.max(6, spec.distance + rng.spread() * 2),
      ring: spec.ring,
      catching: f.catching,
      groundFielding: f.groundFielding,
      throwing: f.throwing,
      agility: f.agility,
    };
  });

  return {
    name: presetName,
    fielders,
    keeperId: keeper.id,
    keeperName: keeper.name,
    keeperSkill: keeper.attributes.fielding.wicketKeeping,
  };
}

/** Shortest angular distance between two bearings, in degrees. */
export function angleGap(a: number, b: number): number {
  const diff = Math.abs(((a - b) % 360) + 360) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/**
 * The fielder best placed to do something about a shot, and how far they have
 * to move to reach it. Distance is a rough arc length, which is all the
 * catching and run-saving rolls need.
 */
export function nearestFielder(
  field: FieldSetting,
  angle: number,
  distance: number,
): { fielder: PlacedFielder; travel: number } | null {
  let best: PlacedFielder | null = null;
  let bestTravel = Infinity;

  for (const fielder of field.fielders) {
    const along = Math.abs(fielder.distance - distance);
    const across = (angleGap(fielder.angle, angle) / 180) * Math.PI * Math.min(fielder.distance, distance || 1);
    const travel = Math.hypot(along, across);
    if (travel < bestTravel) {
      bestTravel = travel;
      best = fielder;
    }
  }

  return best ? { fielder: best, travel: bestTravel } : null;
}

/** Chance a fielder holds a catch they have to travel `travel` metres for. */
export function catchChance(fielder: PlacedFielder, travel: number, inTheAir: number): number {
  const cfg = MATCH.fielding;
  if (travel > cfg.catchReach) return 0;
  const skill = normalise(fielder.catching * 0.75 + fielder.agility * 0.25);
  const base = cfg.baseCatch * (0.6 + 0.6 * skill);
  const reach = Math.max(0, 1 - travel * cfg.catchLossPerMetre);
  // A steepling top edge is easier than a flat, hard-hit chance.
  return clamp01(base * reach * clamp01(inTheAir));
}
