import { describe, expect, it } from 'vitest';
import { createNewCareer } from '../newCareer';
import { applyResult, emptyStanding, netRunRate, rankGroup } from './standings';
import { buildBracket, roundRobin } from './schedule';
import { playAiFixtures, tournamentOf } from './live';
import { rankOf, recordResult, settleKnockout, topRunScorers, topWicketTakers } from './results';
import type { CompactResult, GameState, TournamentState } from '@/types';

const result = (partial: Partial<CompactResult>): CompactResult => ({
  fixtureId: 'fx',
  stage: 'GROUP',
  homeTeamId: 'A',
  awayTeamId: 'B',
  winnerTeamId: null,
  type: 'WIN',
  summary: '',
  scores: [],
  firstInningsLeadTeamId: null,
  matchId: null,
  ...partial,
});

describe('points tables', () => {
  const table = () => [emptyStanding('A', 'A'), emptyStanding('B', 'A'), emptyStanding('C', 'A')];

  it('gives 4 for a limited-overs win, 2 for a tie, and computes NRR with the all-out rule', () => {
    // A 180/5 in 20 overs; B all out for 150 in 18 overs - which counts as 20.
    const rows = applyResult(
      table(),
      result({
        winnerTeamId: 'A',
        scores: [
          { teamId: 'A', runs: 180, wickets: 5, balls: 120, allOut: false },
          { teamId: 'B', runs: 150, wickets: 10, balls: 108, allOut: true },
        ],
      }),
      'LIMITED',
      120,
    );
    const a = rows.find((r) => r.teamId === 'A')!;
    const b = rows.find((r) => r.teamId === 'B')!;
    expect(a.points).toBe(4);
    expect(b.points).toBe(0);
    expect(a.netRunRate).toBeCloseTo(9 - 7.5, 3);
    expect(b.netRunRate).toBeCloseTo(-1.5, 3);
    const tie = applyResult(table(), result({ type: 'TIE', scores: [] }), 'LIMITED', 120);
    expect(tie.find((r) => r.teamId === 'A')!.points).toBe(2);
    expect(tie.find((r) => r.teamId === 'B')!.points).toBe(2);
  });

  it('counts a chase won early at the balls actually faced', () => {
    const rows = applyResult(
      table(),
      result({
        winnerTeamId: 'B',
        scores: [
          { teamId: 'A', runs: 120, wickets: 10, balls: 100, allOut: true },
          { teamId: 'B', runs: 121, wickets: 2, balls: 60, allOut: false },
        ],
      }),
      'LIMITED',
      120,
    );
    const b = rows.find((r) => r.teamId === 'B')!;
    // 121 off 10 overs, against 120 in 20 (all out).
    expect(b.netRunRate).toBeCloseTo(12.1 - 6, 3);
    expect(netRunRate(b)).toBeCloseTo(6.1, 3);
  });

  it('gives first-class points: 6 for a win, 3 for a first-innings lead in a draw, 1 for trailing', () => {
    const win = applyResult(table(), result({ winnerTeamId: 'A', scores: [] }), 'FIRST_CLASS', null);
    expect(win.find((r) => r.teamId === 'A')!.points).toBe(6);
    const draw = applyResult(table(), result({ type: 'DRAW', firstInningsLeadTeamId: 'B', scores: [] }), 'FIRST_CLASS', null);
    expect(draw.find((r) => r.teamId === 'B')!.points).toBe(3);
    expect(draw.find((r) => r.teamId === 'A')!.points).toBe(1);
    expect(draw.find((r) => r.teamId === 'B')!.bonusPoints).toBe(1);
  });

  it('ranks on points, then wins, then net run rate', () => {
    const rows = [
      { ...emptyStanding('A', 'A'), points: 8, won: 2, netRunRate: 0.1 },
      { ...emptyStanding('B', 'A'), points: 8, won: 2, netRunRate: 0.9 },
      { ...emptyStanding('C', 'A'), points: 10, won: 2, netRunRate: -1 },
      { ...emptyStanding('D', 'A'), points: 8, won: 1, netRunRate: 2 },
    ];
    expect(rankGroup(rows).map((r) => r.teamId)).toEqual(['C', 'B', 'A', 'D']);
    expect(rankGroup(rows)[0].position).toBe(1);
  });
});

describe('fixtures and brackets', () => {
  it('plays every pair once in a round-robin, even or odd', () => {
    for (const n of [4, 5, 6, 8]) {
      const rounds = roundRobin(n);
      const pairs = rounds.flat().map(([a, b]) => [Math.min(a, b), Math.max(a, b)].join('-'));
      expect(new Set(pairs).size).toBe((n * (n - 1)) / 2);
      expect(pairs.length).toBe((n * (n - 1)) / 2);
      // Nobody plays twice in a round.
      for (const round of rounds) expect(new Set(round.flat()).size).toBe(round.length * 2);
    }
  });

  it('seeds group winners against neighbouring runners-up, with A1 and A2 in opposite halves', () => {
    const groups = ['A', 'B', 'C', 'D'].map((id) => ({ id, name: id, teamIds: [] }));
    const ties = buildBracket(groups, 2, ['QUARTER_FINAL', 'SEMI_FINAL', 'FINAL'], (s, i) => `${s}-${i}`);
    const qf = ties.filter((t) => t.stage === 'QUARTER_FINAL');
    expect(qf).toHaveLength(4);
    expect(qf[0].home).toEqual({ groupId: 'A', position: 1 });
    expect(qf[0].away).toEqual({ groupId: 'B', position: 2 });
    const sf = ties.filter((t) => t.stage === 'SEMI_FINAL');
    const halfOf = (group: string, position: number) =>
      sf.findIndex((s) => [s.home, s.away].some((ref) => 'tieId' in ref && qf.find((q) => q.id === ref.tieId && [q.home, q.away].some((h) => 'groupId' in h && h.groupId === group && h.position === position))));
    expect(halfOf('A', 1)).not.toBe(halfOf('A', 2));
    expect(ties.filter((t) => t.stage === 'FINAL')).toHaveLength(1);
  });

  it('never leaves a knockout drawn: first-innings lead, then a super over', () => {
    const drawn = settleKnockout(result({ type: 'DRAW', firstInningsLeadTeamId: 'B' }), 60, 60, 0.1);
    expect(drawn.winnerTeamId).toBe('B');
    const tied = settleKnockout(result({ type: 'TIE' }), 60, 60, 0.9);
    expect(tied.winnerTeamId).toBe('B');
  });
});

describe('a whole competition', () => {
  function u19Season(): GameState {
    const state = createNewCareer({ firstName: 'T', lastName: 'Q', dateOfBirth: '2009-02-01', startStageId: 'U19_PATHWAY', seed: 21 });
    // Nobody is the user here: every match is played by the fast sim.
    return { ...state, fixtures: Object.fromEntries(Object.entries(state.fixtures).map(([id, f]) => [id, { ...f, involvesUser: false }])) };
  }

  it('builds groups, plays every fixture, fills the bracket and crowns a champion with awards', () => {
    let state = u19Season();
    const before = tournamentOf(state, 'vinoo-mankad')!;
    expect(before.groups).toHaveLength(4);
    expect(before.groups.every((g) => g.teamIds.length === 6)).toBe(true);
    expect(before.knockouts).toHaveLength(7);
    // Every side has a real squad of fictional players.
    for (const id of before.groups.flatMap((g) => g.teamIds)) expect(state.teams[id].squad.length).toBeGreaterThanOrEqual(15);

    state = playAiFixtures(state, '2026-11-30');
    const t = tournamentOf(state, 'vinoo-mankad')! as TournamentState;
    expect(Object.keys(t.results)).toHaveLength(60 + 7);
    expect(t.complete).toBe(true);
    expect(t.winnerTeamId).not.toBeNull();
    const final = t.knockouts.find((k) => k.stage === 'FINAL')!;
    expect([final.homeTeamId, final.awayTeamId]).toContain(t.winnerTeamId);
    expect(t.awards?.topScorer?.name).toBeTruthy();
    expect(t.awards?.playerOfTournament).not.toBeNull();
    // Each group winner played 5 group games.
    for (const g of t.groups) {
      const table = t.standings.filter((s) => s.groupId === g.id);
      expect(table.every((s) => s.played === 5)).toBe(true);
      expect(table.filter((s) => s.qualified)).toHaveLength(2);
    }
    // Leaders are sorted, and ranks are consistent.
    const scorers = topRunScorers(t);
    expect(scorers[0].runs).toBeGreaterThanOrEqual(scorers[scorers.length - 1].runs);
    expect(rankOf(t, scorers[0].playerId, 'runs')).toBe(1);
    expect(topWicketTakers(t)[0].wickets).toBeGreaterThan(0);
    // Knockout fixtures got their teams.
    expect(state.fixtures[final.fixtureId].homeTeamId).toBe(final.homeTeamId);
    // AI players' seasons moved.
    const anyPlayer = state.teams[final.homeTeamId!].squad.find((p) => p.season.matches > 0);
    expect(anyPlayer).toBeDefined();
  });

  it('does not record the same fixture twice', () => {
    const t: TournamentState = { ...tournamentOf(u19Season(), 'vinoo-mankad')! };
    const r = result({ fixtureId: t.fixtureIds[0], homeTeamId: t.groups[0].teamIds[0], awayTeamId: t.groups[0].teamIds[1], winnerTeamId: t.groups[0].teamIds[0] });
    const once = recordResult(t, r, []).tournament;
    const twice = recordResult(once, r, []).tournament;
    expect(twice.standings.find((s) => s.teamId === r.homeTeamId)!.played).toBe(1);
  });
});
