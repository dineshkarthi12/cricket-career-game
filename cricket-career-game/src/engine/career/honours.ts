/**
 * Trophies and awards. A title counts for the player only if they played in
 * the competition; the tournament's individual awards (top scorer, leading
 * wicket-taker, player of the tournament) go to whoever earned them, the
 * player included. Career firsts unlock their trophies as they happen.
 */
import { TOURNAMENTS_BY_ID } from '@/data/tournaments';
import { newId } from '../id';
import type { GameState, InboxMessage, Match, TournamentState } from '@/types';

export function unlockTrophy(state: GameState, trophyId: string, date: string, seasonYear: number): GameState {
  const trophy = state.trophies.find((t) => t.id === trophyId);
  if (!trophy || trophy.unlocked) return state;
  const trophies = state.trophies.map((t) => (t.id === trophyId ? { ...t, unlocked: true, unlockedOn: date, seasonYear, progress: 1 } : t));
  const msg: InboxMessage = {
    id: newId('msg'),
    date,
    sender: 'SYSTEM',
    senderName: 'Trophy cabinet',
    subject: `Trophy unlocked: ${trophy.name}`,
    body: trophy.description,
    category: 'AWARD',
    read: false,
    important: true,
    actions: [],
    relatedId: trophyId,
  };
  return { ...state, trophies, inbox: [msg, ...state.inbox].slice(0, 80) };
}

function addAward(state: GameState, text: string): GameState {
  const awards = state.season.summary.awards ?? [];
  if (awards.includes(text)) return state;
  return { ...state, season: { ...state.season, summary: { ...state.season.summary, awards: [...awards, text] } } };
}

/** Honours from a competition that has just finished. */
function honoursFor(state: GameState, t: TournamentState): GameState {
  const userId = state.player.id;
  const played = Boolean(t.stats[userId]);
  const date = state.season.currentDate;
  let next = state;
  const out: InboxMessage[] = [];
  const name = t.name;
  if (played && t.winnerTeamId && t.winnerTeamId === t.userTeamId) {
    const trophy = next.trophies.find((x) => x.tournamentId === t.tournamentId && x.kind === 'TEAM_TITLE');
    if (trophy) next = unlockTrophy(next, trophy.id, date, t.seasonYear);
    next = addAward(next, `${name} champions`);
    out.push({
      id: newId('msg'),
      date,
      sender: 'TEAM',
      senderName: 'Team Manager',
      subject: `Champions! ${name} ${t.seasonYear}-${String((t.seasonYear + 1) % 100).padStart(2, '0')}`,
      body: `${next.teams[t.userTeamId ?? '']?.name ?? 'The side'} are champions - and you played your part.`,
      category: 'AWARD',
      read: false,
      important: true,
      actions: [],
      relatedId: t.tournamentId,
    });
  }
  const awards = t.awards;
  const mine: string[] = [];
  if (awards?.topScorer?.playerId === userId) mine.push(`Top run-scorer, ${name} (${awards.topScorer.detail})`);
  if (awards?.topWicketTaker?.playerId === userId) mine.push(`Leading wicket-taker, ${name} (${awards.topWicketTaker.detail})`);
  if (awards?.playerOfTournament?.playerId === userId) mine.push(`Player of the tournament, ${name}`);
  for (const text of mine) {
    next = addAward(next, text);
    out.push({ id: newId('msg'), date, sender: 'MEDIA', senderName: 'Press', subject: text, body: 'An individual award to go with the season.', category: 'AWARD', read: false, important: true, actions: [], relatedId: t.tournamentId });
  }
  if (out.length) next = { ...next, inbox: [...out, ...next.inbox].slice(0, 80) };
  return next;
}

/** Honours for every competition that finished between two states. */
export function tournamentHonours(before: GameState, after: GameState): GameState {
  let next = after;
  for (const t of after.season.tournaments) {
    if (!t.complete || t.seasonYear !== after.season.year) continue;
    const was = before.season.tournaments.find((x) => x.tournamentId === t.tournamentId && x.seasonYear === t.seasonYear);
    if (was?.complete) continue;
    next = honoursFor(next, t);
  }
  return next;
}

/** Career firsts from a match the player played in. */
export function matchMilestones(state: GameState, match: Match): GameState {
  const p = match.userPerformance;
  if (!p) return state;
  const date = match.date;
  const year = match.seasonYear;
  let next = state;
  const userTeamId = match.userIsHome ? match.homeTeamId : match.awayTeamId;
  const team = next.teams[userTeamId];
  if (team && team.kind === 'STATE') next = unlockTrophy(next, 'trophy-state-cap', date, year);
  if (match.tournamentId === 'ranji-trophy') next = unlockTrophy(next, 'trophy-ranji-debut', date, year);
  if (p.runs >= 100) next = unlockTrophy(next, 'trophy-first-hundred', date, year);
  if (p.wickets >= 5) next = unlockTrophy(next, 'trophy-first-five-for', date, year);
  const meta = TOURNAMENTS_BY_ID[match.tournamentId];
  if (p.manOfTheMatch && meta) next = addAward(next, `Player of the match, ${meta.shortName}`);
  return next;
}
