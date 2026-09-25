import { describe, expect, it } from 'vitest';
import { createDemoCareer } from './demoCareer';
import { CAREER_STAGES } from './stages';

describe('demo career', () => {
  const state = createDemoCareer();

  it('is the player from the design: Dinesh, 16, Chennai', () => {
    const { player } = state;
    expect(player.firstName).toBe('Dinesh');
    expect(player.age).toBe(16);
    expect(player.hometown).toBe('Chennai');
    expect(player.state).toBe('Tamil Nadu');
    expect(player.battingStyle).toBe('RIGHT_HAND_BAT');
    expect(player.bowlingStyle).toBe('RIGHT_ARM_MEDIUM');
  });

  it('derives the overall and potential shown on the dashboard', () => {
    expect(state.player.overall).toBe(68);
    expect(state.player.potentialOverall).toBe(85);
  });

  it('shows the condition tiles from the design', () => {
    expect(state.player.condition.formBand).toBe('GOOD');
    expect(state.player.condition.fitness).toBe(92);
    expect(state.player.condition.moraleBand).toBe('HIGH');
    expect(state.player.level).toBe(12);
    expect(state.player.xp).toBe(820);
    expect(state.player.xpToNextLevel).toBe(1200);
  });

  it('sits at stage 3 with the first two stages behind it', () => {
    expect(state.career.currentStageId).toBe('STATE_U16');
    expect(state.career.stages.BEGINNER.status).toBe('COMPLETED');
    expect(state.career.stages.DISTRICT_AGE_GROUP.status).toBe('COMPLETED');
    expect(state.career.stages.STATE_U16.status).toBe('CURRENT');
    expect(state.career.stages.U19_PATHWAY.status).toBe('LOCKED');
  });

  it('has a progress record for every one of the 20 stages', () => {
    expect(Object.keys(state.career.stages)).toHaveLength(CAREER_STAGES.length);
  });

  it('carries the season figures from the design', () => {
    const record = state.player.record.byCompetition['vijay-merchant'];
    expect(record.batting.matches).toBe(6);
    expect(record.batting.runs).toBe(248);
    expect(record.batting.highScore).toBe(78);
    expect(record.batting.fifties).toBe(2);
    expect(record.batting.hundreds).toBe(0);
    // 248 runs / 5 dismissals = 49.60, 248 off 346 balls = 71.7.
    expect(record.batting.runs / (record.batting.innings - record.batting.notOuts)).toBeCloseTo(
      49.6,
      1,
    );
    expect((record.batting.runs / record.batting.balls) * 100).toBeCloseTo(71.7, 1);
  });

  it('has the fixtures, match and messages the dashboard renders', () => {
    expect(Object.keys(state.fixtures)).toHaveLength(5);
    expect(state.inbox).toHaveLength(3);
    expect(state.inbox.every((message) => !message.read)).toBe(true);
    const match = state.matches['match-andhra-u16'];
    expect(match.result?.summary).toBe('Won by 34 runs');
    expect(match.innings[0].runs - match.innings[1].runs).toBe(34);
    expect(match.userPerformance?.runs).toBe(67);
  });

  it('has exactly one trophy unlocked', () => {
    const unlocked = state.trophies.filter((trophy) => trophy.unlocked);
    expect(unlocked).toHaveLength(1);
    expect(unlocked[0].seasonYear).toBe(2025);
  });

  it('is serialisable, so it can go straight into a save slot', () => {
    expect(() => JSON.parse(JSON.stringify(state))).not.toThrow();
  });
});

describe('each demo career is its own copy', () => {
  it('shares no teams, fixtures or venues with another', () => {
    const a = createDemoCareer();
    const b = createDemoCareer();
    const teamId = Object.keys(a.teams)[0];
    a.teams[teamId].morale = 1;
    a.fixtures[Object.keys(a.fixtures)[0]].played = true;
    a.venues[Object.keys(a.venues)[0]].capacity = 1;
    expect(b.teams[teamId].morale).not.toBe(1);
    expect(b.fixtures[Object.keys(b.fixtures)[0]].played).toBe(false);
    expect(b.venues[Object.keys(b.venues)[0]].capacity).not.toBe(1);
  });
});
