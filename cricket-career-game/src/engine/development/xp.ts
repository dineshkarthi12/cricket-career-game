import { XP } from '../config';
import type { Player } from '@/types';

/** XP needed to go from `level` to `level + 1`. */
export function xpForLevel(level: number): number {
  return Math.round(XP.levelBase * Math.pow(Math.max(1, level), XP.levelCurve));
}

export interface XpResult {
  xp: number;
  level: number;
  xpToNextLevel: number;
  levelsGained: number;
}

/** Add XP, levelling up as many times as it pays for. */
export function addXp(player: Pick<Player, 'xp' | 'level' | 'xpToNextLevel'>, amount: number): XpResult {
  let xp = player.xp + Math.max(0, Math.round(amount));
  let level = player.level;
  let toNext = player.xpToNextLevel > 0 ? player.xpToNextLevel : xpForLevel(level);
  let levelsGained = 0;
  while (xp >= toNext) {
    xp -= toNext;
    level += 1;
    levelsGained += 1;
    toNext = xpForLevel(level);
  }
  return { xp, level, xpToNextLevel: toNext, levelsGained };
}
