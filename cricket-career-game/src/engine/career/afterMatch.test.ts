import { describe, expect, it } from 'vitest';
import { createDemoCareer } from '@/data/demoCareer';
import { buildMatch } from '../match/lineup';
import { createLiveMatch } from '../match/live';
import { commitMatchDetailed } from '../match/commit';
import { appointCaptain } from './captaincy';
import {
  applyCaptaincy,
  CAPTAINCY,
  emptyTacticalLog,
  relationshipsAfter,
  resultFor,
  tacticalScore,
  teamMoraleAfter,
} from './afterMatch';
import { applyPressConference, pressConferenceFor } from './press';
import type { GameState, Match } from '@/types';

const FIXTURE = 'fx-ka-u16';
const TEAM = 'team-tn-u16';

/** Play the demo's next fixture out and return the finished match. */
function playFixture(state: GameState, seedShift = 0): Match {
  const build = buildMatch(state, state.fixtures[FIXTURE])!;
  const live = createLiveMatch({ ...build.setup, seed: build.setup.seed + seedShift });
  live.toEnd();
  return live.finished()!.match;
}

/** A match with the result forced, for testing what follows from it. */
function withResult(match: Match, winner: string | null, type: 'WIN' | 'DRAW' = 'WIN'): Match {
  return {
    ...match,
    result: {
      type,
      winningTeamId: winner,
      summary: type === 'WIN' ? 'Won by 5 wickets' : 'Match drawn',
      marginRuns: null,
      marginWickets: type === 'WIN' ? 5 : null,
      manOfTheMatchId: null,
    },
  };
}

describe('the dressing room', () => {
  it('lifts after a win and sags after a loss', () => {
    const team = createDemoCareer().teams[TEAM];
    expect(teamMoraleAfter(team, 'WIN', 3)).toBeGreaterThan(team.morale);
    expect(teamMoraleAfter(team, 'LOSS', 3)).toBeLessThan(team.morale);
  });

  it('moves the user side and the opposition in opposite directions', () => {
    const state = createDemoCareer();
    const match = withResult(playFixture(state), TEAM);
    const { state: next, teamMorale } = commitMatchDetailed(state, match, { userPlayed: true });
    expect(teamMorale!.after).toBeGreaterThan(teamMorale!.before);
    expect(next.teams['team-ka-u16'].morale).toBeLessThan(state.teams['team-ka-u16'].morale);
  });
});

describe('team-mates', () => {
  it('warm to a captain who picks them and cool on one who drops them', () => {
    const next = relationshipsAfter({}, ['a', 'b'], 'DRAW', {
      accepted: [{ inId: 'in', outId: 'out' }],
      overruled: [],
    });
    expect(next.in).toBeGreaterThan(0);
    expect(next.out).toBeLessThan(0);
  });

  it('grow closer after a win', () => {
    const next = relationshipsAfter({ a: 0 }, ['a'], 'WIN', null);
    expect(next.a).toBeGreaterThan(0);
  });
});

describe('the captaincy', () => {
  function captainState() {
    return appointCaptain(createDemoCareer(), TEAM, '2026-10-01', 'test');
  }

  it('records every captained match and moves the rating with the result', () => {
    const state = captainState();
    const match = playFixture(state);
    const win = applyCaptaincy(state, withResult(match, TEAM), TEAM, emptyTacticalLog(), '2026-10-20');
    const loss = applyCaptaincy(state, withResult(match, 'team-ka-u16'), TEAM, emptyTacticalLog(), '2026-10-20');
    expect(win.state.career.captaincy.record.won).toBe(1);
    expect(loss.state.career.captaincy.record.lost).toBe(1);
    expect(win.ratingAfter).toBeGreaterThan(loss.ratingAfter);
    expect(win.state.career.captaincy.byTeam[TEAM].matches).toBe(1);
  });

  it('adds stress in defeat, and it costs the player some of their own form', () => {
    const state = captainState();
    const match = withResult(playFixture(state), 'team-ka-u16');
    const out = applyCaptaincy(state, match, TEAM, emptyTacticalLog(), '2026-10-20');
    expect(out.stressAfter).toBeGreaterThan(state.career.captaincy.stress);
    expect(out.state.player.condition.form).toBeLessThanOrEqual(state.player.condition.form);
  });

  it('lets a strong temperament carry the pressure better', () => {
    const calm = captainState();
    calm.player.attributes.mental.temperament = 95;
    calm.player.attributes.mental.leadership = 95;
    const nervy = captainState();
    nervy.player.attributes.mental.temperament = 20;
    nervy.player.attributes.mental.leadership = 20;
    const match = withResult(playFixture(calm), 'team-ka-u16');
    const a = applyCaptaincy(calm, match, TEAM, emptyTacticalLog(), '2026-10-20');
    const b = applyCaptaincy(nervy, match, TEAM, emptyTacticalLog(), '2026-10-20');
    expect(a.stressAfter).toBeLessThan(b.stressAfter);
  });

  it('costs the captaincy after a long losing run', () => {
    let state = captainState();
    const match = withResult(playFixture(state), 'team-ka-u16');
    let sacked = false;
    for (let i = 0; i < CAPTAINCY.sackStreak + 1 && !sacked; i += 1) {
      const out = applyCaptaincy(state, match, TEAM, emptyTacticalLog(), '2026-10-20');
      state = out.state;
      sacked = out.sacked;
    }
    expect(sacked).toBe(true);
    expect(state.career.captaincy.teamId).toBeNull();
    expect(state.teams[TEAM].captainId).toBeNull();
    expect(state.inbox[0].subject).toMatch(/Captaincy/);
  });

  it('puts a winning captain in line for a bigger job', () => {
    let state = captainState();
    state.career.captaincy.rating = 85;
    const match = withResult(playFixture(state), TEAM);
    let recommended = false;
    for (let i = 0; i < CAPTAINCY.promoteMatches + 2 && !recommended; i += 1) {
      const out = applyCaptaincy(state, match, TEAM, emptyTacticalLog(), '2026-10-20');
      state = out.state;
      recommended = out.recommended;
    }
    expect(recommended).toBe(true);
    expect(state.career.captaincy.recommendedForHigher).toBe(true);
  });

  it('scores tactics on what the captain actually decided', () => {
    const state = captainState();
    const match = playFixture(state);
    const innings = match.innings[0];
    // A captain's pick who went for plenty in their over scores worse than one who took wickets.
    const expensive = innings.deliveries.reduce<Record<number, number>>((acc, b) => {
      acc[b.over] = (acc[b.over] ?? 0) + b.runsOffBat + (b.extras?.runs ?? 0);
      return acc;
    }, {});
    const overs = Object.entries(expensive).sort((a, b) => b[1] - a[1]);
    const worst = Number(overs[0][0]);
    const best = Number(overs[overs.length - 1][0]);
    const bowlerOf = (over: number) => innings.deliveries.find((b) => b.over === over)!.bowlerId;
    const log = (over: number) => ({
      ...emptyTacticalLog(),
      bowlingChoices: [{ innings: innings.number, over, bowlerId: bowlerOf(over), suggestedId: 'someone-else' }],
    });
    const result = resultFor(match, TEAM);
    expect(tacticalScore(match, log(best), result)).toBeGreaterThan(tacticalScore(match, log(worst), result));
  });
});

describe('after the match, as a whole', () => {
  it('writes a selectors’ note even when the player was not picked', () => {
    const state = createDemoCareer();
    const build = buildMatch(state, state.fixtures[FIXTURE], { userSelected: false })!;
    const live = createLiveMatch(build.setup);
    live.toEnd();
    const { state: next } = commitMatchDetailed(state, live.finished()!.match, {
      userPlayed: false,
      selection: { status: 'NOT_SELECTED', reasons: ['The selectors are not yet convinced.'] },
    });
    const note = next.inbox.find((m) => m.sender === 'SELECTOR');
    expect(note?.subject).toMatch(/Not selected/);
    expect(note?.body).toMatch(/not yet convinced/);
    expect(next.fixtures[FIXTURE].played).toBe(true);
  });

  it('reports the player’s standing before and after', () => {
    const state = createDemoCareer();
    const out = commitMatchDetailed(state, playFixture(state), { userPlayed: true });
    expect(out.standing.reputation[0]).toBe(state.player.condition.reputation);
    expect(out.standing.selectorTrust[1]).toBe(out.state.player.condition.selectorTrust);
  });
});

describe('the press conference', () => {
  function bigMatch(state: GameState): Match {
    const match = withResult(playFixture(state), TEAM);
    return {
      ...match,
      stage: 'FINAL',
      userPerformance: { ...match.userPerformance!, runs: 112, rating: 9 },
    };
  }

  it('only happens after a big match', () => {
    const state = createDemoCareer();
    const ordinary = withResult(playFixture(state), TEAM);
    const quiet = { ...ordinary, userPerformance: { ...ordinary.userPerformance!, runs: 12, wickets: 0, rating: 4, manOfTheMatch: false } };
    expect(pressConferenceFor(state, quiet)).toBeNull();
    expect(pressConferenceFor(state, bigMatch(state))).not.toBeNull();
  });

  it('asks two or three questions, each with two or three answers', () => {
    const state = createDemoCareer();
    const conference = pressConferenceFor(state, bigMatch(state))!;
    expect(conference.questions.length).toBeGreaterThanOrEqual(2);
    expect(conference.questions.length).toBeLessThanOrEqual(3);
    for (const q of conference.questions) {
      expect(q.answers.length).toBeGreaterThanOrEqual(2);
      expect(q.answers.length).toBeLessThanOrEqual(3);
    }
  });

  it('moves morale and media standing by the answers chosen', () => {
    const state = createDemoCareer();
    const match = bigMatch(state);
    state.matches[match.id] = match;
    const conference = pressConferenceFor(state, match)!;
    const humble = applyPressConference(state, conference, { result: 'credit-team' }, '2026-10-20');
    const bold = applyPressConference(state, conference, { result: 'bold' }, '2026-10-20');
    expect(humble.teams[TEAM].morale).toBeGreaterThan(bold.teams[TEAM].morale);
    expect(bold.career.mediaReputation).toBeGreaterThan(humble.career.mediaReputation);
    expect(humble.inbox[0].sender).toBe('MEDIA');
  });
});
