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
import { currentLang, isKey, t, type Key, type Lang } from '@/i18n/core';
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

function ordinal(n: number, lang: Lang): string {
  if (lang === 'ta') return `${n}-வது`;
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** "Friday", "next Tuesday" or "on 14 Aug", relative to today. */
function when(today: string, date: string, lang: Lang): string {
  const days = daysBetweenDates(today, date);
  const d = new Date(`${date}T00:00:00Z`);
  const dayIndex = d.getUTCDay();
  const day = lang === 'ta' ? t(lang, `date.day.${dayIndex}` as Key) : WEEKDAYS[dayIndex];
  if (days === 0) return t(lang, 'next.when.today');
  if (days === 1) return t(lang, 'next.when.tomorrow');
  if (days > 1 && days < 7) return day;
  if (days >= 7 && days < 14) return t(lang, 'next.when.next', { day });
  return t(lang, 'next.when.on', { date: t(lang, 'date.dayMonth', { day: d.getUTCDate(), month: t(lang, `date.mon.${d.getUTCMonth()}` as Key) }) });
}

/** "Ranji squad picked Friday - you're 3rd among all-rounders", or null. */
export function selectionLine(state: GameState, journeys?: CompetitionJourney[], lang: Lang = currentLang()): string | null {
  const list = journeys ?? selectionJourney(state, state.pro ? proPlaces(state).map((p) => p.tournamentId) : []);
  const today = state.season.currentDate;
  const withEvent = list.filter((j) => j.nextEvent && j.nextEvent.date >= today).sort((a, b) => a.nextEvent!.date.localeCompare(b.nextEvent!.date));
  const j = withEvent[0] ?? list[0];
  if (!j) return null;
  const groupKey = j.rank ? `group.${j.rank.group}` : '';
  const group = !j.rank ? '' : lang === 'ta' && isKey(groupKey) ? t(lang, groupKey) : j.rank.group.endsWith('s') ? j.rank.group : `${j.rank.group}s`;
  const rank = j.rank ? t(lang, 'next.sel.rank', { pos: ordinal(j.rank.position, lang), group }) : null;
  if (j.nextEvent) {
    const picked = t(lang, /trial/i.test(j.nextEvent.title) ? 'next.sel.trial' : 'next.sel.squad', { comp: j.shortName, when: when(today, j.nextEvent.date, lang) });
    return rank ? t(lang, 'next.sel.joined', { a: picked, b: rank }) : picked;
  }
  return rank ? t(lang, 'next.sel.only', { comp: j.shortName, rank }) : j.headline;
}

function matchLine(state: GameState, f: Fixture): string {
  const home = f.homeTeamId ? state.teams[f.homeTeamId]?.shortName : null;
  const away = f.awayTeamId ? state.teams[f.awayTeamId]?.shortName : null;
  const comp = f.tournamentId ? (TOURNAMENTS_BY_ID[f.tournamentId]?.shortName ?? '') : '';
  const teams = home && away ? `${home} v ${away}` : f.title;
  return comp ? `${comp}: ${teams}` : teams;
}

export function nextAction(state: GameState, lang: Lang = currentLang()): NextAction {
  const today = state.season.currentDate;
  const tt = (key: Key, vars?: Record<string, string | number>) => t(lang, key, vars);

  // 1. A match or trial today: the week cannot go on without it.
  const match = pendingMatch(state);
  if (match) {
    const selected = match.involvesUser !== false;
    return {
      kind: 'MATCH',
      title: tt('next.MATCH.title'),
      label: tt(selected ? 'next.MATCH.play' : 'next.MATCH.watch'),
      reason: tt('next.MATCH.reason', { match: matchLine(state, match) }),
      action: { kind: 'PLAY', fixtureId: match.id },
      secondary: { kind: 'SIM', label: tt('next.sim'), fixtureId: match.id },
      tone: 'blue',
    };
  }
  const trial = pendingTrial(state);
  if (trial) {
    return {
      kind: 'TRIAL',
      title: tt('next.TRIAL.title'),
      label: tt('next.TRIAL.label'),
      reason: tt('next.TRIAL.reason', { title: trial.title }),
      action: { kind: 'ATTEND', fixtureId: trial.id },
      secondary: { kind: 'COACH', label: tt('next.coach'), fixtureId: trial.id },
      tone: 'blue',
    };
  }

  // 2. A decision waiting on the player.
  const auction = unwatchedAuction(state);
  if (auction) {
    const lot = auction.userLot;
    return {
      kind: 'AUCTION',
      title: tt(auction.mega ? 'next.AUCTION.mega' : 'next.AUCTION.title'),
      label: tt('next.AUCTION.label'),
      reason: lot ? tt('next.AUCTION.reasonIn', { base: formatLakh(lot.basePrice) }) : tt('next.AUCTION.reasonOut'),
      action: { kind: 'GO', to: '/auction/live' },
      secondary: null,
      tone: 'gold',
    };
  }
  const retention = state.pro?.ipl.retentionOffer;
  if (retention) {
    return {
      kind: 'RETENTION',
      title: tt('next.RETENTION.title'),
      label: tt('next.RETENTION.label'),
      reason: tt('next.RETENTION.reason', { salary: formatLakh(retention.salary) }),
      action: { kind: 'GO', to: '/auction' },
      secondary: null,
      tone: 'gold',
    };
  }
  const trade = state.pro?.ipl.tradeOffer;
  if (trade) {
    return {
      kind: 'TRADE',
      title: tt('next.TRADE.title'),
      label: tt('next.TRADE.label'),
      reason: tt('next.TRADE.reason', { salary: formatLakh(trade.salary) }),
      action: { kind: 'GO', to: '/auction' },
      secondary: null,
      tone: 'gold',
    };
  }
  const offer = state.pro?.leadership.offer;
  if (offer) {
    return {
      kind: 'CAPTAINCY',
      title: tt(offer.role === 'CAPTAIN' ? 'next.CAPTAINCY.captain' : 'next.CAPTAINCY.vice'),
      label: tt('next.CAPTAINCY.label'),
      reason: tt(offer.role === 'CAPTAIN' ? 'next.CAPTAINCY.reasonCaptain' : 'next.CAPTAINCY.reasonVice', { team: offer.teamName }),
      action: { kind: 'GO', to: '/career' },
      secondary: null,
      tone: 'gold',
    };
  }
  if (state.career.pendingReview) {
    return {
      kind: 'SEASON_REVIEW',
      title: tt('next.SEASON_REVIEW.title'),
      label: tt('next.SEASON_REVIEW.label'),
      reason: tt('next.SEASON_REVIEW.reason'),
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
      title: tt('next.SELECTION_NEWS.title'),
      label: news.length === 1 ? tt('next.SELECTION_NEWS.one') : tt('next.SELECTION_NEWS.many', { n: news.length }),
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
      title: tt('next.INJURY.title'),
      label: tt(rehab ? 'next.INJURY.check' : 'next.INJURY.start'),
      reason: `${back > 0 ? (weeks === 1 ? tt('next.INJURY.backWeek', { injury: injury.name }) : tt('next.INJURY.backWeeks', { injury: injury.name, n: weeks })) : tt('next.INJURY.nearly', { injury: injury.name })}${rehab ? tt('next.INJURY.rehab', { done: rehab.weeksDone, needed: rehab.weeksNeeded }) : ''}.`,
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
      title: tt('next.EXAMS.title'),
      label: tt('next.EXAMS.label'),
      reason: exams.start <= today ? tt('next.EXAMS.now') : tt('next.EXAMS.soon', { when: when(today, exams.start, lang) }),
      action: { kind: 'GO', to: '/training' },
      secondary: null,
      tone: 'orange',
    };
  }

  // 6. No training plan.
  if (state.trainingPlan.sessions.length === 0) {
    return {
      kind: 'TRAINING_PLAN',
      title: tt('next.TRAINING_PLAN.title'),
      label: tt('next.TRAINING_PLAN.label'),
      reason: tt('next.TRAINING_PLAN.reason'),
      action: { kind: 'GO', to: '/training' },
      secondary: null,
      tone: 'green',
    };
  }

  // 7. Nothing pressing: the week goes on.
  return {
    kind: 'CONTINUE',
    title: tt('next.CONTINUE.title'),
    label: tt('next.CONTINUE.label'),
    reason: selectionLine(state, undefined, lang) ?? tt('next.CONTINUE.quiet'),
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
