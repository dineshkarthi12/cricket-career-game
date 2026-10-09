import { describe, expect, it } from 'vitest';
import { createNewCareer } from '../newCareer';
import { emptyFormatRecord } from '../records';
import { broadcastGraphics, figuresIn } from './broadcast';
import type { GameState } from '@/types';

function withIpl(runs: number, wickets = 0, innings = 100): GameState {
  const state = createNewCareer({ firstName: 'Pro', lastName: 'Player', dateOfBirth: '1998-03-10', startStageId: 'RANJI_TROPHY', seed: 7, startDate: '2026-06-01', creationRole: 'BATTER' });
  const rec = emptyFormatRecord('T20');
  rec.batting = { ...rec.batting, matches: innings, innings, runs, highScore: 90 };
  rec.bowling = { ...rec.bowling, wickets };
  return { ...state, player: { ...state.player, record: { ...state.player.record, byCompetition: { ...state.player.record.byCompetition, ipl: rec } } } };
}

describe('the TV graphics', () => {
  it('reaches a career milestone', () => {
    const g = broadcastGraphics(withIpl(980, 0, 40), 'ipl', { batting: [35], bowling: [] });
    expect(g.map((x) => x.headline)).toContain('1,000 IPL runs');
    expect(g.find((x) => x.headline === '1,000 IPL runs')!.kind).toBe('MILESTONE');
  });

  it('goes past a name on the all-time list', () => {
    const g = broadcastGraphics(withIpl(5500), 'ipl', { batting: [40], bowling: [] });
    const past = g.find((x) => x.kind === 'PASSED')!;
    expect(past.headline).toBe('Past Suresh Raina');
    expect(past.detail).toContain('5th on the all-time list');
  });

  it('breaks the record, and says whose', () => {
    const g = broadcastGraphics(withIpl(8640), 'ipl', { batting: [30], bowling: [] });
    const record = g.find((x) => x.kind === 'RECORD')!;
    expect(record.headline).toBe('Most IPL runs');
    expect(record.detail).toContain("Virat Kohli's 8,661");
    // Once past it, the next match says nothing more about it.
    expect(broadcastGraphics(withIpl(8700), 'ipl', { batting: [30], bowling: [] }).some((x) => x.kind === 'RECORD')).toBe(false);
  });

  it('a record innings and a wickets milestone', () => {
    const g = broadcastGraphics(withIpl(2000, 48), 'ipl', { batting: [176], bowling: [{ wickets: 3, runs: 20 }] });
    expect(g.find((x) => x.headline === 'Highest IPL score')!.detail).toContain('Chris Gayle');
    expect(g.map((x) => x.headline)).toContain('50 IPL wickets');
  });

  it('nothing before the player has batted or bowled', () => {
    expect(broadcastGraphics(withIpl(990), 'ipl', { batting: [], bowling: [] })).toEqual([]);
    const figures = figuresIn([{ batting: [{ playerId: 'x', runs: 0, balls: 0, out: false } as never], bowling: [] }], 'x');
    expect(figures.batting).toEqual([]);
  });
});
