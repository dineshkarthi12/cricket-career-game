import { CAREER_STAGES, CAREER_STAGES_BY_ID } from '@/data/stages';
import { TOURNAMENTS_BY_ID } from '@/data/tournaments';
import { battingAverage, strikeRate } from '@/engine/records';
import { estimatedCeilings } from '@/engine/development/coach';
import { daysBetween } from './format';
import type { StepItem } from '@/components';
import type {
  BattingRecord,
  CareerStage,
  Fixture,
  FormatRecord,
  GameState,
  Match,
  MatchFormat,
  Trophy,
} from '@/types';

/** Unread inbox messages - the count on the top bar's bell. */
export function unreadCount(state: GameState): number {
  return state.inbox.filter((message) => !message.read).length;
}

export function currentStage(state: GameState): CareerStage {
  return CAREER_STAGES_BY_ID[state.career.currentStageId] ?? CAREER_STAGES[0];
}

/** Title under the player's name in the top bar, taken from the career stage. */
export function playerTitle(state: GameState): string {
  const { order } = currentStage(state);
  if (order <= 3) return 'Aspiring Cricketer';
  if (order <= 6) return 'Age-Group Prospect';
  if (order <= 10) return 'State Cricketer';
  if (order <= 12) return 'Franchise Player';
  if (order <= 15) return 'India Prospect';
  if (order <= 19) return 'International Cricketer';
  return 'Living Legend';
}

/** The 20 stages as stepper nodes, coloured by how far the career has got. */
export function careerSteps(state: GameState): StepItem[] {
  return CAREER_STAGES.map((stage) => {
    const progress = state.career.stages[stage.id];
    const status =
      progress?.status === 'CURRENT'
        ? 'current'
        : progress?.status === 'COMPLETED' || progress?.status === 'SKIPPED'
          ? 'done'
          : 'locked';
    return { id: stage.id, index: stage.order, label: stage.shortLabel, status };
  });
}

/** Fixtures from today onwards, soonest first. */
export function upcomingFixtures(state: GameState, limit = 5): Fixture[] {
  const today = state.season.currentDate;
  return Object.values(state.fixtures)
    .filter((fixture) => !fixture.played && daysBetween(today, fixture.date) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit);
}

/** The next fixture that is an actual match, for the Next Match card. */
export function nextMatchFixture(state: GameState): Fixture | null {
  return upcomingFixtures(state, 50).find((fixture) => fixture.kind === 'MATCH') ?? null;
}

/** Most recently completed match, for the Recent Match card. */
export function recentMatch(state: GameState): Match | null {
  const played = Object.values(state.matches)
    .filter((match) => match.status === 'COMPLETED')
    .sort((a, b) => b.date.localeCompare(a.date));
  return played[0] ?? null;
}

export interface StatsTabDefinition {
  id: string;
  label: string;
  /** Formats rolled into this tab. */
  formats?: MatchFormat[];
  /** Tournament ids rolled into this tab. */
  tournamentIds?: string[];
}

/**
 * Stat tabs shown on the Player Stats card. The age-group tab is derived from
 * the career stage so a U-16 career shows "U-16" and a U-19 career "U-19".
 */
export function statsTabs(state: GameState): StatsTabDefinition[] {
  const stage = currentStage(state);
  const ageGroupTournaments = Object.values(TOURNAMENTS_BY_ID).filter(
    (tournament) => tournament.ageLimit !== null,
  );
  const ageLimit =
    ageGroupTournaments.find((tournament) => stage.tournamentIds.includes(tournament.id))
      ?.ageLimit ?? null;

  const tabs: StatsTabDefinition[] = [];
  if (ageLimit !== null) {
    tabs.push({
      id: `u${ageLimit}`,
      label: `U-${ageLimit}`,
      tournamentIds: ageGroupTournaments
        .filter((tournament) => tournament.ageLimit === ageLimit)
        .map((tournament) => tournament.id),
    });
  }
  tabs.push(
    {
      id: 'first-class',
      label: 'First-Class',
      tournamentIds: ['ranji-trophy', 'duleep-trophy', 'irani-cup', 'world-test-championship'],
    },
    {
      id: 'list-a',
      label: 'List A',
      tournamentIds: ['vijay-hazare', 'india-a-tour', 'odi-world-cup', 'champions-trophy'],
    },
    { id: 't20', label: 'T20', formats: ['T20'] },
    { id: 'overall', label: 'Overall' },
  );
  return tabs;
}

const EMPTY_BATTING: BattingRecord = {
  matches: 0,
  innings: 0,
  notOuts: 0,
  runs: 0,
  balls: 0,
  highScore: 0,
  highScoreNotOut: false,
  fifties: 0,
  hundreds: 0,
  doubleHundreds: 0,
  fours: 0,
  sixes: 0,
  ducks: 0,
};

function addBatting(a: BattingRecord, b: BattingRecord): BattingRecord {
  return {
    matches: a.matches + b.matches,
    innings: a.innings + b.innings,
    notOuts: a.notOuts + b.notOuts,
    runs: a.runs + b.runs,
    balls: a.balls + b.balls,
    highScore: Math.max(a.highScore, b.highScore),
    highScoreNotOut: b.highScore > a.highScore ? b.highScoreNotOut : a.highScoreNotOut,
    fifties: a.fifties + b.fifties,
    hundreds: a.hundreds + b.hundreds,
    doubleHundreds: a.doubleHundreds + b.doubleHundreds,
    fours: a.fours + b.fours,
    sixes: a.sixes + b.sixes,
    ducks: a.ducks + b.ducks,
  };
}

export interface TabStats {
  matches: number;
  runs: number;
  average: number | null;
  strikeRate: number;
  fifties: number;
  hundreds: number;
  highScore: number;
}

/** Roll the player's record up for one stat tab. */
export function statsForTab(state: GameState, tab: StatsTabDefinition): TabStats {
  const { record } = state.player;
  const sources: FormatRecord[] = tab.formats
    ? tab.formats.map((format) => record.byFormat[format]).filter(Boolean)
    : tab.tournamentIds
      ? tab.tournamentIds.map((id) => record.byCompetition[id]).filter(Boolean)
      : Object.values(record.byFormat);

  const batting = sources.reduce((acc, source) => addBatting(acc, source.batting), EMPTY_BATTING);
  const combined: FormatRecord = {
    format: 'ONE_DAY',
    batting,
    bowling: {
      innings: 0,
      balls: 0,
      runsConceded: 0,
      wickets: 0,
      maidens: 0,
      fiveWicketHauls: 0,
      tenWicketMatches: 0,
      bestInnings: null,
    },
    fielding: { catches: 0, runOuts: 0, stumpings: 0 },
  };

  return {
    matches: batting.matches,
    runs: batting.runs,
    average: battingAverage(combined),
    strikeRate: strikeRate(combined),
    fifties: batting.fifties,
    hundreds: batting.hundreds,
    highScore: batting.highScore,
  };
}

/**
 * The six batting axes drawn on the Skill Development radar. "Potential" is
 * the coaches' estimate, never the hidden truth.
 */
export function radarAxes(state: GameState) {
  const { attributes } = state.player;
  const potential = estimatedCeilings(state.player.potential, attributes, state.player.development);
  return [
    { axis: 'Technique', current: attributes.batting.technique, potential: potential.batting.technique },
    { axis: 'Timing', current: attributes.batting.timing, potential: potential.batting.timing },
    { axis: 'Power', current: attributes.batting.power, potential: potential.batting.power },
    { axis: 'Shot Range', current: attributes.batting.shotRange, potential: potential.batting.shotRange },
    { axis: 'Vs Pace', current: attributes.batting.vsPace, potential: potential.batting.vsPace },
    { axis: 'Vs Spin', current: attributes.batting.vsSpin, potential: potential.batting.vsSpin },
  ];
}

const TIER_ORDER = { BRONZE: 0, SILVER: 1, GOLD: 2, PLATINUM: 3 } as const;

/** Unlocked trophies first, then the next milestones within reach. */
export function featuredTrophies(state: GameState, limit = 4): Trophy[] {
  const unlocked = state.trophies
    .filter((trophy) => trophy.unlocked)
    .sort((a, b) => (b.unlockedOn ?? '').localeCompare(a.unlockedOn ?? ''));
  const locked = state.trophies
    .filter((trophy) => !trophy.unlocked)
    .sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || b.progress - a.progress);
  return [...unlocked, ...locked].slice(0, limit);
}

/** The coaches' estimate of the player's potential overall (shown on the radar legend). */
export function coachEstimate(state: GameState): number {
  return Math.max(state.player.overall, state.player.development.coachEstimate);
}
