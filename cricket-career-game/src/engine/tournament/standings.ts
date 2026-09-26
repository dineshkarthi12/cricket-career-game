/**
 * Points tables. Limited overs: 4 for a win, 2 for a tie or no result,
 * separated on net run rate (an all-out innings counts its full quota of
 * overs). First-class: 6 for an outright win, 3 for a first-innings lead in
 * a draw and 1 for trailing, separated on the runs-per-wicket quotient.
 */
import { TOURNAMENT } from '../config';
import type { CompactResult, TournamentStanding } from '@/types';

export function emptyStanding(teamId: string, groupId: string): TournamentStanding {
  return {
    teamId,
    groupId,
    played: 0,
    won: 0,
    lost: 0,
    drawn: 0,
    tied: 0,
    noResult: 0,
    points: 0,
    netRunRate: 0,
    bonusPoints: 0,
    runsFor: 0,
    ballsFaced: 0,
    runsAgainst: 0,
    ballsBowled: 0,
    wicketsLost: 0,
    wicketsTaken: 0,
    position: 0,
    qualified: false,
    eliminated: false,
  };
}

/** Net run rate from the running totals. */
export function netRunRate(s: Pick<TournamentStanding, 'runsFor' | 'ballsFaced' | 'runsAgainst' | 'ballsBowled'>): number {
  const forRate = s.ballsFaced > 0 ? s.runsFor / (s.ballsFaced / 6) : 0;
  const againstRate = s.ballsBowled > 0 ? s.runsAgainst / (s.ballsBowled / 6) : 0;
  return Math.round((forRate - againstRate) * 1000) / 1000;
}

/** First-class tie-break: (runs per wicket for) / (runs per wicket against). */
export function quotient(s: Pick<TournamentStanding, 'runsFor' | 'wicketsLost' | 'runsAgainst' | 'wicketsTaken'>): number {
  const forAvg = s.runsFor / Math.max(1, s.wicketsLost);
  const againstAvg = s.runsAgainst / Math.max(1, s.wicketsTaken);
  return againstAvg > 0 ? forAvg / againstAvg : forAvg;
}

/**
 * Add one result to the two sides' rows. `quotaBalls` is the innings quota in
 * limited overs (120, 300) or null in first-class cricket.
 */
export function applyResult(
  standings: TournamentStanding[],
  result: CompactResult,
  points: 'LIMITED' | 'FIRST_CLASS',
  quotaBalls: number | null,
): TournamentStanding[] {
  return standings.map((row) => {
    if (row.teamId !== result.homeTeamId && row.teamId !== result.awayTeamId) return row;
    const me = row.teamId;
    const next = { ...row, played: row.played + 1 };
    for (const inn of result.scores) {
      const faced = quotaBalls !== null && inn.allOut ? quotaBalls : inn.balls;
      if (inn.teamId === me) {
        next.runsFor += inn.runs;
        next.ballsFaced += faced;
        next.wicketsLost += inn.wickets;
      } else {
        next.runsAgainst += inn.runs;
        next.ballsBowled += faced;
        next.wicketsTaken += inn.wickets;
      }
    }
    if (points === 'LIMITED') {
      const p = TOURNAMENT.limited;
      if (result.type === 'WIN') {
        if (result.winnerTeamId === me) {
          next.won += 1;
          next.points += p.win;
        } else {
          next.lost += 1;
          next.points += p.loss;
        }
      } else if (result.type === 'TIE') {
        next.tied += 1;
        next.points += p.tie;
      } else {
        next.noResult += 1;
        next.points += p.noResult;
      }
      next.netRunRate = netRunRate(next);
    } else {
      const p = TOURNAMENT.firstClass;
      if (result.type === 'WIN') {
        if (result.winnerTeamId === me) {
          next.won += 1;
          next.points += p.win;
        } else {
          next.lost += 1;
          next.points += p.loss;
        }
      } else if (result.type === 'TIE') {
        next.tied += 1;
        next.points += p.tie;
      } else if (result.type === 'DRAW') {
        next.drawn += 1;
        const lead = result.firstInningsLeadTeamId === me;
        next.points += lead ? p.drawLead : p.drawTrail;
        if (lead) next.bonusPoints += 1;
      } else {
        next.noResult += 1;
        next.points += p.noResult;
      }
      next.netRunRate = Math.round(quotient(next) * 1000) / 1000;
    }
    return next;
  });
}

/** Rank one group: points, then wins, then NRR (or the quotient), then runs. */
export function rankGroup(rows: TournamentStanding[]): TournamentStanding[] {
  return [...rows]
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.won - a.won ||
        b.netRunRate - a.netRunRate ||
        b.runsFor - a.runsFor ||
        a.teamId.localeCompare(b.teamId),
    )
    .map((row, i) => ({ ...row, position: i + 1 }));
}

/** Rank every group in a table. */
export function rankAll(standings: TournamentStanding[]): TournamentStanding[] {
  const groups = [...new Set(standings.map((s) => s.groupId))];
  return groups.flatMap((g) => rankGroup(standings.filter((s) => s.groupId === g)));
}
