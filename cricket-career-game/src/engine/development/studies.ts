/**
 * School. While under 16 the player splits spare time between books and
 * cricket. Exam weeks cut training time; ignoring studies nudges grades down,
 * and falling grades make the family unhappy, which costs a little morale.
 */
import { STUDIES } from '../config';
import type { StudyState } from '@/types';

export interface StudyWeekResult {
  studies: StudyState;
  moraleDelta: number;
  /** A message for the inbox, when something is worth saying. */
  note: string | null;
}

export function atSchool(age: number): boolean {
  return age < STUDIES.schoolUntil;
}

export function studyWeek(
  studies: StudyState,
  studyFocus: number,
  examWeek: boolean,
  age: number,
): StudyWeekResult {
  if (!atSchool(age)) return { studies, moraleDelta: 0, note: null };

  const focus = Math.max(0, Math.min(100, studyFocus));
  let grades = studies.grades + (focus - STUDIES.neutralFocus) * STUDIES.gradeRate;
  if (examWeek) grades += focus >= 50 ? 3 : focus < 25 ? -STUDIES.examPenalty : 0;
  grades = clamp(grades, 20, 98);

  const worried = grades < STUDIES.familyWorry;
  let family = studies.family + (worried ? -STUDIES.familyRate : 0.6);
  family = clamp(family, 5, 100);

  const moraleDelta = family < 35 ? -1 : family > 80 ? 0.3 : 0;

  let note: string | null = null;
  if (examWeek) {
    note =
      grades >= 70
        ? 'Exams went well. Your parents are happy - cricket stays on the table.'
        : grades >= STUDIES.familyWorry
          ? 'Exams were just about fine. Keep an eye on the books.'
          : 'Poor exam results. Your parents want more time on studies before more cricket.';
  } else if (worried && studies.grades >= STUDIES.familyWorry) {
    note = 'Your marks are slipping. The family is starting to worry about all the cricket.';
  }

  return { studies: { grades: round(grades), family: round(family) }, moraleDelta, note };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
