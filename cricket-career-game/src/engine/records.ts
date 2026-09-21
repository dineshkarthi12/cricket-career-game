import type { CareerRecord, FormatRecord, MatchFormat } from '@/types';

const FORMATS: MatchFormat[] = ['T20', 'ODI', 'ONE_DAY', 'MULTI_DAY', 'TEST'];

export function emptyFormatRecord(format: MatchFormat): FormatRecord {
  return {
    format,
    batting: {
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
    },
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
}

export function emptyCareerRecord(): CareerRecord {
  return {
    byFormat: Object.fromEntries(
      FORMATS.map((f) => [f, emptyFormatRecord(f)]),
    ) as Record<MatchFormat, FormatRecord>,
    byCompetition: {},
    manOfTheMatch: 0,
    manOfTheSeries: 0,
  };
}

/** Batting average, or `null` when the player has never been dismissed. */
export function battingAverage(record: FormatRecord): number | null {
  const outs = record.batting.innings - record.batting.notOuts;
  if (outs <= 0) return null;
  return record.batting.runs / outs;
}

export function strikeRate(record: FormatRecord): number {
  if (record.batting.balls === 0) return 0;
  return (record.batting.runs / record.batting.balls) * 100;
}

export function bowlingAverage(record: FormatRecord): number | null {
  if (record.bowling.wickets === 0) return null;
  return record.bowling.runsConceded / record.bowling.wickets;
}

export function economy(record: FormatRecord): number {
  if (record.bowling.balls === 0) return 0;
  return (record.bowling.runsConceded / record.bowling.balls) * 6;
}
