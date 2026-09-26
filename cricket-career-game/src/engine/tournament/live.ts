/**
 * Tournaments inside a running career. As the clock reaches a date, every
 * match that day the user is not in is played on the fast sim; the user's
 * own matches are recorded when they are committed. Results feed the table,
 * the leaders and the bracket, and every player's season - AI rivals
 * included, so their form is real when the selectors compare.
 */
import { createRng, deriveSeed } from '../match/rng';
import { defaultXiIds, squadFor, battingOrderOf, xiOptionsFor } from '../match/lineup';
import { regionOf } from '@/data/places';
import { TOURNAMENTS_BY_ID } from '@/data/tournaments';
import { matchRating, quickMatch, type QuickPlayerLine } from '../sim/quickMatch';
import { recordResult, settleKnockout, type MatchLine } from './results';
import { IPL_RULES } from '../config';
import { rankMatch } from '../pro/rankings';
import { rateResult, trackSeries } from '../pro/awards';
import type { SimPlayer } from '../match/types';
import type { CompactResult, Fixture, GameState, Match, Team, TournamentState } from '@/types';

function saltOf(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function tournamentOf(state: GameState, tournamentId: string | null): TournamentState | undefined {
  if (!tournamentId) return undefined;
  return state.season.tournaments.find((t) => t.tournamentId === tournamentId && t.seasonYear === state.season.year);
}

function withTournament(state: GameState, t: TournamentState): GameState {
  return {
    ...state,
    season: {
      ...state.season,
      tournaments: state.season.tournaments.map((x) => (x.tournamentId === t.tournamentId && x.seasonYear === t.seasonYear ? t : x)),
    },
  };
}

/** A compact result from a full match (engine or fast sim). */
export function compactFromMatch(match: Match, fixture: Fixture, firstInningsLeadTeamId: string | null = null, keepMatchId = false): CompactResult {
  const r = match.result;
  const type: CompactResult['type'] = r?.type === 'WIN' ? 'WIN' : r?.type === 'TIE' ? 'TIE' : r?.type === 'DRAW' ? 'DRAW' : 'NO_RESULT';
  let lead = firstInningsLeadTeamId;
  if (!lead && match.innings.length >= 2) {
    lead = match.innings[0].runs >= match.innings[1].runs ? match.innings[0].battingTeamId : match.innings[1].battingTeamId;
  }
  return {
    fixtureId: fixture.id,
    stage: fixture.stage ?? 'GROUP',
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId,
    winnerTeamId: r?.winningTeamId ?? null,
    type,
    summary: r?.summary ?? '',
    scores: match.innings.map((i) => ({ teamId: i.battingTeamId, runs: i.runs, wickets: i.wickets, balls: i.balls, allOut: i.allOut })),
    firstInningsLeadTeamId: lead,
    matchId: keepMatchId ? match.id : null,
  };
}

/** Everyone's figures from a scorecard. */
export function linesFromMatch(match: Match, quick?: Record<string, QuickPlayerLine>): MatchLine[] {
  const lines = new Map<string, MatchLine>();
  const get = (id: string, name: string, teamId: string): MatchLine => {
    let l = lines.get(id);
    if (!l) {
      l = { playerId: id, name, teamId, innings: 0, notOuts: 0, runs: 0, balls: 0, highScore: 0, wickets: 0, ballsBowled: 0, runsConceded: 0, rating: 0, catches: 0 };
      lines.set(id, l);
    }
    return l;
  };
  for (const inn of match.innings) {
    for (const b of inn.batting) {
      const l = get(b.playerId, b.name, inn.battingTeamId);
      l.innings += 1;
      if (!b.out) l.notOuts += 1;
      l.runs += b.runs;
      l.balls += b.balls;
      l.highScore = Math.max(l.highScore, b.runs);
    }
    for (const w of inn.bowling) {
      const l = get(w.playerId, w.name, inn.bowlingTeamId);
      l.wickets += w.wickets;
      l.ballsBowled += w.balls;
      l.runsConceded += w.runsConceded;
    }
    for (const ball of inn.deliveries) {
      const f = ball.wicket?.fielderId;
      if (f && (ball.wicket?.type === 'CAUGHT' || ball.wicket?.type === 'CAUGHT_BEHIND')) {
        const l = lines.get(f);
        if (l) l.catches += 1;
      }
    }
  }
  for (const l of lines.values()) {
    const q = quick?.[l.playerId];
    if (q) l.catches = q.catches + q.stumpings;
    l.rating = q?.rating ?? matchRating(match.format, { ...l, stumpings: 0 }, match.result?.winningTeamId === l.teamId);
  }
  return [...lines.values()];
}

/** AI players' season lines and form move with every match they play. */
function applyToSquads(state: GameState, lines: MatchLine[]): GameState {
  const byTeam = new Map<string, MatchLine[]>();
  for (const l of lines) byTeam.set(l.teamId, [...(byTeam.get(l.teamId) ?? []), l]);
  let teams = state.teams;
  for (const [teamId, teamLines] of byTeam) {
    const team = teams[teamId];
    if (!team || team.squad.length === 0) continue;
    const byId = new Map(teamLines.map((l) => [l.playerId, l]));
    const squad = team.squad.map((p) => {
      const l = byId.get(p.id);
      if (!l) return p;
      const s = p.season;
      const ratings = [...s.ratings, l.rating].slice(-8);
      const form = Math.round(p.condition.form + ((l.rating * 10 - p.condition.form) * 0.34));
      return {
        ...p,
        season: {
          ...s,
          matches: s.matches + 1,
          innings: s.innings + l.innings,
          notOuts: s.notOuts + l.notOuts,
          runs: s.runs + l.runs,
          balls: s.balls + l.balls,
          highScore: Math.max(s.highScore, l.highScore),
          fifties: s.fifties + (l.highScore >= 50 && l.highScore < 100 ? 1 : 0),
          hundreds: s.hundreds + (l.highScore >= 100 ? 1 : 0),
          wickets: s.wickets + l.wickets,
          ballsBowled: s.ballsBowled + l.ballsBowled,
          runsConceded: s.runsConceded + l.runsConceded,
          catches: s.catches + l.catches,
          ratings,
        },
        condition: { ...p.condition, form, recentRatings: ratings.slice(-5) },
      };
    });
    teams = { ...teams, [teamId]: { ...team, squad } };
  }
  return teams === state.teams ? state : { ...state, teams };
}

/** Put the knockout sides into their fixtures once they are known. */
function fillKnockouts(state: GameState, t: TournamentState, filled: TournamentState['knockouts']): GameState {
  if (filled.length === 0) return state;
  const fixtures = { ...state.fixtures };
  const userInvolved = Object.values(state.fixtures).some((f) => f.tournamentId === t.tournamentId && f.involvesUser);
  for (const tie of filled) {
    const fixture = fixtures[tie.fixtureId];
    if (!fixture || !tie.homeTeamId || !tie.awayTeamId) continue;
    const home = state.teams[tie.homeTeamId];
    const away = state.teams[tie.awayTeamId];
    fixtures[tie.fixtureId] = {
      ...fixture,
      homeTeamId: tie.homeTeamId,
      awayTeamId: tie.awayTeamId,
      venueId: fixture.venueId ?? home?.homeVenueId ?? null,
      title: `${home?.shortName ?? 'TBC'} vs ${away?.shortName ?? 'TBC'}`,
      subtitle: `${t.name} · ${tie.label}`,
      involvesUser: userInvolved && (tie.homeTeamId === t.userTeamId || tie.awayTeamId === t.userTeamId),
    };
  }
  return { ...state, fixtures };
}

/** Record a match (the user's or the fast sim's) in its tournament. */
export function recordInTournament(
  state: GameState,
  fixture: Fixture,
  match: Match,
  quick?: { lines: Record<string, QuickPlayerLine>; firstInningsLeadTeamId: string | null },
): GameState {
  const t = tournamentOf(state, fixture.tournamentId);
  const lines = linesFromMatch(match, quick?.lines);
  let next = applyToSquads(state, lines);
  if (!t || t.results[fixture.id]) return next;
  let compact = compactFromMatch(match, fixture, quick?.firstInningsLeadTeamId ?? null, !quick);
  if (t.knockouts.some((k) => k.fixtureId === fixture.id)) {
    const roll = createRng(deriveSeed(state.seed, saltOf(fixture.id) ^ 0x5eed)).next();
    compact = settleKnockout(compact, state.teams[compact.homeTeamId]?.strength ?? 50, state.teams[compact.awayTeamId]?.strength ?? 50, roll);
  }
  const outcome = recordResult(t, compact, lines);
  next = withTournament(next, outcome.tournament);
  next = fillKnockouts(next, outcome.tournament, outcome.filled);
  // International cricket moves the rankings; a finished series has a player of the series.
  if (next.pro) {
    next = rankMatch(next, match, lines);
    next = rateResult(next, outcome.tournament, compact);
    next = trackSeries(next, outcome.tournament, fixture, lines);
  }
  return next;
}

function xiFor(state: GameState, team: Team, date: string, format?: Fixture['format']): SimPlayer[] {
  const pool = squadFor(state, team.id).filter((p) => {
    const rival = team.squad.find((r) => r.id === p.id);
    return !rival?.injuredUntil || rival.injuredUntil < date;
  });
  const ids = defaultXiIds(pool.length >= 11 ? pool : squadFor(state, team.id), null, xiOptionsFor(team, format));
  const byId = new Map(squadFor(state, team.id).map((p) => [p.id, p]));
  return battingOrderOf(ids.map((id) => byId.get(id)).filter((p): p is SimPlayer => Boolean(p)));
}

/** Play every match on or before `date` that the user is not in. */
export function playAiFixtures(state: GameState, date: string): GameState {
  const dueIn = (s: GameState) =>
    Object.values(s.fixtures)
      .filter((f) => f.kind === 'MATCH' && !f.played && !f.involvesUser && f.date <= date && f.homeTeamId && f.awayTeamId && tournamentOf(s, f.tournamentId))
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  let next = state;
  // Knockout sides only appear once the round before is played, so go round again.
  for (let pass = 0; pass < 8; pass += 1) {
    const due = dueIn(next);
    if (due.length === 0) break;
    for (const fixture of due) next = playAiFixture(next, fixture);
  }
  return next;
}

/** The bench an impact substitute comes from (IPL only, when the rule is on). */
export function impactBench(state: GameState, team: Team, xi: SimPlayer[], date: string): SimPlayer[] {
  const inXi = new Set(xi.map((p) => p.id));
  const overseasFull = xi.filter((p) => p.overseas).length >= IPL_RULES.maxOverseasXi;
  return squadFor(state, team.id).filter((p) => {
    const rival = team.squad.find((r) => r.id === p.id);
    return !inXi.has(p.id) && !(rival?.injuredUntil && rival.injuredUntil >= date) && !(overseasFull && p.overseas);
  });
}

export function playAiFixture(state: GameState, fixture: Fixture): GameState {
  const home = state.teams[fixture.homeTeamId!];
  const away = state.teams[fixture.awayTeamId!];
  if (!home || !away) return state;
  const meta = TOURNAMENTS_BY_ID[fixture.tournamentId ?? ''];
  const venue = (fixture.venueId && state.venues[fixture.venueId]) || state.venues[home.homeVenueId] || Object.values(state.venues)[0];
  const homeXi = xiFor(state, home, fixture.date, fixture.format);
  const awayXi = xiFor(state, away, fixture.date, fixture.format);
  const result = quickMatch({
    fixtureId: fixture.id,
    tournamentId: fixture.tournamentId ?? 'friendly',
    seasonYear: state.season.year,
    format: fixture.format ?? meta?.format ?? 'ONE_DAY',
    stage: fixture.stage ?? 'GROUP',
    date: fixture.date,
    days: meta?.matchDays ?? 1,
    venue,
    homeTeamId: home.id,
    awayTeamId: away.id,
    homeXi,
    awayXi,
    impact: fixture.tournamentId === 'ipl' && IPL_RULES.impactPlayer ? { homeBench: impactBench(state, home, homeXi, fixture.date), awayBench: impactBench(state, away, awayXi, fixture.date) } : undefined,
    userIsHome: false,
    seed: deriveSeed(state.seed, saltOf(fixture.id)),
    region: regionOf(venue?.state),
  });
  const played = { ...state, fixtures: { ...state.fixtures, [fixture.id]: { ...fixture, played: true } } };
  return recordInTournament(played, fixture, result.match, { lines: result.lines, firstInningsLeadTeamId: result.firstInningsLeadTeamId });
}
