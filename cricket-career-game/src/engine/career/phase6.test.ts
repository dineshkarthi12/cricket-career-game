import { describe, expect, it } from 'vitest';
import { createNewCareer } from '../newCareer';
import { ageOnCutoff, eligibleForLimit, eligibleForStage } from './eligibility';
import { ageOutStage, evaluateTargets, nextStageFor } from './targets';
import { competitionForPlaces, decideSquad, weightedForm, IN_SQUAD } from './squads';
import { decideCompetition } from './squadFlow';
import { resolveClashes, setInvolvement } from './involvement';
import { applyTrial, playTrial, runNets, trialFor } from './trials';
import { applyVerdict, reviewSeason, seniorDebut } from './season';
import { tournamentOf } from '../tournament/live';
import type { Fixture, GameState, Match, PlayerMatchPerformance } from '@/types';

/** A career at State U-16 level, with the Vijay Merchant squad drawn up. */
function u16Career(dateOfBirth = '2011-10-01'): GameState {
  return createNewCareer({ firstName: 'Test', lastName: 'Player', dateOfBirth, startStageId: 'STATE_U16', seed: 42, startDate: '2026-06-01', creationRole: 'BATTER' });
}

function userTeam(state: GameState, tournamentId = 'vijay-merchant') {
  const t = tournamentOf(state, tournamentId)!;
  return state.teams[t.userTeamId!];
}

/** Every rival in the squad set to one overall. */
function rivalsAt(state: GameState, overall: number, tournamentId = 'vijay-merchant'): GameState {
  const team = userTeam(state, tournamentId);
  return { ...state, teams: { ...state.teams, [team.id]: { ...team, squad: team.squad.map((p) => ({ ...p, overall })) } } };
}

/** Give the season some of the player's matches in a competition. */
function withMatches(state: GameState, tournamentId: string, lines: Partial<PlayerMatchPerformance>[]): GameState {
  const matches = { ...state.matches };
  const ids: string[] = [];
  lines.forEach((line, i) => {
    const id = `test-${tournamentId}-${i}`;
    ids.push(id);
    matches[id] = {
      id,
      tournamentId,
      date: state.season.currentDate,
      seasonYear: state.season.year,
      userPerformance: {
        playerId: state.player.id,
        runs: 0,
        ballsFaced: 30,
        fours: 0,
        sixes: 0,
        notOut: false,
        wickets: 0,
        runsConceded: 0,
        oversBowled: 0,
        catches: 0,
        runOuts: 0,
        stumpings: 0,
        rating: 6,
        manOfTheMatch: false,
        xpEarned: 0,
        ...line,
      },
    } as unknown as Match;
  });
  return { ...state, matches, season: { ...state.season, matchIds: [...state.season.matchIds, ...ids] } };
}

describe('age eligibility', () => {
  it('counts age on 1 September of the season year', () => {
    expect(ageOnCutoff('2010-09-01', 2026)).toBe(16);
    expect(ageOnCutoff('2010-09-02', 2026)).toBe(15);
    expect(ageOnCutoff('2011-01-15', 2026)).toBe(15);
  });

  it('enforces the under-X limits by date of birth', () => {
    expect(eligibleForLimit('2010-09-02', 2026, 16)).toBe(true);
    expect(eligibleForLimit('2010-09-01', 2026, 16)).toBe(false);
    expect(eligibleForLimit('1990-01-01', 2026, null)).toBe(true);
    expect(eligibleForStage('2008-10-01', 2026, 'U19_PATHWAY')).toBe(true);
    expect(eligibleForStage('2007-08-31', 2026, 'U19_PATHWAY')).toBe(false);
  });

  it('keeps a player out of a squad they are too old for', () => {
    const state = u16Career('2010-08-20');
    const decision = decideSquad(state, 'vijay-merchant', userTeam(state), { incumbent: false, stageId: 'STATE_U16' });
    expect(decision.status).toBe('NOT_SELECTED');
    expect(decision.reason).toMatch(/age limit/);
  });

  it('moves an aged-out player on without the missed level', () => {
    // 14 on 1 Sep 2027: too old for district U-14, straight to State U-16.
    expect(ageOutStage('BEGINNER', '2013-03-01', 2027)).toBe('STATE_U16');
    expect(nextStageFor('BEGINNER', '2013-03-01', 2027)).toBeNull();
    expect(nextStageFor('BEGINNER', '2015-03-01', 2027)).toBe('DISTRICT_AGE_GROUP');
  });
});

describe('selection', () => {
  it('weights recent form most', () => {
    expect(weightedForm([])).toBe(50);
    expect(weightedForm([9, 9, 9, 3])).toBeLessThan(weightedForm([3, 9, 9, 9]));
  });

  it('picks a player clearly better than the rivals', () => {
    const state = rivalsAt(u16Career(), 20);
    const decision = decideSquad(state, 'vijay-merchant', userTeam(state), { incumbent: false, stageId: 'STATE_U16' });
    expect(decision.status).toBe('SQUAD');
    expect(decision.reason).toMatch(/picked ahead of/);
  });

  it('leaves a good player stuck behind better rivals', () => {
    const state = rivalsAt(u16Career(), 95);
    const decision = decideSquad(state, 'vijay-merchant', userTeam(state), { incumbent: false, stageId: 'STATE_U16' });
    expect(IN_SQUAD).not.toContain(decision.status);
    expect(decision.rivalName).toBeTruthy();
  });

  it('drops an incumbent after a run of low scores when others are ahead', () => {
    let state = rivalsAt(u16Career(), 95);
    state = { ...state, career: { ...state.career, lowScores: 4 } };
    const decision = decideSquad(state, 'vijay-merchant', userTeam(state), { incumbent: true, stageId: 'STATE_U16' });
    expect(decision.status).toBe('DROPPED');
    expect(decision.reason).toMatch(/4 low scores/);
  });

  it('keeps an incumbent in possession when nobody is better', () => {
    let state = rivalsAt(u16Career(), 20);
    state = { ...state, career: { ...state.career, lowScores: 4 } };
    const decision = decideSquad(state, 'vijay-merchant', userTeam(state), { incumbent: true, stageId: 'STATE_U16' });
    expect(decision.status).toBe('SQUAD');
  });

  it('a trial can tip a close call', () => {
    const base = u16Career();
    const team = userTeam(base);
    const without = decideSquad(base, 'vijay-merchant', team, { incumbent: false, stageId: 'STATE_U16', trialBonus: -10 });
    const withTrial = decideSquad(base, 'vijay-merchant', team, { incumbent: false, stageId: 'STATE_U16', trialBonus: 10 });
    expect(withTrial.rank).toBeLessThanOrEqual(without.rank);
  });

  it('shows the competition for places, the player included', () => {
    const state = u16Career();
    const panel = competitionForPlaces(state, userTeam(state).id, ['vijay-merchant']);
    expect(panel.some((r) => r.candidate.isUser)).toBe(true);
    expect(panel.length).toBeGreaterThan(4);
    expect(panel.filter((r) => r.holdsSpot).length).toBeGreaterThan(0);
  });

  it('a squad place makes the side fixtures the player’s, and losing it hands them back', () => {
    let state = rivalsAt(u16Career(), 95);
    state = decideCompetition(state, 'vijay-merchant', { date: state.season.currentDate });
    const t = tournamentOf(state, 'vijay-merchant')!;
    const mine = (s: GameState) => Object.values(s.fixtures).filter((f) => f.tournamentId === 'vijay-merchant' && f.involvesUser).length;
    expect(IN_SQUAD).not.toContain(state.career.squads['vijay-merchant'].status);
    expect(mine(state)).toBe(0);
    expect(state.inbox[0].category).toBe('SELECTION');
    state = setInvolvement(state, 'vijay-merchant', true);
    expect(mine(state)).toBeGreaterThan(0);
    expect(t.userTeamId).toBeTruthy();
  });

  it('resolves clashes in favour of the bigger competition', () => {
    const state = u16Career();
    const base = Object.values(state.fixtures).find((f) => f.kind === 'MATCH' && f.involvesUser && f.tournamentId === 'vijay-merchant')!;
    const clash: Fixture = { ...base, id: 'clash', tournamentId: 'club-league', title: 'Club match' };
    const next = resolveClashes({ ...state, fixtures: { ...state.fixtures, clash } });
    expect(next.fixtures.clash.involvesUser).toBe(false);
    expect(next.fixtures[base.id].involvesUser).toBe(true);
  });
});

describe('trials', () => {
  function trialState(): { state: GameState; fixture: Fixture } {
    let state = u16Career();
    state = { ...state, career: { ...state.career, squads: { ...state.career.squads, 'vijay-merchant': { ...state.career.squads['vijay-merchant'], status: 'TRIAL_ONLY' } } } };
    const fixture = Object.values(state.fixtures).find((f) => f.kind === 'TRIAL')!;
    return { state, fixture };
  }

  it('recognises a squad trial for a player waiting on a decision', () => {
    const { state, fixture } = trialState();
    const plan = trialFor(state, fixture);
    expect(plan?.purpose).toBe('SQUAD');
    expect(plan?.tournamentIds).toContain('vijay-merchant');
  });

  it('plays nets, a fitness test and a practice match, deterministically', () => {
    const { state, fixture } = trialState();
    const a = playTrial(state, fixture.id, { approach: 'SOLID', effort: 'STEADY' })!;
    const b = playTrial(state, fixture.id, { approach: 'SOLID', effort: 'STEADY' })!;
    expect(a).toEqual(b);
    expect(a.nets.score).toBeGreaterThanOrEqual(1);
    expect(a.nets.score).toBeLessThanOrEqual(10);
    expect(a.bonus).toBeGreaterThanOrEqual(-10);
    expect(a.bonus).toBeLessThanOrEqual(10);
    expect(a.practice.summary).toMatch(/Practice match/);
  });

  it('showy nets are riskier than solid ones', () => {
    const spread = (approach: 'SOLID' | 'SHOWY') => {
      const scores: number[] = [];
      for (let i = 0; i < 40; i += 1) {
        const { state } = trialState();
        const plan = { fixtureId: `f${i}`, title: 'Trial', date: state.season.currentDate, purpose: 'SQUAD' as const, stageId: state.career.currentStageId, tournamentIds: ['vijay-merchant'], invited: true, note: '' };
        scores.push(runNets(state, plan, approach).score);
      }
      const mean = scores.reduce((x, y) => x + y, 0) / scores.length;
      return Math.sqrt(scores.reduce((s, x) => s + (x - mean) ** 2, 0) / scores.length);
    };
    expect(spread('SHOWY')).toBeGreaterThan(spread('SOLID'));
  });

  it('applying a trial decides the squad and files the day', () => {
    const { state, fixture } = trialState();
    const record = playTrial(state, fixture.id, { approach: 'POSITIVE', effort: 'ALL_OUT' })!;
    const next = applyTrial({ ...state, calendar: { ...state.calendar, pendingTrialId: fixture.id } }, record);
    expect(next.career.trials[0].fixtureId).toBe(fixture.id);
    expect(next.career.trials[0].decisions[0].tournamentId).toBe('vijay-merchant');
    expect(next.career.squads['vijay-merchant'].status).not.toBe('TRIAL_ONLY');
    expect(next.fixtures[fixture.id].played).toBe(true);
    expect(next.calendar.pendingTrialId).toBeNull();
    expect(next.player.development.fitnessTests[0].label).toBe(fixture.title);
  });
});

describe('season review', () => {
  const big = { runs: 80, ballsFaced: 100, rating: 8 };

  it('checks the visible targets against the season', () => {
    const state = withMatches(u16Career(), 'vijay-merchant', [big, big, big, big, big]);
    const progress = evaluateTargets(state);
    expect(progress.met).toBe(true);
    expect(progress.ratio).toBeGreaterThanOrEqual(1);
    expect(progress.checks[0].progress).toBe('400 / 300');
  });

  it('a season short of the target, still young enough, means staying', () => {
    const state = withMatches(u16Career('2012-01-10'), 'vijay-merchant', [{ runs: 5, rating: 4 }]);
    const verdict = reviewSeason(state);
    expect(['STAY', 'BENCH', 'DROPPED']).toContain(verdict.review.outcome);
    expect(verdict.nextStageId).toBe('STATE_U16');
  });

  it('too old for the level next season means moving on', () => {
    // Born Oct 2010: 15 on the 2026 cut-off, 16 on the 2027 one.
    const state = withMatches(u16Career('2010-10-05'), 'vijay-merchant', [{ runs: 5, rating: 4 }]);
    const verdict = reviewSeason(state);
    expect(verdict.review.outcome).toBe('AGED_OUT');
    expect(verdict.nextStageId).toBe('U19_PATHWAY');
    expect(verdict.squads['vinoo-mankad'].status).toBe('TRIAL_ONLY');
  });

  it('a big season is usually rewarded - but never guaranteed', () => {
    let promoted = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      const base = createNewCareer({ firstName: 'T', lastName: 'P', dateOfBirth: '2012-01-10', startStageId: 'STATE_U16', seed, startDate: '2026-06-01' });
      const state = withMatches(base, 'vijay-merchant', [big, big, big, big, big]);
      const verdict = reviewSeason(state);
      if (verdict.review.outcome === 'PROMOTE' || verdict.review.outcome === 'FAST_TRACK') promoted += 1;
    }
    expect(promoted).toBeGreaterThan(8);
  });

  it('writes the verdict into the career', () => {
    const state = withMatches(u16Career('2010-10-05'), 'vijay-merchant', [{ runs: 5, rating: 4 }]);
    const next = applyVerdict(state, reviewSeason(state));
    expect(next.career.currentStageId).toBe('U19_PATHWAY');
    expect(next.career.path).toHaveLength(1);
    expect(next.career.pendingReview?.outcome).toBe('AGED_OUT');
    expect(next.career.stages.U19_PATHWAY.status).toBe('CURRENT');
    expect(next.inbox[0].subject).toMatch(/Season review/);
  });

  it('a senior debut completes stage 7', () => {
    const state = createNewCareer({ firstName: 'T', lastName: 'P', dateOfBirth: '2004-01-10', startStageId: 'SENIOR_STATE', seed: 3, startDate: '2026-06-01' });
    const next = seniorDebut(state, 'ranji-trophy', '2026-10-20');
    expect(next.career.stages.SENIOR_STATE.status).toBe('COMPLETED');
    expect(next.career.currentStageId).toBe('RANJI_TROPHY');
    expect(next.career.events.at(-1)?.kind).toBe('DEBUT');
  });

  it('senior stages have separate Ranji, Vijay Hazare and Mushtaq Ali squads', () => {
    const state = createNewCareer({ firstName: 'T', lastName: 'P', dateOfBirth: '2004-01-10', startStageId: 'SENIOR_STATE', seed: 3, startDate: '2026-06-01' });
    expect(Object.keys(state.career.squads)).toEqual(expect.arrayContaining(['ranji-trophy', 'vijay-hazare', 'syed-mushtaq-ali']));
    for (const id of ['ranji-trophy', 'vijay-hazare', 'syed-mushtaq-ali']) expect(tournamentOf(state, id)).toBeTruthy();
  });
});
