/**
 * A career begun in a past season: it plays among that season's real
 * cricketers, and each 1 June the real squads move on to the next season's
 * players, until the latest data.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadRealData, loadRealSeason, prepareRealSeasons, startSeasons } from '@/data/real';
import { createNewCareer } from '../newCareer';
import { startNewSeason } from '../calendar/advance';
import { activateRealSeason, realData, realSeason, realSeasonFor, hasRealSeason } from './realPlayers';
import { realFranchiseSquad, realNationSquad } from './realSquads';

const names = (squad: { name: string }[] | null) => (squad ?? []).map((p) => p.name);

describe('careers begun in a past season', () => {
  beforeAll(async () => {
    await Promise.all([loadRealSeason(2008), loadRealSeason(2009)]);
  });
  afterAll(async () => {
    await loadRealData();
  });

  it('offers every season from 2005 to today', () => {
    const seasons = startSeasons();
    expect(seasons[0]).toBe(2005);
    expect(seasons[seasons.length - 1]).toBe(2026);
    expect(seasons).toHaveLength(22);
  });

  it('follows real history up to the latest data, and uses today\'s players otherwise', () => {
    expect(realSeasonFor(undefined, 2012)).toBe(2026);
    expect(realSeasonFor(2008, 2008)).toBe(2008);
    expect(realSeasonFor(2008, 2015)).toBe(2015);
    expect(realSeasonFor(2008, 2031)).toBe(2026);
  });

  it('never uses players from the future: with no season that early loaded, sides are generated', () => {
    activateRealSeason(2004);
    expect(realData()).toBeNull();
    activateRealSeason(2026);
    expect(realSeason()).toBe(2026);
  });

  it('starts among the 2008 cricketers: Tendulkar and Dravid for India, Dhoni and Hayden at Chennai', () => {
    const state = createNewCareer({ firstName: 'Ravi', lastName: 'K', dateOfBirth: '1998-04-12', startDate: '2008-06-01', seed: 7 });
    expect(state.realStartYear).toBe(2008);
    expect(realSeason()).toBe(2008);
    const india = names(realNationSquad('India', 'team-india', 2008));
    expect(india).toEqual(expect.arrayContaining(['Sachin Tendulkar', 'Rahul Dravid', 'MS Dhoni']));
    expect(india).not.toContain('Jasprit Bumrah');
    const csk = names(realFranchiseSquad('Chennai Super Kings', 'team-csk', 2008, 'Tamil Nadu'));
    expect(csk).toEqual(expect.arrayContaining(['MS Dhoni', 'Matthew Hayden']));
  });

  it('a career started today is unchanged', () => {
    activateRealSeason(2008);
    const state = createNewCareer({ firstName: 'Ravi', lastName: 'K', dateOfBirth: '2016-04-12', seed: 7 });
    expect(state.realStartYear).toBeUndefined();
    expect(realSeason()).toBe(2026);
  });

  it('moves on to the next season\'s real squads on 1 June', async () => {
    const state = createNewCareer({ firstName: 'Ravi', lastName: 'K', dateOfBirth: '1998-04-12', startDate: '2008-06-01', seed: 7 });
    await prepareRealSeasons(state.realStartYear, state.season.year);
    expect(hasRealSeason(2009)).toBe(true);
    const next = startNewSeason(state, 2009);
    expect(realSeason()).toBe(2009);
    // The rebuild has run: nothing is left pending.
    expect(next.realSquadsPending).toBeFalsy();
    expect(next.realStartYear).toBe(2008);
  });
});
