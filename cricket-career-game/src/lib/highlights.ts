/**
 * The big moments of an innings, worked out from the ball-by-ball log: fours,
 * sixes and wickets, a batter's fifty or hundred, a bowler's five-for or
 * hat-trick, the team's hundreds and the big partnerships. Derived on screen,
 * so older saves get them too.
 */
import type { Ball } from '@/types';

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
  | 'DROP';

export interface Highlight {
  kind: HighlightKind;
  /** Short chip text: "50", "100", "5W". */
  label: string;
  /** One line for the commentary: "FIFTY for Rahul - 50 off 38 balls (5x4, 2x6)". */
  text: string;
}

/** The marks worth a banner. */
const BATTER_MARKS = [50, 100, 150, 200, 250, 300];
const TEAM_MARKS = [100, 150, 200, 250, 300, 350, 400, 450, 500];
const PARTNERSHIP_MARKS = [50, 100, 150, 200, 250];

/** Kinds that count as a highlight in the commentary filter. */
export const MILESTONE_KINDS: HighlightKind[] = ['FIFTY', 'HUNDRED', 'BIG_HUNDRED', 'FIVE_FOR', 'HAT_TRICK', 'TEAM', 'PARTNERSHIP'];

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
  teamName = 'The batting side',
): Map<string, Highlight[]> {
  const out = new Map<string, Highlight[]>();
  const batters = new Map<string, BatterTally>();
  const bowlerWickets = new Map<string, number>();
  /** Each bowler's last few deliveries: wicket or not, for the hat-trick. */
  const bowlerRun = new Map<string, boolean[]>();
  let total = 0;
  let partnership = 0;
  let fallen = 0;

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

    const batter = nameOf(ball.strikerId) || 'The batter';
    const bowler = nameOf(ball.bowlerId) || 'The bowler';

    if (ball.isBoundarySix) add(ball, { kind: 'SIX', label: '6', text: `SIX! ${batter} goes big off ${bowler}.` });
    else if (ball.isBoundaryFour) add(ball, { kind: 'FOUR', label: '4', text: `FOUR! ${batter} finds the rope.` });
    if (ball.dropped) add(ball, { kind: 'DROP', label: 'DROP', text: `Dropped! ${ball.dropped.fielderName} puts down ${batter}.` });

    for (const mark of BATTER_MARKS) {
      if (tally.runs >= mark && before.runs < mark) {
        const kind: HighlightKind = mark === 50 ? 'FIFTY' : mark === 100 ? 'HUNDRED' : 'BIG_HUNDRED';
        const word = mark === 50 ? 'FIFTY' : mark === 100 ? 'HUNDRED' : `${mark}`;
        add(ball, {
          kind,
          label: String(mark),
          text: `${word} for ${batter}! ${mark} up off ${tally.balls} balls (${tally.fours}x4, ${tally.sixes}x6).`,
        });
      }
    }
    for (const mark of TEAM_MARKS) {
      if (total >= mark && before.total < mark) {
        add(ball, { kind: 'TEAM', label: String(mark), text: `${mark} up for ${teamName}.` });
      }
    }
    for (const mark of PARTNERSHIP_MARKS) {
      if (partnership >= mark && before.partnership < mark) {
        add(ball, { kind: 'PARTNERSHIP', label: `${mark}p`, text: `${mark}-run partnership - this pair is taking the game away.` });
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
            ? `RUN OUT! ${teamName} ${total}/${fallen}.`
            : `OUT! ${batter}${line ? ` goes for ${line.runs} (${line.balls})` : ''}. ${teamName} ${total}/${fallen}.`,
      });
      partnership = 0;
    }

    // The bowler's own tally, for the five-for and the hat-trick.
    if (ball.isLegalDelivery || ball.extras?.type === 'NO_BALL') {
      const run = bowlerRun.get(ball.bowlerId) ?? [];
      run.push(bowlerWicket(ball));
      bowlerRun.set(ball.bowlerId, run.slice(-3));
      if (run.length >= 3 && run.slice(-3).every(Boolean)) {
        add(ball, { kind: 'HAT_TRICK', label: 'HAT-TRICK', text: `HAT-TRICK! ${bowler} - three in three!` });
      }
    }
    if (bowlerWicket(ball)) {
      const wickets = (bowlerWickets.get(ball.bowlerId) ?? 0) + 1;
      bowlerWickets.set(ball.bowlerId, wickets);
      if (wickets === 5) add(ball, { kind: 'FIVE_FOR', label: '5W', text: `FIVE-FOR for ${bowler}!` });
    }
  }
  return out;
}

/** The biggest moment in a list, for a banner: milestones beat wickets beat sixes. */
export function headlineOf(list: Highlight[] | undefined): Highlight | null {
  if (!list || list.length === 0) return null;
  const order: HighlightKind[] = ['HAT_TRICK', 'BIG_HUNDRED', 'HUNDRED', 'FIVE_FOR', 'FIFTY', 'WICKET', 'SIX', 'PARTNERSHIP', 'TEAM', 'FOUR', 'DROP'];
  return [...list].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))[0];
}

export interface OverSummary {
  over: number;
  runs: number;
  wickets: number;
  total: number;
  totalWickets: number;
}

/** Runs and wickets in each completed over, with the score at its end. */
export function overSummaries(deliveries: Ball[]): Map<string, OverSummary> {
  const out = new Map<string, OverSummary>();
  let total = 0;
  let wickets = 0;
  let overRuns = 0;
  let overWickets = 0;
  for (const ball of deliveries) {
    const runs = ball.runsOffBat + (ball.extras?.runs ?? 0);
    total += runs;
    overRuns += runs;
    if (ball.wicket) {
      wickets += 1;
      overWickets += 1;
    }
    if (ball.isLegalDelivery && ball.ballInOver === 6) {
      out.set(ball.id, { over: ball.over + 1, runs: overRuns, wickets: overWickets, total, totalWickets: wickets });
      overRuns = 0;
      overWickets = 0;
    }
  }
  return out;
}
