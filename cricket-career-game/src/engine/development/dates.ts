/** Timezone-safe calendar arithmetic on `YYYY-MM-DD` strings. */

function toUtc(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return fromUtc(toUtc(date) + days * 86_400_000);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetweenDates(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekdayOf(date: string): number {
  return new Date(toUtc(date)).getUTCDay();
}

export function monthOf(date: string): number {
  return Number(date.slice(5, 7));
}

export function isoDate(year: number, month: number, day: number): string {
  return fromUtc(Date.UTC(year, month - 1, day));
}

/** The date in a season: months June-December fall in `seasonYear`, the rest in the next. */
export function seasonDate(seasonYear: number, month: number, day: number): string {
  return isoDate(month >= 6 ? seasonYear : seasonYear + 1, month, day);
}

/** Next date on or after `date` that falls on `weekday`. */
export function nextWeekday(date: string, weekday: number): string {
  const diff = (weekday - weekdayOf(date) + 7) % 7;
  return addDays(date, diff);
}

/** Every date from `start` to `end`, inclusive. */
export function eachDay(start: string, end: string): string[] {
  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}
