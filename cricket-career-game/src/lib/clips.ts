/**
 * The highlights reel: which balls of a match are worth replaying on the
 * ground. Every wicket, every six, the boundary that brings up a fifty or a
 * hundred, the winning runs, hat-trick balls, overturned reviews - and all of
 * the player's own boundaries and wickets. At most `MAX_CLIPS`, in match
 * order; when there are more, the biggest moments stay.
 *
 * Pure, and built when the reel is opened: nothing new is stored in a save.
 * Only matches that kept their ball-by-ball (the user's last two) have clips.
 */
import { tr } from '@/i18n/core';
import { inningsHighlights } from './highlights';
import type { Ball, Innings, Match } from '@/types';

export const MAX_CLIPS = 20;

export type ClipKind = 'WICKET' | 'SIX' | 'FOUR' | 'FIFTY' | 'HUNDRED' | 'WINNING_RUNS' | 'HAT_TRICK' | 'DRS';

export interface Clip {
  /** `${inningsIndex}:${ballIndex}`: unique within the match. */
  id: string;
  inningsIndex: number;
  /** Index in the innings' deliveries. */
  ballIndex: number;
  ball: Ball;
  /** Every reason this ball made the reel; the first is the headline. */
  kinds: ClipKind[];
  /** The title card: "WICKET - Bumrah b. Smith 34(22)". */
  title: string;
  /** The player was the batter, the bowler or the fielder. */
  mine: boolean;
  battingTeamId: string;
  /** The score after this ball. */
  score: { runs: number; wickets: number; overs: string };
  /** The innings' target, when chasing. */
  target: number | null;
}

/** How much a reason counts when the reel has to be cut down. */
const WEIGHT: Record<ClipKind, number> = {
  WINNING_RUNS: 100,
  HAT_TRICK: 90,
  HUNDRED: 80,
  DRS: 60,
  FIFTY: 50,
  WICKET: 40,
  SIX: 20,
  FOUR: 10,
};
const ORDER: ClipKind[] = ['WINNING_RUNS', 'HAT_TRICK', 'HUNDRED', 'FIFTY', 'WICKET', 'DRS', 'SIX', 'FOUR'];

/** Does the match still have its ball-by-ball (so it can be replayed)? */
export function hasBallByBall(match: Match): boolean {
  return match.innings.length > 0 && match.innings.every((i) => i.balls === 0 || i.deliveries.length > 0) && match.innings.some((i) => i.deliveries.length > 0);
}

function nameIn(innings: Innings[], id: string): string {
  for (const inn of innings) {
    const line = inn.batting.find((b) => b.playerId === id) ?? inn.bowling.find((b) => b.playerId === id);
    if (line) return line.name;
  }
  return 'Unknown';
}

/** "Jasprit Bumrah" -> "Bumrah". */
function surname(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? name;
}

/** How the bowler got the batter: "Bumrah b. Smith", "Bumrah lbw Smith". */
const DISMISSAL_WORD: Partial<Record<string, string>> = {
  BOWLED: 'b.',
  CAUGHT: 'b.',
  CAUGHT_BEHIND: 'b.',
  CAUGHT_AND_BOWLED: 'c&b',
  LBW: 'lbw',
  STUMPED: 'st.',
  HIT_WICKET: 'hit wkt',
};

export interface PickOptions {
  /** Only balls the player batted, bowled or fielded. */
  mineOnly?: boolean;
  max?: number;
}

/**
 * The reel for a match. `userId` is the player's own cricketer (their
 * boundaries and wickets always count); `userName` matches them as a
 * fielder, since a ball records its fielder by name.
 */
export function pickClips(match: Match, userId: string | null, userName: string | null = null, options: PickOptions = {}): Clip[] {
  const max = options.max ?? MAX_CLIPS;
  const all: Clip[] = [];
  const last = lastBallOf(match);
  const winningSideChased = match.result?.winningTeamId && match.innings.at(-1)?.battingTeamId === match.result.winningTeamId && match.result.marginWickets !== null;

  match.innings.forEach((inn, inningsIndex) => {
    const highlights = inningsHighlights(inn.deliveries, (id) => nameIn(match.innings, id));
    const runs = new Map<string, { runs: number; balls: number }>();
    let total = 0;
    let wickets = 0;
    let legal = 0;
    inn.deliveries.forEach((ball, ballIndex) => {
      const t = runs.get(ball.strikerId) ?? { runs: 0, balls: 0 };
      t.runs += ball.runsOffBat;
      if (ball.extras?.type !== 'WIDE') t.balls += 1;
      runs.set(ball.strikerId, t);
      total += ball.runsOffBat + (ball.extras?.runs ?? 0);
      if (ball.isLegalDelivery) legal += 1;
      const isWicket = Boolean(ball.wicket && ball.wicket.type !== 'RETIRED_HURT');
      // Who went: the next fall of wicket (a run-out can be the non-striker).
      const outId = isWicket ? (inn.fallOfWickets[wickets]?.playerId ?? ball.strikerId) : null;
      if (isWicket) wickets += 1;

      const kinds: ClipKind[] = [];
      const hl = highlights.get(ball.id) ?? [];
      if (isWicket) kinds.push('WICKET');
      if (ball.isBoundarySix) kinds.push('SIX');
      if (hl.some((h) => h.kind === 'HUNDRED' || h.kind === 'BIG_HUNDRED') && (ball.isBoundaryFour || ball.isBoundarySix || ball.runsOffBat > 0)) kinds.push('HUNDRED');
      else if (hl.some((h) => h.kind === 'FIFTY') && (ball.isBoundaryFour || ball.isBoundarySix)) kinds.push('FIFTY');
      if (hl.some((h) => h.kind === 'HAT_TRICK')) kinds.push('HAT_TRICK');
      if (ball.review?.outcome === 'OVERTURNED') kinds.push('DRS');
      if (winningSideChased && last && last.inningsIndex === inningsIndex && last.ballIndex === ballIndex) kinds.push('WINNING_RUNS');

      const fielderIsMe = Boolean(userName && ball.fielderName && ball.fielderName === userName) || ball.wicket?.fielderId === userId;
      const mine = Boolean(userId) && (ball.strikerId === userId || ball.bowlerId === userId || outId === userId || (isWicket && fielderIsMe));
      // The player's own boundaries (and their wickets, already in) always make it.
      if (mine && ball.isBoundaryFour && ball.strikerId === userId && !kinds.includes('FOUR')) kinds.push('FOUR');
      if (kinds.length === 0) return;

      kinds.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
      const batterLine = outId ? (runs.get(outId) ?? { runs: 0, balls: 0 }) : t;
      const batter = surname(nameIn(match.innings, outId ?? ball.strikerId));
      const bowler = surname(nameIn(match.innings, ball.bowlerId));
      const figures = `${batterLine.runs}(${batterLine.balls})`;
      all.push({
        id: `${inningsIndex}:${ballIndex}`,
        inningsIndex,
        ballIndex,
        ball,
        kinds,
        title: titleFor(kinds[0], ball, { batter, bowler, figures, fielder: ball.fielderName ? surname(ball.fielderName) : null }),
        mine,
        battingTeamId: inn.battingTeamId,
        score: { runs: total, wickets, overs: `${Math.floor(legal / 6)}.${legal % 6}` },
        target: inn.target ?? null,
      });
    });
  });

  const pool = options.mineOnly ? all.filter((c) => c.mine) : all;
  if (pool.length <= max) return pool;
  // Too many: keep the biggest (the player's own moments count extra), then back into match order.
  const keep = new Set([...pool].sort((a, b) => clipWeight(b) - clipWeight(a) || order(a, b)).slice(0, max).map((c) => c.id));
  return pool.filter((c) => keep.has(c.id));
}

/** How big a moment is: its biggest reason, plus a little when it is the player's. */
export function clipWeight(c: Clip): number {
  return Math.max(...c.kinds.map((k) => WEIGHT[k])) + (c.mine ? 25 : 0);
}

function order(a: Clip, b: Clip): number {
  return a.inningsIndex - b.inningsIndex || a.ballIndex - b.ballIndex;
}

function lastBallOf(match: Match): { inningsIndex: number; ballIndex: number } | null {
  for (let i = match.innings.length - 1; i >= 0; i -= 1) {
    const n = match.innings[i].deliveries.length;
    if (n > 0) return { inningsIndex: i, ballIndex: n - 1 };
  }
  return null;
}

function titleFor(kind: ClipKind, ball: Ball, n: { batter: string; bowler: string; figures: string; fielder: string | null }): string {
  switch (kind) {
    case 'WICKET':
    case 'HAT_TRICK':
    case 'DRS': {
      const head = tr(kind === 'HAT_TRICK' ? 'clip.HAT_TRICK' : kind === 'DRS' ? 'clip.DRS' : 'clip.WICKET');
      const type = ball.wicket?.type;
      if (!type) return `${head} - ${n.batter} ${n.figures}`;
      if (type === 'RUN_OUT') return `${head} - ${n.batter} ${tr('clip.runOut')}${n.fielder ? ` (${n.fielder})` : ''} ${n.figures}`;
      if (type === 'CAUGHT' || type === 'CAUGHT_BEHIND') return `${head} - ${n.bowler} b. ${n.batter} ${n.figures}${n.fielder ? `, c. ${n.fielder}` : ''}`;
      return `${head} - ${n.bowler} ${DISMISSAL_WORD[type] ?? 'b.'} ${n.batter} ${n.figures}`;
    }
    case 'SIX':
      return `${tr('clip.SIX')} - ${n.batter} ${n.figures}`;
    case 'FOUR':
      return `${tr('clip.FOUR')} - ${n.batter} ${n.figures}`;
    case 'FIFTY':
      return `${tr('clip.FIFTY')} - ${n.batter} ${n.figures}`;
    case 'HUNDRED':
      return `${tr('clip.HUNDRED')} - ${n.batter} ${n.figures}`;
    case 'WINNING_RUNS':
      return `${tr('clip.WINNING_RUNS')} - ${n.batter} ${n.figures}`;
  }
}
