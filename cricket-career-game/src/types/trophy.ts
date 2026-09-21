import type { Id, ISODate } from './primitives';

export type TrophyKind =
  | 'TEAM_TITLE'
  | 'INDIVIDUAL_AWARD'
  | 'MILESTONE'
  | 'CAREER_STEP'
  | 'RECORD';

export type TrophyTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

export interface Trophy {
  id: Id;
  name: string;
  description: string;
  kind: TrophyKind;
  tier: TrophyTier;
  /** lucide-react icon name used on the Trophies & Milestones card. */
  icon: string;
  /** Unlocked trophies show in colour; locked ones show a padlock. */
  unlocked: boolean;
  unlockedOn: ISODate | null;
  /** Season the trophy was won, e.g. 2025. */
  seasonYear: number | null;
  /** Competition it came from, when applicable. */
  tournamentId: Id | null;
  /** Progress towards unlocking, 0-1, for milestone-style trophies. */
  progress: number;
  hint: string;
}
