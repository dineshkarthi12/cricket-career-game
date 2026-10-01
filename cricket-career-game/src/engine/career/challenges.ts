/**
 * Daily and weekly challenges.
 *
 * Challenges run on the real calendar (the player's local date), not the
 * game's, so "daily" means today. Progress is counted only from what really
 * happened in the career since the period began: each committed match and
 * each completed training week adds an entry to the activity log. A reward
 * can be claimed once per challenge per period; the claim is stored in the
 * save, so reloading the page cannot claim it again.
 *
 * Pure TypeScript: the caller passes the local date in.
 */
import { addXp } from '../development/xp';
import { canTrainBowling, roleCategory } from '../roles';
import type { ChallengeEvent, ChallengeState, GameState, Match } from '@/types';

export type ChallengePeriod = 'DAILY' | 'WEEKLY';
export type ChallengeMetric =
  | 'RUNS_NOT_OUT'
  | 'RUNS'
  | 'BOUNDARIES'
  | 'SIXES'
  | 'WICKETS'
  | 'WINS'
  | 'MATCHES'
  | 'TRAINING_WEEKS'
  | 'BALLS_FACED';

interface ChallengeTemplate {
  key: string;
  period: ChallengePeriod;
  metric: ChallengeMetric;
  target: number;
  /** Counted per match (best single match) rather than summed. */
  singleMatch?: boolean;
  xp: number;
  text: string;
  /** Only for players who bowl. */
  bowlers?: boolean;
  /** Only for players who bat in the top order (not pure bowlers). */
  batters?: boolean;
}

const TEMPLATES: ChallengeTemplate[] = [
  { key: 'd-30no', period: 'DAILY', metric: 'RUNS_NOT_OUT', target: 30, singleMatch: true, xp: 60, text: 'Score 30 runs in a match without losing your wicket', batters: true },
  { key: 'd-4s', period: 'DAILY', metric: 'BOUNDARIES', target: 5, xp: 40, text: 'Hit 5 boundaries' },
  { key: 'd-face', period: 'DAILY', metric: 'BALLS_FACED', target: 40, xp: 35, text: 'Face 40 balls' },
  { key: 'd-play', period: 'DAILY', metric: 'MATCHES', target: 1, xp: 25, text: 'Play a match' },
  { key: 'd-train', period: 'DAILY', metric: 'TRAINING_WEEKS', target: 1, xp: 25, text: 'Complete a week of training' },
  { key: 'd-2w', period: 'DAILY', metric: 'WICKETS', target: 2, xp: 50, text: 'Take 2 wickets', bowlers: true },
  { key: 'd-six', period: 'DAILY', metric: 'SIXES', target: 1, xp: 30, text: 'Hit a six' },
  { key: 'w-runs', period: 'WEEKLY', metric: 'RUNS', target: 150, xp: 150, text: 'Score 150 runs this week' },
  { key: 'w-50', period: 'WEEKLY', metric: 'RUNS', target: 50, singleMatch: true, xp: 140, text: 'Make a half-century', batters: true },
  { key: 'w-win', period: 'WEEKLY', metric: 'WINS', target: 2, xp: 120, text: 'Win 2 matches you play in' },
  { key: 'w-train', period: 'WEEKLY', metric: 'TRAINING_WEEKS', target: 3, xp: 100, text: 'Complete 3 training weeks' },
  { key: 'w-6w', period: 'WEEKLY', metric: 'WICKETS', target: 6, xp: 140, text: 'Take 6 wickets this week', bowlers: true },
  { key: 'w-4s', period: 'WEEKLY', metric: 'BOUNDARIES', target: 15, xp: 110, text: 'Hit 15 boundaries this week' },
];

const DAILY_COUNT = 3;
const WEEKLY_COUNT = 3;
/** Activity older than this is dropped from the save. */
const KEEP_DAYS = 10;

export interface Challenge {
  /** Unique per period: claims are stored by this id. */
  id: string;
  key: string;
  period: ChallengePeriod;
  text: string;
  target: number;
  progress: number;
  xp: number;
  complete: boolean;
  claimed: boolean;
  /** Last day (local) the challenge can be completed and claimed. */
  endsOn: string;
}

export function emptyChallenges(): ChallengeState {
  return { log: [], claimed: [], xpEarned: 0 };
}

/** yyyy-mm-dd for a local date. */
export function localDay(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** The Monday of the local week holding `day`. */
export function weekStart(day: string): string {
  const date = parseDay(day);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return localDay(date);
}

function addDaysTo(day: string, days: number): string {
  const date = parseDay(day);
  date.setDate(date.getDate() + days);
  return localDay(date);
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Templates that make sense for this player's role. */
function eligible(state: GameState): ChallengeTemplate[] {
  const bowls = canTrainBowling(state.player);
  const pureBowler = roleCategory(state.player.role) === 'BOWLER';
  return TEMPLATES.filter((t) => (!t.bowlers || bowls) && (!t.batters || !pureBowler));
}

function pick(templates: ChallengeTemplate[], count: number, seed: string): ChallengeTemplate[] {
  return [...templates]
    .map((t) => ({ t, order: hash(`${seed}:${t.key}`) }))
    .sort((a, b) => a.order - b.order)
    .slice(0, count)
    .map((x) => x.t);
}

function measure(events: ChallengeEvent[], metric: ChallengeMetric, single: boolean): number {
  const value = (e: ChallengeEvent): number => {
    switch (metric) {
      case 'RUNS_NOT_OUT':
        return e.kind === 'MATCH' && e.batted && !e.out ? e.runs : 0;
      case 'RUNS':
        return e.kind === 'MATCH' ? e.runs : 0;
      case 'BOUNDARIES':
        return e.kind === 'MATCH' ? e.fours + e.sixes : 0;
      case 'SIXES':
        return e.kind === 'MATCH' ? e.sixes : 0;
      case 'WICKETS':
        return e.kind === 'MATCH' ? e.wickets : 0;
      case 'WINS':
        return e.kind === 'MATCH' && e.won ? 1 : 0;
      case 'MATCHES':
        return e.kind === 'MATCH' ? 1 : 0;
      case 'BALLS_FACED':
        return e.kind === 'MATCH' ? e.balls : 0;
      case 'TRAINING_WEEKS':
        return e.kind === 'TRAINING' ? 1 : 0;
    }
  };
  if (single) return events.reduce((best, e) => Math.max(best, value(e)), 0);
  return events.reduce((sum, e) => sum + value(e), 0);
}

/** Today's and this week's challenges with their real progress. */
export function currentChallenges(state: GameState, now: Date): Challenge[] {
  const ch = state.challenges ?? emptyChallenges();
  const today = localDay(now);
  const monday = weekStart(today);
  const pool = eligible(state);
  const seed = `${state.seed}`;
  const daily = pick(pool.filter((t) => t.period === 'DAILY'), DAILY_COUNT, `${seed}:${today}`);
  const weekly = pick(pool.filter((t) => t.period === 'WEEKLY'), WEEKLY_COUNT, `${seed}:${monday}`);
  const build = (t: ChallengeTemplate, from: string, endsOn: string): Challenge => {
    const id = `${t.period === 'DAILY' ? 'd' : 'w'}:${from}:${t.key}`;
    const events = ch.log.filter((e) => e.day >= from && e.day <= endsOn);
    const progress = Math.min(t.target, measure(events, t.metric, Boolean(t.singleMatch)));
    return {
      id,
      key: t.key,
      period: t.period,
      text: t.text,
      target: t.target,
      progress,
      xp: t.xp,
      complete: progress >= t.target,
      claimed: ch.claimed.includes(id),
      endsOn,
    };
  };
  return [
    ...daily.map((t) => build(t, today, today)),
    ...weekly.map((t) => build(t, monday, addDaysTo(monday, 6))),
  ];
}

export type ClaimResult =
  | { ok: true; state: GameState; xp: number; levelsGained: number }
  | { ok: false; reason: string };

/**
 * Claim a finished challenge. Refused if it is not today's or this week's,
 * is not finished, or was claimed already - so no reload or double tap can
 * pay out twice.
 */
export function claimChallenge(state: GameState, id: string, now: Date): ClaimResult {
  const challenge = currentChallenges(state, now).find((c) => c.id === id);
  if (!challenge) return { ok: false, reason: 'That challenge has ended.' };
  if (challenge.claimed) return { ok: false, reason: 'Already claimed.' };
  if (!challenge.complete) return { ok: false, reason: 'Not finished yet.' };
  const ch = state.challenges ?? emptyChallenges();
  const xp = addXp(state.player, challenge.xp);
  return {
    ok: true,
    xp: challenge.xp,
    levelsGained: xp.levelsGained,
    state: {
      ...state,
      player: { ...state.player, xp: xp.xp, level: xp.level, xpToNextLevel: xp.xpToNextLevel },
      challenges: { ...ch, claimed: [...ch.claimed, id], xpEarned: ch.xpEarned + challenge.xp },
    },
  };
}

/** Drop activity and claims too old to matter. */
function prune(ch: ChallengeState, today: string): ChallengeState {
  const cutoff = addDaysTo(today, -KEEP_DAYS);
  return {
    ...ch,
    log: ch.log.filter((e) => e.day >= cutoff),
    claimed: ch.claimed.filter((id) => (id.split(':')[1] ?? '') >= cutoff),
  };
}

/** The player's own figures from a finished match, as challenge activity. */
export function recordMatch(state: GameState, match: Match, now: Date): GameState {
  if (!match.userPlayed || match.status !== 'COMPLETED') return state;
  const ch = state.challenges ?? emptyChallenges();
  // Each match counts once, however often this is called.
  if (ch.log.some((e) => e.kind === 'MATCH' && e.matchId === match.id)) return state;
  const me = state.player.id;
  let runs = 0;
  let balls = 0;
  let fours = 0;
  let sixes = 0;
  let wickets = 0;
  let batted = false;
  let out = false;
  for (const innings of match.innings) {
    const bat = innings.batting.find((b) => b.playerId === me);
    if (bat && (bat.balls > 0 || bat.out)) {
      batted = true;
      runs += bat.runs;
      balls += bat.balls;
      fours += bat.fours;
      sixes += bat.sixes;
      out = out || bat.out;
    }
    wickets += innings.bowling.find((b) => b.playerId === me)?.wickets ?? 0;
  }
  const userTeam = match.userIsHome ? match.homeTeamId : match.awayTeamId;
  const won = match.result?.winningTeamId === userTeam;
  const day = localDay(now);
  const event: ChallengeEvent = { kind: 'MATCH', day, matchId: match.id, runs, balls, fours, sixes, wickets, batted, out, won };
  return { ...state, challenges: prune({ ...ch, log: [...ch.log, event] }, day) };
}

/** Training weeks completed between two states, as challenge activity. */
export function recordTraining(before: GameState, after: GameState, now: Date): GameState {
  const old = new Set(before.player.development.weeklyReports.map((r) => r.id));
  const fresh = after.player.development.weeklyReports.filter((r) => !old.has(r.id) && r.energyUsed > 0);
  if (fresh.length === 0) return after;
  const ch = after.challenges ?? emptyChallenges();
  const day = localDay(now);
  const events: ChallengeEvent[] = fresh
    .filter((r) => !ch.log.some((e) => e.kind === 'TRAINING' && e.reportId === r.id))
    .map((r) => ({ kind: 'TRAINING', day, reportId: r.id }));
  return { ...after, challenges: prune({ ...ch, log: [...ch.log, ...events] }, day) };
}
