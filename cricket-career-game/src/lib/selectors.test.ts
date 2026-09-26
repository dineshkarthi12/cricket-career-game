import { describe, expect, it } from 'vitest';
import { createDemoCareer } from '@/data/demoCareer';
import {
  careerSteps,
  currentStage,
  featuredTrophies,
  nextMatchFixture,
  playerTitle,
  radarAxes,
  recentMatch,
  statsForTab,
  statsTabs,
  unreadCount,
  upcomingFixtures,
} from './selectors';
import { TOTAL_CAREER_STAGES } from '@/data/stages';

const state = createDemoCareer();

describe('career selectors', () => {
  it('counts unread inbox messages for the top bar', () => {
    expect(unreadCount(state)).toBe(3);
    const read = { ...state, inbox: state.inbox.map((m) => ({ ...m, read: true })) };
    expect(unreadCount(read)).toBe(0);
  });

  it('names the stage and the title under the player name', () => {
    expect(currentStage(state).shortLabel).toBe('State U-16');
    expect(playerTitle(state)).toBe('Aspiring Cricketer');
  });

  it('builds one stepper node per stage, in order', () => {
    const steps = careerSteps(state);
    expect(steps).toHaveLength(TOTAL_CAREER_STAGES);
    expect(steps.map((step) => step.index)).toEqual(
      Array.from({ length: TOTAL_CAREER_STAGES }, (_, i) => i + 1),
    );
    expect(steps[0].status).toBe('done');
    expect(steps[1].status).toBe('done');
    expect(steps[2].status).toBe('current');
    expect(steps[3].status).toBe('locked');
    expect(steps.filter((step) => step.status === 'current')).toHaveLength(1);
  });
});

describe('schedule selectors', () => {
  it('returns upcoming fixtures soonest first', () => {
    const fixtures = upcomingFixtures(state, 5);
    expect(fixtures).toHaveLength(5);
    expect(fixtures[0].date).toBe('2026-10-15');
    expect(fixtures.map((f) => f.date)).toEqual([...fixtures.map((f) => f.date)].sort());
  });

  it('leaves out fixtures that are already in the past', () => {
    const past = {
      ...state,
      season: { ...state.season, currentDate: '2026-11-06' },
    };
    const dates = upcomingFixtures(past, 5).map((f) => f.date);
    expect(dates[0]).toBe('2026-11-12');
    expect(dates.every((d) => d >= '2026-11-06')).toBe(true);
  });

  it('picks the next actual match, skipping camps and meetings', () => {
    const fixture = nextMatchFixture(state);
    expect(fixture?.kind).toBe('MATCH');
    expect(fixture?.title).toBe('TN U-16 vs Karnataka U-16');
  });

  it('finds the most recent completed match', () => {
    expect(recentMatch(state)?.id).toBe('match-andhra-u16');
    expect(recentMatch({ ...state, matches: {} })).toBeNull();
  });
});

describe('stat tabs', () => {
  const tabs = statsTabs(state);

  it('opens on the age group the current stage plays', () => {
    expect(tabs[0].label).toBe('U-16');
    expect(tabs.map((tab) => tab.label)).toEqual(['U-16', 'First-Class', 'List A', 'T20', 'Overall']);
  });

  it('rolls the U-16 record up to the figures on the card', () => {
    const stats = statsForTab(state, tabs[0]);
    expect(stats.matches).toBe(6);
    expect(stats.runs).toBe(248);
    expect(stats.average).toBeCloseTo(49.6, 1);
    expect(stats.strikeRate).toBeCloseTo(71.7, 1);
    expect(stats.fifties).toBe(2);
    expect(stats.hundreds).toBe(0);
    expect(stats.highScore).toBe(78);
  });

  it('reports zeroes for levels the player has never reached', () => {
    const firstClass = statsForTab(state, tabs[1]);
    expect(firstClass.matches).toBe(0);
    expect(firstClass.runs).toBe(0);
    expect(firstClass.average).toBeNull();
    expect(firstClass.strikeRate).toBe(0);
  });
});

describe('radar and trophies', () => {
  it('plots the six batting axes, current against potential', () => {
    const axes = radarAxes(state);
    expect(axes.map((a) => a.axis)).toEqual([
      'Technique',
      'Timing',
      'Power',
      'Shot Range',
      'Vs Pace',
      'Vs Spin',
    ]);
    expect(axes.every((a) => a.potential >= a.current)).toBe(true);
  });

  it('shows unlocked trophies first, then the next ones within reach', () => {
    const featured = featuredTrophies(state, 4);
    expect(featured).toHaveLength(4);
    expect(featured[0].unlocked).toBe(true);
    expect(featured.slice(1).every((trophy) => !trophy.unlocked)).toBe(true);
  });
});
