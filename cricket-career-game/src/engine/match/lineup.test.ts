import { describe, expect, it } from 'vitest';
import { createDemoCareer } from '@/data/demoCareer';
import { createLiveMatch } from './live';
import { battingOrderOf, buildMatch, defaultXiIds, squadFor, xiWarnings } from './lineup';

const state = createDemoCareer();
const fixture = Object.values(state.fixtures).find((f) => f.homeTeamId && f.awayTeamId)!;

describe('squads from a saved career', () => {
  it('generates a squad when the save has none', () => {
    const squad = squadFor(state, fixture.homeTeamId!);
    expect(squad.length).toBeGreaterThanOrEqual(15);
    expect(new Set(squad.map((p) => p.id)).size).toBe(squad.length);
  });

  it('generates the same squad every time for the same career', () => {
    const a = squadFor(state, fixture.awayTeamId!).map((p) => p.name);
    const b = squadFor(state, fixture.awayTeamId!).map((p) => p.name);
    expect(a).toEqual(b);
  });

  it('gives different sides different players', () => {
    const home = squadFor(state, fixture.homeTeamId!).map((p) => p.name);
    const away = squadFor(state, fixture.awayTeamId!).map((p) => p.name);
    expect(home).not.toEqual(away);
  });
});

describe('picking an XI', () => {
  const squad = squadFor(state, fixture.homeTeamId!);

  it('picks a balanced eleven', () => {
    const ids = defaultXiIds(squad);
    expect(ids).toHaveLength(11);
    const xi = ids.map((id) => squad.find((p) => p.id === id)!);
    expect(xi.filter((p) => p.role === 'WICKET_KEEPER_BATTER').length).toBe(1);
    expect(xi.filter((p) => p.role === 'PACE_BOWLER').length).toBeGreaterThanOrEqual(2);
    expect(xi.filter((p) => p.role === 'SPIN_BOWLER').length).toBeGreaterThanOrEqual(1);
    expect(xiWarnings(xi)).toEqual([]);
  });

  it('always includes the user when asked', () => {
    const withUser = [...squad, { ...squad[0], id: 'user-1', isUser: true }];
    expect(defaultXiIds(withUser, 'user-1')).toContain('user-1');
  });

  it('numbers the batting order from the openers down', () => {
    const order = battingOrderOf(squad.slice(0, 11));
    expect(order.map((p) => p.battingPosition)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(order[0].role).toBe('OPENING_BATTER');
    expect(['PACE_BOWLER', 'SPIN_BOWLER']).toContain(order[10].role);
  });

  it('flags an XI that cannot take the field', () => {
    const broken = squad.filter((p) => p.role !== 'WICKET_KEEPER_BATTER').slice(0, 9);
    const warnings = xiWarnings(broken);
    expect(warnings.some((w) => w.includes('exactly 11'))).toBe(true);
    expect(warnings).toContain('No wicket-keeper.');
  });
});

describe('building a match from a fixture', () => {
  it('produces a playable setup', () => {
    const build = buildMatch(state, fixture)!;
    expect(build).not.toBeNull();
    expect(build.setup.homeXi).toHaveLength(11);
    expect(build.setup.awayXi).toHaveLength(11);
    expect(build.setup.format).toBe(fixture.format);
    expect(build.setup.venue.id).toBe(fixture.venueId);
    expect(build.userTeamId).toBe(fixture.homeTeamId);
    expect(build.oppositionTeamId).toBe(fixture.awayTeamId);
  });

  it('puts the user in their own side', () => {
    const build = buildMatch(state, fixture)!;
    const side = build.userTeamId === fixture.homeTeamId ? build.setup.homeXi : build.setup.awayXi;
    expect(side.some((p) => p.isUser)).toBe(true);
    expect(build.setup.userPlayerId).toBe(state.player.id);
  });

  it('leaves the user out when they are not selected', () => {
    const build = buildMatch(state, fixture, { userSelected: false })!;
    const side = build.userTeamId === fixture.homeTeamId ? build.setup.homeXi : build.setup.awayXi;
    expect(side.some((p) => p.isUser)).toBe(false);
    expect(build.setup.userPlayerId).toBeNull();
  });

  it('honours an XI the player chose themselves', () => {
    const squad = squadFor(state, fixture.homeTeamId!);
    const chosen = [state.player.id, ...squad.slice(0, 10).map((p) => p.id)];
    const build = buildMatch(state, fixture, { userXiIds: chosen })!;
    const ids = new Set(build.setup.homeXi.map((p) => p.id));
    for (const id of chosen) expect(ids.has(id)).toBe(true);
  });

  it('replays the same match from the same career and fixture', () => {
    const a = createLiveMatch(buildMatch(state, fixture)!.setup);
    const b = createLiveMatch(buildMatch(state, fixture)!.setup);
    a.toEnd();
    b.toEnd();
    expect(a.snapshot().result?.summary).toBe(b.snapshot().result?.summary);
  });

  it('plays the fixture through to a result', () => {
    const live = createLiveMatch(buildMatch(state, fixture)!.setup);
    live.toEnd();
    expect(live.snapshot().phase).toBe('COMPLETE');
    const done = live.finished()!;
    expect(done.match.fixtureId).toBe(fixture.id);
    expect(done.match.userPerformance).not.toBeNull();
  }, 60_000);
});
