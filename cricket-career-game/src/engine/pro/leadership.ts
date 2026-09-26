/**
 * Leadership. The state association, the franchise and the national
 * selectors look for leaders: the leadership and temperament attributes,
 * performances, and seniority in the side. Vice-captain comes first, then
 * the captaincy. Every offer can be accepted or declined. Accepting makes
 * the Phase 4 captain mode live for that side (for India, that format).
 */
import { LEADERSHIP } from '../config';
import { nationTeamId } from '@/data/nations';
import { FRANCHISES_BY_ID } from '@/data/franchises';
import { newId } from '../id';
import { appointCaptain, emptyCaptaincyRecord, removeCaptain } from '../career/captaincy';
import { IN_SQUAD } from '../career/squads';
import { resultFor } from '../career/afterMatch';
import { tournamentOf } from '../tournament/live';
import { decision, message, navigate, withEvent, withInbox } from './common';
import { addStory, spotlightMoment } from './media';
import { isIntl } from './national';
import { rngFor } from './world';
import type { GameState, IntlFormat, LeadershipLevel, LeadershipOffer, LeadershipPost, LeadershipRole, Match } from '@/types';
import { INTL_TOURNAMENT, intlFormatOf } from '@/types';

function key(level: LeadershipLevel, format: IntlFormat | null): string {
  return `${level}|${format ?? 'ALL'}`;
}

export function activePosts(state: GameState): LeadershipPost[] {
  return state.pro.leadership.posts.filter((p) => !p.until);
}

function holds(state: GameState, level: LeadershipLevel, role: LeadershipRole, format: IntlFormat | null): LeadershipPost | undefined {
  return activePosts(state).find((p) => p.level === level && p.role === role && (p.format ?? null) === format);
}

/** Recent average match rating in some competitions (last 12). */
function recentRating(state: GameState, ids: string[] | ((id: string) => boolean)): { rating: number; matches: number } {
  const test = typeof ids === 'function' ? ids : (id: string) => ids.includes(id);
  const matchIds = [...(state.seasonHistory[state.seasonHistory.length - 1]?.matchIds ?? []), ...state.season.matchIds];
  const perfs = matchIds.map((id) => state.matches[id]).filter((m) => m?.userPerformance && test(m.tournamentId)).slice(-12);
  if (perfs.length === 0) return { rating: 5, matches: 0 };
  return { rating: perfs.reduce((s, m) => s + m!.userPerformance!.rating, 0) / perfs.length, matches: perfs.length };
}

/** The leadership case, 0-100: attributes, form and seniority. */
export function leadershipScore(state: GameState, form: number, seniority: number): number {
  const m = state.player.attributes.mental;
  return Math.round(m.leadership * LEADERSHIP.leadershipWeight + m.temperament * LEADERSHIP.temperamentWeight + (form - 5) * LEADERSHIP.formWeight + Math.min(LEADERSHIP.seniorityCap, seniority));
}

function competitionMatches(state: GameState, ids: string[]): number {
  return ids.reduce((s, id) => s + (state.player.record.byCompetition[id]?.batting.matches ?? 0), 0);
}

interface Candidacy {
  level: LeadershipLevel;
  format: IntlFormat | null;
  teamId: string;
  teamName: string;
  score: number;
  seniority: string;
}

function candidacies(state: GameState, level: LeadershipLevel): Candidacy[] {
  const out: Candidacy[] = [];
  const age = state.player.age;
  if (level === 'STATE') {
    const place = ['ranji-trophy', 'vijay-hazare', 'syed-mushtaq-ali'].map((id) => state.career.squads[id]).find((p) => p && IN_SQUAD.includes(p.status));
    const team = (place?.teamId ? state.teams[place.teamId] : undefined) ?? Object.values(state.teams).find((t) => t.isUserTeam && t.kind === 'STATE' && t.level === 'STATE_SENIOR');
    const matches = competitionMatches(state, ['ranji-trophy', 'vijay-hazare', 'syed-mushtaq-ali']);
    if (!team || !place || !IN_SQUAD.includes(place.status) || age < LEADERSHIP.minAge.STATE || matches < LEADERSHIP.minMatches.STATE) return out;
    const form = recentRating(state, ['ranji-trophy', 'vijay-hazare', 'syed-mushtaq-ali']);
    out.push({ level, format: null, teamId: team.id, teamName: team.name, score: leadershipScore(state, form.rating, matches / 3), seniority: `${matches} senior state matches` });
  } else if (level === 'IPL') {
    const fid = state.pro.ipl.franchiseId;
    const seasons = state.pro.ipl.seasons.filter((s) => s.franchiseId === fid);
    const matches = seasons.reduce((s, x) => s + x.matches, 0);
    if (!fid || age < LEADERSHIP.minAge.IPL || matches < LEADERSHIP.minMatches.IPL) return out;
    const form = recentRating(state, ['ipl']);
    const capped = state.pro.national.caps.T20I + state.pro.national.caps.ODI + state.pro.national.caps.TEST > 0 ? LEADERSHIP.cappedBonus : 0;
    out.push({ level, format: null, teamId: fid, teamName: FRANCHISES_BY_ID[fid]?.name ?? fid, score: leadershipScore(state, form.rating, matches / 2) + capped, seniority: `${seasons.length} seasons, ${matches} matches for the franchise` });
  } else {
    for (const format of ['TEST', 'ODI', 'T20I'] as IntlFormat[]) {
      const caps = state.pro.national.caps[format];
      const place = state.career.squads[INTL_TOURNAMENT[format]];
      if (caps < LEADERSHIP.minMatches.INDIA || age < LEADERSHIP.minAge.INDIA || (place && !IN_SQUAD.includes(place.status))) continue;
      const form = recentRating(state, (id) => isIntl(id));
      out.push({ level, format, teamId: nationTeamId('India'), teamName: `India (${format === 'TEST' ? 'Tests' : format === 'ODI' ? 'ODIs' : 'T20Is'})`, score: leadershipScore(state, form.rating, caps / 2), seniority: `${caps} caps` });
    }
  }
  return out;
}

/**
 * The selectors' leadership review for a level: a vice-captaincy for a
 * strong enough case, the captaincy for a vice-captain whose case keeps
 * growing. The side's current captain is not always ready to go, so a
 * good case still waits sometimes.
 */
export function leadershipReview(state: GameState, level: LeadershipLevel, date: string): GameState {
  if (state.pro.leadership.offer || state.pro.retirement.complete) return state;
  const rng = rngFor(state, `leadership-${level}-${date}`);
  for (const c of candidacies(state, level)) {
    const k = key(level, c.format);
    if ((state.pro.leadership.cooldown[k] ?? 0) > state.season.year) continue;
    const vc = holds(state, level, 'VICE_CAPTAIN', c.format);
    const captain = holds(state, level, 'CAPTAIN', c.format);
    if (captain) continue;
    const t = LEADERSHIP.thresholds[level];
    // The side has other leaders: the user's case must beat the best of them this season.
    const rival = t.rival + rng.spread() * LEADERSHIP.rivalSpread;
    let role: LeadershipRole | null = null;
    if (vc && c.score >= t.captain && c.score >= rival + LEADERSHIP.captainOverRival && rng.chance(LEADERSHIP.captainVacancy[level])) role = 'CAPTAIN';
    else if (!vc && c.score >= t.vice && c.score >= rival && rng.chance(LEADERSHIP.viceVacancy[level])) role = 'VICE_CAPTAIN';
    if (!role) continue;
    return offer(state, { id: newId('offer'), level, role, teamId: c.teamId, teamName: c.teamName, format: c.format, date, reason: `Leadership ${state.player.attributes.mental.leadership}, temperament ${state.player.attributes.mental.temperament}, ${c.seniority}.` });
  }
  return state;
}

function roleName(role: LeadershipRole): string {
  return role === 'CAPTAIN' ? 'captain' : 'vice-captain';
}

function offer(state: GameState, o: LeadershipOffer): GameState {
  const next: GameState = { ...state, pro: { ...state.pro, leadership: { ...state.pro.leadership, offer: o } } };
  return withInbox(
    next,
    message(
      o.date,
      o.level === 'IPL' ? 'FRANCHISE' : 'SELECTOR',
      o.level === 'IPL' ? o.teamName : o.level === 'INDIA' ? 'National selectors' : 'State association',
      `Offer: ${roleName(o.role)} of ${o.teamName}`,
      `${o.reason} ${o.role === 'CAPTAIN' ? 'As captain you set the field, choose the bowlers, call the toss and have your say on the XI - and carry the results.' : 'The next step is the captaincy itself.'} Do you accept?`,
      'SELECTION',
      true,
      [decision('leadership-accept', 'Accept', 'ACCEPT'), decision('leadership-decline', 'Decline', 'DECLINE'), navigate('Career Path', '/career')],
      o.id,
    ),
  );
}

/** The user answers the leadership offer. */
export function answerLeadership(state: GameState, accept: boolean, date = state.season.currentDate): GameState {
  const o = state.pro.leadership.offer;
  if (!o) return state;
  const l = state.pro.leadership;
  if (!accept) {
    return {
      ...state,
      pro: { ...state.pro, leadership: { ...l, offer: null, declined: l.declined + 1, cooldown: { ...l.cooldown, [key(o.level, o.format)]: state.season.year + 2 } } },
    };
  }
  const posts = l.posts.map((p) => (!p.until && p.level === o.level && (p.format ?? null) === o.format ? { ...p, until: date } : p));
  const post: LeadershipPost = { level: o.level, role: o.role, teamId: o.teamId, teamName: o.teamName, format: o.format, since: date, until: null };
  let next: GameState = { ...state, pro: { ...state.pro, leadership: { ...l, offer: null, posts: [...posts, post] } } };
  if (o.role === 'CAPTAIN') {
    next = appointCaptain(next, o.teamId, date, `Captain of ${o.teamName}`);
    const record = next.pro.leadership.records[key(o.level, o.format)];
    if (!record) next = { ...next, pro: { ...next.pro, leadership: { ...next.pro.leadership, records: { ...next.pro.leadership.records, [key(o.level, o.format)]: emptyCaptaincyRecord() } } } };
  }
  next = withEvent(next, date, 'CAPTAINCY', `${o.role === 'CAPTAIN' ? 'Captain' : 'Vice-captain'} of ${o.teamName}`, o.reason, o.level === 'INDIA' ? 'INTERNATIONAL_STAR' : undefined);
  next = addStory(next, date, `${next.player.firstName} ${next.player.lastName} named ${roleName(o.role)} of ${o.teamName}`, o.reason, 'PRAISE');
  return spotlightMoment(next, o.level === 'INDIA' ? 50000 : 4000, 4);
}

/** Captaincy record per level and format, after a match the user captained. */
export function recordCaptaincy(state: GameState, match: Match, captained: boolean): GameState {
  if (!captained) return state;
  const userTeamId = match.userIsHome ? match.homeTeamId : match.awayTeamId;
  const team = state.teams[userTeamId];
  if (!team) return state;
  const level: LeadershipLevel | null = team.kind === 'FRANCHISE' ? 'IPL' : team.kind === 'NATIONAL' && team.level === 'INTERNATIONAL' ? 'INDIA' : team.kind === 'STATE' && team.level === 'STATE_SENIOR' ? 'STATE' : null;
  if (!level) return state;
  const format = level === 'INDIA' ? intlFormatOf(match.format) : null;
  const k = key(level, format);
  const r = state.pro.leadership.records[k] ?? emptyCaptaincyRecord();
  const result = resultFor(match, userTeamId);
  const record = {
    matches: r.matches + 1,
    won: r.won + (result === 'WIN' ? 1 : 0),
    lost: r.lost + (result === 'LOSS' ? 1 : 0),
    drawn: r.drawn + (result === 'DRAW' ? 1 : 0),
    tied: r.tied + (result === 'TIE' ? 1 : 0),
    noResult: r.noResult + (result === 'NO_RESULT' ? 1 : 0),
  };
  return { ...state, pro: { ...state.pro, leadership: { ...state.pro.leadership, records: { ...state.pro.leadership.records, [k]: record } } } };
}

/**
 * Keep the posts honest: a sacking, a new franchise or retirement ends one.
 * The sacking itself comes from the Phase 4 captaincy rules.
 */
export function syncPosts(state: GameState, date: string): GameState {
  const l = state.pro.leadership;
  const gone = state.pro.retirement.retiredFrom;
  let changed = false;
  const posts = l.posts.map((p) => {
    if (p.until) return p;
    let end = false;
    if (p.level === 'IPL' && (state.pro.ipl.franchiseId !== p.teamId || gone.includes('IPL'))) end = true;
    if (p.level === 'STATE' && (gone.includes('FIRST_CLASS') || gone.includes('ALL'))) end = true;
    if (p.level === 'INDIA' && p.format && gone.includes(p.format)) end = true;
    if (p.role === 'CAPTAIN' && p.level !== 'INDIA' && state.teams[p.teamId]?.captainId !== state.player.id) end = true;
    if (p.role === 'CAPTAIN' && p.level === 'INDIA' && state.career.captaincy.teamId !== p.teamId && !l.posts.some((q) => q !== p && !q.until && q.level === 'INDIA' && q.role === 'CAPTAIN')) end = true;
    if (end) {
      changed = true;
      return { ...p, until: date };
    }
    return p;
  });
  if (!changed) return state;
  let next: GameState = { ...state, pro: { ...state.pro, leadership: { ...l, posts } } };
  // A captaincy that ended here but is still on the books elsewhere is cleared.
  const cap = next.career.captaincy.teamId;
  if (cap && !activePosts(next).some((p) => p.role === 'CAPTAIN' && p.teamId === cap) && l.posts.some((p) => p.role === 'CAPTAIN' && p.teamId === cap)) {
    next = removeCaptain(next, date, 'RESIGNED', 'Left the side');
  }
  return next;
}

/** Is the leadership review for a level due today? (the IPL's in March, the rest at the start of a season) */
export function leadershipLevelsFor(month: number): LeadershipLevel[] {
  return month === 3 ? ['IPL'] : month === 6 ? ['STATE', 'INDIA'] : month === 1 ? ['INDIA'] : [];
}

/** India's squad has a captain the user is competing with? Used by the screens. */
export function hasIndiaSquad(state: GameState, format: IntlFormat): boolean {
  return Boolean(tournamentOf(state, INTL_TOURNAMENT[format]));
}
