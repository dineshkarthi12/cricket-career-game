import type { SideKind } from './schedule';
import type { TournamentStage } from '@/types';

/**
 * How each competition in stages 1-10 is played: groups, a round-robin, and
 * knockouts, inside the real Indian season windows. Dates are month/day in
 * the season (June-December in its first year, January-May in its second).
 */
export interface RoundWindow {
  from: [number, number];
  to: [number, number];
  /** Group rounds played inside this window. */
  rounds: number;
}

export interface TournamentStructure {
  tournamentId: string;
  side: SideKind;
  groups: number;
  groupSize: number;
  /** Times each pair meets in the group (a bilateral series is 1 pair, 5 legs). */
  legs: number;
  qualifiersPerGroup: number;
  knockouts: TournamentStage[];
  roundWindows: RoundWindow[];
  knockoutWindow: { from: [number, number]; to: [number, number] } | null;
  /** Weekday matches start on (0 Sunday ... 6 Saturday), or null for any. */
  weekday: number | null;
  points: 'LIMITED' | 'FIRST_CLASS';
  /** Only held in some seasons. */
  heldIn?: (seasonYear: number) => boolean;
}

const QF_SF_F: TournamentStage[] = ['QUARTER_FINAL', 'SEMI_FINAL', 'FINAL'];
const SF_F: TournamentStage[] = ['SEMI_FINAL', 'FINAL'];

export const TOURNAMENT_STRUCTURES: Record<string, TournamentStructure> = {
  'school-league': {
    tournamentId: 'school-league',
    side: 'SCHOOL',
    groups: 1,
    groupSize: 6,
    legs: 1,
    qualifiersPerGroup: 4,
    knockouts: SF_F,
    roundWindows: [
      { from: [7, 5], to: [9, 13], rounds: 3 },
      { from: [11, 7], to: [1, 30], rounds: 2 },
    ],
    knockoutWindow: { from: [2, 6], to: [2, 20] },
    weekday: 6,
    points: 'LIMITED',
  },
  'club-league': {
    tournamentId: 'club-league',
    side: 'CLUB',
    groups: 1,
    groupSize: 8,
    legs: 1,
    qualifiersPerGroup: 0,
    knockouts: [],
    roundWindows: [
      { from: [8, 2], to: [12, 13], rounds: 4 },
      { from: [1, 3], to: [3, 1], rounds: 3 },
    ],
    knockoutWindow: null,
    weekday: 0,
    points: 'LIMITED',
  },
  'district-league': {
    tournamentId: 'district-league',
    side: 'DISTRICT',
    groups: 2,
    groupSize: 5,
    legs: 1,
    qualifiersPerGroup: 2,
    knockouts: SF_F,
    roundWindows: [
      { from: [8, 22], to: [11, 28], rounds: 3 },
      { from: [1, 9], to: [2, 13], rounds: 2 },
    ],
    knockoutWindow: { from: [2, 20], to: [3, 6] },
    weekday: 6,
    points: 'LIMITED',
  },
  'vijay-merchant': {
    tournamentId: 'vijay-merchant',
    side: 'STATE_U16',
    groups: 4,
    groupSize: 6,
    legs: 1,
    qualifiersPerGroup: 2,
    knockouts: QF_SF_F,
    roundWindows: [{ from: [11, 20], to: [1, 10], rounds: 5 }],
    knockoutWindow: { from: [1, 16], to: [2, 8] },
    weekday: null,
    points: 'FIRST_CLASS',
  },
  'vinoo-mankad': {
    tournamentId: 'vinoo-mankad',
    side: 'STATE_U19',
    groups: 4,
    groupSize: 6,
    legs: 1,
    qualifiersPerGroup: 2,
    knockouts: QF_SF_F,
    roundWindows: [{ from: [10, 4], to: [10, 24], rounds: 5 }],
    knockoutWindow: { from: [10, 27], to: [11, 4] },
    weekday: null,
    points: 'LIMITED',
  },
  'cooch-behar': {
    tournamentId: 'cooch-behar',
    side: 'STATE_U19',
    groups: 4,
    groupSize: 6,
    legs: 1,
    qualifiersPerGroup: 2,
    knockouts: QF_SF_F,
    roundWindows: [{ from: [11, 12], to: [1, 14], rounds: 5 }],
    knockoutWindow: { from: [1, 20], to: [2, 14] },
    weekday: null,
    points: 'FIRST_CLASS',
  },
  'u19-bilateral': {
    tournamentId: 'u19-bilateral',
    side: 'INDIA_U19',
    groups: 1,
    groupSize: 2,
    legs: 5,
    qualifiersPerGroup: 0,
    knockouts: [],
    roundWindows: [{ from: [9, 10], to: [9, 28], rounds: 5 }],
    knockoutWindow: null,
    weekday: null,
    points: 'LIMITED',
  },
  'u19-world-cup': {
    tournamentId: 'u19-world-cup',
    side: 'INDIA_U19',
    groups: 4,
    groupSize: 4,
    legs: 1,
    qualifiersPerGroup: 2,
    knockouts: QF_SF_F,
    roundWindows: [{ from: [1, 15], to: [1, 24], rounds: 3 }],
    knockoutWindow: { from: [1, 27], to: [2, 8] },
    weekday: null,
    points: 'LIMITED',
    heldIn: (seasonYear) => (seasonYear + 1) % 2 === 0,
  },
  'ck-nayudu': {
    tournamentId: 'ck-nayudu',
    side: 'STATE_U23',
    groups: 4,
    groupSize: 6,
    legs: 1,
    qualifiersPerGroup: 2,
    knockouts: QF_SF_F,
    roundWindows: [{ from: [10, 12], to: [1, 18], rounds: 5 }],
    knockoutWindow: { from: [1, 26], to: [2, 24] },
    weekday: null,
    points: 'FIRST_CLASS',
  },
  'u23-state-a': {
    tournamentId: 'u23-state-a',
    side: 'STATE_U23',
    groups: 4,
    groupSize: 6,
    legs: 1,
    qualifiersPerGroup: 2,
    knockouts: QF_SF_F,
    roundWindows: [{ from: [9, 12], to: [10, 2], rounds: 5 }],
    knockoutWindow: { from: [10, 5], to: [10, 11] },
    weekday: null,
    points: 'LIMITED',
  },
  'ranji-trophy': {
    tournamentId: 'ranji-trophy',
    side: 'STATE',
    groups: 4,
    groupSize: 8,
    legs: 1,
    qualifiersPerGroup: 2,
    knockouts: QF_SF_F,
    roundWindows: [
      { from: [10, 11], to: [11, 16], rounds: 5 },
      { from: [1, 23], to: [2, 4], rounds: 2 },
    ],
    knockoutWindow: { from: [2, 9], to: [3, 8] },
    weekday: null,
    points: 'FIRST_CLASS',
  },
  'vijay-hazare': {
    tournamentId: 'vijay-hazare',
    side: 'STATE',
    groups: 4,
    groupSize: 8,
    legs: 1,
    qualifiersPerGroup: 2,
    knockouts: QF_SF_F,
    roundWindows: [{ from: [12, 21], to: [1, 7], rounds: 7 }],
    knockoutWindow: { from: [1, 10], to: [1, 18] },
    weekday: null,
    points: 'LIMITED',
  },
  'syed-mushtaq-ali': {
    tournamentId: 'syed-mushtaq-ali',
    side: 'STATE',
    groups: 4,
    groupSize: 8,
    legs: 1,
    qualifiersPerGroup: 2,
    knockouts: QF_SF_F,
    roundWindows: [{ from: [11, 23], to: [12, 9], rounds: 7 }],
    knockoutWindow: { from: [12, 12], to: [12, 17] },
    weekday: null,
    points: 'LIMITED',
  },
};

export const STAGE_LABEL: Partial<Record<TournamentStage, string>> = {
  GROUP: 'Group',
  LEAGUE: 'League',
  QUARTER_FINAL: 'Quarter-final',
  SEMI_FINAL: 'Semi-final',
  FINAL: 'Final',
};
