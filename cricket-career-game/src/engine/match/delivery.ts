/**
 * Resolve one delivery.
 *
 * The order is the one in GAME_SPEC.md §5: the bowler executes a plan, the
 * conditions decide how dangerous the ball is, the batter's skill and intent
 * decide the quality of contact, and the outcome falls out of the two.
 */
import { MATCH, MATCH_FORMATS } from '../config';
import { bounceOnOffer, seamOnOffer, swingOnOffer, turnOnOffer } from './conditions';
import { catchChance, nearestFielder } from './field';
import {
  batterPower,
  batterSkill,
  bowlerSkill,
  clamp01,
  matchupBonus,
  normalise,
  pacePreference,
  pressureBite,
  setLevel,
} from './skill';
import { describeBall } from './commentary';
import type { Rng } from './rng';
import type { DeliveryContext, DeliveryOutcome } from './types';
import type { DismissalType, ShotType } from '@/types';

/** How far off the intended spot the ball landed, 0 (perfect) to 1 (dreadful). */
function executionError(context: DeliveryContext, rng: Rng): number {
  const cfg = MATCH.execution;
  const accuracy = normalise(
    context.bowler.attributes.bowling.accuracy * 0.6 + context.bowler.attributes.bowling.control * 0.4,
  );
  const fatigue = (context.bowler.condition.fatigue / 100) * cfg.fatiguePenalty;
  // Resetting the line for a left-right pair every single costs a bowler.
  const leftRight =
    context.striker.battingStyle !== context.nonStriker.battingStyle
      ? MATCH.batting.leftRightDisruption
      : 0;
  // A wet ball is hard to grip, so the bowler's execution suffers.
  const dew = context.dew * MATCH.weather.dewGripLoss;
  const skill = clamp01(cfg.baseAccuracy * (0.5 + accuracy) - fatigue - leftRight - dew);
  // Coming round the wicket means a wider position on the crease to hit from.
  const angle = context.aroundTheWicket ? MATCH.aroundTheWicket.executionPenalty : 1;
  // Even the best bowler misses; even the worst lands one on the spot.
  return clamp01(Math.abs(rng.spread()) * (1.25 - skill) * angle);
}

/** Wides and no-balls, which come out of the same wayward-bowling roll. */
function rollIllegal(
  context: DeliveryContext,
  error: number,
  rng: Rng,
): { type: 'WIDE' | 'NO_BALL'; runs: number } | null {
  const cfg = MATCH.execution;
  const scale = 1 + error * cfg.inaccuracyExtraScale;
  // Bowlers go wider at the death, and a wide line is a wide in limited overs.
  const wideScale =
    (context.phase === 'DEATH' ? 1.9 : 1) *
    (context.aroundTheWicket ? MATCH.aroundTheWicket.wideRate : 1);
  if (rng.chance(cfg.wideChance * scale * wideScale)) return { type: 'WIDE', runs: 1 };
  if (rng.chance(cfg.noBallChance * scale)) return { type: 'NO_BALL', runs: 1 };
  return null;
}

/**
 * How threatening the delivery is, 0-1, from what the conditions offer and
 * how well the bowler landed it.
 */
function deliveryThreat(context: DeliveryContext, error: number): number {
  const { conditions, bowlerKind, plan } = context;
  const { pitch, weather, ball } = conditions;

  const swing = swingOnOffer(pitch, weather, ball);
  const seam = seamOnOffer(pitch, ball);
  const turn = turnOnOffer(pitch, context.dew);
  const bounce = bounceOnOffer(pitch, ball);

  const w = context.bowler.attributes.bowling;
  const movement =
    bowlerKind === 'PACE'
      ? (swing / 100) * normalise(w.swing) * MATCH.pitch.swingWicket +
        (seam / 100) * normalise(w.seam) * MATCH.pitch.seamWicket
      : (turn / 100) * normalise(w.spin) * MATCH.pitch.turnWicket +
        (pitch.turn / 100) * normalise(w.flight) * 0.2;

  const carry = (bounce / 100) * MATCH.pitch.bounceCaught * (bowlerKind === 'PACE' ? 1 : 0.5);
  const hardToBat = 1 - pitch.battingEase / 100;

  // A delivery that misses its length is a lot less dangerous.
  const execution = 1 - error * MATCH.execution.missPenalty;

  const variationBonus = plan.variation ? normalise(w.variation) * 0.14 : 0;

  // The match-up: which way the ball is going for this batter, and whether
  // they would rather be facing pace or spin.
  const matchup =
    matchupBonus(context.bowler, context.striker) -
    pacePreference(context.striker, bowlerKind) * MATCH.matchup.preference;

  // Soft saturation rather than a hard clamp. A hard clamp let a seaming pitch
  // peg threat at 1, after which extra swing from cloud cover did nothing at
  // all; this keeps every extra degree of movement worth something.
  const raw = Math.max(0, (movement + carry + hardToBat * 0.35 + variationBonus + matchup) * execution);
  return raw / (1 + raw);
}

/** Pick the shot the batter played, from length, line and how hard they went. */
function chooseShot(context: DeliveryContext, contact: number, rng: Rng): ShotType {
  const { plan, approach } = context;
  const attacking = approach.level >= 4 || (approach.level === 3 && contact > 0.55);

  if (!attacking && contact < 0.4) return rng.chance(0.75) ? 'DEFEND' : 'LEAVE';
  if (approach.level === 1) return rng.chance(0.9) ? 'BLOCK' : 'DEFEND';

  const onSide = plan.line === 'LEG_STUMP' || plan.line === 'DOWN_LEG' || plan.line === 'MIDDLE';

  switch (plan.length) {
    case 'YORKER':
      return rng.chance(0.6) ? 'FLICK' : 'DEFEND';
    case 'FULL_TOSS':
    case 'FULL':
      if (onSide) return rng.chance(0.55) ? 'FLICK' : 'DRIVE';
      return rng.chance(0.75) ? 'DRIVE' : 'LOFT';
    case 'SHORT':
      if (onSide) return rng.chance(0.6) ? 'PULL' : 'HOOK';
      return rng.chance(0.55) ? 'CUT' : 'PULL';
    case 'SHORT_OF_GOOD':
      return onSide ? 'PULL' : rng.chance(0.5) ? 'CUT' : 'DEFEND';
    case 'GOOD':
    default:
      if (context.bowlerKind === 'SPIN' && approach.level >= 4) {
        return rng.chance(0.25) ? 'SWEEP' : rng.chance(0.2) ? 'REVERSE_SWEEP' : 'DRIVE';
      }
      if (attacking) return rng.chance(0.3) ? 'LOFT' : 'DRIVE';
      return 'DEFEND';
  }
}

/**
 * Bend the natural angle for a shot towards where the batter was trying to
 * hit. A well-timed shot from a good player goes close to the chosen side; a
 * mishit still goes wherever the edge takes it.
 */
function steer(
  natural: number,
  preference: number | null | undefined,
  contact: number,
  technique: number,
): number {
  if (preference === null || preference === undefined) return natural;
  const cfg = MATCH.shotPreference;
  const control = clamp01(contact) * (1 - cfg.skillWeight + cfg.skillWeight * normalise(technique));
  const pull = cfg.pull * control;
  // Interpolate the short way round the circle.
  let delta = ((preference - natural + 540) % 360) - 180;
  delta *= pull;
  return (natural + delta + 360) % 360;
}

/** Where a given shot tends to go, in degrees. */
const SHOT_ANGLES: Record<ShotType, { angle: number; spread: number }> = {
  DEFEND: { angle: 20, spread: 55 },
  LEAVE: { angle: 175, spread: 10 },
  BLOCK: { angle: 10, spread: 40 },
  DRIVE: { angle: 35, spread: 45 },
  CUT: { angle: 110, spread: 28 },
  PULL: { angle: 290, spread: 32 },
  HOOK: { angle: 250, spread: 28 },
  SWEEP: { angle: 255, spread: 30 },
  REVERSE_SWEEP: { angle: 125, spread: 28 },
  FLICK: { angle: 320, spread: 35 },
  LOFT: { angle: 350, spread: 60 },
  RAMP: { angle: 175, spread: 25 },
};

/** Resolve one legal or illegal delivery into everything the scorecard needs. */
export function resolveDelivery(context: DeliveryContext, rng: Rng): DeliveryOutcome {
  const rates = MATCH_FORMATS[context.format] ?? MATCH_FORMATS.ODI;
  const cfg = MATCH;

  const error = executionError(context, rng);
  const speed = Math.round(
    context.plan.speed * (1 + rng.spread() * 0.04) - (context.bowler.condition.fatigue / 100) * 4,
  );

  // --- Wides and no-balls come before anything else happens ---------------
  const illegal = rollIllegal(context, error, rng);
  if (illegal) {
    return {
      runsOffBat: 0,
      extras: illegal,
      isLegalDelivery: false,
      isBoundaryFour: false,
      isBoundarySix: false,
      wicket: null,
      dismissedPlayerId: null,
      shot: null,
      contactQuality: 0,
      shotAngle: null,
      shotDistance: null,
      fielderName: null,
      speed,
      strikeRotated: false,
      review: null,
      dropped: null,
      retired: null,
      commentary: describeBall({ context, kind: illegal.type === 'WIDE' ? 'WIDE' : 'NO_BALL' }),
    };
  }

  // --- The duel -----------------------------------------------------------
  const batter = batterSkill(context);
  const bowler = bowlerSkill(context);
  const threat = deliveryThreat(context, error);
  const bite = pressureBite(context);

  const edge = Math.max(-cfg.edge.clamp, Math.min(cfg.edge.clamp, batter - bowler));
  const intentIndex = Math.max(0, Math.min(4, context.approach.level - 1));

  // Quality of contact drives everything downstream.
  const contact = clamp01(
    0.5 + (edge - threat * 0.55) * 0.6 + rng.spread() * 0.3 - bite * 0.18,
  );

  const settle = clamp01(context.strikerBallsFaced / cfg.newBatter.settleBalls);
  const set = setLevel(context.strikerBallsFaced);
  const phaseMod = cfg.phase[context.phase] ?? { boundary: 1, wicket: 1, dot: 1 };

  // --- Dot-ball pressure ---------------------------------------------------
  // A batter who has not scored for an over starts looking for a release
  // shot, and that is usually when the wicket comes.
  const dots = Math.max(0, context.consecutiveDots - cfg.dotPressure.from);
  const dotWicket = 1 + Math.min(cfg.dotPressure.maxWicket, dots * cfg.dotPressure.wicketPerDot);

  // --- Milestone nerves ----------------------------------------------------
  const nearMilestone = cfg.batting.milestone.marks.some((mark) => {
    const gap = mark - context.strikerRuns;
    return gap > 0 && gap <= cfg.batting.milestone.window;
  });
  const milestone = nearMilestone ? cfg.batting.milestone.wicketBump : 1;

  // --- Momentum ------------------------------------------------------------
  // Wickets come in clusters: a new batter walking in while the last two went
  // cheaply is in far more trouble than the same batter in a calm innings.
  const cluster = Math.max(0, context.recentWickets - 1);
  const collapse = 1 + cluster * cfg.momentum.collapseWicket;
  // The other side of it: a pair who have been in for twenty overs have worn
  // the bowling down, and the captain is running out of ideas.
  const partnership = clamp01(context.partnershipBalls / cfg.momentum.settledPartnershipBalls);

  // --- Wicket -------------------------------------------------------------
  const defaultIntentIndex = Math.max(0, Math.min(4, rates.defaultIntent - 1));

  let pWicket =
    rates.wicket *
    (0.55 + 0.9 * threat) *
    (cfg.intent.wicket[intentIndex] / cfg.intent.wicket[defaultIntentIndex]) *
    (1 - edge * cfg.edge.wicket) *
    phaseMod.wicket *
    (1 + bite * cfg.pressure.wicketAtMax) *
    (1 + (1 - settle) * cfg.newBatter.wicketPenalty) *
    (1 - set * (1 - cfg.setBatter.wicket)) *
    collapse *
    dotWicket *
    milestone *
    (1 - partnership * cfg.momentum.settledPartnershipWicket) *
    (1 + (0.5 - context.conditions.pitch.battingEase / 100) * cfg.pitch.battingEaseWicket * 2);
  pWicket = clamp01(
    Math.max(
      rates.wicket * cfg.limits.wicketFloor,
      Math.min(rates.wicket * cfg.limits.wicketCeiling, pWicket),
    ),
  );

  // --- Boundaries ---------------------------------------------------------
  const power = batterPower(context.striker);
  const boundaryBase =
    (1 + edge * cfg.edge.boundary) *
    phaseMod.boundary *
    (1 - (1 - settle) * cfg.newBatter.boundaryPenalty) *
    (1 + set * (cfg.setBatter.boundary - 1)) *
    (cluster > 0 ? cfg.momentum.collapseBoundary : 1) *
    (1 + partnership * cfg.momentum.settledPartnershipBoundary);
  const softBall = context.conditions.ball.hardness < 55 ? cfg.ball.softBallBoundary : 1;
  const easeBoundary = 1 + (context.conditions.pitch.battingEase / 100 - 0.5) * cfg.pitch.battingEaseBoundary * 2;

  const intentBoundary = cfg.intent.boundary[intentIndex] / cfg.intent.boundary[defaultIntentIndex];

  const capped = Math.min(cfg.limits.boundaryCeiling, intentBoundary * boundaryBase * easeBoundary);

  let pFour = clamp01(rates.four * capped * softBall * (0.62 + contact * 0.76));
  // Ground size matters: a short square boundary turns a mis-hit pull into
  // six, a long straight one keeps the same shot in the ground.
  const meanBoundary = (context.boundaries.straight + context.boundaries.square) / 2;
  const groundSize = clamp01(1 + (68 - meanBoundary) / 40);

  let pSix = clamp01(
    rates.six * capped * (0.5 + power * 1.0) * (0.45 + contact * 1.1) * (0.6 + groundSize * 0.8),
  );

  // Nothing can be more likely than the total probability space allows.
  const total = pWicket + pFour + pSix;
  if (total > 0.92) {
    const scale = 0.92 / total;
    pWicket *= scale;
    pFour *= scale;
    pSix *= scale;
  }

  // On a free hit only a run-out can end the innings, and the batter knows
  // it, so the boundary chance goes up.
  if (context.freeHit) {
    pWicket = 0;
    pFour *= MATCH.freeHit.boundaryBonus;
    pSix *= MATCH.freeHit.boundaryBonus;
  }

  const roll = rng.next();

  if (roll < pWicket) {
    return resolveWicket(context, { contact, threat, speed }, rng);
  }

  if (roll < pWicket + pSix) {
    return resolveBoundary(context, { contact, speed, six: true }, rng);
  }

  if (roll < pWicket + pSix + pFour) {
    return resolveBoundary(context, { contact, speed, six: false }, rng);
  }

  // --- Everything else: dots, ones, twos, threes --------------------------
  return resolvePlacedShot(
    context,
    { contact, edge, speed, intentIndex, phaseDot: phaseMod.dot, cluster },
    rng,
  );
}

/** A wicket: work out how, and who takes the catch. */
function resolveWicket(
  context: DeliveryContext,
  input: { contact: number; threat: number; speed: number },
  rng: Rng,
): DeliveryOutcome {
  const { plan, bowlerKind, field, striker } = context;
  const weights = { ...MATCH.dismissal };

  // The delivery's own shape decides how the batter is most likely to go.
  const full = plan.length === 'YORKER' || plan.length === 'FULL' || plan.length === 'FULL_TOSS';
  const short = plan.length === 'SHORT' || plan.length === 'SHORT_OF_GOOD';
  const straight = plan.line === 'MIDDLE' || plan.line === 'OFF_STUMP' || plan.line === 'LEG_STUMP';
  const wide = plan.line === 'WIDE_OFF' || plan.line === 'OUTSIDE_OFF';

  if (full && straight) {
    weights.BOWLED *= 2.4;
    weights.LBW *= 2.6;
    weights.CAUGHT *= 0.5;
  }
  if (short) {
    weights.CAUGHT *= 1.8;
    weights.BOWLED *= 0.35;
    weights.LBW *= 0.2;
  }
  if (wide) {
    weights.CAUGHT_BEHIND *= 2.6;
    weights.CAUGHT *= 1.3;
    weights.LBW *= 0.25;
    weights.BOWLED *= 0.5;
  }
  if (bowlerKind === 'SPIN') {
    weights.STUMPED *= context.approach.level >= 4 ? 6 : 2.5;
    weights.CAUGHT_AND_BOWLED *= 1.4;
    weights.CAUGHT_BEHIND *= 0.7;
  } else {
    weights.STUMPED = 0;
  }
  if (context.approach.level >= 4) {
    weights.CAUGHT *= 1.5;
    weights.LBW *= 0.75;
  }
  if (context.aroundTheWicket) {
    const cfg = MATCH.aroundTheWicket;
    weights.LBW *= cfg.lbw;
    weights.BOWLED *= cfg.bowled;
    weights.CAUGHT_BEHIND *= cfg.caughtBehind;
    weights.CAUGHT *= cfg.caught;
  }

  const type = rng.weighted<DismissalType>(
    (Object.keys(weights) as DismissalType[]).map((item) => ({ item, weight: weights[item] })),
  );

  // Where the ball went, so the ground view can draw the chance.
  const shot = chooseShot(context, input.contact, rng);
  const spec = SHOT_ANGLES[shot];
  const angle = steer(
    (spec.angle + rng.spread() * spec.spread + 360) % 360,
    context.shotPreference,
    input.contact,
    context.striker.attributes.batting.technique,
  );
  const distance = Math.max(4, 12 + input.contact * 34 + rng.spread() * 8);

  let fielderName: string | null = null;
  if (type === 'CAUGHT') {
    const nearest = nearestFielder(field, angle, distance);
    fielderName = nearest?.fielder.name ?? field.fielders[0]?.name ?? null;
  } else if (type === 'CAUGHT_BEHIND' || type === 'STUMPED') {
    fielderName = field.keeperName;
  } else if (type === 'CAUGHT_AND_BOWLED') {
    fielderName = context.bowler.name;
  }

  const fielderId =
    type === 'CAUGHT'
      ? (field.fielders.find((f) => f.name === fielderName)?.playerId ?? null)
      : type === 'CAUGHT_BEHIND' || type === 'STUMPED'
        ? field.keeperId
        : type === 'CAUGHT_AND_BOWLED'
          ? context.bowler.id
          : null;

  // --- Did the catch actually stick? --------------------------------------
  // The ball has gone to hand, so this is a regulation chance rather than
  // one the fielder has to chase; skill decides whether it is held.
  if (type === 'CAUGHT') {
    const nearest = nearestFielder(field, angle, distance);
    if (nearest) {
      const held = clamp01(
        MATCH.fielding.regulationCatch +
          normalise(nearest.fielder.catching) * MATCH.fielding.regulationCatchSkill,
      );
      if (!rng.chance(held)) {
        // Put down. The batter carries on, and they usually run one.
        const runs = rng.chance(0.55) ? 1 : 0;
        return {
          runsOffBat: runs,
          extras: null,
          isLegalDelivery: true,
          isBoundaryFour: false,
          isBoundarySix: false,
          wicket: null,
          dismissedPlayerId: null,
          shot,
          contactQuality: Math.round(input.contact * 100),
          shotAngle: angle,
          shotDistance: distance,
          fielderName: nearest.fielder.name,
          speed: input.speed,
          strikeRotated: runs % 2 === 1,
          review: null,
          dropped: { fielderName: nearest.fielder.name },
          retired: null,
          commentary: `Chance! ${nearest.fielder.name} puts down ${striker.name} off ${context.bowler.name}.`,
        };
      }
    }
  }

  // --- The umpire, and the review system ----------------------------------
  // Only lbw and caught behind are close enough to be worth reviewing.
  const reviewable = type === 'LBW' || type === 'CAUGHT_BEHIND';
  let review: DeliveryOutcome['review'] = null;

  if (reviewable) {
    const cfg = MATCH.umpiring;
    const wrong = rng.chance(cfg.wrongDecisionChance);
    const hasReview = context.reviewsLeft.batting > 0;

    if (hasReview) {
      // A side that reviews well spots the wrong ones and leaves the rest.
      const shouldReview = wrong
        ? rng.chance(cfg.reviewJudgement + 0.35)
        : rng.chance(cfg.speculativeReviewChance);

      if (shouldReview) {
        if (wrong) {
          const umpiresCall = rng.chance(cfg.umpiresCallShare);
          if (umpiresCall) {
            review = { by: 'BATTING', outcome: 'UMPIRES_CALL' };
          } else {
            // Overturned: the batter survives.
            return {
              runsOffBat: 0,
              extras: null,
              isLegalDelivery: true,
              isBoundaryFour: false,
              isBoundarySix: false,
              wicket: null,
              dismissedPlayerId: null,
              shot,
              contactQuality: Math.round(input.contact * 100),
              shotAngle: angle,
              shotDistance: distance,
              fielderName: null,
              speed: input.speed,
              strikeRotated: false,
              review: { by: 'BATTING', outcome: 'OVERTURNED' },
              dropped: null,
              retired: null,
              commentary: `${striker.name} reviews... and the replay saves him. Not out, the decision is overturned.`,
            };
          }
        } else {
          review = { by: 'BATTING', outcome: 'UPHELD' };
        }
      }
    }
  }

  return {
    runsOffBat: 0,
    extras: null,
    isLegalDelivery: true,
    isBoundaryFour: false,
    isBoundarySix: false,
    wicket: { type, bowlerId: context.bowler.id, fielderId },
    dismissedPlayerId: striker.id,
    shot,
    contactQuality: Math.round(input.contact * 100),
    shotAngle: angle,
    shotDistance: distance,
    fielderName,
    speed: input.speed,
    strikeRotated: false,
    review,
    dropped: null,
    retired: null,
    commentary:
      review?.outcome === 'UMPIRES_CALL'
        ? `${striker.name} reviews, and it is umpire's call. The decision stands - out.`
        : describeBall({ context, kind: 'WICKET', dismissal: type, fielderName, shot }),
  };
}

/** A four or a six - unless a boundary rider gets under it. */
function resolveBoundary(
  context: DeliveryContext,
  input: { contact: number; speed: number; six: boolean },
  rng: Rng,
): DeliveryOutcome {
  const shot = chooseShot(context, input.contact, rng);
  const spec = SHOT_ANGLES[shot];
  const angle = steer(
    (spec.angle + rng.spread() * spec.spread + 360) % 360,
    context.shotPreference,
    input.contact,
    context.striker.attributes.batting.technique,
  );
  const distance = input.six ? rng.range(68, 92) : rng.range(58, 72);

  // A six hit flat to a boundary rider is sometimes a catch instead.
  if (input.six) {
    const nearest = nearestFielder(context.field, angle, distance);
    if (
      nearest &&
      nearest.fielder.ring === 'OUTER' &&
      nearest.travel < MATCH.fielding.boundaryCatchReach &&
      rng.chance(catchChance(nearest.fielder, nearest.travel, 0.55))
    ) {
      return {
        runsOffBat: 0,
        extras: null,
        isLegalDelivery: true,
        isBoundaryFour: false,
        isBoundarySix: false,
        wicket: { type: 'CAUGHT', bowlerId: context.bowler.id, fielderId: nearest.fielder.playerId },
        dismissedPlayerId: context.striker.id,
        shot,
        contactQuality: Math.round(input.contact * 100),
        shotAngle: angle,
        shotDistance: distance,
        fielderName: nearest.fielder.name,
        speed: input.speed,
        strikeRotated: false,
        review: null,
        dropped: null,
        retired: null,
        commentary: describeBall({
          context,
          kind: 'WICKET',
          dismissal: 'CAUGHT',
          fielderName: nearest.fielder.name,
          shot,
          onTheRope: true,
        }),
      };
    }
  }

  return {
    runsOffBat: input.six ? 6 : 4,
    extras: null,
    isLegalDelivery: true,
    isBoundaryFour: !input.six,
    isBoundarySix: input.six,
    wicket: null,
    dismissedPlayerId: null,
    shot,
    contactQuality: Math.round(input.contact * 100),
    shotAngle: angle,
    shotDistance: distance,
    fielderName: null,
    speed: input.speed,
    strikeRotated: false,
    review: null,
    dropped: null,
    retired: null,
    commentary: describeBall({ context, kind: input.six ? 'SIX' : 'FOUR', shot }),
  };
}

/** Dots, singles, twos and threes - decided by placement against the field. */
function resolvePlacedShot(
  context: DeliveryContext,
  input: {
    contact: number;
    edge: number;
    speed: number;
    intentIndex: number;
    phaseDot: number;
    cluster: number;
  },
  rng: Rng,
): DeliveryOutcome {
  const rates = MATCH_FORMATS[context.format] ?? MATCH_FORMATS.ODI;
  const cfg = MATCH;
  const { contact, intentIndex } = input;

  const shot = chooseShot(context, contact, rng);
  const spec = SHOT_ANGLES[shot];
  const angle = steer(
    (spec.angle + rng.spread() * spec.spread + 360) % 360,
    context.shotPreference,
    contact,
    context.striker.attributes.batting.technique,
  );
  const distance = Math.max(2, 6 + contact * 46 + rng.spread() * 10);

  const nearest = nearestFielder(context.field, angle, distance);
  const fielder = nearest?.fielder ?? null;
  const straightAt = nearest ? clamp01(1 - nearest.travel / 18) : 0;

  const running = normalise(
    context.striker.attributes.batting.running * 0.6 + context.striker.attributes.physical.speed * 0.4,
  );

  // A well-placed shot into the gap runs; one straight to a fielder does not.
  // Weights are relative to a single, which is always 1. `rng.weighted`
  // normalises, so a dot weight above 1 simply means more dots than singles.
  const dotWeight = Math.max(
    0.02,
    rates.dotWeight *
      input.phaseDot *
      cfg.intent.dot[intentIndex] *
      (input.cluster > 0 ? cfg.momentum.collapseDot : 1) *
      (1 - input.edge * cfg.edge.dot) *
      (1 + straightAt * cfg.fielding.ringSaveChance * 0.6) *
      (1.2 - contact * 0.4),
  );

  const runFactor = cfg.intent.running[intentIndex] * (0.7 + running * 0.6);
  const twoWeight = rates.twoWeight * runFactor * (1 - straightAt * 0.7) * (0.6 + contact * 0.8);
  const threeWeight = rates.threeWeight * runFactor * (1 - straightAt * 0.85) * (0.5 + contact * 0.8);

  // A set batter shielding the tail wants the strike back: he takes the single
  // early in the over and turns one down late, so the tailender faces as few
  // balls as possible.
  const farm = context.farmingStrike ? MATCH.batting.farmStrikeStrength : 0;
  const lateInOver = context.ballInOver >= 5;
  const oddWeight = 1 * (farm > 0 ? (lateInOver ? 1 - farm : 1 + farm * 0.4) : 1);
  const evenTwo = twoWeight * (farm > 0 && lateInOver ? 1 + farm : 1);

  const runs = rng.weighted<number>([
    { item: 0, weight: dotWeight },
    { item: 1, weight: oddWeight },
    { item: 2, weight: evenTwo },
    { item: 3, weight: threeWeight },
  ]);

  // Beaten outside off? Sometimes it runs away for byes or off the pad.
  if (runs === 0 && contact < 0.28) {
    const extrasCfg = MATCH.extras;
    if (rng.chance(extrasCfg.byeChance)) {
      const byes = rng.chance(0.15) ? 4 : 1;
      return {
        runsOffBat: 0,
        extras: { type: 'BYE', runs: byes },
        isLegalDelivery: true,
        isBoundaryFour: false,
        isBoundarySix: false,
        wicket: null,
        dismissedPlayerId: null,
        shot: 'LEAVE',
        contactQuality: Math.round(contact * 100),
        shotAngle: 178,
        shotDistance: byes === 4 ? 62 : 18,
        fielderName: context.field.keeperName,
        speed: input.speed,
        strikeRotated: byes % 2 === 1,
        review: null,
        dropped: null,
        retired: null,
        commentary: describeBall({ context, kind: 'BYE', runs: byes }),
      };
    }
    if (rng.chance(extrasCfg.legByeChance)) {
      const legByes = rng.chance(0.1) ? 4 : 1;
      return {
        runsOffBat: 0,
        extras: { type: 'LEG_BYE', runs: legByes },
        isLegalDelivery: true,
        isBoundaryFour: false,
        isBoundarySix: false,
        wicket: null,
        dismissedPlayerId: null,
        shot: 'DEFEND',
        contactQuality: Math.round(contact * 100),
        shotAngle: 250,
        shotDistance: legByes === 4 ? 60 : 16,
        fielderName: null,
        speed: input.speed,
        strikeRotated: legByes % 2 === 1,
        review: null,
        dropped: null,
        retired: null,
        commentary: describeBall({ context, kind: 'LEG_BYE', runs: legByes }),
      };
    }
  }

  // --- Run out, rolled while they are actually running --------------------
  if (runs > 0) {
    const runOut = rollRunOut(context, runs, fielder, rng);
    if (runOut) return runOut;
  }

  // A fumble in the field lets one more through.
  const misfield = fielder && runs > 0 && rng.chance(MATCH.fielding.misfieldChance);
  const finalRuns = misfield ? runs + 1 : runs;

  return {
    runsOffBat: finalRuns,
    extras: null,
    isLegalDelivery: true,
    isBoundaryFour: false,
    isBoundarySix: false,
    wicket: null,
    dismissedPlayerId: null,
    shot,
    contactQuality: Math.round(contact * 100),
    shotAngle: angle,
    shotDistance: distance,
    fielderName: fielder?.name ?? null,
    speed: input.speed,
    strikeRotated: finalRuns % 2 === 1,
    review: null,
    dropped: null,
    retired: null,
    commentary: misfield
      ? `${fielder?.name} fumbles it, and they come back for an extra run.`
      : describeBall({ context, kind: 'RUNS', runs, shot, fielderName: fielder?.name ?? null }),
  };
}

/** A sharp single, a direct hit, and someone is walking off. */
function rollRunOut(
  context: DeliveryContext,
  runs: number,
  fielder: { name: string; playerId: string; throwing: number; groundFielding: number } | null,
  rng: Rng,
): DeliveryOutcome | null {
  const cfg = MATCH.runOut;
  if (!fielder) return null;

  const batterRunning = normalise(
    context.striker.attributes.batting.running * 0.5 +
      context.nonStriker.attributes.batting.running * 0.3 +
      context.striker.attributes.physical.speed * 0.2,
  );
  const fieldingSharpness = normalise(fielder.throwing * 0.55 + fielder.groundFielding * 0.45);

  const inPlay = cfg.chancePerRun * runs * (1 + (fieldingSharpness - batterRunning) * 0.8);
  if (!rng.chance(Math.max(0, inPlay))) return null;

  const converted =
    cfg.conversion * (0.5 + fieldingSharpness * cfg.fieldingWeight * 2) * (1.3 - batterRunning * cfg.runningWeight);
  if (!rng.chance(clamp01(converted))) return null;

  // The batter who was going for the extra run is usually the one who goes.
  const directHit = rng.chance(MATCH.fielding.directHitChance * (0.5 + fieldingSharpness));
  const strikerOut = rng.chance(0.55);
  void directHit;
  const dismissed = strikerOut ? context.striker : context.nonStriker;
  const completed = Math.max(0, runs - 1);

  return {
    runsOffBat: completed,
    extras: null,
    isLegalDelivery: true,
    isBoundaryFour: false,
    isBoundarySix: false,
    wicket: { type: 'RUN_OUT', bowlerId: null, fielderId: fielder.playerId },
    dismissedPlayerId: dismissed.id,
    shot: 'DEFEND',
    contactQuality: 40,
    shotAngle: 90,
    shotDistance: 24,
    fielderName: fielder.name,
    speed: 0,
    strikeRotated: completed % 2 === 1,
    review: null,
    dropped: null,
    retired: null,
    commentary: describeBall({
      context,
      kind: 'WICKET',
      dismissal: 'RUN_OUT',
      fielderName: fielder.name,
      dismissedName: dismissed.name,
    }),
  };
}
