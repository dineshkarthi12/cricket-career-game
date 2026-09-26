/**
 * The rest of the world plays too. Series between two other nations are
 * played on the fast sim when both sides have squads (once the national
 * selectors are watching), so rival players earn real rankings and season
 * figures; each match is kept as a lightweight scorecard - the result, the
 * top scorers and the wicket-takers. Without squads, results are settled
 * on the team ratings.
 */
import { NATIONS, nationTeamId } from '@/data/nations';
import { RANKINGS } from '../config';
import { addDays, seasonDate } from '../development/dates';
import { battingOrderOf, defaultXiIds, squadFor, xiOptionsFor } from '../match/lineup';
import { quickMatch } from '../sim/quickMatch';
import { applyToSquads, linesFromMatch } from '../tournament/live';
import { cityVenue } from './world';
import { expected, rankMatch, rateTeams } from './rankings';
import type { Rng } from '../match/rng';
import type { SimPlayer } from '../match/types';
import type { GameState, IntlFormat, MatchFormat, WorldResult } from '@/types';

const MATCH_FORMAT: Record<IntlFormat, MatchFormat> = { TEST: 'TEST', ODI: 'ODI', T20I: 'T20' };
const TOURNAMENT: Record<IntlFormat, string> = { TEST: 'intl-test', ODI: 'intl-odi', T20I: 'intl-t20i' };
/** When in the season each format's series are played (month, day). */
const WINDOWS: Record<IntlFormat, [number, number]> = { TEST: [11, 20], ODI: [9, 20], T20I: [2, 10] };

function xiOf(state: GameState, teamId: string, format: MatchFormat): SimPlayer[] | null {
  const team = state.teams[teamId];
  if (!team || team.squad.length < 11) return null;
  const pool = squadFor(state, teamId);
  const ids = defaultXiIds(pool, null, xiOptionsFor(team, format));
  const byId = new Map(pool.map((p) => [p.id, p]));
  return battingOrderOf(ids.map((id) => byId.get(id)).filter((p): p is SimPlayer => Boolean(p)));
}

/** One season of other nations' bilateral cricket. */
export function worldSeries(state: GameState, seasonYear: number, rng: Rng): GameState {
  let next = state;
  const others = NATIONS.filter((n) => n.name !== 'India');
  const results: WorldResult[] = [];
  for (const format of ['TEST', 'ODI', 'T20I'] as IntlFormat[]) {
    for (let s = 0; s < RANKINGS.backgroundSeries[format]; s += 1) {
      const pool = format === 'TEST' ? others.filter((n) => n.tier !== 'ASSOCIATE') : others;
      const home = rng.pick(pool);
      const away = rng.pick(pool.filter((n) => n.name !== home.name));
      const matches = format === 'TEST' ? rng.int(2, 3) : 3;
      const start = addDays(seasonDate(seasonYear, ...WINDOWS[format]), s * 12);
      for (let m = 0; m < matches; m += 1) {
        const homeId = nationTeamId(home.name);
        const awayId = nationTeamId(away.name);
        const mf = MATCH_FORMAT[format];
        const homeXi = xiOf(next, homeId, mf);
        const awayXi = xiOf(next, awayId, mf);
        const date = addDays(start, m * (format === 'TEST' ? 8 : 3));
        if (!homeXi || !awayXi) {
          // No squads to play with: settle it on the ratings.
          const pHome = expected(next.pro.nations[home.name].ratings[format], next.pro.nations[away.name].ratings[format], RANKINGS.homeAdvantage);
          const drawn = format === 'TEST' && rng.chance(RANKINGS.testDraw);
          next = rateTeams(next, format, home.name, away.name, drawn ? null : rng.chance(pHome) ? home.name : away.name, drawn, true);
          continue;
        }
        const venue = cityVenue(home.cities[(s + m) % home.cities.length], home.name, home.name);
        const played = quickMatch({
          fixtureId: `world-${seasonYear}-${format}-${s}-${m}`,
          tournamentId: TOURNAMENT[format],
          seasonYear,
          format: mf,
          stage: 'LEAGUE',
          date,
          days: format === 'TEST' ? 5 : 1,
          venue,
          homeTeamId: homeId,
          awayTeamId: awayId,
          homeXi,
          awayXi,
          userIsHome: false,
          seed: Math.floor(rng.next() * 2 ** 31),
          region: home.region,
        });
        const lines = linesFromMatch(played.match, played.lines);
        next = applyToSquads(next, lines);
        next = rankMatch(next, played.match, lines);
        const r = played.match.result;
        const winner = r?.winningTeamId === homeId ? home.name : r?.winningTeamId === awayId ? away.name : null;
        next = rateTeams(next, format, home.name, away.name, winner, !winner, true);
        const nation = (teamId: string) => (teamId === homeId ? home.name : away.name);
        results.push({
          date,
          format,
          home: home.name,
          away: away.name,
          summary: winner ? `${winner} ${r?.summary ?? 'won'}` : (r?.summary ?? 'Drawn'),
          batting: [...lines].sort((a, b) => b.runs - a.runs).slice(0, 3).map((l) => ({ name: l.name, nation: nation(l.teamId), runs: l.runs, balls: l.balls })),
          bowling: [...lines].filter((l) => l.wickets > 0).sort((a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded).slice(0, 3).map((l) => ({ name: l.name, nation: nation(l.teamId), wickets: l.wickets, runs: l.runsConceded })),
        });
      }
    }
  }
  results.sort((a, b) => b.date.localeCompare(a.date));
  return { ...next, pro: { ...next.pro, worldResults: results.slice(0, 40) } };
}
