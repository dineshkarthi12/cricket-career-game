import type { Rating } from './primitives';

/**
 * Batting skills. `technique`, `timing`, `power`, `shotRange`, `vsPace` and
 * `vsSpin` are the six axes drawn on the Skill Development radar chart.
 */
export interface BattingAttributes {
  technique: Rating;
  timing: Rating;
  power: Rating;
  shotRange: Rating;
  vsPace: Rating;
  vsSpin: Rating;
  vsSwing: Rating;
  footwork: Rating;
  running: Rating;
  concentration: Rating;
}

export interface BowlingAttributes {
  pace: Rating;
  accuracy: Rating;
  swing: Rating;
  seam: Rating;
  spin: Rating;
  /** Loop and dip through the air. Drives a spinner's wicket-taking balls. */
  flight: Rating;
  bounce: Rating;
  variation: Rating;
  newBall: Rating;
  deathBowling: Rating;
  control: Rating;
}

export interface FieldingAttributes {
  catching: Rating;
  groundFielding: Rating;
  throwing: Rating;
  agility: Rating;
  wicketKeeping: Rating;
}

export interface PhysicalAttributes {
  stamina: Rating;
  strength: Rating;
  speed: Rating;
  /** Resistance to picking up injuries under workload. */
  durability: Rating;
}

export interface MentalAttributes {
  temperament: Rating;
  /** Reading the game: match-ups, field settings, when to accelerate. */
  matchAwareness: Rating;
  aggression: Rating;
  discipline: Rating;
  leadership: Rating;
  /** How fast training converts into permanent attribute growth. */
  workRate: Rating;
}

/** The complete skill profile of any player (career player or rival). */
export interface Attributes {
  batting: BattingAttributes;
  bowling: BowlingAttributes;
  fielding: FieldingAttributes;
  physical: PhysicalAttributes;
  mental: MentalAttributes;
}

/** Attribute group keys, useful for training plans and UI grouping. */
export type AttributeGroup = keyof Attributes;
