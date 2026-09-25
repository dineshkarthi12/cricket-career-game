/**
 * The AI captain and the AI batter: what to bowl, where to field, how hard to
 * go with the bat. Pure functions of the match situation.
 */
import { MATCH, MATCH_FORMATS } from '../config';
import { clamp01, normalise } from './skill';
import type { Rng } from './rng';
import type { BatterApproach, BowlerKind, BowlerPlan, SimPlayer } from './types';
import { INTENT_BY_LEVEL } from './types';
import type { DeliveryLength, DeliveryLine, MatchFormat, MatchPhase } from '@/types';

/** Situation the AI reads before every decision. */
export interface Situation {
  format: MatchFormat;
  phase: MatchPhase;
  oversBowled: number;
  totalOvers: number | null;
  wicketsLost: number;
  runsRequired: number | null;
  ballsRemaining: number | null;
  /** Runs per over the batting side is managing right now. */
  currentRunRate: number;
  /** Balls this batter has faced. */
  strikerBallsFaced: number;
  /** Runs this batter has made, for milestone nerves. */
  strikerRuns: number;
  /** Where the striker bats, 1-11. */
  strikerPosition: number;
  /** True when the batter at the other end is a tailender. */
  partnerIsTail: boolean;
  /** Consecutive dot balls this batter has faced. */
  consecutiveDots: number;
  /** Innings number, 1-4. */
  inningsNumber: number;
  /** For a multi-day match: is this side batting to save the game? */
  savingTheGame: boolean;
}

/** How hard the batter should be trying, 1-5. */
/**
 * When a side with this many wickets down should start going, as a share of
 * the innings. Three down and you can attack from three quarters of the way
 * in; five down and you wait a little longer; seven down and you are batting
 * to bat out the overs, not to score.
 */
function accelerationPoint(wicketsLost: number): number | null {
  if (wicketsLost <= 2) return 0.7;
  if (wicketsLost === 3) return 0.75;
  if (wicketsLost === 4) return 0.78;
  if (wicketsLost === 5) return 0.82;
  if (wicketsLost === 6) return 0.88;
  return null; // seven down: protect the tail and bat the overs out
}

export function chooseApproach(batter: SimPlayer, situation: Situation, rng: Rng): BatterApproach {
  const rates = MATCH_FORMATS[situation.format] ?? MATCH_FORMATS.ODI;
  const cfg = MATCH.batting;
  let level = rates.defaultIntent;

  // A new batter plays himself in whatever the format.
  if (situation.strikerBallsFaced < 8) level -= 1;

  const aggression = normalise(batter.attributes.mental.aggression);
  const awareness = normalise(batter.attributes.mental.matchAwareness);
  const isTail = situation.strikerPosition >= 9;

  if (situation.totalOvers !== null) {
    const oversLeft = situation.totalOvers - situation.oversBowled;
    const share = situation.oversBowled / situation.totalOvers;

    // Acceleration depends on what you have left in the shed, not just the
    // clock: three down at fifteen overs of a T20 is a green light, seven
    // down is not.
    const goFrom = accelerationPoint(situation.wicketsLost);
    if (goFrom !== null && share >= goFrom) level += share >= 0.9 ? 2 : 1;
    if (goFrom === null) level -= 1;

    if (share < MATCH.powerplayFraction && situation.wicketsLost <= 1) level += 1;
    if (situation.wicketsLost >= 8) level -= 1;

    if (situation.runsRequired !== null && situation.ballsRemaining !== null && situation.ballsRemaining > 0) {
      const required = (situation.runsRequired / situation.ballsRemaining) * 6;
      // A smart batter reads the required rate rather than just slogging.
      if (required > situation.currentRunRate + 3) level += awareness > 0.5 ? 2 : 1;
      else if (required > situation.currentRunRate + 1.2) level += 1;
      else if (required < situation.currentRunRate - 2 && oversLeft > 5) level -= 1;
    }
  } else {
    // Multi-day: occupy the crease unless there is a reason not to.
    if (situation.savingTheGame) level -= 1;
    if (situation.inningsNumber >= 3 && situation.runsRequired !== null) level += 1;
    if (situation.strikerBallsFaced > 60) level += 1;
  }

  // Roles. Openers and number threes bat time; the middle order finishes.
  if (cfg.anchorPositions.includes(situation.strikerPosition) && situation.strikerBallsFaced < 30) {
    level -= cfg.anchorIntentDrop;
  }
  if (cfg.finisherPositions.includes(situation.strikerPosition) && situation.strikerBallsFaced > 12) {
    level += cfg.finisherIntentBump;
  }

  // A tailender is not trying to play shots, unless there is nothing to lose.
  if (isTail && situation.runsRequired === null) level -= cfg.tailIntentDrop;

  // With the tail in, the recognised batter has to do the scoring.
  if (!isTail && situation.partnerIsTail) level += 1;

  // Nervous nineties: nobody wants to get out ten short of a hundred.
  const toMilestone = cfg.milestone.marks
    .map((mark) => mark - situation.strikerRuns)
    .filter((gap) => gap > 0 && gap <= cfg.milestone.window);
  if (toMilestone.length > 0) level -= cfg.milestone.intentDrop;

  // Dots build up, and eventually the batter goes looking for a release shot.
  const dots = Math.max(0, situation.consecutiveDots - MATCH.dotPressure.from);
  if (dots > 0) {
    level += Math.min(MATCH.dotPressure.maxIntent, dots * MATCH.dotPressure.intentPerDot);
  }

  // Personality, and a little noise so no two batters play the same way.
  level += aggression > 0.7 ? 1 : aggression < 0.3 ? -1 : 0;
  if (rng.chance(0.12)) level += rng.chance(0.5) ? 1 : -1;

  const bounded = Math.max(1, Math.min(5, Math.round(level)));
  return { intent: INTENT_BY_LEVEL[bounded - 1], level: bounded };
}

/** Which bowler comes on next, respecting spells, rest and over limits. */
/** A part-timer is someone who bowls, but is not really a bowler. */
export function isPartTimer(player: SimPlayer): boolean {
  if (player.bowlingStyle === 'NONE') return false;
  if (player.role === 'PACE_BOWLER' || player.role === 'SPIN_BOWLER') return false;
  if (player.role === 'BOWLING_ALLROUNDER') return false;
  return true;
}

export function chooseBowler(input: {
  bowlers: SimPlayer[];
  oversBowledBy: Record<string, number>;
  spellOvers: Record<string, number>;
  oversSinceBowled: Record<string, number>;
  lastBowlerId: string | null;
  format: MatchFormat;
  phase: MatchPhase;
  ballAgeOvers: number;
  /** 0-1 how much trouble the bowling side is in. */
  runRatePressure: number;
  /** How far through the innings, 0-1. */
  share: number;
  /** The captain's trust in each bowler, as a multiplier. 1 when unset. */
  trust?: Record<string, number>;
  rng: Rng;
}): SimPlayer {
  const rates = MATCH_FORMATS[input.format] ?? MATCH_FORMATS.ODI;
  const limit = rates.maxOversPerBowler;

  const eligible = input.bowlers.filter((b) => {
    if (b.id === input.lastBowlerId) return false; // no consecutive overs
    if (limit !== null && (input.oversBowledBy[b.id] ?? 0) >= limit) return false;
    return true;
  });

  const pool = eligible.length > 0 ? eligible : input.bowlers.filter((b) => b.id !== input.lastBowlerId);
  if (pool.length === 0) return input.bowlers[0];

  // With the game under control and plenty of overs left, a captain will
  // happily give a part-timer a go and save his front-liners for later.
  const cfg = MATCH.partTimer;
  const safe =
    input.runRatePressure < cfg.safeRunRatePressure &&
    input.share < cfg.beforeShare &&
    // Never with a new ball in hand.
    input.ballAgeOvers >= 10;
  if (safe && input.rng.chance(cfg.chance)) {
    const partTimers = pool.filter(isPartTimer);
    if (partTimers.length > 0) return input.rng.pick(partTimers);
  }

  const scored = pool.map((bowler) => {
    const w = bowler.attributes.bowling;
    const isPace = !['OFF_SPIN', 'LEG_SPIN', 'LEFT_ARM_ORTHODOX', 'LEFT_ARM_WRIST_SPIN'].includes(
      bowler.bowlingStyle,
    );
    let score = normalise(w.accuracy * 0.4 + w.control * 0.3 + (isPace ? w.pace : w.spin) * 0.3) * 100;

    // Right bowler for the moment. A spinner with the new ball is a rarity,
    // so the penalty is multiplicative rather than a flat subtraction - a
    // small deduction still left spin opening a quarter of the time.
    if (input.ballAgeOvers < 8) {
      if (isPace) score += normalise(w.newBall) * 45;
      else score *= 0.06;
    }
    // Save the best for the end: a specialist death bowler is held back until
    // the overs where he is worth the most.
    if (input.phase === 'DEATH') score += isPace ? normalise(w.deathBowling) * 50 : -10;
    // ...but never at the cost of opening the bowling with a spinner: the
    // hold-back only applies once the new ball has gone soft.
    else if (
      isPace &&
      normalise(w.deathBowling) > 0.7 &&
      input.ballAgeOvers >= 10 &&
      input.share < 0.6
    ) {
      score -= 22;
    }
    if (input.phase === 'MIDDLE' || input.phase === 'OLD_BALL') score += isPace ? 0 : 18;

    // Tired bowlers and long spells get a rest.
    const spell = input.spellOvers[bowler.id] ?? 0;
    const spellLimit = isPace ? MATCH.bowling.paceSpellOvers : MATCH.bowling.spinSpellOvers;
    if (spell >= spellLimit) score -= (spell - spellLimit + 1) * 22;
    score -= (bowler.condition.fatigue / 100) * 25;

    // Someone who has just been rested is ready to go again.
    const rested = input.oversSinceBowled[bowler.id] ?? 99;
    if (rested >= MATCH.bowling.recoveryOvers) score += 10;

    // Spread the load across the attack.
    if (limit !== null) {
      const used = input.oversBowledBy[bowler.id] ?? 0;
      score -= (used / limit) * 30;
    }

    // A captain gives the ball to the bowlers he believes in.
    const trust = input.trust?.[bowler.id] ?? 1;
    return { item: bowler, weight: Math.max(1, score * trust) };
  });

  return input.rng.weighted(scored);
}

/** What the bowler is trying with this ball. */
export function choosePlan(input: {
  bowler: SimPlayer;
  kind: BowlerKind;
  phase: MatchPhase;
  batterIntentLevel: number;
  batterBallsFaced: number;
  /** Bowling aggression 1-5; 3 (the default) leaves the plan untouched. */
  aggression?: number;
  rng: Rng;
}): BowlerPlan {
  const { bowler, kind, phase, rng } = input;
  const w = bowler.attributes.bowling;
  // Defensive bowling lives in the channel outside off; all-out attack goes
  // for the stumps, the yorker, the bouncer and the variations.
  const ag = MATCH.bowlingAggression;
  const index = Math.max(0, Math.min(4, Math.round(input.aggression ?? 3) - 1));
  const byLength = (item: DeliveryLength, weight: number) => ({ item, weight: weight * ag.length[item][index] });
  const byLine = (item: DeliveryLine, weight: number) => ({ item, weight: weight * ag.line[item][index] });

  // Length.
  const lengthWeights: { item: DeliveryLength; weight: number }[] =
    kind === 'PACE'
      ? [
          byLength('YORKER', phase === 'DEATH' ? 26 + normalise(w.deathBowling) * 30 : 4),
          byLength('FULL', phase === 'DEATH' ? 16 : 18),
          byLength('GOOD', 40),
          byLength('SHORT_OF_GOOD', 24),
          byLength('SHORT', input.batterIntentLevel >= 4 ? 16 : 9),
          byLength('FULL_TOSS', 2),
        ]
      : [
          byLength('FULL', 22),
          byLength('GOOD', 48),
          byLength('SHORT_OF_GOOD', 20),
          byLength('SHORT', 5),
          byLength('FULL_TOSS', 3),
          byLength('YORKER', 2),
        ];
  const length = rng.weighted(lengthWeights);

  // Line. A new batter sees a lot of balls in the corridor.
  const settling = input.batterBallsFaced < 10;
  const line = rng.weighted<DeliveryLine>([
    byLine('WIDE_OFF', phase === 'DEATH' ? 10 : 4),
    byLine('OUTSIDE_OFF', settling ? 34 : 26),
    byLine('OFF_STUMP', 30),
    byLine('MIDDLE', 20),
    byLine('LEG_STUMP', 10),
    byLine('DOWN_LEG', 4),
  ]);

  // Variation, if they have one worth using.
  const variationSkill = normalise(w.variation);
  let variation: string | null = null;
  if (rng.chance(Math.min(0.95, (0.1 + variationSkill * 0.3) * ag.variation[index]))) {
    variation =
      kind === 'PACE'
        ? rng.pick(['slower ball', 'cutter', 'bouncer', 'wide yorker', 'knuckle ball'])
        : bowler.bowlingStyle === 'LEG_SPIN' || bowler.bowlingStyle === 'LEFT_ARM_WRIST_SPIN'
          ? rng.pick(['googly', 'flipper', 'slider', 'top spinner'])
          : rng.pick(['arm ball', 'doosra', 'carrom ball', 'quicker one']);
  }

  // Speed.
  const base = kind === 'PACE' ? 118 + normalise(w.pace) * 32 : 78 + normalise(w.pace) * 18;
  const speed = Math.round(base + (variation === 'slower ball' ? -14 : 0) + rng.spread() * 4);

  return { length, line, variation, speed };
}

/** How much the chasing side is under the pump, 0-1. Drives field settings. */
export function runRatePressure(situation: Situation): number {
  if (situation.runsRequired === null || situation.ballsRemaining === null || situation.ballsRemaining <= 0) {
    return clamp01((situation.currentRunRate - 5) / 5);
  }
  const required = (situation.runsRequired / situation.ballsRemaining) * 6;
  return clamp01((required - 4) / 8);
}
