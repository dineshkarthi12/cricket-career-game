/**
 * What a match leaves behind beyond the scorecard: the dressing room's mood,
 * how team-mates feel about the player, what the selectors think, and - for
 * a captain - the rating, the pressure, and whether they keep the job.
 *
 * Pure functions. `commitMatch` calls them and writes the results.
 */
import { newId } from '../id';
import { createRng, deriveSeed } from '../match/rng';
import type { MatchSelection } from './selection';
import { appointCaptain, emptyCaptaincyRecord, removeCaptain } from './captaincy';
import type {
  CaptaincyRecord,
  GameState,
  Id,
  InboxMessage,
  Match,
  Team,
  TournamentStage,
} from '@/types';

export const CAPTAINCY = {
  /** How far the rating moves towards each match's verdict. */
  ratingInertia: 0.22,
  /** What each result is worth to the rating, 0-100. */
  resultScore: { WIN: 90, TIE: 60, DRAW: 55, NO_RESULT: 50, LOSS: 22 },
  /** How the verdict is built: result, tactics, dressing room. */
  weights: { result: 0.55, tactics: 0.25, morale: 0.2 },
  /** Stress added by a result, before temperament and leadership soften it. */
  stress: { WIN: 2, TIE: 6, DRAW: 6, NO_RESULT: 3, LOSS: 15 },
  stressDecay: 0.85,
  /** Form and confidence lost at 100 stress, for a player with no temperament. */
  stressFormHit: 9,
  /** Losses in a row, or a rating this low, costs the job. */
  sackStreak: 5,
  sackRating: 24,
  minMatchesBeforeSack: 3,
  /**
   * A record this good puts the player in line for a bigger job. A captain
   * who keeps winning with average tactics settles around 75.
   */
  promoteRating: 72,
  promoteMatches: 6,
  promoteWinPercent: 60,
  /** Chance per match of being named captain once the case is made. */
  appointChance: 0.1,
} as const;

export const KNOCKOUT_STAGES: TournamentStage[] = [
  'PRE_QUARTER_FINAL',
  'QUARTER_FINAL',
  'ELIMINATOR',
  'QUALIFIER_1',
  'QUALIFIER_2',
  'SEMI_FINAL',
  'FINAL',
];

export type UserResult = 'WIN' | 'LOSS' | 'DRAW' | 'TIE' | 'NO_RESULT';

export function resultFor(match: Match, teamId: Id): UserResult {
  const r = match.result;
  if (!r || r.type === 'NO_RESULT' || r.type === 'ABANDONED') return 'NO_RESULT';
  if (r.type === 'WIN') return r.winningTeamId === teamId ? 'WIN' : 'LOSS';
  if (r.type === 'TIE') return 'TIE';
  return 'DRAW';
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

/** The dressing room after a result. */
export function teamMoraleAfter(team: Team, result: UserResult, margin: number): number {
  const shift = { WIN: 6, LOSS: -6, DRAW: 1, TIE: 2, NO_RESULT: 0 }[result];
  // A thrashing, either way, moves it further.
  const big = margin >= 100 || margin >= 8 ? (result === 'WIN' ? 2 : result === 'LOSS' ? -2 : 0) : 0;
  // It drifts back towards neutral between matches.
  const drift = (60 - (team.morale ?? 60)) * 0.08;
  return Math.round(clamp((team.morale ?? 60) + shift + big + drift));
}

/** Margin of the result, for "big win" purposes: runs, or wickets as a number. */
export function marginOf(match: Match): number {
  return match.result?.marginRuns ?? match.result?.marginWickets ?? 0;
}

// --- Tactics ---------------------------------------------------------------

/** What the captain decided during the match, recorded as it happened. */
export interface TacticalLog {
  /** Overs where the captain chose the bowler. */
  bowlingChoices: { innings: number; over: number; bowlerId: Id; suggestedId: Id | null }[];
  /** Reviews the captain (or the player) called, and whether they came off. */
  reviews: { success: boolean }[];
  declared: boolean;
  followOnEnforced: boolean | null;
}

export function emptyTacticalLog(): TacticalLog {
  return { bowlingChoices: [], reviews: [], declared: false, followOnEnforced: null };
}

/**
 * 0-100 score for the captain's calls in one match. A bowler the captain
 * picked is judged on that over against the innings; reviews on whether they
 * came off; a declaration on the result it bought.
 */
export function tacticalScore(match: Match, log: TacticalLog, result: UserResult): number {
  let score = 50;
  for (const choice of log.bowlingChoices) {
    const innings = match.innings.find((i) => i.number === choice.innings);
    if (!innings) continue;
    const overBalls = innings.deliveries.filter((b) => b.over === choice.over);
    if (overBalls.length === 0) continue;
    const runs = overBalls.reduce((sum, b) => sum + b.runsOffBat + (b.extras?.runs ?? 0), 0);
    const wickets = overBalls.filter((b) => b.wicket && b.wicket.type !== 'RUN_OUT').length;
    const perOver = innings.balls > 0 ? (innings.runs / innings.balls) * 6 : 6;
    // Only a call that went against the advice is really the captain's.
    const weight = choice.suggestedId && choice.suggestedId !== choice.bowlerId ? 1.5 : 0.6;
    score += ((perOver - runs) * 0.8 + wickets * 5) * weight;
  }
  for (const review of log.reviews) score += review.success ? 6 : -5;
  if (log.declared) score += result === 'WIN' ? 10 : result === 'LOSS' ? -12 : 0;
  if (log.followOnEnforced) score += result === 'WIN' ? 6 : result === 'LOSS' ? -10 : -2;
  return Math.round(clamp(score, 5, 95));
}

// --- Captaincy -------------------------------------------------------------

function addToRecord(record: CaptaincyRecord, result: UserResult): CaptaincyRecord {
  return {
    matches: record.matches + 1,
    won: record.won + (result === 'WIN' ? 1 : 0),
    lost: record.lost + (result === 'LOSS' ? 1 : 0),
    drawn: record.drawn + (result === 'DRAW' ? 1 : 0),
    tied: record.tied + (result === 'TIE' ? 1 : 0),
    noResult: record.noResult + (result === 'NO_RESULT' ? 1 : 0),
  };
}

function message(
  date: string,
  sender: InboxMessage['sender'],
  senderName: string,
  subject: string,
  body: string,
  category: InboxMessage['category'],
  important = false,
  relatedId: Id | null = null,
): InboxMessage {
  return {
    id: newId('msg'),
    date,
    sender,
    senderName,
    subject,
    body,
    category,
    read: false,
    important,
    actions: [],
    relatedId,
  };
}

export interface CaptaincyOutcome {
  state: GameState;
  tactics: number;
  ratingBefore: number;
  ratingAfter: number;
  stressAfter: number;
  sacked: boolean;
  recommended: boolean;
}

/**
 * Roll a captained match into the captaincy: record, rating, stress and its
 * cost to the player's own game, and the job itself.
 */
export function applyCaptaincy(
  state: GameState,
  match: Match,
  teamId: Id,
  log: TacticalLog,
  date: string,
): CaptaincyOutcome {
  const result = resultFor(match, teamId);
  const c = state.career.captaincy;
  const team = state.teams[teamId];
  const tactics = tacticalScore(match, log, result);

  const verdict =
    CAPTAINCY.resultScore[result] * CAPTAINCY.weights.result +
    tactics * CAPTAINCY.weights.tactics +
    (team?.morale ?? 60) * CAPTAINCY.weights.morale;
  const rating = Math.round(clamp(c.rating + (verdict - c.rating) * CAPTAINCY.ratingInertia));

  // Temperament and leadership decide who thrives under it.
  const mental = state.player.attributes.mental;
  const resilience = (mental.temperament + mental.leadership) / 200;
  const losing = c.streak < 0 && result === 'LOSS' ? Math.min(10, -c.streak * 2) : 0;
  const stress = clamp(
    c.stress * CAPTAINCY.stressDecay + (CAPTAINCY.stress[result] + losing) * (1.6 - resilience),
  );

  const streak =
    result === 'WIN' ? Math.max(1, c.streak + 1) : result === 'LOSS' ? Math.min(-1, c.streak - 1) : 0;

  const record = addToRecord(c.record, result);
  const byTeam = { ...c.byTeam, [teamId]: addToRecord(c.byTeam[teamId] ?? emptyCaptaincyRecord(), result) };

  // Stress costs form and confidence; a good leader winning gets a lift.
  const condition = state.player.condition;
  const formHit = (stress / 100) * CAPTAINCY.stressFormHit * (1 - mental.temperament / 160);
  const lift = result === 'WIN' ? (mental.leadership / 100) * 3 : 0;

  let next: GameState = {
    ...state,
    player: {
      ...state.player,
      condition: {
        ...condition,
        form: Math.round(clamp(condition.form - formHit + lift)),
        confidence: Math.round(clamp(condition.confidence - formHit * 0.8 + lift)),
      },
    },
    career: {
      ...state.career,
      captaincy: { ...c, rating, tactics, stress: Math.round(stress), streak, record, byTeam },
    },
  };

  const inbox: InboxMessage[] = [];
  let sacked = false;
  let recommended = false;

  const matchesHere = byTeam[teamId].matches;
  // Only a real appointment can be taken away (the dev toggle is not one).
  if (
    c.teamId === teamId &&
    matchesHere >= CAPTAINCY.minMatchesBeforeSack &&
    (streak <= -CAPTAINCY.sackStreak || rating <= CAPTAINCY.sackRating)
  ) {
    sacked = true;
    next = removeCaptain(
      next,
      date,
      'SACKED',
      streak <= -CAPTAINCY.sackStreak
        ? `${-streak} defeats in a row`
        : `Captaincy rating fell to ${rating}`,
    );
    inbox.push(
      message(
        date,
        'SELECTOR',
        'Selectors',
        'Captaincy: a change',
        `The selectors have decided to make a change. ${
          streak <= -CAPTAINCY.sackStreak ? `${-streak} defeats in a row` : 'The results'
        } left them no choice. You keep your place in the side - for now. Focus on your own game.`,
        'SELECTION',
        true,
        match.id,
      ),
    );
  } else {
    const winPct = record.matches > 0 ? (record.won / record.matches) * 100 : 0;
    if (
      !c.recommendedForHigher &&
      rating >= CAPTAINCY.promoteRating &&
      record.matches >= CAPTAINCY.promoteMatches &&
      winPct >= CAPTAINCY.promoteWinPercent
    ) {
      recommended = true;
      next = {
        ...next,
        career: {
          ...next.career,
          captaincy: {
            ...next.career.captaincy,
            recommendedForHigher: true,
            history: [
              ...next.career.captaincy.history,
              { date, kind: 'RECOMMENDED', teamId, note: `Won ${record.won} of ${record.matches}` },
            ],
          },
        },
      };
      inbox.push(
        message(
          date,
          'SELECTOR',
          'Selectors',
          'Your captaincy has been noticed',
          `Won ${record.won} of ${record.matches} as captain. The panel at the next level have asked about your leadership - when you step up, the armband may come with you.`,
          'SELECTION',
          true,
          match.id,
        ),
      );
    }
  }

  if (stress >= 70 && !sacked) {
    inbox.push(
      message(
        date,
        'COACH',
        'Coach',
        'The captaincy is weighing on you',
        'The pressure is showing in your own batting. Lean on the vice-captain for the smaller calls and look after your own game.',
        'TRAINING',
        false,
        match.id,
      ),
    );
  }

  next = { ...next, inbox: [...inbox, ...next.inbox] };
  return {
    state: next,
    tactics,
    ratingBefore: c.rating,
    ratingAfter: rating,
    stressAfter: Math.round(stress),
    sacked,
    recommended,
  };
}

/**
 * Selectors appoint a captain when the case is overwhelming: a natural
 * leader, well known, trusted and in form. Rare, and never from nowhere.
 */
export function maybeAppointCaptain(state: GameState, match: Match, date: string): GameState {
  const teamId = match.userIsHome ? match.homeTeamId : match.awayTeamId;
  const team = state.teams[teamId];
  if (!team || state.career.captaincy.teamId || team.captainId === state.player.id) return state;
  const c = state.player.condition;
  const leader = state.player.attributes.mental.leadership;
  const caseMade =
    leader >= 72 && c.reputation >= 45 && c.selectorTrust >= 65 && c.form >= 60 && state.player.age >= 15;
  if (!caseMade) return state;
  const rng = createRng(deriveSeed(state.seed, match.id.length * 31 + state.season.matchIds.length));
  if (!rng.chance(CAPTAINCY.appointChance)) return state;
  const next = appointCaptain(state, teamId, date, `Named captain of ${team.name}`);
  return {
    ...next,
    inbox: [
      message(
        date,
        'SELECTOR',
        'Selectors',
        `You are the new captain of ${team.shortName}`,
        `The selectors have handed you the captaincy. From the next match you set the field, choose the bowlers, call the toss and have your say on the XI. It will ask more of you than your own game ever has.`,
        'SELECTION',
        true,
        match.id,
      ),
      ...next.inbox,
    ],
  };
}

// --- Relationships -----------------------------------------------------------

/** Results and selection calls move how team-mates feel about the player. */
export function relationshipsAfter(
  current: Record<Id, number>,
  teammateIds: Id[],
  result: UserResult,
  xiChanges: { accepted: { inId: Id; outId: Id }[]; overruled: { inId: Id; outId: Id }[] } | null,
): Record<Id, number> {
  const next = { ...current };
  const bump = (id: Id, by: number) => {
    next[id] = Math.round(clamp((next[id] ?? 0) + by, -100, 100));
  };
  // Winning together brings a side closer; losing frays it a little.
  const shared = result === 'WIN' ? 2 : result === 'LOSS' ? -1 : 0;
  for (const id of teammateIds) bump(id, shared);
  if (xiChanges) {
    for (const change of xiChanges.accepted) {
      bump(change.inId, 10);
      bump(change.outId, -15);
    }
    for (const change of xiChanges.overruled) {
      // The captain backed them, even if it did not come off...
      bump(change.inId, 3);
      // ...and tried to leave this one out.
      bump(change.outId, -8);
    }
  }
  return next;
}

// --- Selectors -----------------------------------------------------------------

/** What the selectors tell the player after a match, picked or not. */
export function selectorFeedback(
  state: GameState,
  match: Match,
  status: MatchSelection,
  reasons: string[],
  rating: number | null,
  date: string,
): InboxMessage {
  const team = state.teams[match.userIsHome ? match.homeTeamId : match.awayTeamId];
  if (status !== 'PLAYING_XI') {
    const heading =
      status === 'TWELFTH_MAN'
        ? 'Twelfth man this time'
        : status === 'BENCH'
          ? 'On the bench this time'
          : 'Not selected';
    return message(
      date,
      'SELECTOR',
      'Selectors',
      `${heading} - ${team?.shortName ?? 'the side'} ${resultFor(match, team?.id ?? '').toLowerCase().replace('_', ' ')}`,
      `${reasons.join(' ')} ${
        status === 'NOT_SELECTED'
          ? 'Runs and wickets in the next trial or club game will get you back in the conversation.'
          : 'Stay ready - a chance can come at any time.'
      }`.trim(),
      'SELECTION',
      false,
      match.id,
    );
  }
  const verdict =
    rating === null
      ? 'Thanks for your efforts.'
      : rating >= 7.5
        ? 'An outstanding contribution. You have made the selectors sit up.'
        : rating >= 5.5
          ? 'A solid game. Keep building on it.'
          : rating >= 4
            ? 'A quiet one. The selectors will want more next time.'
            : 'A tough day. There are others pushing for your spot.';
  return message(date, 'SELECTOR', 'Selectors', 'Selectors’ note', verdict, 'SELECTION', false, match.id);
}
