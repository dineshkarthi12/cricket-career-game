/**
 * Fans. After each of the player's senior matches a few fans post about it -
 * hype after a hundred, a troll after a duck, a shrug after a quiet day - and
 * a big day sets a hashtag trending. The following is charted match by
 * match, and each follower milestone (10K, 100K, 1M ...) makes the news.
 *
 * Posts carry an i18n key (`fan.post.<kind>.<n>`) and its values, never
 * English text, so the feed reads in the app's language.
 */
import { FANS } from '../config';
import { TOURNAMENTS_BY_ID } from '@/data/tournaments';
import { newId } from '../id';
import { resultFor } from '../career/afterMatch';
import { message, withEvent, withInbox } from './common';
import { rngFor } from './world';
import type { FanMood, FanPost, FanState, GameState, Match, MediaStory } from '@/types';

/** The kinds of post, each with this many wordings in the strings. */
export const FAN_POST_KINDS = {
  HUNDRED: 4,
  FIFTY: 3,
  FIVE_FOR: 3,
  WICKETS: 3,
  POTM: 2,
  DUCK: 3,
  CHEAP: 3,
  EXPENSIVE: 2,
  QUIET: 2,
  WIN: 3,
  LOSS: 3,
} as const;

export type FanPostKind = keyof typeof FAN_POST_KINDS;

const MOOD: Record<FanPostKind, FanMood> = {
  HUNDRED: 'HYPE',
  FIFTY: 'PRAISE',
  FIVE_FOR: 'HYPE',
  WICKETS: 'PRAISE',
  POTM: 'HYPE',
  DUCK: 'TROLL',
  CHEAP: 'TROLL',
  EXPENSIVE: 'TROLL',
  QUIET: 'NEUTRAL',
  WIN: 'PRAISE',
  LOSS: 'NEUTRAL',
};

const HANDLES = [
  'CoverDriveKing', 'StumpCam', 'NetBowler99', 'GullyCricketGuy', 'TeaBreakTalk', 'SquareLegSiva',
  'YorkerQueen', 'MidOnMurali', 'CricketPaithiyam', 'ThirdManThoughts', 'PitchReportPriya', 'SixHitterSanjay',
  'DuckWatch', 'FreeHitFanatic', 'LongOnLokesh', 'SillyPointStats', 'BoundaryRopeBala', 'NightWatchman',
  'ChepaukRoar', 'StatsGuruAnand', 'SpinTwinFan', 'PowerplayPavi', 'DeathOverDinesh', 'StandsSideView',
];

/** What the player's day was, most striking first. */
export function postKindFor(match: Match): FanPostKind {
  const p = match.userPerformance!;
  const batted = p.ballsFaced > 0;
  const overs = p.oversBowled;
  const economy = overs > 0 ? p.runsConceded / overs : 0;
  const costly = match.format === 'T20' ? 11 : match.format === 'TEST' || match.format === 'MULTI_DAY' ? 5 : 7.5;
  if (p.runs >= 100) return 'HUNDRED';
  if (p.wickets >= 5) return 'FIVE_FOR';
  if (p.manOfTheMatch) return 'POTM';
  if (p.runs >= 50) return 'FIFTY';
  if (p.wickets >= 3) return 'WICKETS';
  if (batted && p.runs === 0 && !p.notOut && p.wickets === 0) return 'DUCK';
  if (overs >= 2 && p.wickets === 0 && economy >= costly) return 'EXPENSIVE';
  if (batted && p.runs < 10 && !p.notOut && p.wickets === 0) return 'CHEAP';
  return 'QUIET';
}

/** The numbered wordings of a kind: 1..n. */
function lines(kind: FanPostKind): number[] {
  return Array.from({ length: FAN_POST_KINDS[kind] }, (_, i) => i + 1);
}

/** The fans' posts after one of the player's matches. */
export function fanReactions(state: GameState, match: Match): FanPost[] {
  const p = match.userPerformance;
  if (!p) return [];
  const rng = rngFor(state, `fans-${match.id}`);
  const userTeamId = match.userIsHome ? match.homeTeamId : match.awayTeamId;
  const oppId = match.userIsHome ? match.awayTeamId : match.homeTeamId;
  const team = state.teams[userTeamId]?.shortName ?? '';
  const opp = state.teams[oppId]?.shortName ?? '';
  const result = resultFor(match, userTeamId);
  const params = {
    name: state.player.lastName || state.player.firstName,
    runs: p.runs,
    balls: p.ballsFaced,
    wickets: p.wickets,
    conceded: p.runsConceded,
    team,
    opp,
    comp: TOURNAMENTS_BY_ID[match.tournamentId]?.shortName ?? '',
  };
  const kind = postKindFor(match);
  const kinds: FanPostKind[] = [kind, kind];
  if (result === 'WIN') kinds.push('WIN');
  else if (result === 'LOSS') kinds.push('LOSS');
  else kinds.push(kind);

  const handles = [team && `${team.replace(/\s+/g, '')}Army`, team && `${team.replace(/\s+/g, '')}_Fanatic`, ...HANDLES].filter(Boolean) as string[];
  const followers = state.pro.fans.followers;
  // Never the same line twice in one match; where it can, none of the last few posts' lines either.
  const recent = new Set<string>((state.pro.fans.posts ?? []).slice(0, FANS.freshPosts).map((x) => x.key.replace(/^fan\.post\./, '')));
  const thisMatch = new Set<string>();
  const resultKind: FanPostKind | null = result === 'WIN' ? 'WIN' : result === 'LOSS' ? 'LOSS' : null;
  const posts: FanPost[] = [];
  for (const wanted of kinds.slice(0, FANS.postsPerMatch)) {
    // A kind whose every line is already in this match hands over to the result, then a shrug.
    const k = [wanted, resultKind, 'QUIET' as const].find((x): x is FanPostKind => Boolean(x) && lines(x!).some((n) => !thisMatch.has(`${x}.${n}`)));
    if (!k) break;
    const open = lines(k).filter((n) => !thisMatch.has(`${k}.${n}`));
    const fresh = open.filter((n) => !recent.has(`${k}.${n}`));
    const n = rng.pick(fresh.length ? fresh : open);
    thisMatch.add(`${k}.${n}`);
    let handle = rng.pick(handles);
    for (let tries = 0; posts.some((x) => x.handle === handle) && tries < 6; tries += 1) handle = rng.pick(handles);
    const mood = MOOD[k];
    posts.push({
      id: newId('fan'),
      date: match.date,
      handle,
      key: `fan.post.${k}.${n}`,
      params,
      mood,
      likes: Math.round(Math.max(3, followers * (0.002 + rng.next() * 0.01)) * (mood === 'HYPE' ? 2.5 : mood === 'TROLL' ? 1.4 : 1)),
      matchId: match.id,
    });
  }
  return posts;
}

/** The hashtag a big day trends under, if it was one. */
export function trendFor(state: GameState, match: Match): string | null {
  const p = match.userPerformance;
  if (!p) return null;
  const name = (state.player.lastName || state.player.firstName).replace(/[^A-Za-z0-9]/g, '');
  if (p.runs >= 100) return `#${name}${p.runs}`;
  if (p.wickets >= 5) return `#${name}FiveFor`;
  if (p.manOfTheMatch) return `#${name}Show`;
  return null;
}

/** A trend still showing on `today`. */
export function activeTrend(fans: FanState, today: string): FanState['trend'] {
  const trend = fans.trend;
  if (!trend) return null;
  const days = (Date.parse(today) - Date.parse(trend.date)) / 86_400_000;
  return days >= 0 && days < FANS.trendDays ? trend : null;
}

/** One more point on the growth chart; the oldest half thins out when it gets long. */
export function withFollowerPoint(fans: FanState, date: string): FanState {
  let history = [...(fans.history ?? [])];
  const last = history[history.length - 1];
  if (last && last.date === date) history[history.length - 1] = { date, followers: fans.followers };
  else history.push({ date, followers: fans.followers });
  if (history.length > FANS.historyKept) {
    const half = Math.floor(history.length / 2);
    history = [...history.slice(0, half).filter((_, i) => i % 2 === 0), ...history.slice(half)];
  }
  return { ...fans, history };
}

export function followersText(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return String(n);
}

/** Milestones passed since the last check: an inbox note, a story and a career event each. */
export function checkFanMilestones(state: GameState, date: string): GameState {
  const fans = state.pro.fans;
  const reached = fans.milestones ?? [];
  const fresh = FANS.milestones.filter((m) => fans.followers >= m && !reached.includes(m));
  if (fresh.length === 0) return state;
  let next: GameState = { ...state, pro: { ...state.pro, fans: { ...fans, milestones: [...reached, ...fresh] } } };
  const top = fresh[fresh.length - 1];
  const label = followersText(top);
  const who = `${next.player.firstName} ${next.player.lastName}`.trim();
  next = withInbox(next, message(date, 'FAN', 'Fan club', `${label} followers!`, `${label} people now follow your career. Every innings is watched - the good days and the bad.`, 'MILESTONE', false, [{ id: 'nav-/community', label: 'Community', kind: 'NAVIGATE', route: '/community', taken: false }]));
  next = withEvent(next, date, 'MILESTONE', `${label} followers`, 'The fan following passed a milestone.');
  const story: MediaStory = { id: newId('story'), date, outlet: 'Fan Zone', headline: `${who} passes ${label} followers`, body: 'One of the most followed cricketers in the country now.', tone: 'PRAISE', likes: Math.round(top * 0.03) };
  return { ...next, pro: { ...next.pro, fans: { ...next.pro.fans, stories: [story, ...next.pro.fans.stories].slice(0, 40) } } };
}

/** After one of the player's matches: the posts, the trend, the chart point and any milestone. */
export function fansAfterMatch(state: GameState, match: Match): GameState {
  const posts = fanReactions(state, match);
  const fans = state.pro.fans;
  const tag = trendFor(state, match);
  const trend = tag ? { tag, date: match.date, posts: Math.round(Math.max(500, fans.followers * 0.08)) } : (fans.trend ?? null);
  const withPosts: FanState = { ...fans, posts: [...posts, ...(fans.posts ?? [])].slice(0, FANS.postsKept), trend };
  const next: GameState = { ...state, pro: { ...state.pro, fans: withFollowerPoint(withPosts, match.date) } };
  return checkFanMilestones(next, match.date);
}
