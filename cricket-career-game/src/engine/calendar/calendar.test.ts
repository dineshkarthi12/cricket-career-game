import { describe, expect, it } from 'vitest';
import { CAREER_STAGES } from '@/data/stages';
import { createNewCareer } from '../newCareer';
import { commitMatch } from '../match/commit';
import { createWeather } from '../match/conditions';
import { createRng } from '../match/rng';
import { quickSimFixture } from './testing';
import {
  advanceWeek,
  buildSeasonCalendar,
  climateNote,
  pendingMatch,
  regionalWeatherWeights,
  seasonYearOf,
} from './index';
import type { CareerStageId, GameState, WeatherType } from '@/types';

const BASE = {
  seasonYear: 2026,
  dateOfBirth: '2016-03-10',
  hometown: 'Chennai',
  stateName: 'Tamil Nadu',
  seed: 42,
  from: '2026-06-01',
};

function calendarFor(stageId: CareerStageId, dateOfBirth = BASE.dateOfBirth) {
  return buildSeasonCalendar({ ...BASE, stageId, dateOfBirth });
}

describe('season calendar by stage', () => {
  it('gives a beginner school and club cricket, exams and school terms', () => {
    const cal = calendarFor('BEGINNER');
    const matches = cal.fixtures.filter((f) => f.kind === 'MATCH');
    expect(new Set(matches.map((f) => f.tournamentId))).toEqual(new Set(['school-league', 'club-league']));
    expect(cal.fixtures.some((f) => f.kind === 'EXAMS')).toBe(true);
    expect(cal.windows.some((w) => w.kind === 'SCHOOL_TERM')).toBe(true);
    expect(cal.fixtures.some((f) => f.kind === 'FITNESS_ASSESSMENT')).toBe(true);
    // School matches on Saturdays, club matches on Sundays.
    for (const m of matches) {
      const weekday = new Date(`${m.date}T00:00:00Z`).getUTCDay();
      expect(weekday).toBe(m.tournamentId === 'school-league' ? 6 : 0);
    }
    // Nothing senior leaks in.
    expect(cal.windows.some((w) => w.kind === 'IPL')).toBe(false);
    expect(matches.some((m) => m.tournamentId === 'ranji-trophy')).toBe(false);
  });

  it('keeps school matches out of exam weeks', () => {
    const cal = calendarFor('BEGINNER');
    const exams = cal.windows.filter((w) => w.kind === 'EXAMS');
    for (const m of cal.fixtures.filter((f) => f.kind === 'MATCH')) {
      for (const exam of exams) expect(m.date >= exam.start && m.date <= exam.end).toBe(false);
    }
  });

  it('only shows the competitions of the stage the player is at', () => {
    for (const stage of CAREER_STAGES) {
      const cal = calendarFor(stage.id, '2000-03-10');
      const played = new Set(cal.fixtures.filter((f) => f.kind === 'MATCH').map((f) => f.tournamentId));
      for (const id of played) expect(stage.tournamentIds).toContain(id);
    }
  });

  it('uses the real Indian windows', () => {
    const u16 = calendarFor('STATE_U16', '2010-08-01').fixtures.filter((f) => f.kind === 'MATCH');
    expect(u16.every((f) => f.tournamentId === 'vijay-merchant')).toBe(true);
    expect(u16.every((f) => ['11', '12', '01'].includes(f.date.slice(5, 7)))).toBe(true);
    const senior = calendarFor('SENIOR_STATE', '2000-08-01').fixtures.filter((f) => f.kind === 'MATCH');
    const month = (id: string) => senior.filter((f) => f.tournamentId === id).map((f) => Number(f.date.slice(5, 7)));
    expect(month('syed-mushtaq-ali').every((m) => m === 11 || m === 12)).toBe(true);
    expect(month('vijay-hazare').every((m) => m === 12 || m === 1)).toBe(true);
    expect(month('ranji-trophy').every((m) => [10, 11, 1, 2].includes(m))).toBe(true);
    const ipl = calendarFor('IPL_CAREER', '2000-08-01');
    expect(ipl.windows.some((w) => w.kind === 'IPL' && w.start.slice(5, 7) === '03')).toBe(true);
    expect(ipl.fixtures.filter((f) => f.tournamentId === 'ipl')).toHaveLength(14);
  });

  it('never double-books the player', () => {
    for (const stageId of ['BEGINNER', 'SENIOR_STATE', 'ESTABLISH_INDIA'] as CareerStageId[]) {
      const matches = calendarFor(stageId, '2000-03-10').fixtures.filter((f) => f.kind === 'MATCH');
      for (let i = 1; i < matches.length; i += 1) expect(matches[i].date > matches[i - 1].endDate).toBe(true);
    }
  });

  it('adds travel before away state matches and rest after long ones', () => {
    const cal = calendarFor('STATE_U16', '2010-08-01');
    expect(cal.fixtures.some((f) => f.kind === 'TRAVEL')).toBe(true);
    expect(cal.fixtures.some((f) => f.kind === 'REST')).toBe(true);
  });

  it('holds ICC events only in their years', () => {
    const inYear = (year: number, id: string) =>
      buildSeasonCalendar({ ...BASE, seasonYear: year, stageId: 'ICC_TOURNAMENTS', dateOfBirth: '1998-01-01' }).fixtures.some((f) => f.tournamentId === id);
    expect(inYear(2027, 'odi-world-cup')).toBe(true);
    expect(inYear(2028, 'odi-world-cup')).toBe(false);
    expect(inYear(2028, 't20-world-cup')).toBe(true);
    expect(inYear(2027, 't20-world-cup')).toBe(false);
  });

  it('drops school once the player turns 16, and marks the birthday', () => {
    const young = calendarFor('DISTRICT_AGE_GROUP', '2013-09-01');
    expect(young.fixtures.some((f) => f.kind === 'EXAMS')).toBe(true);
    const older = calendarFor('U19_PATHWAY', '2009-01-01');
    expect(older.fixtures.some((f) => f.kind === 'EXAMS')).toBe(false);
    expect(young.fixtures.find((f) => f.kind === 'BIRTHDAY')?.date).toBe('2026-09-01');
  });

  it('knows which season a date is in', () => {
    expect(seasonYearOf('2026-06-01')).toBe(2026);
    expect(seasonYearOf('2027-05-31')).toBe(2026);
  });
});

describe('climate', () => {
  const share = (region: Parameters<typeof regionalWeatherWeights>[0], month: number, types: WeatherType[]) => {
    const weights = regionalWeatherWeights(region, month);
    const total = weights.reduce((s, w) => s + w.weight, 0);
    return weights.filter((w) => types.includes(w.item)).reduce((s, w) => s + w.weight, 0) / total;
  };
  const rain: WeatherType[] = ['LIGHT_RAIN', 'HEAVY_RAIN'];

  it('rains in Chennai in November and in Kerala in July', () => {
    expect(share('SOUTH_EAST', 11, rain)).toBeGreaterThan(share('SOUTH_EAST', 7, rain) * 1.5);
    expect(share('SOUTH_WEST', 7, rain)).toBeGreaterThan(share('SOUTH_WEST', 1, rain) * 3);
    expect(climateNote('SOUTH_EAST', 11).kind).toBe('MONSOON');
  });

  it('is hot in May in the north, and dewy in its winter', () => {
    expect(climateNote('NORTH', 5).kind).toBe('HEAT');
    expect(climateNote('NORTH', 1).kind).toBe('DEW');
    expect(share('NORTH', 5, ['HOT'])).toBeGreaterThan(share('NORTH', 12, ['HOT']) * 3);
  });

  it('feeds the match engine: hotter and wetter where it should be', () => {
    const sample = (region: 'NORTH' | 'SOUTH_EAST', month: number) => {
      let temperature = 0;
      let wet = 0;
      for (let i = 0; i < 400; i += 1) {
        const w = createWeather(createRng(i + 1), month, region);
        temperature += w.temperature;
        if (w.type === 'LIGHT_RAIN' || w.type === 'HEAVY_RAIN') wet += 1;
      }
      return { temperature: temperature / 400, wet: wet / 400 };
    };
    expect(sample('NORTH', 5).temperature).toBeGreaterThan(sample('NORTH', 1).temperature + 8);
    expect(sample('SOUTH_EAST', 11).wet).toBeGreaterThan(sample('SOUTH_EAST', 3).wet * 2);
  });

  it('leaves the month-only weather untouched when no region is given', () => {
    const a = createWeather(createRng(9), 7);
    const b = createWeather(createRng(9), 7, undefined);
    expect(a).toEqual(b);
  });
});

describe('the weekly clock', () => {
  function fresh(): GameState {
    return createNewCareer({ firstName: 'Test', lastName: 'Kid', dateOfBirth: '2016-06-20', seed: 5, startDate: '2026-06-01' });
  }

  it('advances a week at a time and trains', () => {
    const state = fresh();
    const result = advanceWeek(state);
    expect(result.days).toBe(7);
    expect(result.state.season.currentDate).toBe('2026-06-08');
    expect(result.state.player.development.weeklyReports).toHaveLength(1);
    expect(result.state.inbox.some((m) => m.sender === 'COACH' && m.category === 'TRAINING')).toBe(true);
  });

  it('stops on the day of a match and waits for it', () => {
    let state = fresh();
    let stop = null;
    for (let i = 0; i < 20 && !stop; i += 1) {
      const result = advanceWeek(state);
      state = result.state;
      stop = result.stoppedFor;
    }
    expect(stop?.kind).toBe('MATCH');
    expect(state.season.currentDate).toBe(stop!.date);
    expect(pendingMatch(state)?.id).toBe(stop!.id);
    // Continue does nothing until the match is played.
    const again = advanceWeek(state);
    expect(again.days).toBe(0);
    expect(again.stoppedFor?.id).toBe(stop!.id);

    const match = quickSimFixture(state, stop!);
    state = commitMatch(state, match);
    const after = advanceWeek(state);
    expect(after.days).toBeGreaterThan(0);
    expect(after.state.calendar.pendingFixtureId).not.toBe(stop!.id);
  });

  it('runs the fitness test and ages the player on their birthday', () => {
    let state = fresh();
    const startAge = state.player.age;
    for (let i = 0; i < 6; i += 1) {
      const result = advanceWeek(state);
      state = result.stoppedFor ? commitMatch(result.state, quickSimFixture(result.state, result.stoppedFor)) : result.state;
    }
    expect(state.player.development.fitnessTests.length).toBeGreaterThan(0);
    expect(state.player.age).toBe(startAge + 1);
    expect(state.inbox.some((m) => m.subject.startsWith('Happy birthday'))).toBe(true);
  });

  it('rolls into a new season on 1 June with a fresh calendar', () => {
    let state = fresh();
    state = { ...state, season: { ...state.season, currentDate: '2027-05-28' }, calendar: { ...state.calendar, pendingFixtureId: null } };
    // Clear the old season's remaining fixtures so the clock runs freely.
    state = { ...state, fixtures: Object.fromEntries(Object.entries(state.fixtures).map(([id, f]) => [id, { ...f, played: true }])) };
    const result = advanceWeek(state);
    expect(result.state.season.year).toBe(2027);
    expect(result.state.seasonHistory).toHaveLength(1);
    expect(result.state.calendar.seasonYear).toBe(2027);
    expect(Object.values(result.state.fixtures).some((f) => f.date >= '2027-06-01' && !f.played)).toBe(true);
  });
});

describe('the save stays small over a season', () => {
  it('keeps ball-by-ball for the latest matches only, so a season fits in localStorage', async () => {
    const { createDemoCareer } = await import('@/data/demoCareer');
    const { isArchived } = await import('../match/archive');
    let state = createDemoCareer();
    let matches = 0;
    for (let i = 0; i < 16; i += 1) {
      const result = advanceWeek(state);
      state = result.state;
      if (result.stoppedFor) {
        state = commitMatch(state, quickSimFixture(state, result.stoppedFor));
        matches += 1;
      }
    }
    expect(matches).toBeGreaterThanOrEqual(5);
    const played = Object.values(state.matches).filter((m) => m.id !== 'match-andhra-u16' && m.innings.some((i) => i.balls > 0));
    const full = played.filter((m) => !isArchived(m));
    expect(full.length).toBeLessThanOrEqual(2);
    // Archived matches keep their full scorecards.
    for (const m of played) expect(m.innings.every((i) => i.batting.length > 0 || i.balls === 0)).toBe(true);
    // Well inside the ~5 MB a browser gives one origin.
    expect(JSON.stringify(state).length).toBeLessThan(3_500_000);
  });
});
