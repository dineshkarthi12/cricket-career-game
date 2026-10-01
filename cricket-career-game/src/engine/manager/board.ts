/**
 * The board: what it expects this season, and how it judges the manager.
 * Expectations follow the squad's strength and the manager's job - a Head of
 * Scouting is judged on what he finds, a Head Coach on results.
 */
import type { BoardObjective, ManagerState } from '@/types/manager';
import { marketValue } from './players';
import { financeReport } from './finance';
import { rankStandings } from './matchday';
import { holds, squadOf } from './util';

/** Rank of the user's squad by total value among the ten (1 = strongest). */
export function squadStrengthRank(state: ManagerState): number {
  const value = (id: string) => squadOf(state, id).reduce((n, p) => n + marketValue(p), 0);
  const order = Object.keys(state.franchises).sort((a, b) => value(b) - value(a));
  return order.indexOf(state.franchiseId) + 1;
}

export function setObjectives(state: ManagerState): BoardObjective[] {
  const rank = squadStrengthRank(state);
  const hard = state.profile.difficulty === 'HARD';
  const easy = state.profile.difficulty === 'EASY';
  const out: BoardObjective[] = [];
  const add = (kind: BoardObjective['kind'], label: string, target: number, weight: number) => out.push({ id: `${state.season.year}-${kind}`, kind, label, target, weight, met: null });
  const results = holds(state, 'MATCHDAY') ? 1 : 0.4;
  if (rank <= 3 && !easy) add('REACH_FINAL', 'Reach the final', 1, 3 * results);
  else if (rank <= 6 || hard) add('PLAYOFFS', 'Make the playoffs (top four)', 4, 3 * results);
  else add('TOP_HALF', 'Finish in the top half', 5, 2.5 * results);
  add('AVOID_BOTTOM', 'Do not finish bottom', 9, 1.5 * results);
  add('PROFIT', 'Break even for the season', 0, 1.5);
  if (holds(state, 'SCOUTING')) add('DISCOVER_TALENT', 'Find two prospects with estimated potential of 75+', 2, holds(state, 'MATCHDAY') ? 1 : 3);
  if (holds(state, 'DEVELOPMENT')) add('DEVELOP_YOUTH', 'Give an under-23 player five or more matches', 1, 1);
  return out;
}

/** Judge each objective against the season as it finished. */
export function evaluateObjectives(state: ManagerState): BoardObjective[] {
  const table = rankStandings(state.season.standings);
  const position = table.findIndex((s) => s.franchiseId === state.franchiseId) + 1;
  const final = state.season.fixtures.find((f) => f.stage === 'FINAL');
  const inFinal = Boolean(final && (final.homeId === state.franchiseId || final.awayId === state.franchiseId));
  const won = final?.result?.winnerId === state.franchiseId;
  const profit = financeReport(state).profit;
  const discovered = Object.values(state.reports).filter((r) => {
    const p = state.players[r.playerId];
    return p?.prospect && r.estPotential >= 75 && Math.floor(r.updated / 100) === state.season.year;
  }).length;
  const youth = squadOf(state, state.franchiseId).filter((p) => p.age < 23 && p.season.matches >= 5).length;
  return state.season.objectives.map((o) => {
    let met = false;
    switch (o.kind) {
      case 'WIN_TITLE':
        met = won;
        break;
      case 'REACH_FINAL':
        met = inFinal;
        break;
      case 'PLAYOFFS':
      case 'TOP_HALF':
        met = position > 0 && position <= o.target;
        break;
      case 'AVOID_BOTTOM':
        met = position > 0 && position <= o.target;
        break;
      case 'PROFIT':
        met = profit >= o.target;
        break;
      case 'DISCOVER_TALENT':
        met = discovered >= o.target;
        break;
      case 'DEVELOP_YOUTH':
        met = youth >= o.target;
        break;
    }
    return { ...o, met };
  });
}
