/**
 * Fielding restrictions, checked against where the fielders actually stand.
 *
 * Shared by the field editor, which shows the problems, and the match store,
 * which refuses to send an illegal field to the engine - the umpire would not
 * let the captain use it either.
 */
import { fieldersAllowedOutside } from '@/engine/match/field';
import type { FieldSetting } from '@/engine/match/types';
import { groundBox, insideCircle } from './ground';
import type { MatchFormat, Venue } from '@/types';

const LIMITED: MatchFormat[] = ['T20', 'ODI', 'ONE_DAY'];

export function outsideCount(
  field: FieldSetting | null,
  venue: Pick<Venue, 'squareBoundary' | 'straightBoundary'>,
): number {
  if (!field) return 0;
  const box = groundBox(venue);
  return field.fielders.filter((f) => !insideCircle(box, f.angle, f.distance)).length;
}

export function fieldProblems(
  field: FieldSetting | null,
  venue: Pick<Venue, 'squareBoundary' | 'straightBoundary'>,
  format: MatchFormat,
  over: number,
): string[] {
  if (!field) return [];
  const problems: string[] = [];

  if (LIMITED.includes(format)) {
    const allowed = fieldersAllowedOutside(format, over);
    const outside = outsideCount(field, venue);
    if (outside > allowed) {
      problems.push(`${outside} outside the circle — only ${allowed} allowed right now.`);
    }
    const legSide = field.fielders.filter((f) => f.angle > 180 && f.angle < 360).length;
    if (legSide > 5) problems.push(`${legSide} on the leg side — no more than five.`);
  }

  // Law 28.4: no more than two behind square on the leg side, in any format.
  const behindSquare = field.fielders.filter((f) => f.angle > 180 && f.angle < 270).length;
  if (behindSquare > 2) {
    problems.push(`${behindSquare} behind square on the leg side — the law allows two.`);
  }

  return problems;
}
