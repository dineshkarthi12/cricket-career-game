/**
 * Turning attributes and condition into the two numbers the delivery resolver
 * actually argues with: how good the batter is right now, and how good the
 * bowler is right now. Both come out on a 0-1 scale.
 */
import { MATCH } from '../config';
import type { BowlerKind, DeliveryContext, SimPlayer } from './types';
import type { Condition } from '@/types';

/** Map a 1-99 rating onto 0-1, where 30 is raw club and 85 is international. */
export function normalise(rating: number): number {
  const { floor, ceiling } = MATCH.skill;
  return clamp01((rating - floor) / (ceiling - floor));
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp01(t);
}

/**
 * How much of their ability a player can call on today. Form and confidence
 * swing it either way; fatigue and poor fitness only take away.
 */
export function conditionMultiplier(condition: Condition): number {
  const cfg = MATCH.condition;
  const form = ((condition.form - 50) / 50) * cfg.formSwing;
  const confidence = ((condition.confidence - 50) / 50) * cfg.confidenceSwing;
  const fatigue = -(condition.fatigue / 100) * cfg.fatiguePenalty;
  const fitness = -(1 - condition.fitness / 100) * cfg.fitnessPenalty;
  return Math.max(0.35, 1 + form + confidence + fatigue + fitness);
}

/** Pace or spin, from the bowling style. */
export function bowlerKindOf(player: SimPlayer): BowlerKind {
  switch (player.bowlingStyle) {
    case 'OFF_SPIN':
    case 'LEG_SPIN':
    case 'LEFT_ARM_ORTHODOX':
    case 'LEFT_ARM_WRIST_SPIN':
      return 'SPIN';
    default:
      return 'PACE';
  }
}

/**
 * Batting ability against this particular bowler. Technique and timing carry
 * most of it; the vsPace / vsSpin match-up decides the rest.
 */
export function batterSkill(context: DeliveryContext): number {
  const { striker, bowlerKind } = context;
  const b = striker.attributes.batting;
  const matchup = bowlerKind === 'PACE' ? b.vsPace : b.vsSpin;

  const core =
    b.technique * 0.26 +
    b.timing * 0.24 +
    matchup * 0.22 +
    b.shotRange * 0.12 +
    b.footwork * 0.1 +
    b.concentration * 0.06;

  const raw = normalise(core) * conditionMultiplier(striker.condition);

  // A batter who has only just walked in is not yet the player they will be.
  const settle = clamp01(context.strikerBallsFaced / MATCH.newBatter.settleBalls);
  return clamp01(raw * lerp(0.74, 1, settle));
}

/** Power decides whether a well-timed shot clears the rope. */
export function batterPower(striker: SimPlayer): number {
  const b = striker.attributes.batting;
  return clamp01(normalise(b.power * 0.7 + striker.attributes.physical.strength * 0.3));
}

/**
 * Bowling ability, including whatever the pitch is offering this bowler type.
 * `pitchHelp` is added separately so the caller can report it.
 */
export function bowlerSkill(context: DeliveryContext): number {
  const { bowler, bowlerKind } = context;
  const w = bowler.attributes.bowling;

  const core =
    bowlerKind === 'PACE'
      ? w.accuracy * 0.28 + w.control * 0.2 + w.pace * 0.18 + w.seam * 0.14 + w.swing * 0.12 + w.variation * 0.08
      : w.accuracy * 0.28 + w.control * 0.22 + w.spin * 0.22 + w.variation * 0.12 + w.flight * 0.1 + w.bounce * 0.06;

  const raw = normalise(core) * conditionMultiplier(bowler.condition);

  // A bowler kept on too long in one spell loses their edge.
  const spellLimit =
    bowlerKind === 'PACE' ? MATCH.bowling.paceSpellOvers : MATCH.bowling.spinSpellOvers;
  const overWorked = Math.max(0, context.spellOvers - spellLimit);
  const tired = overWorked * MATCH.bowling.tiredPenaltyPerOver;

  return clamp01(raw - tired);
}

/**
 * Pressure the batter is under, 0-100, resolved against their temperament and
 * confidence. Returns the share of the pressure that actually gets through.
 */
export function pressureBite(context: DeliveryContext): number {
  const mental = context.striker.attributes.mental;
  const relief =
    normalise(mental.temperament) * MATCH.pressure.temperamentRelief * 0.7 +
    clamp01(context.striker.condition.confidence / 100) * MATCH.pressure.temperamentRelief * 0.3;
  return clamp01((context.pressure / 100) * (1 - clamp01(relief)));
}

/**
 * Situational pressure from the match state. Chasing a steep rate with few
 * wickets in hand in front of a big crowd is the worst place to bat.
 */
export function computePressure(input: {
  runsRequired: number | null;
  ballsRemaining: number | null;
  wicketsLost: number;
  currentRunRate: number;
  knockout: boolean;
  crowdFactor: number;
  battingAtHome: boolean;
}): number {
  const cfg = MATCH.pressure;
  let pressure = 0;

  if (input.runsRequired !== null && input.ballsRemaining !== null && input.ballsRemaining > 0) {
    const required = (input.runsRequired / input.ballsRemaining) * 6;
    const gap = required - Math.max(2, input.currentRunRate);
    pressure += clamp01(gap / 6) * cfg.requiredRateWeight;
    pressure += cfg.chaseWeight * clamp01(1 - input.ballsRemaining / 300);
  }

  pressure += clamp01(input.wicketsLost / 9) * cfg.wicketsLostWeight;
  if (input.knockout) pressure += cfg.knockoutWeight;
  pressure += clamp01(input.crowdFactor) * cfg.crowdWeight * (input.battingAtHome ? 0.4 : 1);

  return Math.max(0, Math.min(100, pressure));
}
