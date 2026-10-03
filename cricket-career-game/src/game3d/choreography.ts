/**
 * Choreography: what every player and the ball do after the authority has
 * resolved a delivery. Pure data from pure inputs, no Three.js.
 *
 * The rule this file exists to keep: the pictures follow the engine. A miss
 * never shows the ball coming off the bat; a boundary never shows a catch; a
 * catch only happens when the engine recorded one, at the fielder it named.
 */
import type { ContactKind, PublicOutcome, PvpShot } from '@/engine/pvp/match';
import type { DeliveryLength } from '@/types';
import {
  PITCH,
  apexForFlight,
  groundPoint,
  insideRope,
  radius,
  ropeCrossing,
  v3,
  type Segment,
  type Vec3,
} from './physics/ballFlight';

export type BallEnd = 'KEEPER' | 'STUMPS' | 'PAD' | 'BYES' | 'GROUND' | 'CATCH' | 'DROPPED' | 'FOUR' | 'SIX' | 'RUN_OUT';
/**
 * Camera states. WIDE: the stadium between balls. RUNUP: behind the bowler.
 * DELIVERY: the batter-facing broadcast view the ball is played in. SIDE_ON:
 * the shot seen square of the wicket. BALL_FOLLOW: chasing the ball (high for
 * big hits). RUNNING: both batters between the wickets. CLOSE_UP: a catch,
 * a wicket, an appeal or a celebration.
 */
export type CameraShot = 'WIDE' | 'RUNUP' | 'DELIVERY' | 'SIDE_ON' | 'BALL_FOLLOW' | 'RUNNING' | 'CLOSE_UP';

export interface CameraCue {
  at: number;
  shot: CameraShot;
  /** A player id, or a place: the striker's or bowler's stumps. */
  focus?: string;
  /** Ball-follow from high up (sixes, skiers). */
  high?: boolean;
}

export interface Spot {
  id: string;
  pos: Vec3;
}

export interface FielderTask {
  id: string;
  /** Where to run to, and when to be there. */
  runTo: Vec3;
  arriveMs: number;
  action: 'Catching' | 'FieldingStop' | 'FieldingDive' | 'WicketkeeperAction' | 'Throwing' | null;
  actionMs: number;
}

export interface AfterPlan {
  batterState: string;
  contact: ContactKind;
  /** The ball from the moment it reaches the batter. */
  ballPath: Segment[];
  end: BallEnd;
  tasks: FielderTask[];
  /** Completed runs the batters run (not boundaries). */
  runs: number;
  runOutId: string | null;
  bailsAtMs: number | null;
  umpireSignal: 'UmpireOut' | 'UmpireFour' | 'UmpireSix' | 'UmpireWide' | 'UmpireNoBall' | 'UmpireBye' | null;
  umpireAtMs: number;
  celebrate: boolean;
  dismissedId: string | null;
  /** The camera script for this ball, in time order. */
  cues: CameraCue[];
  /** When the fielding side appeals (lbw, caught behind, stumping), or null. */
  appealAtMs: number | null;
  /** The bowler's reaction to a boundary or a dropped catch. */
  bowlerReaction: 'Disappointment' | null;
  /** For a run-out: which end the batter was beaten to. */
  runOutEnd: 'STRIKER' | 'BOWLER' | null;
  endMs: number;
}

export interface AfterInput {
  shot: PvpShot | null;
  contact: ContactKind;
  outcome: PublicOutcome;
  /** When the ball reaches the bat on the delivery timeline. */
  contactMs: number;
  /** The ball's position at that moment. */
  arrival: Vec3;
  leftHanded: boolean;
  spin: boolean;
  keeper: Spot;
  bowler: Spot;
  fielders: Spot[];
  strikerId: string;
  /** Delivery length, to tell a front-foot shot from a back-foot one. */
  length?: DeliveryLength;
}

export const RUN_MS = 2400;

const SHOT_STATE: Record<PvpShot, string> = {
  DEFEND: 'BattingDefence',
  DRIVE: 'BattingDrive',
  CUT: 'BattingCut',
  PULL: 'BattingPull',
  SWEEP: 'BattingSweep',
  LOFT: 'BattingLoftedShot',
  LEAVE: 'BattingLeave',
};

const BACK_FOOT_LENGTHS: DeliveryLength[] = ['SHORT', 'SHORT_OF_GOOD'];

/**
 * The batter's animation for a resolved ball - the only place that maps a
 * result to a clip. A miss is never a connecting shot. The shot the engine
 * resolved picks the variant: back-foot defence to a short ball, a cover
 * drive when the ball went square on the off side.
 */
export function batterStateFor(shot: PvpShot | null, contact: ContactKind, ctx: { angle?: number | null; length?: DeliveryLength } = {}): string {
  if (contact === 'NO_SHOT' || shot === null || shot === 'LEAVE') return 'BattingLeave';
  const backFoot = ctx.length !== undefined && BACK_FOOT_LENGTHS.includes(ctx.length);
  if (contact === 'MISS' || contact === 'PAD') return shot === 'DEFEND' ? (backFoot ? 'BattingBackDefence' : 'BattingDefence') : 'MissedShot';
  if (shot === 'DEFEND' && backFoot) return 'BattingBackDefence';
  if (shot === 'DRIVE' && ctx.angle !== null && ctx.angle !== undefined && ctx.angle > 28 && ctx.angle < 150) return 'BattingCoverDrive';
  return SHOT_STATE[shot];
}

export interface RunLeg {
  batterId: string;
  /** Which crease this leg ends at. */
  to: 'STRIKER' | 'BOWLER';
  startMs: number;
  endMs: number;
  /** The last leg finishes with the bat slid in; a run-out leg falls short. */
  finish: 'TURN' | 'SLIDE' | 'SHORT';
}

/**
 * The batters' running, leg by leg. Both run `runs` completed runs; on a
 * run-out the dismissed batter sets off for one more and arrives only after
 * the bails are off, so the picture agrees with the engine's decision.
 */
export function runLegs(input: { runs: number; startMs: number; strikerId: string; nonStrikerId: string; runOutId: string | null; bailsAtMs: number | null }): RunLeg[] {
  const legs: RunLeg[] = [];
  const attempted = input.runs + (input.runOutId ? 1 : 0);
  for (const id of [input.strikerId, input.nonStrikerId]) {
    const fromStriker = id === input.strikerId;
    for (let n = 0; n < attempted; n += 1) {
      const startMs = input.startMs + n * RUN_MS;
      const toBowler = (n % 2 === 0) === fromStriker;
      const last = n === attempted - 1;
      const short = last && input.runOutId !== null && n === input.runs && id === input.runOutId;
      legs.push({
        batterId: id,
        to: toBowler ? 'BOWLER' : 'STRIKER',
        startMs,
        // The run-out leg is still in progress when the bails come off.
        endMs: short && input.bailsAtMs !== null ? Math.max(startMs + RUN_MS, input.bailsAtMs + 350) : startMs + RUN_MS,
        finish: short ? 'SHORT' : last ? 'SLIDE' : 'TURN',
      });
    }
  }
  return legs;
}

/** The state to start the moment a player presses, before the result is known. */
export function provisionalBatterState(shot: PvpShot): string {
  return SHOT_STATE[shot];
}

function nearest(spots: Spot[], p: Vec3): Spot | null {
  let best: Spot | null = null;
  let bestD = Infinity;
  for (const s of spots) {
    const d = Math.hypot(s.pos.x - p.x, s.pos.z - p.z);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

function dist(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

const keeperGloves = (k: Spot): Vec3 => v3(k.pos.x, 0.75, k.pos.z + 0.4);
const stumps = (z: number): Vec3 => v3(0, 0.45, z);

type CorePlan = Omit<AfterPlan, 'cues' | 'appealAtMs' | 'bowlerReaction' | 'runOutEnd'> & { camera: 'BROADCAST' | 'BALL_FOLLOW' | 'AERIAL' | 'BOUNDARY' | 'WICKET_REPLAY' };

/** Which end a run-out happens at: where the dismissed batter was heading on the extra run. */
export function runOutEnd(runs: number, dismissedIsStriker: boolean): 'STRIKER' | 'BOWLER' {
  const strikerHeadsToBowler = (runs + 1) % 2 === 1;
  return strikerHeadsToBowler === dismissedIsStriker ? 'BOWLER' : 'STRIKER';
}

export function planAfterContact(input: AfterInput): AfterPlan {
  const core = planCore(input);
  const { camera, ...rest } = core;
  const t0 = input.contactMs;
  const o = input.outcome;
  const wicket = o.wicket?.type ?? null;
  const plan: AfterPlan = { ...rest, cues: [], appealAtMs: null, bowlerReaction: null, runOutEnd: null };
  if (wicket === 'RUN_OUT') plan.runOutEnd = runOutEnd(core.runs, (o.dismissedPlayerId ?? input.strikerId) === input.strikerId);
  if (wicket === 'LBW' || wicket === 'CAUGHT_BEHIND' || wicket === 'STUMPED') plan.appealAtMs = t0 + 250;
  if (o.isBoundaryFour || o.isBoundarySix || o.dropped) plan.bowlerReaction = 'Disappointment';

  // The camera script.
  const cues: CameraCue[] = [];
  const catcher = core.tasks.find((t) => t.action === 'Catching');
  if (o.isBoundarySix || o.isBoundaryFour) {
    cues.push({ at: t0, shot: 'SIDE_ON' }, { at: t0 + 350, shot: 'BALL_FOLLOW', high: o.isBoundarySix });
  } else if (catcher) {
    cues.push({ at: t0, shot: 'SIDE_ON' }, { at: t0 + 350, shot: 'BALL_FOLLOW', high: true }, { at: Math.max(t0 + 600, catcher.arriveMs - 250), shot: 'CLOSE_UP', focus: catcher.id });
  } else if (wicket === 'BOWLED' || wicket === 'HIT_WICKET') {
    cues.push({ at: t0, shot: 'SIDE_ON' }, { at: t0 + 300, shot: 'CLOSE_UP', focus: 'STUMPS_STRIKER' });
  } else if (wicket === 'RUN_OUT') {
    cues.push({ at: t0, shot: 'SIDE_ON' }, { at: t0 + 450, shot: 'BALL_FOLLOW' }, { at: (core.bailsAtMs ?? t0 + 2000) - 700, shot: 'CLOSE_UP', focus: plan.runOutEnd === 'BOWLER' ? 'STUMPS_BOWLER' : 'STUMPS_STRIKER' });
  } else if (core.runs > 0) {
    cues.push({ at: t0, shot: 'SIDE_ON' }, { at: t0 + 450, shot: 'BALL_FOLLOW' }, { at: t0 + 1300, shot: 'RUNNING' });
  } else if (core.end === 'GROUND' || core.end === 'BYES') {
    cues.push({ at: t0, shot: 'SIDE_ON' }, { at: t0 + 900, shot: 'BALL_FOLLOW' });
  } else {
    // Defended, left, beaten, padded: the shot itself is the picture.
    cues.push({ at: t0, shot: 'SIDE_ON' });
  }
  if (wicket || core.celebrate) cues.push({ at: Math.max(t0 + 900, core.umpireAtMs - 300), shot: 'CLOSE_UP', focus: o.dismissedPlayerId ?? input.strikerId });
  if (o.isBoundaryFour || o.isBoundarySix) cues.push({ at: core.umpireAtMs - 200, shot: 'CLOSE_UP', focus: input.strikerId });
  cues.push({ at: Math.max(t0 + 1200, core.endMs - 900), shot: 'WIDE' });
  plan.cues = cues.sort((a, b) => a.at - b.at);
  void camera;
  return plan;
}

function planCore(input: AfterInput): CorePlan {
  const { outcome, contactMs: t0, arrival, leftHanded } = input;
  const plan: CorePlan = {
    batterState: batterStateFor(input.shot, input.contact, { angle: outcome.shotAngle, length: input.length }),
    contact: input.contact,
    ballPath: [],
    end: 'KEEPER',
    tasks: [],
    runs: 0,
    runOutId: null,
    bailsAtMs: null,
    umpireSignal: null,
    umpireAtMs: t0 + 900,
    celebrate: false,
    dismissedId: outcome.dismissedPlayerId,
    camera: 'BROADCAST',
    endMs: t0 + 1500,
  };
  const wicket = outcome.wicket?.type ?? null;
  // Byes and leg-byes run away; a no-ball is otherwise played like any ball.
  const byes = outcome.extras?.type === 'BYE' || outcome.extras?.type === 'LEG_BYE';
  const toKeeperMs = input.spin ? 320 : 230;
  const fielderSpot = (id: string | null): Spot | null => {
    if (!id) return null;
    if (id === input.keeper.id) return input.keeper;
    if (id === input.bowler.id) return input.bowler;
    return input.fielders.find((f) => f.id === id) ?? null;
  };
  const keeperTakes = (atMs: number) =>
    plan.tasks.push({ id: input.keeper.id, runTo: input.keeper.pos, arriveMs: atMs, action: 'WicketkeeperAction', actionMs: atMs - 250 });

  if (outcome.extras?.type === 'WIDE') {
    plan.ballPath = [{ from: arrival, to: keeperGloves(input.keeper), t0, t1: t0 + toKeeperMs, apex: 0.05 }];
    keeperTakes(t0 + toKeeperMs);
    plan.end = 'KEEPER';
    plan.umpireSignal = 'UmpireWide';
    plan.runs = Math.max(0, (outcome.extras.runs ?? 1) - 1);
    plan.endMs = t0 + 1400 + plan.runs * RUN_MS;
    return plan;
  }

  // --- The ball never came off the middle of the bat ----------------------
  if (wicket === 'BOWLED' || wicket === 'HIT_WICKET') {
    const at = t0 + 110;
    plan.ballPath = [
      { from: arrival, to: stumps(PITCH.strikerStumpsZ), t0, t1: at, apex: 0 },
      { from: stumps(PITCH.strikerStumpsZ), to: v3(arrival.x * 0.3, 0, PITCH.strikerStumpsZ - 1.2), t0: at, t1: at + 500, apex: 0.15 },
    ];
    plan.end = 'STUMPS';
    plan.bailsAtMs = at;
    plan.umpireSignal = 'UmpireOut';
    plan.celebrate = true;
    plan.camera = 'WICKET_REPLAY';
    plan.endMs = t0 + 3200;
    return plan;
  }
  if (wicket === 'LBW' || (input.contact === 'PAD' && !byes)) {
    const drop = v3(arrival.x + (leftHanded ? -0.25 : 0.25), 0, PITCH.strikerZ + 0.8);
    plan.ballPath = [{ from: arrival, to: drop, t0, t1: t0 + 320, apex: 0.15 }];
    plan.end = 'PAD';
    if (wicket === 'LBW') {
      plan.umpireSignal = 'UmpireOut';
      plan.umpireAtMs = t0 + 1300;
      plan.celebrate = true;
      plan.camera = 'WICKET_REPLAY';
      plan.endMs = t0 + 3200;
    }
    return plan;
  }
  if (wicket === 'CAUGHT_BEHIND' || wicket === 'STUMPED' || ((input.contact === 'MISS' || input.contact === 'NO_SHOT') && !byes)) {
    const edge = input.contact === 'EDGE';
    const gloves = keeperGloves(input.keeper);
    if (edge) gloves.x += leftHanded ? 0.35 : -0.35;
    plan.ballPath = [{ from: arrival, to: gloves, t0, t1: t0 + toKeeperMs, apex: edge ? 0.25 : 0.05 }];
    keeperTakes(t0 + toKeeperMs);
    plan.end = 'KEEPER';
    if (wicket) {
      plan.umpireSignal = 'UmpireOut';
      plan.celebrate = true;
      plan.camera = 'WICKET_REPLAY';
      if (wicket === 'STUMPED') plan.bailsAtMs = t0 + toKeeperMs + 450;
      plan.endMs = t0 + 3200;
    }
    return plan;
  }
  if (byes && outcome.extras) {
    const angle = outcome.shotAngle ?? (outcome.extras.type === 'BYE' ? 178 : 250);
    const four = outcome.extras.runs >= 4;
    const end = four ? ropeCrossing(angle, leftHanded, 1) : insideRope(groundPoint(angle, outcome.shotDistance ?? 18, leftHanded));
    const ms = 500 + dist(arrival, end) * 38;
    plan.ballPath = [{ from: arrival, to: end, t0, t1: t0 + ms, apex: 0.1 }];
    plan.end = 'BYES';
    plan.runs = four ? 0 : outcome.extras.runs;
    if (four) plan.umpireSignal = 'UmpireFour';
    const chaser = nearest(input.fielders, end);
    if (chaser && !four) plan.tasks.push({ id: chaser.id, runTo: end, arriveMs: t0 + ms, action: 'FieldingStop', actionMs: t0 + ms - 200 });
    plan.camera = 'BALL_FOLLOW';
    plan.endMs = t0 + Math.max(ms + 800, plan.runs * RUN_MS + 600);
    return plan;
  }

  // --- Off the bat (middle or edge) ----------------------------------------
  const angle = outcome.shotAngle ?? 20;
  if (outcome.isBoundarySix) {
    const land = ropeCrossing(angle, leftHanded, 9 + (outcome.contactQuality % 7));
    const ms = 2500;
    plan.ballPath = [{ from: arrival, to: { ...land, y: 2 }, t0, t1: t0 + ms, apex: Math.max(16, apexForFlight(ms) * 0.75) }];
    plan.end = 'SIX';
    plan.umpireSignal = 'UmpireSix';
    plan.umpireAtMs = t0 + ms + 300;
    plan.camera = 'AERIAL';
    const chaser = nearest(input.fielders, land);
    if (chaser) plan.tasks.push({ id: chaser.id, runTo: insideRope(land, 2), arriveMs: t0 + ms, action: null, actionMs: 0 });
    plan.endMs = t0 + ms + 1600;
    return plan;
  }
  if (outcome.isBoundaryFour) {
    const rope = ropeCrossing(angle, leftHanded, 1.5);
    const ms = 900 + dist(arrival, rope) * 22;
    const hop = v3(arrival.x + (rope.x - arrival.x) * 0.18, 0, arrival.z + (rope.z - arrival.z) * 0.18);
    plan.ballPath = [
      { from: arrival, to: hop, t0, t1: t0 + ms * 0.2, apex: 0.7 },
      { from: hop, to: rope, t0: t0 + ms * 0.2, t1: t0 + ms, apex: 0 },
    ];
    plan.end = 'FOUR';
    plan.umpireSignal = 'UmpireFour';
    plan.umpireAtMs = t0 + ms + 300;
    plan.camera = 'BOUNDARY';
    const chaser = nearest(input.fielders, rope);
    if (chaser) plan.tasks.push({ id: chaser.id, runTo: insideRope(rope, 1.5), arriveMs: t0 + ms + 250, action: 'FieldingDive', actionMs: t0 + ms - 150 });
    plan.endMs = t0 + ms + 1600;
    return plan;
  }

  const caught = wicket === 'CAUGHT' || wicket === 'CAUGHT_AND_BOWLED';
  if (caught || outcome.dropped) {
    const catcher = fielderSpot(outcome.wicket?.fielderId ?? outcome.fielderId) ?? nearest(input.fielders, groundPoint(angle, outcome.shotDistance ?? 25, leftHanded));
    const spot = catcher?.pos ?? groundPoint(angle, 25, leftHanded);
    // The catcher moves a few metres towards the line of the ball.
    const line = groundPoint(angle, radius(v3(spot.x, 0, spot.z - PITCH.strikerZ)), leftHanded);
    const catchAt = v3(spot.x + (line.x - spot.x) * 0.6, 1.35, spot.z + (line.z - spot.z) * 0.6);
    const d = dist(arrival, catchAt);
    const ms = Math.max(500, 450 + d * 42);
    plan.ballPath = [{ from: arrival, to: catchAt, t0, t1: t0 + ms, apex: Math.max(2.5, Math.min(26, apexForFlight(ms) * 0.55)) }];
    if (catcher) plan.tasks.push({ id: catcher.id, runTo: v3(catchAt.x, 0, catchAt.z), arriveMs: t0 + ms - 120, action: 'Catching', actionMs: t0 + ms - 320 });
    plan.camera = d > 25 ? 'AERIAL' : 'BALL_FOLLOW';
    if (caught) {
      plan.end = 'CATCH';
      plan.umpireSignal = 'UmpireOut';
      plan.umpireAtMs = t0 + ms + 500;
      plan.celebrate = true;
      plan.endMs = t0 + ms + 2600;
      return plan;
    }
    // Put down: the ball spills out of the hands and they run.
    const spill = v3(catchAt.x + 0.8, 0, catchAt.z + 0.6);
    plan.ballPath.push({ from: catchAt, to: spill, t0: t0 + ms, t1: t0 + ms + 400, apex: 0.3 });
    plan.end = 'DROPPED';
    plan.runs = outcome.runsOffBat;
    plan.endMs = t0 + Math.max(ms + 1500, outcome.runsOffBat * RUN_MS + 600);
    return plan;
  }

  // Along the ground: a fielder stops it and throws it back.
  const distance = Math.max(4, Math.min(outcome.shotDistance ?? 12, PITCH.boundaryRadius - 4));
  const end = insideRope(groundPoint(angle, distance, leftHanded));
  const fielder = fielderSpot(outcome.fielderId) ?? nearest([...input.fielders, input.bowler], end);
  const rollMs = 350 + distance * 55;
  plan.ballPath = [{ from: arrival, to: end, t0, t1: t0 + rollMs, apex: input.contact === 'EDGE' ? 0.3 : 0.12 }];
  plan.end = wicket === 'RUN_OUT' ? 'RUN_OUT' : 'GROUND';
  plan.runs = wicket === 'RUN_OUT' ? Math.max(0, outcome.runsOffBat) : outcome.runsOffBat;
  plan.camera = distance > 15 ? 'BALL_FOLLOW' : 'BROADCAST';
  if (fielder) {
    const far = dist(fielder.pos, end) > 6 && distance > 10;
    plan.tasks.push({ id: fielder.id, runTo: end, arriveMs: t0 + rollMs, action: far ? 'FieldingDive' : 'FieldingStop', actionMs: t0 + rollMs - 250 });
    // The throw back to the keeper's end (or at the stumps for a run-out).
    const throwAt = t0 + rollMs + (far ? 1100 : 500);
    const outEnd = wicket === 'RUN_OUT' ? runOutEnd(plan.runs, (outcome.dismissedPlayerId ?? input.strikerId) === input.strikerId) : null;
    const target = outEnd ? stumps(outEnd === 'BOWLER' ? PITCH.bowlerStumpsZ : PITCH.strikerStumpsZ) : keeperGloves(input.keeper);
    const throwMs = 250 + dist(end, target) * 26;
    plan.tasks.push({ id: fielder.id, runTo: end, arriveMs: throwAt, action: 'Throwing', actionMs: throwAt - 400 });
    plan.ballPath.push({ from: end, to: end, t0: t0 + rollMs, t1: throwAt, apex: 0 });
    plan.ballPath.push({ from: v3(end.x, 1.8, end.z), to: target, t0: throwAt, t1: throwAt + throwMs, apex: Math.min(6, 0.6 + dist(end, target) * 0.05) });
    if (wicket === 'RUN_OUT') {
      plan.runOutId = outcome.dismissedPlayerId;
      plan.bailsAtMs = throwAt + throwMs;
      plan.umpireSignal = 'UmpireOut';
      plan.umpireAtMs = throwAt + throwMs + 600;
      plan.celebrate = true;
      plan.camera = 'BALL_FOLLOW';
    }
    plan.endMs = Math.max(throwAt + throwMs + 700, t0 + plan.runs * RUN_MS + 700);
  } else {
    plan.endMs = t0 + Math.max(rollMs + 700, plan.runs * RUN_MS + 700);
  }
  if (wicket === 'RUN_OUT') plan.endMs += 1800;
  return plan;
}
