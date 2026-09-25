/**
 * One week of a player's life off the field: training, rehab, school, form
 * drifting between matches, the coaches' monthly re-think and XP. Used by the
 * calendar's weekly advance and by the career simulation, so both run the
 * exact same model.
 */
import { INJURY } from '../config';
import type { Rng } from '../match/rng';
import { INJURIES_BY_TYPE } from '@/data/injuries';
import { ageInYears } from './curves';
import { coachHints, refineEstimate } from './coach';
import { daysBetweenDates } from './dates';
import { driftCondition } from './form';
import { historyEntry, rehabWeek, returnMatchFitness, startRehab } from './injuries';
import { studyWeek } from './studies';
import { runTrainingWeek } from './training';
import { addXp } from './xp';
import type {
  DevelopmentState,
  InboxCategory,
  InboxSender,
  Injury,
  Player,
  TrainingPlan,
  WeeklyReport,
} from '@/types';

export interface DevelopmentMessage {
  sender: InboxSender;
  senderName: string;
  subject: string;
  body: string;
  category: InboxCategory;
  important: boolean;
}

export interface DevelopmentWeekInput {
  player: Player;
  plan: TrainingPlan;
  date: string;
  examWeek: boolean;
  /** Share of the week free for training, 0-1. */
  fraction: number;
  /** Did a match take part of this week? Form only drifts in weeks without one. */
  playedMatch: boolean;
  /** First week of a new month: the coaches take stock. */
  newMonth: boolean;
  rng: Rng;
  /** Skip the coach's weekly message (bulk simulation). */
  quiet?: boolean;
}

export interface DevelopmentWeekResult {
  player: Player;
  plan: TrainingPlan;
  report: WeeklyReport;
  messages: DevelopmentMessage[];
  injuryStarted: Injury | null;
  /** The player was cleared to play this week. */
  cleared: boolean;
  /** The lay-off has now cost the player their squad place. */
  lostSquadPlace: boolean;
}

const MAX_REPORTS = 12;

export function developmentWeek(input: DevelopmentWeekInput): DevelopmentWeekResult {
  const { rng, date } = input;
  const messages: DevelopmentMessage[] = [];
  let player = input.player;

  // An injury from before Phase 5 (or a match) with no rehab yet gets one.
  if (player.condition.injury && !player.development.rehab) {
    player = withDevelopment(player, {
      rehab: startRehab(player.condition.injury),
      injuryHistory: ensureHistory(player.development, player.condition.injury),
    });
  }
  const wasInjured = player.condition.injury;

  // --- Training -----------------------------------------------------------
  const trained = runTrainingWeek({
    player,
    plan: input.plan,
    date,
    examWeek: input.examWeek,
    fraction: input.fraction,
    rng,
  });
  player = trained.player;
  let report = trained.report;

  let cleared = false;
  let lostSquadPlace = false;

  // --- A new injury -------------------------------------------------------
  if (trained.injury) {
    const def = INJURIES_BY_TYPE[trained.injury.type ?? 'NIGGLE'];
    const rehab = startRehab(trained.injury);
    player = withDevelopment(player, {
      rehab,
      injuryHistory: [historyEntry(trained.injury), ...player.development.injuryHistory],
    });
    messages.push({
      sender: 'PHYSIO',
      senderName: 'Physio',
      subject: `${trained.injury.name} in training - about ${rehab.weeksNeeded} week${rehab.weeksNeeded === 1 ? '' : 's'} out`,
      body: `${def.rehabNote} Pick a rehab plan on the Training screen: cautious is slower but safer; rushing back raises the chance it goes again.`,
      category: 'INJURY',
      important: true,
    });
  }

  // --- Rehab --------------------------------------------------------------
  if (wasInjured && player.development.rehab) {
    const rehab = player.development.rehab;
    const step = rehabWeek(rehab, rng);
    const weeksOut = Math.max(1, Math.round(daysBetweenDates(wasInjured.startedOn, date) / 7));

    if (weeksOut === INJURY.trustLossWeeks) {
      player = {
        ...player,
        condition: {
          ...player.condition,
          selectorTrust: Math.max(0, player.condition.selectorTrust - INJURY.trustLoss),
        },
      };
      messages.push({
        sender: 'SELECTOR',
        senderName: 'Selectors',
        subject: 'The side has moved on while you are out',
        body: 'Six weeks is a long time. Someone else has taken their chance - you will have to win your place back.',
        category: 'SELECTION',
        important: false,
      });
    }
    if (weeksOut === INJURY.squadLossWeeks) {
      lostSquadPlace = true;
      messages.push({
        sender: 'SELECTOR',
        senderName: 'Selectors',
        subject: 'Squad place lost to injury',
        body: 'After three months out you are no longer in the squad. Get fit, get runs and wickets, and force your way back.',
        category: 'SELECTION',
        important: true,
      });
    }

    if (step.cleared) {
      cleared = true;
      const history = player.development.injuryHistory.map((entry) =>
        entry.id === wasInjured.id
          ? { ...entry, returnedOn: date, weeksOut, rushed: step.rushed }
          : entry,
      );
      player = {
        ...player,
        condition: { ...player.condition, injury: null },
        development: {
          ...player.development,
          rehab: null,
          injuryHistory: history,
          matchFitness: Math.min(player.development.matchFitness, returnMatchFitness(weeksOut)),
        },
      };
      messages.push({
        sender: 'PHYSIO',
        senderName: 'Physio',
        subject: `Cleared to play after the ${wasInjured.name.toLowerCase()}`,
        body:
          `Return-to-play test passed after ${weeksOut} week${weeksOut === 1 ? '' : 's'}. ` +
          'Match sharpness is down - match simulation sessions and a few games will bring it back.' +
          (step.rushed ? ' You came back quickly; the risk of it going again is higher for a while.' : ''),
        category: 'INJURY',
        important: true,
      });
    } else {
      player = withDevelopment(player, { rehab: step.rehab });
      if (step.failedTest) {
        messages.push({
          sender: 'PHYSIO',
          senderName: 'Physio',
          subject: 'Return-to-play test failed',
          body: 'Not quite there yet. Another week or two of rehab before we test again.',
          category: 'INJURY',
          important: false,
        });
      }
    }
  }

  // --- School -------------------------------------------------------------
  const age = ageInYears(player.dateOfBirth, date);
  const school = studyWeek(player.development.studies, input.plan.studyFocus, input.examWeek, age);
  player = withDevelopment(player, { studies: school.studies });
  if (school.moraleDelta !== 0) {
    const morale = clamp(player.condition.morale + school.moraleDelta, 0, 100);
    player = { ...player, condition: { ...player.condition, morale } };
  }
  if (school.note) {
    messages.push({
      sender: 'SYSTEM',
      senderName: 'Family',
      subject: input.examWeek ? 'Exam results' : 'A word about school',
      body: school.note,
      category: 'NEWS',
      important: false,
    });
  }

  // --- Form between matches -----------------------------------------------
  if (!input.playedMatch) {
    player = { ...player, condition: driftCondition(player.condition, Math.max(0.3, input.fraction)) };
  }

  // --- The coaches take stock once a month --------------------------------
  if (input.newMonth) {
    const estimate = refineEstimate(player.development, age, player.condition.form, player.overall, rng);
    const dev = { ...player.development, coachEstimate: estimate };
    player = withDevelopment(player, {
      coachEstimate: estimate,
      coachHints: coachHints(dev, age),
      overallHistory: [
        ...player.development.overallHistory,
        { date, age: Math.round(age * 10) / 10, overall: player.overall },
      ].slice(-360),
    });
  }

  // --- XP -----------------------------------------------------------------
  const levelled = addXp(player, report.xpEarned);
  player = { ...player, xp: levelled.xp, level: levelled.level, xpToNextLevel: levelled.xpToNextLevel, age: Math.floor(age) };
  if (levelled.levelsGained > 0 && !input.quiet) {
    messages.push({
      sender: 'SYSTEM',
      senderName: 'Career',
      subject: `Level ${levelled.level} reached`,
      body: 'All those hours are adding up.',
      category: 'MILESTONE',
      important: false,
    });
  }

  if (!input.quiet && report.energyUsed + report.changes.length > 0 && !trained.injury) {
    messages.push({
      sender: 'COACH',
      senderName: 'Coach',
      subject: report.coachNote,
      body: weekSummary(report),
      category: 'TRAINING',
      important: false,
    });
  }

  report = { ...report, overall: [input.player.overall, player.overall] };
  player = withDevelopment(player, {
    weeklyReports: [report, ...player.development.weeklyReports].slice(0, MAX_REPORTS),
  });

  return {
    player,
    plan: { ...input.plan, lastAppliedOn: date, weeksActive: input.plan.weeksActive + 1 },
    report,
    messages,
    injuryStarted: trained.injury,
    cleared,
    lostSquadPlace,
  };
}

function weekSummary(report: WeeklyReport): string {
  const gains = report.changes.filter((c) => c.delta > 0).map((c) => `+${c.delta} ${c.label}`);
  const parts = [
    `Energy ${report.energyUsed}/${report.energyBudget}.`,
    gains.length ? `Gains: ${gains.join(', ')}.` : 'No attribute moved a full point this week.',
    `Fatigue ${Math.round(report.fatigue[0])} → ${Math.round(report.fatigue[1])}.`,
  ];
  return parts.join(' ');
}

function withDevelopment(player: Player, patch: Partial<DevelopmentState>): Player {
  return { ...player, development: { ...player.development, ...patch } };
}

function ensureHistory(development: DevelopmentState, injury: Injury) {
  return development.injuryHistory.some((entry) => entry.id === injury.id)
    ? development.injuryHistory
    : [historyEntry(injury), ...development.injuryHistory];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
