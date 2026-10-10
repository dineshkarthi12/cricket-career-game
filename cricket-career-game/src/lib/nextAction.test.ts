import { describe, expect, it } from 'vitest';
import { createDemoCareer } from '@/data/demoCareer';
import { nextAction } from './nextAction';
import type { GameState, Injury, InboxMessage } from '@/types';

/** The demo career with nothing pressing: every message read, fit, a plan, no exams. */
function quiet(): GameState {
  const s = createDemoCareer();
  return {
    ...s,
    inbox: s.inbox.map((m) => ({ ...m, read: true })),
    player: { ...s.player, condition: { ...s.player.condition, injury: null } },
    calendar: { ...s.calendar, pendingFixtureId: null, pendingTrialId: null, windows: s.calendar.windows.filter((w) => w.kind !== 'EXAMS') },
    career: { ...s.career, pendingReview: null },
    trainingPlan: s.trainingPlan.sessions.length ? s.trainingPlan : { ...s.trainingPlan, sessions: [{ id: 'x' } as never] },
  };
}

const injury: Injury = { id: 'inj', name: 'Hamstring strain', bodyPart: 'Hamstring', severity: 'MINOR', startedOn: '2026-10-01', expectedReturn: '2026-10-29', matchesMissed: 0, attributePenalty: 3, recurrence: false };

function news(subject: string): InboxMessage {
  return { id: `m-${subject}`, date: '2026-10-01', sender: 'SELECTOR', senderName: 'Selectors', subject, body: '', category: 'SELECTION', read: false, important: true, actions: [] } as unknown as InboxMessage;
}

/** Every case switched on, so each can be switched off to reveal the next. */
function everything(): GameState {
  let s = quiet();
  const match = Object.values(s.fixtures).find((f) => f.kind === 'MATCH' && !f.played)!;
  const trial = { ...match, id: 'fx-trial', kind: 'TRIAL' as const, title: 'State U-16 trials' };
  s = {
    ...s,
    fixtures: { ...s.fixtures, [trial.id]: trial },
    calendar: { ...s.calendar, pendingFixtureId: match.id, pendingTrialId: trial.id, windows: [...s.calendar.windows, { kind: 'EXAMS', start: s.season.currentDate, end: s.season.currentDate, label: 'Exams' } as never] },
    career: { ...s.career, pendingReview: { seasonYear: 2026 } as never },
    inbox: [news('Picked for the U-16 squad'), ...s.inbox],
    player: { ...s.player, condition: { ...s.player.condition, injury } },
    trainingPlan: { ...s.trainingPlan, sessions: [] },
  };
  return s;
}

describe('the next action on Home', () => {
  it('goes down the priority list, one thing at a time', () => {
    let s = everything();
    const seen: string[] = [];
    const clear: Record<string, (x: GameState) => GameState> = {
      MATCH: (x) => ({ ...x, calendar: { ...x.calendar, pendingFixtureId: null } }),
      TRIAL: (x) => ({ ...x, calendar: { ...x.calendar, pendingTrialId: null } }),
      SEASON_REVIEW: (x) => ({ ...x, career: { ...x.career, pendingReview: null } }),
      SELECTION_NEWS: (x) => ({ ...x, inbox: x.inbox.map((m) => ({ ...m, read: true })) }),
      INJURY: (x) => ({ ...x, player: { ...x.player, condition: { ...x.player.condition, injury: null } } }),
      EXAMS: (x) => ({ ...x, calendar: { ...x.calendar, windows: x.calendar.windows.filter((w) => w.kind !== 'EXAMS') } }),
      TRAINING_PLAN: (x) => ({ ...x, trainingPlan: { ...x.trainingPlan, sessions: [{ id: 'x' } as never] } }),
    };
    for (let i = 0; i < 10; i += 1) {
      const a = nextAction(s);
      seen.push(a.kind);
      if (a.kind === 'CONTINUE') break;
      s = clear[a.kind](s);
    }
    expect(seen).toEqual(['MATCH', 'TRIAL', 'SEASON_REVIEW', 'SELECTION_NEWS', 'INJURY', 'EXAMS', 'TRAINING_PLAN', 'CONTINUE']);
  });

  it('a match day: one button to play, Sim beside it, and the fixture in the reason', () => {
    const a = nextAction(everything());
    expect(a.kind).toBe('MATCH');
    expect(a.action).toMatchObject({ kind: 'PLAY' });
    expect(a.secondary).toMatchObject({ kind: 'SIM', label: 'Sim' });
    expect(a.reason).toMatch(/ v /);
  });

  it('the auction room and the IPL offers come before the news', () => {
    const s = quiet();
    const pro = s.pro!;
    const withPro = (ipl: Partial<NonNullable<GameState['pro']>['ipl']>) => ({ ...s, inbox: [news('x'), ...s.inbox], pro: { ...pro, ipl: { ...pro.ipl, ...ipl } } });
    const auction = { seasonYear: 2026, mega: true, date: s.season.currentDate, userLot: { basePrice: 200 } as never, lots: [], pursesAfter: {}, userStatus: 'SHORTLISTED' as const, room: [{} as never], watched: false };
    expect(nextAction(withPro({ auctions: [auction] }))).toMatchObject({ kind: 'AUCTION', action: { kind: 'GO', to: '/auction/live' } });
    expect(nextAction(withPro({ auctions: [auction] })).reason).toMatch(/₹2 Cr/);
    expect(nextAction(withPro({ retentionOffer: { franchiseId: 'f', date: s.season.currentDate, salary: 1100, previous: 300, limit: 1400, round: 1 } }))).toMatchObject({ kind: 'RETENTION', action: { to: '/auction' } });
    expect(nextAction(withPro({ tradeOffer: { franchiseId: 'f', date: s.season.currentDate, salary: 75 } })).kind).toBe('TRADE');
    const captaincy = { ...s, pro: { ...pro, leadership: { ...pro.leadership, offer: { role: 'CAPTAIN', teamName: 'Tamil Nadu', level: 'STATE' } as never } } };
    expect(nextAction(captaincy)).toMatchObject({ kind: 'CAPTAINCY', title: 'Captaincy offer' });
  });

  it('injured: to the rehab, with when they are back', () => {
    const s = quiet();
    const a = nextAction({ ...s, player: { ...s.player, condition: { ...s.player.condition, injury: { ...injury, expectedReturn: '2099-01-01' } } } });
    expect(a).toMatchObject({ kind: 'INJURY', action: { kind: 'GO', to: '/training/rehab' }, tone: 'red' });
    expect(a.reason).toMatch(/^Hamstring strain - back in about \d+ weeks/);
  });

  it('exams later this week count, exams next month do not', () => {
    const s = quiet();
    const soon = { kind: 'EXAMS', start: addDays(s.season.currentDate, 3), end: addDays(s.season.currentDate, 10), label: 'Exams' } as never;
    const later = { kind: 'EXAMS', start: addDays(s.season.currentDate, 30), end: addDays(s.season.currentDate, 40), label: 'Exams' } as never;
    expect(nextAction({ ...s, calendar: { ...s.calendar, windows: [soon] } }).kind).toBe('EXAMS');
    expect(nextAction({ ...s, calendar: { ...s.calendar, windows: [later] } }).kind).toBe('CONTINUE');
  });

  it('a quiet week: Continue, with where the player stands for selection', () => {
    const a = nextAction(quiet());
    expect(a).toMatchObject({ kind: 'CONTINUE', label: 'Continue', action: { kind: 'CONTINUE' } });
    expect(a.reason.length).toBeGreaterThan(10);
  });
});

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
