/**
 * The big moments of an innings, worked out from the ball-by-ball log: fours,
 * sixes and wickets, a batter's fifty or hundred, a bowler's five-for or
 * hat-trick, the team's hundreds and the big partnerships. Derived on screen,
 * so older saves get them too.
 */
import { tr, variants, type Key } from '@/i18n/core';

/** One of a milestone's numbered variants, chosen by the ball, so it reads the same every time. */
function variantOf(family: string, seed: string): Key {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return `${family}.${hash % Math.max(1, variants(family))}` as Key;
}
import type { Ball, Innings } from '@/types';

export type HighlightKind =
  | 'FOUR'
  | 'SIX'
  | 'WICKET'
  | 'FIFTY'
  | 'HUNDRED'
  | 'BIG_HUNDRED'
  | 'FIVE_FOR'
  | 'HAT_TRICK'
  | 'TEAM'
  | 'PARTNERSHIP'
  | 'DROP'
  | 'THREE_FOR'
  | 'MAIDEN'
  | 'ALL_ROUND';

export interface Highlight {
  kind: HighlightKind;
  /** Short chip text: "50", "100", "5W". */
  label: string;
  /** One line for the commentary: "FIFTY for Rahul - 50 off 38 balls (5x4, 2x6)". */
  text: string;
  /** The player the moment belongs to (batter or bowler), when there is one. */
  playerId?: string;
}

/** Runs and wickets a player already has in this match, from earlier innings. */
export type MatchTally = Map<string, { runs: number; wickets: number }>;

/** What each player did in the innings already completed, for all-round doubles. */
export function matchTally(innings: Pick<Innings, 'batting' | 'bowling'>[]): MatchTally {
  const out: MatchTally = new Map();
  const get = (id: string) => out.get(id) ?? { runs: 0, wickets: 0 };
  for (const inn of innings) {
    for (const l of inn.batting) out.set(l.playerId, { ...get(l.playerId), runs: get(l.playerId).runs + l.runs });
    for (const l of inn.bowling) out.set(l.playerId, { ...get(l.playerId), wickets: get(l.playerId).wickets + l.wickets });
  }
  return out;
}

/** The all-round double: fifty runs and three wickets in the same match. */
const ALL_ROUND = { runs: 50, wickets: 3 };

/** The marks worth a banner. */
const BATTER_MARKS = [50, 100, 150, 200, 250, 300];
const TEAM_MARKS = [100, 150, 200, 250, 300, 350, 400, 450, 500];
const PARTNERSHIP_MARKS = [50, 100, 150, 200, 250];

/** Kinds that count as a highlight in the commentary filter. */
export const MILESTONE_KINDS: HighlightKind[] = ['FIFTY', 'HUNDRED', 'BIG_HUNDRED', 'FIVE_FOR', 'HAT_TRICK', 'THREE_FOR', 'ALL_ROUND', 'TEAM', 'PARTNERSHIP'];

interface BatterTally {
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
}

/** A bowler gets the wicket for everything but a run-out. */
function bowlerWicket(ball: Ball): boolean {
  return Boolean(ball.wicket && ball.wicket.type !== 'RUN_OUT');
}

/**
 * Highlights for every ball that has one, by ball id. `nameOf` turns a player
 * id into a name (the innings' batting and bowling lines have them).
 */
export function inningsHighlights(
  deliveries: Ball[],
  nameOf: (id: string) => string = () => '',
  teamName = tr('hl.battingSide'),
  /** Earlier innings of the match, for the all-round double. */
  prior: MatchTally = new Map(),
): Map<string, Highlight[]> {
  const out = new Map<string, Highlight[]>();
  const batters = new Map<string, BatterTally>();
  const bowlerWickets = new Map<string, number>();
  /** Each bowler's last few deliveries: wicket or not, for the hat-trick. */
  const bowlerRun = new Map<string, boolean[]>();
  let total = 0;
  let partnership = 0;
  let fallen = 0;
  /** Runs off each bowler's current over (byes and leg byes do not count), for maidens. */
  const overConceded = new Map<string, number>();
  const allRounders = new Set<string>();
  const allRoundCheck = (ball: Ball, playerId: string) => {
    if (allRounders.has(playerId)) return;
    const before = prior.get(playerId) ?? { runs: 0, wickets: 0 };
    const runs = before.runs + (batters.get(playerId)?.runs ?? 0);
    const wickets = before.wickets + (bowlerWickets.get(playerId) ?? 0);
    if (runs >= ALL_ROUND.runs && wickets >= ALL_ROUND.wickets) {
      allRounders.add(playerId);
      add(ball, {
        kind: 'ALL_ROUND',
        label: 'ALL-ROUND',
        text: tr('hl.allRound', { name: nameOf(playerId) || tr('hl.he'), runs, wickets }),
        playerId,
      });
    }
  };

  const add = (ball: Ball, h: Highlight) => {
    const list = out.get(ball.id);
    if (list) list.push(h);
    else out.set(ball.id, [h]);
  };

  for (const ball of deliveries) {
    const extraRuns = ball.extras?.runs ?? 0;
    const wide = ball.extras?.type === 'WIDE';
    const tally = batters.get(ball.strikerId) ?? { runs: 0, balls: 0, fours: 0, sixes: 0 };
    const before = { runs: tally.runs, total, partnership };

    tally.runs += ball.runsOffBat;
    if (!wide) tally.balls += 1;
    if (ball.isBoundaryFour) tally.fours += 1;
    if (ball.isBoundarySix) tally.sixes += 1;
    batters.set(ball.strikerId, tally);
    total += ball.runsOffBat + extraRuns;
    partnership += ball.runsOffBat + extraRuns;

    const batter = nameOf(ball.strikerId) || tr('hl.theBatter');
    const bowler = nameOf(ball.bowlerId) || tr('hl.theBowler');

    if (ball.isBoundarySix) add(ball, { kind: 'SIX', label: '6', text: tr('hl.six', { batter, bowler }), playerId: ball.strikerId });
    else if (ball.isBoundaryFour) add(ball, { kind: 'FOUR', label: '4', text: tr('hl.four', { batter }), playerId: ball.strikerId });
    if (ball.dropped) add(ball, { kind: 'DROP', label: 'DROP', text: tr('hl.drop', { fielder: ball.dropped.fielderName, batter }) });

    for (const mark of BATTER_MARKS) {
      if (tally.runs >= mark && before.runs < mark) {
        const kind: HighlightKind = mark === 50 ? 'FIFTY' : mark === 100 ? 'HUNDRED' : 'BIG_HUNDRED';
        const vars = { batter, mark, balls: tally.balls, fours: tally.fours, sixes: tally.sixes };
        add(ball, {
          kind,
          label: String(mark),
          text: mark === 50 ? tr(variantOf('hl.fifty', ball.id), vars) : mark === 100 ? tr(variantOf('hl.hundred', ball.id), vars) : tr('hl.bigHundred', vars),
          playerId: ball.strikerId,
        });
      }
    }
    if (ball.runsOffBat > 0) allRoundCheck(ball, ball.strikerId);
    for (const mark of TEAM_MARKS) {
      if (total >= mark && before.total < mark) {
        add(ball, { kind: 'TEAM', label: String(mark), text: tr('hl.team', { mark, team: teamName }) });
      }
    }
    for (const mark of PARTNERSHIP_MARKS) {
      if (partnership >= mark && before.partnership < mark) {
        add(ball, { kind: 'PARTNERSHIP', label: `${mark}p`, text: tr('hl.partnership', { mark }) });
      }
    }

    if (ball.wicket) {
      fallen += 1;
      const line = batters.get(ball.strikerId);
      add(ball, {
        kind: 'WICKET',
        label: 'W',
        text:
          ball.wicket.type === 'RUN_OUT'
            ? tr('hl.runOut', { team: teamName, score: `${total}/${fallen}` })
            : tr('hl.out', {
                batter,
                gone: line ? tr('hl.goesFor', { runs: line.runs, balls: line.balls }) : '',
                team: teamName,
                score: `${total}/${fallen}`,
              }),
        playerId: bowlerWicket(ball) ? ball.bowlerId : undefined,
      });
      partnership = 0;
    }

    // The bowler's own tally, for the five-for and the hat-trick.
    if (ball.isLegalDelivery || ball.extras?.type === 'NO_BALL') {
      const run = bowlerRun.get(ball.bowlerId) ?? [];
      run.push(bowlerWicket(ball));
      bowlerRun.set(ball.bowlerId, run.slice(-3));
      if (run.length >= 3 && run.slice(-3).every(Boolean)) {
        add(ball, { kind: 'HAT_TRICK', label: 'HAT-TRICK', text: tr('hl.hatTrick', { bowler }), playerId: ball.bowlerId });
      }
    }
    if (bowlerWicket(ball)) {
      const wickets = (bowlerWickets.get(ball.bowlerId) ?? 0) + 1;
      bowlerWickets.set(ball.bowlerId, wickets);
      if (wickets === 3) add(ball, { kind: 'THREE_FOR', label: '3W', text: tr('hl.threeFor', { bowler }), playerId: ball.bowlerId });
      if (wickets === 5) add(ball, { kind: 'FIVE_FOR', label: '5W', text: tr(variantOf('hl.fiveFor', ball.id), { bowler }), playerId: ball.bowlerId });
      allRoundCheck(ball, ball.bowlerId);
    }

    // A maiden: six legal balls and nothing off the bat, no wides, no no-balls.
    const conceded = ball.runsOffBat + (ball.extras && (ball.extras.type === 'WIDE' || ball.extras.type === 'NO_BALL') ? ball.extras.runs : 0);
    if (ball.ballInOver === 1 && ball.isLegalDelivery && !overConceded.has(`${ball.bowlerId}:${ball.over}`)) overConceded.set(`${ball.bowlerId}:${ball.over}`, 0);
    const key = `${ball.bowlerId}:${ball.over}`;
    overConceded.set(key, (overConceded.get(key) ?? 0) + conceded);
    if (ball.isLegalDelivery && ball.ballInOver === 6 && overConceded.get(key) === 0) {
      add(ball, { kind: 'MAIDEN', label: 'M', text: tr('hl.maiden', { bowler }), playerId: ball.bowlerId });
    }
  }
  return out;
}

/** The biggest moment in a list, for a banner: milestones beat wickets beat sixes. */
export function headlineOf(list: Highlight[] | undefined): Highlight | null {
  if (!list || list.length === 0) return null;
  const order: HighlightKind[] = ['HAT_TRICK', 'ALL_ROUND', 'BIG_HUNDRED', 'HUNDRED', 'FIVE_FOR', 'FIFTY', 'THREE_FOR', 'WICKET', 'SIX', 'PARTNERSHIP', 'TEAM', 'FOUR', 'MAIDEN', 'DROP'];
  return [...list].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))[0];
}

export interface OverSummary {
  over: number;
  runs: number;
  wickets: number;
  total: number;
  totalWickets: number;
  /** The bowler of the over, and their figures after it: overs-maidens-runs-wickets. */
  bowlerId: string;
  figures: string;
}

/** Runs and wickets in each completed over, with the score at its end. */
export function overSummaries(deliveries: Ball[]): Map<string, OverSummary> {
  const out = new Map<string, OverSummary>();
  let total = 0;
  let wickets = 0;
  let overRuns = 0;
  let overWickets = 0;
  const figures = new Map<string, { balls: number; maidens: number; runs: number; wickets: number }>();
  let overConceded = 0;
  for (const ball of deliveries) {
    const f = figures.get(ball.bowlerId) ?? { balls: 0, maidens: 0, runs: 0, wickets: 0 };
    const conceded = ball.runsOffBat + (ball.extras && (ball.extras.type === 'WIDE' || ball.extras.type === 'NO_BALL') ? ball.extras.runs : 0);
    f.runs += conceded;
    overConceded += conceded;
    if (ball.isLegalDelivery) f.balls += 1;
    if (bowlerWicket(ball)) f.wickets += 1;
    figures.set(ball.bowlerId, f);
    const runs = ball.runsOffBat + (ball.extras?.runs ?? 0);
    total += runs;
    overRuns += runs;
    if (ball.wicket) {
      wickets += 1;
      overWickets += 1;
    }
    if (ball.isLegalDelivery && ball.ballInOver === 6) {
      if (overConceded === 0) f.maidens += 1;
      const overs = `${Math.floor(f.balls / 6)}${f.balls % 6 ? `.${f.balls % 6}` : ''}`;
      out.set(ball.id, {
        over: ball.over + 1,
        runs: overRuns,
        wickets: overWickets,
        total,
        totalWickets: wickets,
        bowlerId: ball.bowlerId,
        figures: `${overs}-${f.maidens}-${f.runs}-${f.wickets}`,
      });
      overRuns = 0;
      overWickets = 0;
      overConceded = 0;
    }
  }
  return out;
}
