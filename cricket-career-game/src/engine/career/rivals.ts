/**
 * The AI rivals competing with the player for a place: squad-mates in the
 * same role group at each side the player is with. Everything comes from the
 * simulated world - the rivals' own ratings, form, fitness and figures, which
 * change as they play, train, age and get injured.
 */
import { roleCategory } from '../roles';
import type { GameState, RivalPlayer } from '@/types';

export interface RivalRow {
  id: string;
  name: string;
  age: number;
  role: RivalPlayer['role'];
  overall: number;
  form: number;
  fitness: number;
  injured: boolean;
  matches: number;
  runs: number;
  wickets: number;
  battingAverage: number | null;
  selectorFavour: number;
  direct: boolean;
  /** Overall change since last season's summary, when known. */
  seasons: number;
  isUser: boolean;
}

export interface RivalGroup {
  teamId: string;
  teamName: string;
  rows: RivalRow[];
  /** 1-based place of the player by overall in their role group. */
  userRank: number;
}

export function rivalGroups(state: GameState): RivalGroup[] {
  const me = state.player;
  const myCategory = roleCategory(me.role);
  const today = state.season.currentDate;
  const groups: RivalGroup[] = [];
  for (const teamId of me.currentTeamIds) {
    const team = state.teams[teamId];
    if (!team) continue;
    const rivals = team.squad.filter((p) => p.id !== me.id && (p.isDirectRival || roleCategory(p.role) === myCategory));
    if (rivals.length === 0) continue;
    const rows: RivalRow[] = rivals.map((p) => {
      const outs = p.season.innings - p.season.notOuts;
      return {
        id: p.id,
        name: p.name,
        age: p.age,
        role: p.role,
        overall: p.overall,
        form: Math.round(p.condition.form),
        fitness: Math.round(p.condition.fitness),
        injured: Boolean(p.injuredUntil && p.injuredUntil > today),
        matches: p.season.matches,
        runs: p.season.runs,
        wickets: p.season.wickets,
        battingAverage: outs > 0 ? Math.round((p.season.runs / outs) * 10) / 10 : null,
        selectorFavour: p.selectorFavour,
        direct: p.isDirectRival,
        seasons: p.history.length,
        isUser: false,
      };
    });
    const season = seasonLineOf(state);
    rows.push({
      id: me.id,
      name: `${me.firstName} ${me.lastName}`.trim(),
      age: me.age,
      role: me.role,
      overall: me.overall,
      form: Math.round(me.condition.form),
      fitness: Math.round(me.condition.fitness),
      injured: Boolean(me.development.rehab),
      matches: season.matches,
      runs: season.runs,
      wickets: season.wickets,
      battingAverage: season.average,
      selectorFavour: Math.round(me.condition.selectorTrust ?? 50),
      direct: false,
      seasons: 0,
      isUser: true,
    });
    rows.sort((a, b) => b.overall - a.overall || b.form - a.form);
    groups.push({
      teamId,
      teamName: team.name,
      rows,
      userRank: rows.findIndex((r) => r.isUser) + 1,
    });
  }
  return groups;
}

/** The player's figures this season, across every format. */
function seasonLineOf(state: GameState): { matches: number; runs: number; wickets: number; average: number | null } {
  let matches = 0;
  let runs = 0;
  let wickets = 0;
  let outs = 0;
  const me = state.player.id;
  for (const match of Object.values(state.matches)) {
    if (!match.userPlayed || match.date < state.season.startDate || match.status !== 'COMPLETED') continue;
    matches += 1;
    for (const innings of match.innings) {
      const bat = innings.batting.find((b) => b.playerId === me);
      if (bat) {
        runs += bat.runs;
        if (bat.out) outs += 1;
      }
      wickets += innings.bowling.find((b) => b.playerId === me)?.wickets ?? 0;
    }
  }
  return { matches, runs, wickets, average: outs > 0 ? Math.round((runs / outs) * 10) / 10 : null };
}
