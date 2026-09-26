/**
 * Awards: player of the series in every bilateral series, the IPL's
 * Orange Cap, Purple Cap and MVP, player of the tournament at ICC events,
 * and the annual awards night at the end of each season.
 */
import { TOURNAMENTS_BY_ID } from '@/data/tournaments';
import { newId } from '../id';
import { levelOfCompetition } from '../career/eligibility';
import { message, withEvent, withInbox } from './common';
import { addStory, spotlightMoment } from './media';
import { nationResult, rateTeams } from './rankings';
import type { MatchLine } from '../tournament/results';
import type { AwardKind, AwardRecord, CompactResult, Fixture, GameState, SeriesLine, TournamentState } from '@/types';
import { intlFormatOf } from '@/types';

export function giveAward(state: GameState, kind: AwardKind, title: string, detail: string, date: string): GameState {
  const record: AwardRecord = { id: newId('award'), kind, title, detail, date, seasonYear: state.season.year };
  let next: GameState = { ...state, pro: { ...state.pro, awards: [...state.pro.awards, record] } };
  const awards = next.season.summary.awards ?? [];
  if (!awards.includes(title)) next = { ...next, season: { ...next.season, summary: { ...next.season.summary, awards: [...awards, title] } } };
  next = withInbox(next, message(date, 'MEDIA', 'Awards', title, detail, 'AWARD', true, [{ id: 'nav-awards', label: 'Awards', kind: 'NAVIGATE', route: '/awards', taken: false }]));
  next = withEvent(next, date, 'AWARD', title, detail);
  next = addStory(next, date, title, detail, 'PRAISE');
  return spotlightMoment(next, Math.round(next.pro.fans.followers * 0.04) + 200, 3);
}

/** Series in progress are bilateral competitions: India (or India A) against one side. */
export function isSeriesCompetition(tournamentId: string): boolean {
  return tournamentId.startsWith('intl-') || tournamentId.startsWith('india-a-');
}

function impact(l: SeriesLine): number {
  return l.runs + l.wickets * 22 + l.rating * 3;
}

/**
 * Every result in a series goes into the open series' figures; when the
 * last match is played the series is settled - the result, the player of
 * the series, and for Tests the World Test Championship points.
 */
export function trackSeries(state: GameState, t: TournamentState, fixture: Fixture, lines: MatchLine[]): GameState {
  if (!isSeriesCompetition(t.tournamentId)) return state;
  const group = t.groups.find((g) => g.teamIds.includes(fixture.homeTeamId ?? '') && g.teamIds.includes(fixture.awayTeamId ?? ''));
  if (!group) return state;
  const key = `${t.tournamentId}|${t.seasonYear}|${group.id}`;
  const open = { ...(state.pro.openSeries[key] ?? {}) };
  for (const l of lines) {
    const cur = open[l.playerId] ?? { name: l.name, teamId: l.teamId, matches: 0, runs: 0, wickets: 0, rating: 0 };
    open[l.playerId] = { ...cur, matches: cur.matches + 1, runs: cur.runs + l.runs, wickets: cur.wickets + l.wickets, rating: cur.rating + l.rating };
  }
  let next: GameState = { ...state, pro: { ...state.pro, openSeries: { ...state.pro.openSeries, [key]: open } } };
  const prefix = `fx-${t.seasonYear}-${t.tournamentId}-${group.id.toLowerCase()}-`;
  const total = t.fixtureIds.filter((id) => id.startsWith(prefix)).length;
  const played = Object.values(t.results).filter((r) => r.fixtureId.startsWith(prefix)).length;
  if (played < total) return next;

  // The series is over.
  const results = Object.values(t.results).filter((r) => r.fixtureId.startsWith(prefix));
  const [a, b] = group.teamIds;
  const winsA = results.filter((r) => r.winnerTeamId === a).length;
  const winsB = results.filter((r) => r.winnerTeamId === b).length;
  const teamA = next.teams[a];
  const teamB = next.teams[b];
  const score = `${winsA}-${winsB}`;
  const summary = winsA === winsB ? `Series drawn ${score}` : `${winsA > winsB ? teamA?.name : teamB?.name} win the series ${winsA > winsB ? `${winsA}-${winsB}` : `${winsB}-${winsA}`}`;
  const best = Object.entries(open).sort((x, y) => impact(y[1]) - impact(x[1]))[0];
  const userLine = open[state.player.id];
  const date = fixture.endDate;
  const name = TOURNAMENTS_BY_ID[t.tournamentId]?.name ?? t.name;
  if (userLine) {
    next = withInbox(next, message(date, 'TEAM', 'Team Manager', `${group.name}: ${summary}`, `Your series: ${userLine.matches} matches, ${userLine.runs} runs, ${userLine.wickets} wickets. Player of the series: ${best?.[1].name ?? '-'}.`, 'MATCH', false));
  }
  if (best && best[0] === state.player.id) {
    next = giveAward(next, 'PLAYER_OF_SERIES', `Player of the series: ${name} ${group.name}`, `${userLine!.runs} runs and ${userLine!.wickets} wickets in ${userLine!.matches} matches. ${summary}.`, date);
    next = { ...next, player: { ...next.player, record: { ...next.player.record, manOfTheSeries: next.player.record.manOfTheSeries + 1 } } };
  }
  const { [key]: _done, ...rest } = next.pro.openSeries;
  void _done;
  return { ...next, pro: { ...next.pro, openSeries: rest } };
}

/** Rankings for the teams after an international result. */
export function rateResult(state: GameState, t: TournamentState, r: CompactResult): GameState {
  if (levelOfCompetition(t.tournamentId) < 10) return state;
  const { home, away, winner, drawn } = nationResult(state, r);
  if (!home || !away) return state;
  const format = intlFormatOf(t.format);
  const neutral = !t.tournamentId.startsWith('intl-');
  return rateTeams(state, format, home, away, winner, drawn, t.tournamentId === 'intl-test', neutral);
}

/** Individual awards when a professional competition finishes. */
export function proTournamentAwards(state: GameState, t: TournamentState): GameState {
  const a = t.awards;
  if (!a) return state;
  const me = state.player.id;
  const date = state.season.currentDate;
  let next = state;
  if (t.tournamentId === 'ipl') {
    if (a.topScorer?.playerId === me) next = giveAward(next, 'IPL_ORANGE_CAP', `Orange Cap, IPL ${t.seasonYear + 1}`, `Leading run-scorer: ${a.topScorer.detail}.`, date);
    if (a.topWicketTaker?.playerId === me) next = giveAward(next, 'IPL_PURPLE_CAP', `Purple Cap, IPL ${t.seasonYear + 1}`, `Leading wicket-taker: ${a.topWicketTaker.detail}.`, date);
    if (a.playerOfTournament?.playerId === me) next = giveAward(next, 'IPL_MVP', `Most Valuable Player, IPL ${t.seasonYear + 1}`, a.playerOfTournament.detail, date);
    return next;
  }
  if (['t20-world-cup', 'odi-world-cup', 'champions-trophy'].includes(t.tournamentId)) {
    if (a.playerOfTournament?.playerId === me) next = giveAward(next, 'PLAYER_OF_TOURNAMENT', `Player of the tournament: ${t.name}`, a.playerOfTournament.detail, date);
    if (a.topScorer?.playerId === me) next = giveAward(next, 'TOURNAMENT_TOP_SCORER', `Top run-scorer: ${t.name}`, a.topScorer.detail, date);
    if (a.topWicketTaker?.playerId === me) next = giveAward(next, 'TOURNAMENT_TOP_WICKETS', `Leading wicket-taker: ${t.name}`, a.topWicketTaker.detail, date);
  }
  return next;
}

interface YearLine {
  matches: number;
  runs: number;
  wickets: number;
  rating: number;
}

/** The season's international figures for the user, by format. */
function userIntlYear(state: GameState): Record<string, YearLine> {
  const out: Record<string, YearLine> = {};
  for (const id of state.season.matchIds) {
    const m = state.matches[id];
    const p = m?.userPerformance;
    if (!m || !p || levelOfCompetition(m.tournamentId) < 10) continue;
    const f = intlFormatOf(m.format);
    const cur = out[f] ?? { matches: 0, runs: 0, wickets: 0, rating: 0 };
    out[f] = { matches: cur.matches + 1, runs: cur.runs + p.runs, wickets: cur.wickets + p.wickets, rating: cur.rating + p.rating };
  }
  return out;
}

/** The best season among India's own players, by format, from the tournament figures. */
function rivalBest(state: GameState, tournamentIds: string[]): number {
  const india = new Set(Object.values(state.teams).filter((t) => t.nation === 'India' && t.kind === 'NATIONAL').map((t) => t.id));
  const totals = new Map<string, YearLine>();
  for (const t of state.season.tournaments) {
    if (!tournamentIds.includes(t.tournamentId)) continue;
    for (const l of Object.values(t.stats)) {
      if (!india.has(l.teamId) || l.playerId === state.player.id) continue;
      const cur = totals.get(l.playerId) ?? { matches: 0, runs: 0, wickets: 0, rating: 0 };
      totals.set(l.playerId, { matches: cur.matches + l.matches, runs: cur.runs + l.runs, wickets: cur.wickets + l.wickets, rating: cur.rating + l.ratingSum });
    }
  }
  return Math.max(0, ...[...totals.values()].filter((l) => l.matches >= 4).map(score));
}

function score(l: YearLine): number {
  return l.runs + l.wickets * 22 + l.rating * 4;
}

/**
 * The annual awards night (late May). Player of the Year and the format
 * awards go to the best Indian international season; the emerging award
 * to the best young newcomer; domestic cricketer of the year to the best
 * Ranji season.
 */
export function annualAwards(state: GameState, date: string): GameState {
  const year = state.season.year;
  if (state.pro.awards.some((a) => a.seasonYear === year && a.date === date)) return state;
  let next = state;
  const mine = userIntlYear(state);
  const all: YearLine = Object.values(mine).reduce((s, l) => ({ matches: s.matches + l.matches, runs: s.runs + l.runs, wickets: s.wickets + l.wickets, rating: s.rating + l.rating }), { matches: 0, runs: 0, wickets: 0, rating: 0 });
  const label = `${year}-${String((year + 1) % 100).padStart(2, '0')}`;
  const intl = ['intl-test', 'intl-odi', 'intl-t20i', 't20-world-cup', 'odi-world-cup', 'champions-trophy', 'world-test-championship'];
  if (all.matches >= 8 && score(all) > rivalBest(state, intl)) {
    next = giveAward(next, 'PLAYER_OF_YEAR', `Indian Cricketer of the Year ${label}`, `${all.runs} runs and ${all.wickets} wickets in ${all.matches} internationals.`, date);
  }
  const formats: [string, AwardKind, string[]][] = [
    ['TEST', 'TEST_PLAYER_OF_YEAR', ['intl-test', 'world-test-championship']],
    ['ODI', 'ODI_PLAYER_OF_YEAR', ['intl-odi', 'odi-world-cup', 'champions-trophy']],
    ['T20I', 'T20I_PLAYER_OF_YEAR', ['intl-t20i', 't20-world-cup']],
  ];
  for (const [f, kind, ids] of formats) {
    const l = mine[f];
    if (l && l.matches >= 4 && score(l) > rivalBest(state, ids) * 0.95) {
      next = giveAward(next, kind, `${f === 'TEST' ? 'Test' : f} Player of the Year ${label}`, `${l.runs} runs and ${l.wickets} wickets in ${l.matches} matches.`, date);
    }
  }
  const firstIntlSeason = state.pro.national.debuts.length > 0 && state.pro.national.debuts.every((d) => d.date >= state.season.startDate);
  if (firstIntlSeason && state.player.age <= 24 && all.matches >= 4 && all.rating / all.matches >= 6) {
    next = giveAward(next, 'EMERGING_PLAYER', `Emerging Player of the Year ${label}`, `A first season in international cricket: ${all.runs} runs, ${all.wickets} wickets.`, date);
  }
  const ranji = state.season.tournaments.find((t) => t.tournamentId === 'ranji-trophy');
  const aw = ranji?.awards;
  if (aw && (aw.playerOfTournament?.playerId === state.player.id || (aw.topScorer?.playerId === state.player.id && aw.topWicketTaker?.playerId === state.player.id))) {
    next = giveAward(next, 'DOMESTIC_CRICKETER_OF_YEAR', `Domestic Cricketer of the Year ${label}`, 'The best season in the Ranji Trophy.', date);
  }
  return next;
}
