/**
 * The TV graphics: as on a broadcast, the moment the player reaches a
 * career milestone ("1,000 IPL RUNS"), goes past a name on the all-time
 * list ("past Suresh Raina - 5th on the list") or breaks a record ("past
 * Virat Kohli's 8,661"). Worked out from the career before the match plus
 * the figures so far in it, so the same function serves the live match and
 * the post-match screen.
 */
import { LADDERS, ODI_COMPETITIONS, RECORDS, T20I_COMPETITIONS, TEST_COMPETITIONS, type RecordDef } from '@/data/records';
import { TOURNAMENTS_BY_ID } from '@/data/tournaments';
import { competitionTotals } from './legacy';
import type { GameState, Innings } from '@/types';

export type TvGraphicKind = 'MILESTONE' | 'PASSED' | 'RECORD';

export interface TvGraphic {
  /** Stable within a match: each graphic is shown once. */
  id: string;
  kind: TvGraphicKind;
  /** The strap above the headline: "MILESTONE", "ALL-TIME LIST", "RECORD BROKEN". */
  strap: string;
  headline: string;
  detail: string;
}

/** The player's figures in the match so far, innings by innings. */
export interface MatchFigures {
  batting: number[];
  bowling: { wickets: number; runs: number }[];
}

export function figuresIn(innings: Pick<Innings, 'batting' | 'bowling'>[], playerId: string): MatchFigures {
  const batting: number[] = [];
  const bowling: { wickets: number; runs: number }[] = [];
  for (const inn of innings) {
    const bat = inn.batting.find((b) => b.playerId === playerId);
    if (bat && (bat.balls > 0 || bat.out)) batting.push(bat.runs);
    const bowl = inn.bowling.find((b) => b.playerId === playerId);
    if (bowl && bowl.balls > 0) bowling.push({ wickets: bowl.wickets, runs: bowl.runsConceded });
  }
  return { batting, bowling };
}

interface Book {
  /** "IPL", "Test", "ODI", "T20I", or the competition's short name. */
  unit: string;
  competitions: string[];
}

function bookOf(tournamentId: string): Book {
  if (tournamentId === 'ipl') return { unit: 'IPL', competitions: ['ipl'] };
  if (TEST_COMPETITIONS.includes(tournamentId)) return { unit: 'Test', competitions: TEST_COMPETITIONS };
  if (ODI_COMPETITIONS.includes(tournamentId)) return { unit: 'ODI', competitions: ODI_COMPETITIONS };
  if (T20I_COMPETITIONS.includes(tournamentId)) return { unit: 'T20I', competitions: T20I_COMPETITIONS };
  return { unit: TOURNAMENTS_BY_ID[tournamentId]?.shortName ?? 'career', competitions: [tournamentId] };
}

const RUN_MARKS = [500, ...Array.from({ length: 20 }, (_, i) => (i + 1) * 1000)];
const WICKET_MARKS = [25, ...Array.from({ length: 16 }, (_, i) => (i + 1) * 50)];

function n(value: number): string {
  return value.toLocaleString('en-IN');
}

function ordinal(i: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = i % 100;
  return `${i}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** Runs and wickets in the competition's book this season, before the match. */
function seasonSoFar(state: GameState, competitions: string[]): { runs: number; wickets: number } {
  let runs = 0;
  let wickets = 0;
  for (const id of state.season.matchIds) {
    const m = state.matches[id];
    const p = m?.userPerformance;
    if (!m || !p || !competitions.includes(m.tournamentId)) continue;
    runs += p.runs;
    wickets += p.wickets;
  }
  return { runs, wickets };
}

/**
 * The graphics the match has earned so far. `state` is the career before the
 * match is stored (the record does not include it yet).
 */
export function broadcastGraphics(state: GameState, tournamentId: string, figures: MatchFigures): TvGraphic[] {
  if (figures.batting.length === 0 && figures.bowling.length === 0) return [];
  const name = `${state.player.firstName} ${state.player.lastName}`.trim();
  const book = bookOf(tournamentId);
  const before = competitionTotals(state, book.competitions);
  const runs = figures.batting.reduce((a, b) => a + b, 0);
  const wickets = figures.bowling.reduce((a, b) => a + b.wickets, 0);
  const runsAfter = before.batting.runs + runs;
  const wicketsAfter = before.bowling.wickets + wickets;
  const out: TvGraphic[] = [];

  // Career milestones.
  for (const mark of RUN_MARKS) {
    if (before.batting.runs < mark && runsAfter >= mark) {
      out.push({ id: `runs-${book.unit}-${mark}`, kind: 'MILESTONE', strap: 'Milestone', headline: `${n(mark)} ${book.unit} runs`, detail: `${name} · ${before.batting.innings + figures.batting.length} innings` });
    }
  }
  for (const mark of WICKET_MARKS) {
    if (before.bowling.wickets < mark && wicketsAfter >= mark) {
      out.push({ id: `wkts-${book.unit}-${mark}`, kind: 'MILESTONE', strap: 'Milestone', headline: `${n(mark)} ${book.unit} wickets`, detail: `${name} · ${before.batting.matches + 1} matches` });
    }
  }

  // The all-time lists: past a great, or past the record itself.
  for (const ladder of LADDERS.filter((l) => l.competitions.includes(tournamentId))) {
    const was = ladder.kind === 'CAREER_RUNS' ? before.batting.runs : before.bowling.wickets;
    const now = ladder.kind === 'CAREER_RUNS' ? runsAfter : wicketsAfter;
    const what = ladder.kind === 'CAREER_RUNS' ? 'runs' : 'wickets';
    ladder.list.forEach((entry, i) => {
      if (was > entry.value || now <= entry.value) return;
      const id = `pass-${ladder.book}-${ladder.kind}-${entry.name}`;
      if (i === 0) {
        out.push({ id, kind: 'RECORD', strap: 'Record broken', headline: `Most ${book.unit} ${what}`, detail: `${name}: ${n(now)} - past ${entry.name}'s ${n(entry.value)}` });
      } else {
        out.push({ id, kind: 'PASSED', strap: 'All-time list', headline: `Past ${entry.name}`, detail: `${name}: ${n(now)} ${book.unit} ${what} · ${ordinal(i + 1)} on the all-time list` });
      }
    });
  }

  // The rest of the record book.
  const season = seasonSoFar(state, book.competitions);
  const bestBat = Math.max(0, ...figures.batting);
  const bestBowl = figures.bowling.reduce<{ wickets: number; runs: number } | null>((b, x) => (!b || x.wickets > b.wickets || (x.wickets === b.wickets && x.runs < b.runs) ? x : b), null);
  const bb = before.bowling.bestInnings;
  const record = (def: RecordDef, figure: string) => out.push({ id: `record-${def.id}`, kind: 'RECORD', strap: 'Record broken', headline: def.label, detail: `${name}: ${figure} - past ${def.holder}'s ${def.display}` });
  for (const def of RECORDS.filter((d) => d.competitions.includes(tournamentId))) {
    switch (def.kind) {
      case 'HIGH_SCORE':
        if (before.batting.highScore <= def.value && bestBat > def.value) record(def, `${bestBat}`);
        break;
      case 'BEST_BOWLING': {
        const was = bb ? bb.wickets * 1000 - bb.runs : 0;
        if (bestBowl && was <= def.value && bestBowl.wickets * 1000 - bestBowl.runs > def.value) record(def, `${bestBowl.wickets}/${bestBowl.runs}`);
        break;
      }
      case 'HUNDREDS': {
        const was = before.batting.hundreds + before.batting.doubleHundreds;
        const now = was + figures.batting.filter((r) => r >= 100).length;
        if (was <= def.value && now > def.value) record(def, `${now}`);
        break;
      }
      case 'MATCHES':
        if (before.batting.matches <= def.value && before.batting.matches + 1 > def.value) record(def, `${before.batting.matches + 1}`);
        break;
      case 'SEASON_RUNS':
        if (season.runs <= def.value && season.runs + runs > def.value) record(def, `${n(season.runs + runs)}`);
        break;
      case 'SEASON_WICKETS':
        if (season.wickets <= def.value && season.wickets + wickets > def.value) record(def, `${season.wickets + wickets}`);
        break;
      default:
        // Career runs and wickets: the all-time lists above.
        if (!LADDERS.some((l) => l.book === def.book && l.kind === def.kind)) {
          const was = def.kind === 'CAREER_RUNS' ? before.batting.runs : before.bowling.wickets;
          const now = def.kind === 'CAREER_RUNS' ? runsAfter : wicketsAfter;
          if (was <= def.value && now > def.value) record(def, n(now));
        }
    }
  }
  return out;
}
