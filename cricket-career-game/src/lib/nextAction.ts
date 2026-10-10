/**
 * What the player should do next, for the Home screen's "Next action" card:
 * one thing, the most pressing, with one line on why.
 *
 * Priority: a match (or trial) today > a decision waiting (the auction room,
 * a retention or trade offer, a captaincy offer, the season review) > unread
 * selection news > an injury to rehab > exams this week > no training plan >
 * Continue. A press conference is answered on the post-match screen, so it
 * never waits here.
 *
 * Pure: state in, an action out. The card does what `action` says.
 */
import { pendingMatch, pendingTrial } from '@/engine/calendar';
import { selectionJourney, type CompetitionJourney } from '@/engine/career/journey';
import { unwatchedAuction } from '@/engine/pro/ipl';
import { TOURNAMENTS_BY_ID } from '@/data/tournaments';
import { daysBetweenDates } from '@/engine/development';
import { formatLakh } from '@/engine/pro/common';
import { proPlaces } from './pro';
import type { Fixture, GameState } from '@/types';

export type NextActionKind =
  | 'MATCH'
  | 'TRIAL'
  | 'AUCTION'
  | 'RETENTION'
  | 'TRADE'
  | 'CAPTAINCY'
  | 'SEASON_REVIEW'
  | 'SELECTION_NEWS'
  | 'INJURY'
  | 'EXAMS'
  | 'TRAINING_PLAN'
  | 'CONTINUE';

/** What the big button does. */
export type NextActionDo =
  | { kind: 'PLAY'; fixtureId: string }
  | { kind: 'ATTEND'; fixtureId: string }
  | { kind: 'GO'; to: string }
  /** Open the unread selection news (and mark it read). */
  | { kind: 'NEWS' }
  | { kind: 'CONTINUE' };

export interface NextAction {
  kind: NextActionKind;
  /** Short heading: "Match day", "Rehab". */
  title: string;
  /** The button's label. */
  label: string;
  /** One line on why. */
  reason: string;
  action: NextActionDo;
  /** A second, quieter choice: Sim a match, let the coach decide a trial. */
  secondary: { kind: 'SIM' | 'COACH'; label: string; fixtureId: string } | null;
  tone: 'blue' | 'gold' | 'red' | 'orange' | 'green';
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** "Friday", "next Tuesday" or "on 14 Aug", relative to today. */
function when(today: string, date: string): string {
  const days = daysBetweenDates(today, date);
  const day = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days > 1 && days < 7) return day;
  if (days >= 7 && days < 14) return `next ${day}`;
  const d = new Date(`${date}T00:00:00Z`);
  return `on ${d.getUTCDate()} ${d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })}`;
}

/** "Ranji squad picked Friday - you're 3rd among all-rounders", or null. */
export function selectionLine(state: GameState, journeys?: CompetitionJourney[]): string | null {
  const list = journeys ?? selectionJourney(state, state.pro ? proPlaces(state).map((p) => p.tournamentId) : []);
  const today = state.season.currentDate;
  const withEvent = list.filter((j) => j.nextEvent && j.nextEvent.date >= today).sort((a, b) => a.nextEvent!.date.localeCompare(b.nextEvent!.date));
  const j = withEvent[0] ?? list[0];
  if (!j) return null;
  const group = j.rank ? (j.rank.group.endsWith('s') ? j.rank.group : `${j.rank.group}s`) : '';
  const rank = j.rank ? `you're ${ordinal(j.rank.position)} among ${group}` : null;
  if (j.nextEvent) {
    const picked = /trial/i.test(j.nextEvent.title) ? `${j.shortName} trial ${when(today, j.nextEvent.date)}` : `${j.shortName} squad picked ${when(today, j.nextEvent.date)}`;
    return rank ? `${picked} - ${rank}` : picked;
  }
  return rank ? `${j.shortName}: ${rank}` : j.headline;
}

function matchLine(state: GameState, f: Fixture): string {
  const home = f.homeTeamId ? state.teams[f.homeTeamId]?.shortName : null;
  const away = f.awayTeamId ? state.teams[f.awayTeamId]?.shortName : null;
  const comp = f.tournamentId ? (TOURNAMENTS_BY_ID[f.tournamentId]?.shortName ?? '') : '';
  const teams = home && away ? `${home} v ${away}` : f.title;
  return comp ? `${comp}: ${teams}` : teams;
}

export function nextAction(state: GameState): NextAction {
  const today = state.season.currentDate;

  // 1. A match or trial today: the week cannot go on without it.
  const match = pendingMatch(state);
  if (match) {
    const selected = match.involvesUser !== false;
    return {
      kind: 'MATCH',
      title: 'Match day',
      label: selected ? 'Play the match' : 'Watch the match',
      reason: `${matchLine(state, match)} - play it ball by ball, or sim it to carry on.`,
      action: { kind: 'PLAY', fixtureId: match.id },
      secondary: { kind: 'SIM', label: 'Sim', fixtureId: match.id },
      tone: 'blue',
    };
  }
  const trial = pendingTrial(state);
  if (trial) {
    return {
      kind: 'TRIAL',
      title: 'Trial day',
      label: 'Attend the trial',
      reason: `${trial.title}: the selectors are watching. Make the calls yourself, or let the coach decide.`,
      action: { kind: 'ATTEND', fixtureId: trial.id },
      secondary: { kind: 'COACH', label: 'Coach decides', fixtureId: trial.id },
      tone: 'blue',
    };
  }

  // 2. A decision waiting on the player.
  const auction = unwatchedAuction(state);
  if (auction) {
    const lot = auction.userLot;
    return {
      kind: 'AUCTION',
      title: auction.mega ? 'Mega auction' : 'IPL auction',
      label: 'Watch the room live',
      reason: lot ? `You are in the ${auction.mega ? 'mega ' : ''}auction at a base price of ${formatLakh(lot.basePrice)} - see who bids.` : 'The franchises are building their squads - watch who goes where.',
      action: { kind: 'GO', to: '/auction/live' },
      secondary: null,
      tone: 'gold',
    };
  }
  const retention = state.pro?.ipl.retentionOffer;
  if (retention) {
    return {
      kind: 'RETENTION',
      title: 'Retention offer',
      label: 'Answer the offer',
      reason: `Your franchise wants to keep you at ${formatLakh(retention.salary)} a season - accept, decline or name your price before the auction.`,
      action: { kind: 'GO', to: '/auction' },
      secondary: null,
      tone: 'gold',
    };
  }
  const trade = state.pro?.ipl.tradeOffer;
  if (trade) {
    return {
      kind: 'TRADE',
      title: 'Trade offer',
      label: 'Decide on the trade',
      reason: `Another franchise will take over your contract (${formatLakh(trade.salary)}) and wants you in their XI.`,
      action: { kind: 'GO', to: '/auction' },
      secondary: null,
      tone: 'gold',
    };
  }
  const offer = state.pro?.leadership.offer;
  if (offer) {
    return {
      kind: 'CAPTAINCY',
      title: offer.role === 'CAPTAIN' ? 'Captaincy offer' : 'Vice-captaincy offer',
      label: 'Answer the offer',
      reason: `${offer.teamName} want you as ${offer.role === 'CAPTAIN' ? 'captain' : 'vice-captain'}.`,
      action: { kind: 'GO', to: '/career' },
      secondary: null,
      tone: 'gold',
    };
  }
  if (state.career.pendingReview) {
    return {
      kind: 'SEASON_REVIEW',
      title: 'Season review',
      label: 'Read the review',
      reason: 'The season is done - see what the selectors and coaches made of it.',
      action: { kind: 'GO', to: '/season-review' },
      secondary: null,
      tone: 'gold',
    };
  }

  // 3. Selection news not read yet.
  const news = state.inbox.filter((m) => m.category === 'SELECTION' && !m.read);
  if (news.length) {
    return {
      kind: 'SELECTION_NEWS',
      title: 'Selection news',
      label: news.length === 1 ? 'Read the news' : `Read ${news.length} updates`,
      reason: news[0].subject,
      action: { kind: 'NEWS' },
      secondary: null,
      tone: 'orange',
    };
  }

  // 4. Injured: rehab first.
  const injury = state.player.condition.injury;
  if (injury) {
    const rehab = state.player.development.rehab;
    const back = daysBetweenDates(today, injury.expectedReturn);
    const weeks = Math.max(1, Math.round(back / 7));
    return {
      kind: 'INJURY',
      title: 'Injured',
      label: rehab ? 'Check the rehab' : 'Start the rehab',
      reason: `${injury.name}${back > 0 ? ` - back in about ${weeks} week${weeks === 1 ? '' : 's'}` : ' - nearly fit'}${rehab ? ` (rehab ${rehab.weeksDone}/${rehab.weeksNeeded} weeks)` : ''}.`,
      action: { kind: 'GO', to: '/training/rehab' },
      secondary: null,
      tone: 'red',
    };
  }

  // 5. Exams this week.
  const weekEnd = addDays(today, 6);
  const exams = state.calendar.windows.find((w) => w.kind === 'EXAMS' && w.start <= weekEnd && w.end >= today);
  if (exams) {
    return {
      kind: 'EXAMS',
      title: 'Exam week',
      label: 'Plan the week',
      reason: `Exams ${exams.start <= today ? 'this week' : when(today, exams.start)} - balance revision with training so grades and family stay happy.`,
      action: { kind: 'GO', to: '/training' },
      secondary: null,
      tone: 'orange',
    };
  }

  // 6. No training plan.
  if (state.trainingPlan.sessions.length === 0) {
    return {
      kind: 'TRAINING_PLAN',
      title: 'No training plan',
      label: 'Set up training',
      reason: 'A week without a plan is a week without progress - pick your sessions.',
      action: { kind: 'GO', to: '/training' },
      secondary: null,
      tone: 'green',
    };
  }

  // 7. Nothing pressing: the week goes on.
  return {
    kind: 'CONTINUE',
    title: 'Next week',
    label: 'Continue',
    reason: selectionLine(state) ?? 'Train, stay fit and keep the numbers coming.',
    action: { kind: 'CONTINUE' },
    secondary: null,
    tone: 'gold',
  };
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
