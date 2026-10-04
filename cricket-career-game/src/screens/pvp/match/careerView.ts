/**
 * Live PvP drawn the Career Mode way: the authority's events turned into the
 * same scorecards, ball log, field and ground that the career match screen
 * uses, so the PvP match reuses those panels as they are.
 */
import { VENUES } from '@/data/venues';
import { dismissalText } from '@/engine/match/innings';
import type { FieldSetting } from '@/engine/match/types';
import type { MatchEvent, PublicPlayer } from '@/engine/pvp/match';
import type { Ball, BattingIntent, BatterInningsLine, BowlerInningsLine, Innings, MatchConditions, MatchPhase, Venue } from '@/types';

type Ev<K extends MatchEvent['kind']> = Extract<MatchEvent, { kind: K }>;

const INTENTS: BattingIntent[] = ['BLOCK', 'DEFENSIVE', 'NORMAL', 'ATTACKING', 'ALL_OUT'];

export interface CareerView {
  innings: Innings[];
  /** The field for the delivery now live, or the last one bowled. */
  field: FieldSetting | null;
  venue: Venue;
  conditions: MatchConditions;
  /** The ball just played, for the ground's ball layer. */
  lastBall: Ball | null;
}

export function sideId(side: 0 | 1): string {
  return `s${side}`;
}

function emptyInnings(number: number, battingSide: 0 | 1, target: number | null): Innings {
  return {
    id: `pvp-inns-${number}`,
    number,
    battingTeamId: sideId(battingSide),
    bowlingTeamId: sideId((1 - battingSide) as 0 | 1),
    runs: 0,
    wickets: 0,
    balls: 0,
    overs: 0,
    extras: { WIDE: 0, NO_BALL: 0, BYE: 0, LEG_BYE: 0, PENALTY: 0 },
    extrasTotal: 0,
    batting: [],
    bowling: [],
    fallOfWickets: [],
    deliveries: [],
    declared: false,
    followOn: false,
    allOut: false,
    complete: false,
    target,
    dlsTarget: null,
  };
}

function batterLine(player: PublicPlayer | undefined, id: string, position: number): BatterInningsLine {
  return { playerId: id, name: player?.name ?? id, battingPosition: position, runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: 0, out: false, dismissal: null, dismissalText: 'not out' };
}

function bowlerLine(player: PublicPlayer | undefined, id: string): BowlerInningsLine {
  return { playerId: id, name: player?.name ?? id, overs: 0, balls: 0, maidens: 0, runsConceded: 0, wickets: 0, wides: 0, noBalls: 0, economy: 0 };
}

function phaseOf(over: number, overs: number): MatchPhase {
  if (over === 0) return 'POWERPLAY';
  if (over >= overs - 1) return 'DEATH';
  return 'MIDDLE';
}

function fieldOf(open: Ev<'DELIVERY_OPEN'>, players: Map<string, PublicPlayer>): FieldSetting {
  return {
    name: 'Captain\'s field',
    keeperId: open.field.keeperId,
    keeperName: players.get(open.field.keeperId)?.name ?? 'Keeper',
    keeperSkill: 70,
    fielders: open.field.fielders.map((f) => ({
      ...f,
      ring: f.distance < 18 ? 'CLOSE' : f.distance <= 32 ? 'INNER' : 'OUTER',
      catching: 70,
      groundFielding: 70,
      throwing: 70,
      agility: 70,
    })),
  };
}

/** A night T20 on the named ground; only what the 2D ground draws. */
function conditionsOf(start: Ev<'MATCH_START'> | undefined): MatchConditions {
  return {
    pitch: { type: start?.pitch ?? 'FLAT', deterioration: 0 },
    weather: { type: 'CLEAR', cloudCover: 10, rainDelay: false },
    ball: { overs: 0, hardness: 100, shine: 100 },
    phase: 'POWERPLAY',
    pressure: 0,
    underLights: true,
  } as unknown as MatchConditions;
}

export function deriveCareerView(events: MatchEvent[]): CareerView {
  const start = events.find((e): e is Ev<'MATCH_START'> => e.kind === 'MATCH_START');
  const players = new Map<string, PublicPlayer>();
  const position = new Map<string, number>();
  for (const side of start?.sides ?? []) side.players.forEach((p, i) => {
    players.set(p.id, p);
    position.set(p.id, i + 1);
  });
  const totalOvers = start?.overs ?? 2;
  const innings: Innings[] = [];
  let field: FieldSetting | null = null;
  let open: Ev<'DELIVERY_OPEN'> | null = null;
  let released: Ev<'BALL_RELEASED'> | null = null;
  let lastBall: Ball | null = null;
  let overRuns = 0;

  const bat = (inn: Innings, id: string) => {
    let line = inn.batting.find((b) => b.playerId === id);
    if (!line) {
      line = batterLine(players.get(id), id, position.get(id) ?? inn.batting.length + 1);
      inn.batting.push(line);
    }
    return line;
  };
  const bowl = (inn: Innings, id: string) => {
    let line = inn.bowling.find((b) => b.playerId === id);
    if (!line) {
      line = bowlerLine(players.get(id), id);
      inn.bowling.push(line);
    }
    return line;
  };

  for (const e of events) {
    const inn = innings[innings.length - 1];
    switch (e.kind) {
      case 'INNINGS_START':
        innings.push(emptyInnings(e.innings + 1, e.battingSide, e.target));
        overRuns = 0;
        break;
      case 'DELIVERY_OPEN':
        open = e;
        released = null;
        field = fieldOf(e, players);
        if (inn) {
          bat(inn, e.strikerId);
          bat(inn, e.nonStrikerId);
          bowl(inn, e.bowlerId);
        }
        break;
      case 'BALL_RELEASED':
        released = e;
        break;
      case 'BALL_RESULT': {
        if (!inn || !open || open.deliveryId !== e.deliveryId) break;
        const o = e.outcome;
        const plan = released?.deliveryId === e.deliveryId ? released.plan : null;
        const level = e.level ?? 3;
        const ball: Ball = {
          id: e.deliveryId,
          over: open.over,
          ballInOver: open.ballInOver,
          ballNumber: inn.balls + (o.isLegalDelivery ? 1 : 0),
          bowlerId: open.bowlerId,
          strikerId: open.strikerId,
          nonStrikerId: open.nonStrikerId,
          line: plan?.line ?? 'OFF_STUMP',
          length: plan?.length ?? 'GOOD',
          speed: o.speed,
          variation: plan?.variation ?? null,
          intent: INTENTS[Math.max(0, Math.min(4, level - 1))],
          shot: o.engineShot,
          contactQuality: o.contactQuality,
          runsOffBat: o.runsOffBat,
          extras: o.extras,
          isLegalDelivery: o.isLegalDelivery,
          isBoundaryFour: o.isBoundaryFour,
          isBoundarySix: o.isBoundarySix,
          wicket: o.wicket ? { type: o.wicket.type, bowlerId: o.wicket.type === 'RUN_OUT' ? null : open.bowlerId, fielderId: o.wicket.fielderId } : null,
          landingPoint: null,
          shotAngle: o.shotAngle,
          shotDistance: o.shotDistance,
          fielderName: o.fielderName,
          dropped: o.dropped && o.fielderName ? { fielderName: o.fielderName } : null,
          freeHit: open.freeHit,
          commentary: o.commentary,
          phase: phaseOf(open.over, totalOvers),
        };
        inn.deliveries.push(ball);
        lastBall = ball;

        // The scorecard, the way the career engine keeps it.
        const runs = o.runsOffBat + (o.extras?.runs ?? 0);
        const striker = bat(inn, open.strikerId);
        striker.runs += o.runsOffBat;
        if (o.extras?.type !== 'WIDE') striker.balls += 1;
        if (o.isBoundaryFour) striker.fours += 1;
        if (o.isBoundarySix) striker.sixes += 1;
        striker.strikeRate = striker.balls ? (striker.runs * 100) / striker.balls : 0;
        const bowler = bowl(inn, open.bowlerId);
        const bowlerRuns = o.runsOffBat + (o.extras && (o.extras.type === 'WIDE' || o.extras.type === 'NO_BALL') ? o.extras.runs : 0);
        bowler.runsConceded += bowlerRuns;
        if (o.extras?.type === 'WIDE') bowler.wides += 1;
        if (o.extras?.type === 'NO_BALL') bowler.noBalls += 1;
        if (o.isLegalDelivery) bowler.balls += 1;
        bowler.overs = Math.floor(bowler.balls / 6) + (bowler.balls % 6) / 10;
        bowler.economy = bowler.balls ? (bowler.runsConceded * 6) / bowler.balls : 0;
        overRuns += bowlerRuns;
        if (o.isLegalDelivery && bowler.balls % 6 === 0) {
          if (overRuns === 0) bowler.maidens += 1;
          overRuns = 0;
        }
        if (o.extras) {
          inn.extras[o.extras.type] += o.extras.runs;
          inn.extrasTotal += o.extras.runs;
        }
        if (o.dismissedPlayerId) {
          const gone = bat(inn, o.dismissedPlayerId);
          gone.out = true;
          gone.dismissal = ball.wicket;
          gone.dismissalText = dismissalText(ball, players.get(open.bowlerId)?.name ?? 'bowler', o.fielderName);
          if (ball.wicket && ball.wicket.type !== 'RUN_OUT') bowler.wickets += 1;
        }
        inn.runs = e.score.runs;
        inn.wickets = e.score.wickets;
        inn.balls = e.score.balls;
        inn.overs = Math.floor(inn.balls / 6) + (inn.balls % 6) / 10;
        if (o.dismissedPlayerId) inn.fallOfWickets.push({ wicketNumber: inn.wickets, runs: inn.runs, over: inn.balls / 6, playerId: o.dismissedPlayerId });
        void runs;
        break;
      }
      case 'INNINGS_END':
        if (inn) {
          inn.complete = true;
          inn.allOut = e.score.wickets >= (start?.wickets ?? 10);
        }
        break;
      default:
        break;
    }
  }

  const venue = VENUES.find((v) => v.name === start?.venue) ?? VENUES[0];
  return { innings, field, venue, conditions: conditionsOf(start), lastBall };
}
