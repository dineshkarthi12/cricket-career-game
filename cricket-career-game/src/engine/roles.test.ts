import { describe, expect, it } from 'vitest';
import {
  canBowlInMatch,
  canPlayerBeAssignedToBowl,
  canTrainBowling,
  canUserControlBatting,
  canUserControlBowling,
  canUserKeepWicket,
  getAvailableMatchActions,
  roleCategory,
} from './roles';
import { createLiveMatch, type LiveMatchSetup } from './match/live';
import { bowlersOf, createInningsState, stepBall } from './match/innings';
import { chooseBowler } from './match/ai';
import { createRng } from './match/rng';
import { generateXi } from './match/squad';
import type { SimPlayer } from './match/types';
import { buildCareerPlayer, runTrainingWeek, sessionFrom } from './development';
import { createNewCareer } from './newCareer';
import { changePlayerRole } from './career/roleChange';
import { quickMatch } from './sim/quickMatch';
import { exportSave, importSave, loadSlot, saveToSlot } from '@/save/saveSystem';
import { VENUES_BY_ID } from '@/data/venues';
import type { MatchFormat, Player, PlayerRole, TrainingPlan } from '@/types';

const venue = VENUES_BY_ID['venue-chepauk'];
const ALL_ROLES: PlayerRole[] = ['BATTER', 'OPENING_BATTER', 'WICKET_KEEPER_BATTER', 'BATTING_ALLROUNDER', 'BOWLING_ALLROUNDER', 'PACE_BOWLER', 'SPIN_BOWLER'];

/** A home XI where player 0 is the user, with the given role and a tempting bowling skill. */
function sideWithUser(seed: number, role: PlayerRole, opts: { shortOfBowlers?: boolean } = {}): SimPlayer[] {
  const xi = generateXi('home', 66, createRng(seed));
  return xi.map((p, i) => {
    if (i === 0) {
      return {
        ...p,
        isUser: true,
        role,
        bowlingStyle: 'RIGHT_ARM_MEDIUM',
        // A user who would be the best bowler in the side if the rules allowed it.
        attributes: { ...p.attributes, bowling: Object.fromEntries(Object.entries(p.attributes.bowling).map(([k]) => [k, 90])) as unknown as SimPlayer['attributes']['bowling'] },
      };
    }
    // An unusual squad: only two others can bowl at all.
    if (opts.shortOfBowlers && i > 2) return { ...p, role: 'BATTER' as const, bowlingStyle: 'NONE' as const };
    return p;
  });
}

function setup(seed: number, homeXi: SimPlayer[], format: MatchFormat = 'T20'): LiveMatchSetup {
  return {
    fixtureId: 'fx-roles',
    tournamentId: 'syed-mushtaq-ali',
    seasonYear: 2026,
    format,
    stage: 'League',
    date: '2026-11-15',
    venue,
    homeTeamId: 'home',
    awayTeamId: 'away',
    homeXi,
    awayXi: generateXi('away', 64, createRng(seed ^ 0xb)),
    userTeamId: 'home',
    userPlayerId: homeXi[0].id,
    userIsCaptain: true,
    seed,
    month: 11,
  };
}

describe('role capabilities', () => {
  it('classifies every engine role', () => {
    expect(roleCategory('BATTER')).toBe('PURE_BATTER');
    expect(roleCategory('OPENING_BATTER')).toBe('PURE_BATTER');
    expect(roleCategory('WICKET_KEEPER_BATTER')).toBe('WICKETKEEPER');
    expect(roleCategory('BATTING_ALLROUNDER')).toBe('ALL_ROUNDER');
    expect(roleCategory('BOWLING_ALLROUNDER')).toBe('ALL_ROUNDER');
    expect(roleCategory('PACE_BOWLER')).toBe('BOWLER');
    expect(roleCategory('SPIN_BOWLER')).toBe('BOWLER');
  });

  it('lets every role bat, but only bowlers and all-rounders bowl', () => {
    for (const role of ALL_ROLES) {
      const subject = { role, bowlingStyle: 'RIGHT_ARM_MEDIUM' as const };
      const bowls = ['BATTING_ALLROUNDER', 'BOWLING_ALLROUNDER', 'PACE_BOWLER', 'SPIN_BOWLER'].includes(role);
      expect(canUserControlBatting(subject)).toBe(true);
      expect(canUserControlBowling(subject)).toBe(bowls);
      expect(canTrainBowling(subject)).toBe(bowls);
      expect(canBowlInMatch({ ...subject, id: 'u', isUser: true })).toBe(bowls);
      expect(canUserKeepWicket(subject)).toBe(role === 'WICKET_KEEPER_BATTER');
    }
  });

  it('a bowling role with no bowling type still cannot be given the ball', () => {
    expect(canUserControlBowling({ role: 'BATTING_ALLROUNDER', bowlingStyle: 'NONE' })).toBe(false);
  });

  it('respects quotas and consecutive overs for those who may bowl', () => {
    const p = { id: 'b', role: 'PACE_BOWLER' as const, bowlingStyle: 'RIGHT_ARM_FAST' as const, isUser: true };
    expect(canPlayerBeAssignedToBowl(p, { oversBowledBy: {}, maxOversPerBowler: 4, lastBowlerId: null })).toBe(true);
    expect(canPlayerBeAssignedToBowl(p, { oversBowledBy: { b: 4 }, maxOversPerBowler: 4, lastBowlerId: null })).toBe(false);
    expect(canPlayerBeAssignedToBowl(p, { oversBowledBy: {}, maxOversPerBowler: 4, lastBowlerId: 'b' })).toBe(false);
    const batter = { ...p, role: 'BATTER' as const };
    expect(canPlayerBeAssignedToBowl(batter, { oversBowledBy: {}, maxOversPerBowler: null, lastBowlerId: null })).toBe(false);
  });

  it('never offers bowling actions to a Pure Batter, even when "bowling"', () => {
    const involvement = { playing: true, onStrike: false, atCrease: false, bowling: true, fielding: true };
    const actions = getAvailableMatchActions({ role: 'BATTER', bowlingStyle: 'RIGHT_ARM_MEDIUM' }, involvement);
    expect(actions.bowl).toBe(false);
    expect(actions.setBowlingAggression).toBe(false);
    expect(actions.field).toBe(true);
    const ar = getAvailableMatchActions({ role: 'BATTING_ALLROUNDER', bowlingStyle: 'OFF_SPIN' }, involvement);
    expect(ar.bowl).toBe(true);
  });
});

describe('the engine enforces the role rules', () => {
  it('keeps a Pure Batter out of the attack, even in a side short of bowlers', () => {
    for (const role of ['BATTER', 'OPENING_BATTER', 'WICKET_KEEPER_BATTER'] as PlayerRole[]) {
      const side = sideWithUser(11, role, { shortOfBowlers: true });
      expect(bowlersOf(side).some((p) => p.isUser)).toBe(false);
      // The AI still finds bowlers: nobody is forced to bowl because the side is short.
      expect(bowlersOf(side).length).toBeGreaterThanOrEqual(4);
    }
  });

  it('chooseBowler never returns a restricted user, even when handed one', () => {
    const side = sideWithUser(3, 'BATTER');
    for (let i = 0; i < 200; i += 1) {
      const chosen = chooseBowler({
        bowlers: side,
        oversBowledBy: {},
        spellOvers: {},
        oversSinceBowled: {},
        lastBowlerId: null,
        format: 'T20',
        phase: 'MIDDLE',
        ballAgeOvers: 12,
        runRatePressure: 0,
        share: 0.3,
        rng: createRng(i),
      });
      expect(chosen.isUser).toBe(false);
    }
  });

  it('a captain cannot force a Pure Batter to bowl', () => {
    const side = sideWithUser(5, 'BATTER');
    const state = createInningsState({
      number: 1,
      battingTeamId: 'away',
      bowlingTeamId: 'home',
      batting: generateXi('away', 60, createRng(9)),
      bowling: side,
      format: 'T20',
      venue,
      conditions: createLiveMatch(setup(5, side)).snapshot().conditions,
      oversAvailable: 20,
      target: null,
      battingAtHome: false,
      knockout: false,
      day: 1,
      underLights: false,
    });
    const rng = createRng(1);
    for (let i = 0; i < 120; i += 1) {
      const ball = stepBall(state, rng, { bowlerId: side[0].id, bowlingFor: side[0].id });
      if (!ball) break;
      expect(ball.bowlerId).not.toBe(side[0].id);
    }
  });

  it.each(['T20', 'ODI'] as MatchFormat[])('a Pure Batter never bowls a ball across many %s matches', (format) => {
    for (let seed = 1; seed <= 25; seed += 1) {
      const side = sideWithUser(seed, 'BATTER', { shortOfBowlers: seed % 2 === 0 });
      const live = createLiveMatch(setup(seed, side, format));
      live.toEnd({ battingFor: side[0].id, bowlingFor: side[0].id, bowlerId: side[0].id, bowlingAggression: 5 });
      const done = live.finished();
      expect(done).not.toBeNull();
      for (const inn of done!.match.innings) {
        expect(inn.bowling.some((b) => b.playerId === side[0].id)).toBe(false);
        expect(inn.deliveries.some((d) => d.bowlerId === side[0].id)).toBe(false);
      }
      expect(done!.match.userPerformance?.oversBowled ?? 0).toBe(0);
    }
  });

  it('an all-rounder does get overs', () => {
    let overs = 0;
    for (let seed = 1; seed <= 12; seed += 1) {
      const side = sideWithUser(seed, 'BATTING_ALLROUNDER');
      const live = createLiveMatch(setup(seed, side));
      live.toEnd();
      for (const inn of live.finished()!.match.innings) overs += inn.bowling.find((b) => b.playerId === side[0].id)?.balls ?? 0;
    }
    expect(overs).toBeGreaterThan(0);
  });

  it('the quick simulator keeps a Pure Batter out of the attack too', () => {
    const side = sideWithUser(2, 'BATTER', { shortOfBowlers: true });
    for (let seed = 1; seed <= 10; seed += 1) {
      const result = quickMatch({
        fixtureId: 'q',
        tournamentId: 'syed-mushtaq-ali',
        seasonYear: 2026,
        format: 'T20',
        date: '2026-11-15',
        venue,
        homeTeamId: 'home',
        awayTeamId: 'away',
        homeXi: side,
        awayXi: generateXi('away', 64, createRng(seed)),
        seed,
      } as Parameters<typeof quickMatch>[0]);
      for (const inn of result.match.innings) expect(inn.bowling.some((b) => b.playerId === side[0].id)).toBe(false);
    }
  });
});

describe('training and role changes', () => {
  function batter(role: 'BATTER' | 'ALLROUNDER'): Player {
    return buildCareerPlayer(
      { firstName: 'T', lastName: 'P', dateOfBirth: '2014-01-15', hometown: 'Chennai', state: 'Tamil Nadu', country: 'India', battingStyle: 'RIGHT_HAND_BAT', bowlingStyle: 'RIGHT_ARM_MEDIUM', shirtNumber: 18, motto: '' },
      { role, battingApproach: 'STROKE_MAKER', bowlingStyle: 'RIGHT_ARM_MEDIUM', traits: ['HARD_WORKER', 'NATURAL_LEADER'], preferredAggression: 3 },
      '2026-06-01',
      createRng(4),
    );
  }
  const plan: TrainingPlan = {
    id: 'p',
    name: 'p',
    sessions: [sessionFrom('BOWL_ACCURACY', 'HARD', null), sessionFrom('MATCH_SIM', 'HARD', 3), sessionFrom('NETS_PACE', 'NORMAL', 3)],
    lifestyle: { sleep: 'NORMAL', diet: 'BALANCED', recovery: 'NONE' },
    studyFocus: 0,
    lastAppliedOn: null,
    weeksActive: 0,
  };
  const bowlingTotal = (p: Player) => Object.values(p.attributes.bowling).reduce((a, b) => a + b, 0);
  const train = (p: Player) => {
    let date = '2026-06-01';
    for (let i = 0; i < 30; i += 1) {
      date = new Date(Date.parse(`${date}T00:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10);
      p = runTrainingWeek({ player: p, plan, date, examWeek: false, fraction: 1, rng: createRng(i) }).player;
      p = { ...p, condition: { ...p.condition, injury: null } };
    }
    return p;
  };

  it('a Pure Batter gains no bowling from drills or growing up', () => {
    const before = batter('BATTER');
    const after = train(before);
    expect(bowlingTotal(after)).toBeLessThanOrEqual(bowlingTotal(before));
  });

  it('an all-rounder does improve their bowling', () => {
    const before = batter('ALLROUNDER');
    expect(bowlingTotal(train(before))).toBeGreaterThan(bowlingTotal(before));
  });

  it('a new Pure Batter career, saved and loaded, still may not bowl', () => {
    const state = createNewCareer({ firstName: 'Dinesh', lastName: 'K', dateOfBirth: '2016-04-12', creationRole: 'BATTER', bowlingStyle: 'NONE', seed: 9 });
    expect(canUserControlBowling(state.player)).toBe(false);
    expect(saveToSlot(1, state).ok).toBe(true);
    const loaded = loadSlot(1);
    expect(loaded.ok && canUserControlBowling(loaded.value.state.player)).toBe(false);
    const exported = exportSave(state, 1);
    const imported = exported.ok ? importSave(exported.value) : null;
    expect(imported?.ok && imported.value.state.player.role).toBe(state.player.role);
  });

  it('changing role is explicit and switches the rules', () => {
    const state = createNewCareer({ firstName: 'Dinesh', lastName: 'K', dateOfBirth: '2016-04-12', creationRole: 'BATTER', bowlingStyle: 'NONE', seed: 9 });
    expect(changePlayerRole(state, 'ALLROUNDER', 'NONE').ok).toBe(false);
    const ar = changePlayerRole(state, 'ALLROUNDER', 'OFF_SPIN');
    expect(ar.ok).toBe(true);
    expect(canUserControlBowling(ar.state.player)).toBe(true);
    const back = changePlayerRole(ar.state, 'BATTER', 'OFF_SPIN');
    expect(back.state.player.bowlingStyle).toBe('NONE');
    expect(canUserControlBowling(back.state.player)).toBe(false);
    expect(back.state.trainingPlan.sessions.every((s) => !['BOWL_ACCURACY', 'BOWL_PACE', 'SPIN_BOWLING', 'DEATH_BOWLING', 'VARIATIONS'].includes(s.drill))).toBe(true);
    // Attributes do not jump.
    expect(back.state.player.attributes).toEqual(state.player.attributes);
  });
});
