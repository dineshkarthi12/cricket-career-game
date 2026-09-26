/** Round-robin pairings, match dates inside the season windows, and knockout seeding. */
import { addDays, daysBetweenDates, nextWeekday, seasonDate } from '../development/dates';
import type { RoundWindow } from '@/data/tournamentStructures';
import type { KnockoutTie, TournamentGroup, TournamentStage } from '@/types';

/**
 * The circle method: every team meets every other once. With an odd number
 * a bye is added (a team with the bye sits the round out). Returns, for each
 * round, the pairs as [home, away] indices; home and away alternate.
 */
export function roundRobin(teamCount: number): [number, number][][] {
  const n = teamCount % 2 === 0 ? teamCount : teamCount + 1;
  const bye = teamCount % 2 === 0 ? -1 : n - 1;
  const order = Array.from({ length: n }, (_, i) => i);
  const rounds: [number, number][][] = [];
  for (let r = 0; r < n - 1; r += 1) {
    const pairs: [number, number][] = [];
    for (let i = 0; i < n / 2; i += 1) {
      const a = order[i];
      const b = order[n - 1 - i];
      if (a === bye || b === bye) continue;
      pairs.push((r + i) % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    // Rotate everyone but the first.
    order.splice(1, 0, order.pop()!);
  }
  return rounds;
}

/** Repeat a round-robin for more legs, swapping home and away each time. */
export function withLegs(rounds: [number, number][][], legs: number): [number, number][][] {
  const out: [number, number][][] = [];
  for (let leg = 0; leg < legs; leg += 1) {
    for (const round of rounds) out.push(leg % 2 === 0 ? round : round.map(([a, b]) => [b, a] as [number, number]));
  }
  return out;
}

/**
 * Dates for `count` rounds spread across the windows (each window's share
 * set by its `rounds`), on a weekday when there is one, and far enough apart
 * for a match of `matchDays`.
 */
export function roundDates(
  windows: RoundWindow[],
  seasonYear: number,
  matchDays: number,
  weekday: number | null,
  totalRounds: number,
): string[] {
  const dates: string[] = [];
  const planned = windows.reduce((s, w) => s + w.rounds, 0);
  let remaining = totalRounds;
  windows.forEach((window, index) => {
    const share = index === windows.length - 1 ? remaining : Math.round((window.rounds / planned) * totalRounds);
    remaining -= share;
    const start = seasonDate(seasonYear, ...window.from);
    const end = seasonDate(seasonYear, ...window.to);
    const span = Math.max(1, daysBetweenDates(start, end) - (matchDays - 1));
    let previousEnd = dates.length ? addDays(dates[dates.length - 1], matchDays) : null;
    for (let i = 0; i < share; i += 1) {
      let date = addDays(start, Math.floor((i * span) / Math.max(1, share)));
      if (weekday !== null) date = nextWeekday(date, weekday);
      // Never start before the last round has finished (plus a rest day for long matches).
      if (previousEnd && date <= previousEnd) {
        date = addDays(previousEnd, matchDays >= 3 ? 1 : 0);
        if (weekday !== null) date = nextWeekday(date, weekday);
      }
      dates.push(date);
      previousEnd = addDays(date, matchDays - 1);
    }
  });
  return dates;
}

/** Evenly spaced dates for the knockout rounds. */
export function knockoutDates(
  window: { from: [number, number]; to: [number, number] },
  seasonYear: number,
  rounds: number,
  matchDays: number,
  weekday: number | null,
): string[] {
  const start = seasonDate(seasonYear, ...window.from);
  const end = seasonDate(seasonYear, ...window.to);
  const span = Math.max(1, daysBetweenDates(start, end) - (matchDays - 1));
  const out: string[] = [];
  for (let i = 0; i < rounds; i += 1) {
    let date = addDays(start, rounds === 1 ? 0 : Math.floor((i * span) / (rounds - 1)));
    if (weekday !== null) date = nextWeekday(date, weekday);
    if (out.length && date <= addDays(out[out.length - 1], matchDays - 1)) date = addDays(out[out.length - 1], matchDays + 1);
    out.push(date);
  }
  return out;
}

/**
 * The knockout bracket. Group winners meet runners-up of the neighbouring
 * group (A1 v B2, B1 v A2, ...); a single group plays 1 v 4 and 2 v 3.
 */
export function buildBracket(
  groups: TournamentGroup[],
  qualifiers: number,
  stages: TournamentStage[],
  fixtureIdFor: (stage: TournamentStage, index: number) => string,
): KnockoutTie[] {
  if (stages.length === 0) return [];
  const ties: KnockoutTie[] = [];
  const label = (stage: TournamentStage, i: number, count: number) =>
    stage === 'FINAL' ? 'Final' : `${stage === 'QUARTER_FINAL' ? 'Quarter-final' : 'Semi-final'} ${count > 1 ? i + 1 : ''}`.trim();

  // First round from the groups.
  const first = stages[0];
  const seeds: { home: { groupId: string; position: number }; away: { groupId: string; position: number } }[] = [];
  if (groups.length === 1) {
    const g = groups[0].id;
    if (qualifiers >= 4) {
      seeds.push({ home: { groupId: g, position: 1 }, away: { groupId: g, position: 4 } });
      seeds.push({ home: { groupId: g, position: 2 }, away: { groupId: g, position: 3 } });
    } else {
      seeds.push({ home: { groupId: g, position: 1 }, away: { groupId: g, position: 2 } });
    }
  } else {
    for (let i = 0; i < groups.length; i += 2) {
      const a = groups[i].id;
      const b = groups[i + 1]?.id ?? groups[0].id;
      seeds.push({ home: { groupId: a, position: 1 }, away: { groupId: b, position: 2 } });
      seeds.push({ home: { groupId: b, position: 1 }, away: { groupId: a, position: 2 } });
    }
  }
  // Interleave so group A's winner and runner-up are in opposite halves.
  const ordered = groups.length > 2 ? interleave(seeds) : seeds;
  ordered.forEach((seed, i) =>
    ties.push({
      id: `${first}-${i + 1}`,
      stage: first,
      label: label(first, i, ordered.length),
      home: seed.home,
      away: seed.away,
      homeTeamId: null,
      awayTeamId: null,
      fixtureId: fixtureIdFor(first, i),
      winnerTeamId: null,
    }),
  );

  // Later rounds: winners of consecutive ties.
  let previous = ties.filter((t) => t.stage === first);
  for (const stage of stages.slice(1)) {
    const round: KnockoutTie[] = [];
    for (let i = 0; i < previous.length; i += 2) {
      const index = i / 2;
      round.push({
        id: `${stage}-${index + 1}`,
        stage,
        label: label(stage, index, Math.ceil(previous.length / 2)),
        home: { tieId: previous[i].id },
        away: { tieId: previous[i + 1]?.id ?? previous[i].id },
        homeTeamId: null,
        awayTeamId: null,
        fixtureId: fixtureIdFor(stage, index),
        winnerTeamId: null,
      });
    }
    ties.push(...round);
    previous = round;
  }
  return ties;
}

/** [A1vB2, B1vA2, C1vD2, D1vC2] -> [A1vB2, C1vD2, B1vA2, D1vC2]: the two halves of the draw. */
function interleave<T>(items: T[]): T[] {
  const evens = items.filter((_, i) => i % 2 === 0);
  const odds = items.filter((_, i) => i % 2 === 1);
  return [...evens, ...odds];
}
