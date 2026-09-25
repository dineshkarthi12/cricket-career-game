/**
 * The press conference after a big match: two or three questions, each with a
 * few ways to answer. What the player says moves the dressing room, their
 * standing with the media, and their own head space.
 */
import { newId } from '../id';
import { KNOCKOUT_STAGES, marginOf, resultFor, type UserResult } from './afterMatch';
import type { GameState, Id, Match, TournamentStage } from '@/types';

export interface PressEffects {
  /** Change to the dressing room's morale. */
  teamMorale: number;
  /** Change to standing with the press. */
  mediaReputation: number;
  /** Change to the player's own morale. */
  morale: number;
}

export interface PressAnswer {
  id: string;
  text: string;
  /** A short label for how it will land, shown before choosing. */
  tone: string;
  effects: PressEffects;
}

export interface PressQuestion {
  id: string;
  asker: string;
  text: string;
  answers: PressAnswer[];
}

export interface PressConference {
  matchId: Id;
  headline: string;
  questions: PressQuestion[];
}

const answer = (id: string, text: string, tone: string, effects: PressEffects): PressAnswer => ({
  id,
  text,
  tone,
  effects,
});

/** Is this match big enough for the press to want the player? */
export function isBigMatch(state: GameState, match: Match): boolean {
  const perf = match.userPerformance;
  if (!perf) return false;
  const knockout = KNOCKOUT_STAGES.includes(match.stage as TournamentStage);
  const personal = perf.runs >= 100 || perf.wickets >= 5 || perf.manOfTheMatch;
  const teamId = match.userIsHome ? match.homeTeamId : match.awayTeamId;
  const captain = state.career.captaincy.teamId === teamId || state.teams[teamId]?.captainId === state.player.id;
  const thrashing = marginOf(match) >= 100 || (match.result?.marginWickets ?? 0) >= 9;
  return knockout || (personal && perf.rating >= 7.5) || (captain && thrashing);
}

export function pressConferenceFor(state: GameState, match: Match): PressConference | null {
  if (!isBigMatch(state, match)) return null;
  const teamId = match.userIsHome ? match.homeTeamId : match.awayTeamId;
  const result: UserResult = resultFor(match, teamId);
  const perf = match.userPerformance!;
  const captain = state.career.captaincy.teamId === teamId || state.teams[teamId]?.captainId === state.player.id;
  const questions: PressQuestion[] = [];

  if (result === 'WIN') {
    questions.push({
      id: 'result',
      asker: 'Sports reporter',
      text: 'A big win today. What made the difference?',
      answers: [
        answer('credit-team', 'It was a team effort - everyone chipped in.', 'Humble', {
          teamMorale: 4,
          mediaReputation: 2,
          morale: 1,
        }),
        answer('bold', 'We are the best side in this competition. Nobody wants to play us.', 'Bold', {
          teamMorale: 2,
          mediaReputation: 4,
          morale: 3,
        }),
        answer('deflect', 'We just stick to our processes and take it one game at a time.', 'Safe', {
          teamMorale: 1,
          mediaReputation: -1,
          morale: 0,
        }),
      ],
    });
  } else if (result === 'LOSS') {
    questions.push({
      id: 'result',
      asker: 'Sports reporter',
      text: 'A tough defeat. Where did it go wrong?',
      answers: [
        answer('responsibility', 'I take responsibility. We will learn from it.', 'Accountable', {
          teamMorale: 3,
          mediaReputation: 3,
          morale: -2,
        }),
        answer('conditions', 'The conditions and a couple of decisions went against us.', 'Excuses', {
          teamMorale: -1,
          mediaReputation: -5,
          morale: 1,
        }),
        answer('criticise', 'Some of the batters need to take a hard look at themselves.', 'Blunt', {
          teamMorale: -7,
          mediaReputation: 1,
          morale: 0,
        }),
      ],
    });
  } else {
    questions.push({
      id: 'result',
      asker: 'Sports reporter',
      text: 'Honours even. Are you happy with that?',
      answers: [
        answer('positives', 'There are plenty of positives to take.', 'Upbeat', {
          teamMorale: 2,
          mediaReputation: 1,
          morale: 1,
        }),
        answer('frustrated', 'Frankly, we should have won that.', 'Frustrated', {
          teamMorale: -1,
          mediaReputation: 2,
          morale: 0,
        }),
      ],
    });
  }

  if (perf.runs >= 100 || perf.wickets >= 5) {
    const feat = perf.runs >= 100 ? `a hundred` : `five wickets`;
    questions.push({
      id: 'personal',
      asker: 'TV presenter',
      text: `${feat.charAt(0).toUpperCase()}${feat.slice(1)} today. What does it mean to you?`,
      answers: [
        answer('dedicate', 'It means more because it helped the team.', 'Team first', {
          teamMorale: 3,
          mediaReputation: 1,
          morale: 2,
        }),
        answer('ambition', 'This is only the start. I want to play at the very top.', 'Ambitious', {
          teamMorale: -1,
          mediaReputation: 4,
          morale: 3,
        }),
      ],
    });
  }

  if (captain) {
    questions.push({
      id: 'captaincy',
      asker: 'Columnist',
      text:
        result === 'LOSS'
          ? 'Some of your bowling changes were questioned. Would you do anything differently?'
          : 'Your captaincy was praised today. Is leadership coming naturally?',
      answers:
        result === 'LOSS'
          ? [
              answer('defend', 'I back every call I made. The plans were right.', 'Firm', {
                teamMorale: 1,
                mediaReputation: -1,
                morale: 2,
              }),
              answer('admit', 'Looking back, I would change a couple of things.', 'Honest', {
                teamMorale: 2,
                mediaReputation: 2,
                morale: -1,
              }),
            ]
          : [
              answer('senior', 'The senior players make it easy for me.', 'Gracious', {
                teamMorale: 4,
                mediaReputation: 1,
                morale: 0,
              }),
              answer('own-it', 'I trust my instincts, and today they came off.', 'Confident', {
                teamMorale: 0,
                mediaReputation: 3,
                morale: 3,
              }),
            ],
    });
  }

  const headline =
    result === 'WIN'
      ? 'The press want to hear from you after the win.'
      : result === 'LOSS'
        ? 'The media are waiting after the defeat.'
        : 'A few questions from the press.';
  return { matchId: match.id, headline, questions: questions.slice(0, 3) };
}

/** Apply the answers the player chose. An unanswered question counts as neutral. */
export function applyPressConference(
  state: GameState,
  conference: PressConference,
  chosen: Record<string, string>,
  date: string,
): GameState {
  const total: PressEffects = { teamMorale: 0, mediaReputation: 0, morale: 0 };
  const quotes: string[] = [];
  for (const question of conference.questions) {
    const picked = question.answers.find((a) => a.id === chosen[question.id]);
    if (!picked) continue;
    total.teamMorale += picked.effects.teamMorale;
    total.mediaReputation += picked.effects.mediaReputation;
    total.morale += picked.effects.morale;
    quotes.push(`"${picked.text}"`);
  }

  const match = state.matches[conference.matchId];
  const teamId = match ? (match.userIsHome ? match.homeTeamId : match.awayTeamId) : null;
  const team = teamId ? state.teams[teamId] : null;
  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

  return {
    ...state,
    teams:
      team && teamId
        ? { ...state.teams, [teamId]: { ...team, morale: clamp(team.morale + total.teamMorale) } }
        : state.teams,
    career: {
      ...state.career,
      mediaReputation: clamp(state.career.mediaReputation + total.mediaReputation),
    },
    player: {
      ...state.player,
      condition: {
        ...state.player.condition,
        morale: clamp(state.player.condition.morale + total.morale),
      },
    },
    inbox:
      quotes.length > 0
        ? [
            {
              id: newId('msg'),
              date,
              sender: 'MEDIA',
              senderName: 'Press',
              subject: `In the papers: ${quotes[0].slice(0, 60)}${quotes[0].length > 60 ? '…' : ''}`,
              body: quotes.join(' '),
              category: 'NEWS',
              read: false,
              important: false,
              actions: [],
              relatedId: conference.matchId,
            },
            ...state.inbox,
          ]
        : state.inbox,
  };
}
