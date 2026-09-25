import { describe, expect, it } from 'vitest';
import { createDemoCareer } from '@/data/demoCareer';
import { appointCaptain, isCaptainOf, removeCaptain, winPercent } from './captaincy';

const userTeam = 'team-tn-u16';

describe('who is captain', () => {
  it('is nobody by default, so team controls stay locked', () => {
    const state = createDemoCareer();
    expect(isCaptainOf(state, userTeam)).toBe(false);
  });

  it('is the player once appointed, for that team only', () => {
    const state = appointCaptain(createDemoCareer(), userTeam, '2026-10-01', 'Named captain');
    expect(isCaptainOf(state, userTeam)).toBe(true);
    expect(isCaptainOf(state, 'team-ka-u16')).toBe(false);
    expect(state.teams[userTeam].captainId).toBe(state.player.id);
    expect(state.career.captaincy.history.at(-1)?.kind).toBe('APPOINTED');
  });

  it('is no longer the player once sacked', () => {
    let state = appointCaptain(createDemoCareer(), userTeam, '2026-10-01', 'Named captain');
    state = removeCaptain(state, '2026-12-01', 'SACKED', 'Five defeats in a row');
    expect(isCaptainOf(state, userTeam)).toBe(false);
    expect(state.teams[userTeam].captainId).toBeNull();
    expect(state.career.captaincy.history.at(-1)?.kind).toBe('SACKED');
  });

  it('honours the dev toggle only in a development build', () => {
    const state = createDemoCareer();
    state.settings.devCaptainMode = true;
    expect(isCaptainOf(state, userTeam, false)).toBe(false);
    expect(isCaptainOf(state, userTeam, true)).toBe(true);
    // Never for a team the player is not in.
    expect(isCaptainOf(state, 'team-ka-u16', true)).toBe(false);
  });

  it('works out a win percentage from decided matches', () => {
    expect(winPercent({ matches: 0, won: 0, lost: 0, drawn: 0, tied: 0, noResult: 0 })).toBeNull();
    expect(winPercent({ matches: 5, won: 3, lost: 1, drawn: 0, tied: 0, noResult: 1 })).toBe(75);
  });
});
