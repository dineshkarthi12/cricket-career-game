import { beforeAll, describe, expect, it } from 'vitest';
import { SAVE_VERSION } from '@/types';
import { createNewCareer } from '../newCareer';
import { applyProSeason } from '../pro/season';
import { ensureFranchises, ensureNationSide, ensureZones, ensureRestOfIndia } from '../pro/world';
import { tournamentOf } from '../tournament/live';
import { buildTournament } from '../tournament/build';
import { competitionMembers } from './teams';
import { progressWorld } from './progression';
import { createRng } from '../match/rng';
import { computeOverall, formatOverall } from '../ratings';
import { defaultXiIds, squadFor, xiOptionsFor } from '../match/lineup';
import { rankGroup } from '../career/squads';
import {
  hasRealPlayers,
  pointsToOverall,
  realAttributes,
  realData,
  realPlayerAt,
  realPotential,
  realRatings,
  realRecord,
  playerRng,
} from './realPlayers';
import { isRealSide, seedRealSquads } from './realSeed';
import { migrate } from '@/save/migrate';
import { FRANCHISES } from '@/data/franchises';
import { nationTeamId } from '@/data/nations';
import { IPL_RULES } from '../config';
import type { GameState, RealPlayerRecord } from '@/types';

/** A made-up record; figures are in REAL_STAT_KEYS order. */
function record(overrides: Partial<RealPlayerRecord>): RealPlayerRecord {
  return { id: 'test-player', n: 'Test Player', c: 'India', r: 'BA', h: 'R', bw: 'NONE', y: 1998, s: {}, x: 0, ly: 2026, g: 0, ...overrides };
}

// m, inn, runs, balls, outs, 4s, 6s, bb, br, wk, ct, st, pos
const STAR_BAT = { TEST: [40, 70, 3500, 6000, 60, 400, 30, 0, 0, 0, 30, 0, 4], ODI: [40, 38, 2000, 2100, 30, 180, 40, 0, 0, 0, 15, 0, 3], T20I: [30, 29, 1100, 780, 24, 90, 45, 0, 0, 0, 10, 0, 3] };
const ORDINARY_BAT = { SMAT: [20, 19, 380, 330, 17, 35, 10, 0, 0, 0, 6, 0, 4] };
const T20_HITTER = { IPL: [40, 38, 1200, 750, 32, 90, 90, 0, 0, 0, 12, 0, 5], TEST: [5, 9, 180, 420, 9, 20, 1, 0, 0, 0, 3, 0, 6] };
const STAR_PACE = { TEST: [30, 40, 300, 800, 30, 30, 5, 6000, 2700, 130, 8, 0, 10], ODI: [30, 15, 100, 120, 10, 5, 3, 1600, 1350, 50, 5, 0, 10], T20I: [30, 8, 30, 30, 5, 2, 1, 700, 750, 45, 4, 0, 11] };

describe('real players are loaded for the game and the tests', () => {
  it('has all three levels', () => {
    expect(hasRealPlayers()).toBe(true);
    const data = realData()!;
    expect(Object.keys(data.ipl.squads)).toHaveLength(10);
    expect(Object.keys(data.international.squads)).toHaveLength(12);
    expect(Object.keys(data.domestic.squads)).toHaveLength(38);
  });
});

describe('figures -> ratings -> attributes', () => {
  it('maps points onto the overall scale in order', () => {
    const points = [40, 50, 56, 62, 68, 72, 75, 78, 85];
    const overalls = points.map(pointsToOverall);
    for (let i = 1; i < overalls.length; i += 1) expect(overalls[i]).toBeGreaterThan(overalls[i - 1]);
    expect(pointsToOverall(56)).toBeCloseTo(70, 0);
    expect(pointsToOverall(75)).toBeCloseTo(90, 0);
  });

  it('rates a top international far above an ordinary state batter', () => {
    const star = realRatings(record({ id: 'star', s: STAR_BAT, cap: 1 }));
    const ordinary = realRatings(record({ id: 'ordinary', s: ORDINARY_BAT }));
    expect(star.overall).toBeGreaterThanOrEqual(88);
    expect(star.overall).toBeLessThanOrEqual(96);
    expect(ordinary.overall).toBeGreaterThanOrEqual(60);
    expect(ordinary.overall).toBeLessThanOrEqual(78);
    expect(star.fromFigures && ordinary.fromFigures).toBe(true);
  });

  it('rates a bowler on bowling, and a batter on batting', () => {
    const pace = realRatings(record({ id: 'pace', r: 'PB', bw: 'RIGHT_ARM_FAST', s: STAR_PACE, cap: 1 }));
    expect(pace.bowl).not.toBeNull();
    expect(pace.overall).toBeGreaterThanOrEqual(86);
    expect(pace.bat!).toBeLessThan(pace.bowl!);
  });

  it('builds attributes that land on the overall, shaped by the role and formats', () => {
    const rec = record({ id: 'hitter', s: T20_HITTER });
    const ratings = realRatings(rec);
    const a = realAttributes(rec, ratings, playerRng(rec.id, 'attributes'));
    expect(Math.abs(computeOverall(a, 'BATTER') - ratings.overall)).toBeLessThanOrEqual(1);
    // Better in T20 than in Tests: power and range up, technique down.
    expect(formatOverall(a, 'BATTER', 'T20')).toBeGreaterThan(formatOverall(a, 'BATTER', 'TEST'));
    expect(a.batting.power).toBeGreaterThan(a.batting.technique);
    const pace = record({ id: 'pace2', r: 'PB', bw: 'RIGHT_ARM_FAST', s: STAR_PACE });
    const pa = realAttributes(pace, realRatings(pace), playerRng('pace2', 'attributes'));
    expect(pa.bowling.pace).toBeGreaterThan(pa.bowling.spin);
    expect(pa.bowling.pace).toBeGreaterThan(pa.batting.technique);
  });

  it('gives listed players with no figures a generated state-level rating', () => {
    const r = realRatings(record({ id: 'u-tamil-nadu-nobody', s: {}, g: 16 }));
    expect(r.fromFigures).toBe(false);
    expect(r.overall).toBeGreaterThanOrEqual(60);
    expect(r.overall).toBeLessThanOrEqual(78);
  });

  it('sets hidden potential for the age: room to grow when young, none to spare when old', () => {
    expect(realPotential(75, 19)).toBeGreaterThan(85);
    expect(realPotential(88, 30)).toBeGreaterThanOrEqual(88);
    expect(realPotential(88, 30)).toBeLessThanOrEqual(92);
    expect(realPotential(80, 35)).toBeLessThanOrEqual(99);
  });

  it('puts the real sides in the right bands', () => {
    const data = realData()!;
    const overall = (id: string) => realPlayerAt(realRecord(id)!, { teamId: 'team-x', region: 'x', seasonYear: data.ipl.season })?.overall ?? 0;
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
    const india = data.international.squads.India.map(overall);
    expect(median(india)).toBeGreaterThanOrEqual(85);
    expect(Math.max(...india)).toBeLessThanOrEqual(96);
    const ipl = Object.values(data.ipl.squads).flat().map(overall);
    expect(median(ipl)).toBeGreaterThanOrEqual(78);
    expect(median(ipl)).toBeLessThanOrEqual(86);
    const tn = data.domestic.squads['Tamil Nadu'].ranji.map(overall);
    expect(median(tn)).toBeGreaterThanOrEqual(62);
    expect(median(tn)).toBeLessThanOrEqual(80);
  });
});

describe('real players over the years', () => {
  const data = () => realData()!;
  const someone = () => realRecord(data().international.squads.India[0])!;

  it('is the same person in every side, and ages the same way', () => {
    const rec = someone();
    const a = realPlayerAt(rec, { teamId: 'team-india', region: 'Delhi', seasonYear: data().ipl.season + 2 });
    const b = realPlayerAt(rec, { teamId: 'team-coromandel-kings', region: 'Delhi', seasonYear: data().ipl.season + 2 });
    if (!a || !b) return; // retired by then
    expect(a.id).not.toBe(b.id);
    expect(a.realId).toBe(b.realId);
    expect(a.overall).toBe(b.overall);
    expect(a.attributes).toEqual(b.attributes);
  });

  it('retires everyone eventually, and nobody comes back', () => {
    for (const id of data().international.squads.India) {
      const rec = realRecord(id)!;
      let retired = false;
      for (let year = data().ipl.season; year <= data().ipl.season + 25; year += 1) {
        const p = realPlayerAt(rec, { teamId: 't', region: 'x', seasonYear: year });
        if (!p) retired = true;
        else expect(retired, `${rec.n} back in ${year}`).toBe(false);
      }
      expect(retired, rec.n).toBe(true);
    }
  });
});

/** A 28-year-old who has played Ranji: the professional season is open. */
function proCareer(): GameState {
  let state = createNewCareer({ firstName: 'Pro', lastName: 'Player', dateOfBirth: '1998-03-10', startStageId: 'RANJI_TROPHY', seed: 11, startDate: '2026-06-01', creationRole: 'BATTER' });
  state = { ...state, career: { ...state.career, stages: { ...state.career.stages, SENIOR_STATE: { ...state.career.stages.SENIOR_STATE, status: 'COMPLETED', completedOn: '2025-11-01' } } } };
  state = { ...state, pro: { ...state.pro, national: { ...state.pro.national, watched: true } } };
  return applyProSeason(state, 2026, '2026-06-01');
}

describe('a new career in the real world', () => {
  let state: GameState;
  let data: NonNullable<ReturnType<typeof realData>>;
  beforeAll(() => {
    state = proCareer();
    data = realData()!;
  });
  const namesOf = (teamId: string) => new Set(state.teams[teamId].squad.map((p) => p.name));

  it('has the real India squad and the real nations', () => {
    const india = state.teams[nationTeamId('India')];
    expect(india.squad.filter((p) => p.realId).length).toBeGreaterThanOrEqual(20);
    for (const id of data.international.squads.India) expect(namesOf(india.id)).toContain(realRecord(id)!.n);
    const australia = state.teams[nationTeamId('Australia')];
    expect(australia.squad.filter((p) => p.realId).length).toBeGreaterThanOrEqual(20);
  });

  it('has the ten real franchises with their real squads, within the overseas limits', () => {
    for (const f of FRANCHISES) {
      const team = state.teams[f.id];
      expect(team.name).toBe(f.name);
      expect(team.squad.length).toBeGreaterThanOrEqual(IPL_RULES.squadSize);
      expect(team.squad.filter((p) => p.overseas).length).toBeLessThanOrEqual(IPL_RULES.maxOverseasSquad);
      for (const id of data.ipl.squads[f.name]) expect(namesOf(f.id)).toContain(realRecord(id)!.n);
      // The overseas players are exactly the ones who are not Indian.
      for (const p of team.squad.filter((x) => x.realId)) expect(Boolean(p.overseas)).toBe(realRecord(p.realId!)!.c !== 'India');
      // An XI never has more than four.
      const pool = squadFor(state, f.id, 'ipl');
      const xi = defaultXiIds(pool, null, xiOptionsFor(team, 'T20'));
      expect(xi).toHaveLength(11);
      expect(xi.filter((id) => pool.find((p) => p.id === id)!.overseas).length).toBeLessThanOrEqual(IPL_RULES.maxOverseasXi);
    }
  });

  it('has real Ranji, Vijay Hazare and Mushtaq Ali squads for the state sides', () => {
    const ranji = tournamentOf(state, 'ranji-trophy')!;
    expect(ranji).toBeTruthy();
    const tn = state.teams[ranji.userTeamId!];
    expect(tn.name).toBe('Tamil Nadu');
    const lists = data.domestic.squads['Tamil Nadu'];
    const ranjiNames = competitionMembers(tn, 'ranji-trophy').map((p) => p.name);
    const vhtNames = competitionMembers(tn, 'vijay-hazare').map((p) => p.name);
    for (const id of lists.ranji) expect(ranjiNames).toContain(realRecord(id)!.n);
    for (const id of lists.vht) expect(vhtNames).toContain(realRecord(id)!.n);
    // Different squads, with players in more than one.
    expect(ranjiNames).not.toEqual(vhtNames);
    expect(ranjiNames.some((n) => vhtNames.includes(n))).toBe(true);
    // Every other side in the Ranji Trophy is real too.
    for (const id of ranji.groups.flatMap((g) => g.teamIds)) {
      const team = state.teams[id];
      expect(team.competitionSquads?.['ranji-trophy']?.length, team.name).toBeGreaterThanOrEqual(10);
    }
  });

  it('makes the user earn a place against the real players of that competition', () => {
    const ranji = tournamentOf(state, 'ranji-trophy')!;
    const tn = state.teams[ranji.userTeamId!];
    const ranked = rankGroup(state, tn, ['ranji-trophy']);
    const rivals = ranked.filter((r) => !r.candidate.isUser && !r.candidate.outside).map((r) => r.candidate.id);
    const members = new Set(competitionMembers(tn, 'ranji-trophy').map((p) => p.id));
    expect(rivals.length).toBeGreaterThan(0);
    for (const id of rivals) expect(members.has(id)).toBe(true);
  });

  it('builds the zones, the Rest of India and India A from the real state players', () => {
    const s = ensureNationSide(ensureRestOfIndia(ensureZones(state)), 'India', 'A');
    const indiaSquad = new Set(data.international.squads.India);
    for (const id of ['team-south-zone', 'team-north-zone', 'team-rest-of-india', nationTeamId('India', 'A')]) {
      const team = s.teams[id];
      expect(team.squad.filter((p) => p.realId).length, id).toBeGreaterThanOrEqual(15);
      for (const p of team.squad) if (p.realId) expect(indiaSquad.has(p.realId), `${p.name} in ${id}`).toBe(false);
    }
  });

  it('keeps district and age-group sides generated', () => {
    const beginner = createNewCareer({ firstName: 'Young', lastName: 'Player', dateOfBirth: '2016-03-10', seed: 5, startDate: '2026-06-01', creationRole: 'BATTER' });
    for (const team of Object.values(beginner.teams)) for (const p of team.squad) expect(p.realId).toBeUndefined();
  });
});

describe('a career that reaches the top years later', () => {
  it('meets the real players aged; the IPL fills retired places with real domestic players', () => {
    const base = createNewCareer({ firstName: 'Later', lastName: 'Player', dateOfBirth: '2014-03-10', seed: 21, startDate: '2026-06-01', creationRole: 'BATTER' });
    const later: GameState = { ...base, season: { ...base.season, year: 2036 } };
    const s = ensureFranchises(later);
    const all = FRANCHISES.flatMap((f) => s.teams[f.id].squad);
    const real = all.filter((p) => p.realId);
    expect(real.length).toBeGreaterThan(0);
    // No made-up names in the IPL while the real domestic players last.
    expect(real.length).toBe(all.length);
    for (const f of FRANCHISES) expect(s.teams[f.id].squad.length).toBeGreaterThanOrEqual(IPL_RULES.squadSize);
    // Ten years on, nobody in the data is still under 25 unless they were a child in it.
    for (const p of real) {
      const now = realPlayerAt(realRecord(p.realId!)!, { teamId: 't', region: 'x', seasonYear: 2026 })!;
      expect(p.age).toBe(now.age + 10);
    }
    const ranji = buildTournament({ tournamentId: 'ranji-trophy', seasonYear: 2036, hometown: 'Chennai', stateName: 'Tamil Nadu', seed: 3, userAge: 22, userInvolved: false, from: '2036-06-01' });
    const tn = ranji.teams.find((t) => t.id === ranji.userTeamId)!;
    expect(competitionMembers(tn, 'ranji-trophy').length).toBeGreaterThanOrEqual(15);
  });

  it('ages and retires real players in the yearly progression, identically in every side', () => {
    const state = proCareer();
    const next = progressWorld(state, 2027, new Set(), createRng(4));
    const copies = new Map<string, number[]>();
    for (const team of Object.values(next.teams)) for (const p of team.squad) if (p.realId) copies.set(p.realId, [...(copies.get(p.realId) ?? []), p.overall]);
    let shared = 0;
    for (const overalls of copies.values()) {
      if (overalls.length < 2) continue;
      shared += 1;
      expect(new Set(overalls).size).toBe(1);
    }
    expect(shared).toBeGreaterThan(10);
    // Competition squads only hold players still in the side.
    for (const team of Object.values(next.teams)) {
      if (!team.competitionSquads) continue;
      const ids = new Set(team.squad.map((p) => p.id));
      for (const list of Object.values(team.competitionSquads)) for (const id of list) expect(ids.has(id)).toBe(true);
    }
  });
});

describe('saves from before the real players', () => {
  it('migrates v8: real franchise names now, real squads at the next rollover', () => {
    const state = proCareer();
    // Make it look like a v8 save with generated squads.
    const oldTeams = Object.fromEntries(
      Object.entries(state.teams).map(([id, t]) => [id, { ...t, name: FRANCHISES.some((f) => f.id === id) ? 'Old Name' : t.name, squad: t.squad.map((p) => ({ ...p, realId: undefined })) }]),
    );
    const v8 = { ...state, version: 8, teams: oldTeams } as GameState;
    delete (v8 as { realSquadsPending?: boolean }).realSquadsPending;
    const migrated = migrate(v8);
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    const m = migrated.value;
    expect(m.version).toBe(SAVE_VERSION);
    expect(m.realSquadsPending).toBe(true);
    for (const f of FRANCHISES) expect(m.teams[f.id].name).toBe(f.name);
    // Nothing changes mid-season...
    expect(m.teams[FRANCHISES[0].id].squad.every((p) => !p.realId)).toBe(true);
    // ...then the real sides are cleared for the new season's builders, and the rest are kept.
    const seeded = seedRealSquads(m);
    expect(seeded.realSquadsPending).toBe(false);
    for (const team of Object.values(seeded.teams)) {
      if (isRealSide(team)) expect(team.squad, team.name).toHaveLength(0);
    }
    const rebuilt = ensureFranchises(seeded);
    expect(rebuilt.teams[FRANCHISES[0].id].squad.filter((p) => p.realId).length).toBeGreaterThan(15);
    // Seeding happens once.
    expect(seedRealSquads(rebuilt)).toBe(rebuilt);
  });
});

describe('real roles', () => {
  /** Well-known players and what they are in real cricket (role code, bowling style). */
  const KNOWN: [string, string, string?][] = [
    ['Virat Kohli', 'BA'], ['Jasprit Bumrah', 'PB', 'RIGHT_ARM_FAST'], ['Hardik Pandya', 'AR'], ['Ravindra Jadeja', 'BR', 'LEFT_ARM_ORTHODOX'],
    ['KL Rahul', 'WK'], ['Sanju Samson', 'WK'], ['Rishabh Pant', 'WK'], ['MS Dhoni', 'WK'], ['Kuldeep Yadav', 'SB', 'LEFT_ARM_WRIST_SPIN'],
    ['Shivam Dube', 'AR'], ['Riyan Parag', 'AR'], ['Venkatesh Iyer', 'AR'], ['Axar Patel', 'BR'], ['Varun Chakravarthy', 'SB', 'LEG_SPIN'],
    ['Pat Cummins', 'PB'], ['Mitchell Starc', 'PB', 'LEFT_ARM_FAST'], ['Travis Head', 'OB'], ['Glenn Maxwell', 'AR'], ['Nathan Lyon', 'SB', 'OFF_SPIN'],
    ['Joe Root', 'BA'], ['Ben Stokes', 'AR'], ['Jos Buttler', 'WK'], ['Adil Rashid', 'SB', 'LEG_SPIN'], ['Kagiso Rabada', 'PB'], ['Quinton de Kock', 'WK'],
    ['Tristan Stubbs', 'BA'], ['Devon Conway', 'OB'], ['Mitchell Santner', 'BR', 'LEFT_ARM_ORTHODOX'], ['Shaheen Shah Afridi', 'PB', 'LEFT_ARM_FAST'],
    ['Mohammad Rizwan', 'WK'], ['Rashid Khan', 'SB', 'LEG_SPIN'], ['Sunil Narine', 'BR'], ['Andre Russell', 'BR'], ['Heinrich Klaasen', 'WK'],
    ['Robin Minz', 'WK'], ['Umesh Yadav', 'PB'], ['Wanindu Hasaranga', 'BR', 'LEG_SPIN'],
  ];
  it('match real cricket for well-known players', () => {
    const data = realData()!;
    const all = [...data.international.players, ...data.ipl.players, ...data.domestic.players];
    for (const [name, role, style] of KNOWN) {
      const recs = all.filter((p) => p.n === name);
      expect(recs.length, name).toBeGreaterThan(0);
      for (const rec of recs) {
        expect(rec.r, name).toBe(role);
        if (style) expect(rec.bw, name).toBe(style);
      }
    }
  });
});
