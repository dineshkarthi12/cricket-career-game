import { battingAverage, bowlingAverage, economy, strikeRate } from '@/engine/records';
import { cn } from '@/lib/cn';
import type { FormatRecord } from '@/types';

const fmt = (n: number | null, digits = 2) => (n === null || !Number.isFinite(n) ? '-' : n.toFixed(digits));

export interface RecordRow {
  key: string;
  label: string;
  record: FormatRecord;
  strong?: boolean;
}

/** Batting, bowling and fielding figures, one row per format or competition. Scrolls sideways on phones. */
export function RecordTable({ rows, caption }: { rows: RecordRow[]; caption: string }) {
  return (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={caption}>
      <table className="w-full min-w-[820px] text-left text-[12.5px]">
        <caption className="sr-only">{caption}</caption>
        <thead className="text-[11.5px] text-ink-muted">
          <tr>
            {['', 'M', 'Inn', 'NO', 'Runs', 'HS', 'Avg', 'SR', '100s', '50s', 'Wkts', 'Best', 'Avg', 'Econ', '5w', 'Ct'].map((h, i) => (
              <th key={i} scope="col" className="py-1 pr-2 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, label, record: r, strong }) => {
            const b = r.batting;
            const w = r.bowling;
            return (
              <tr key={key} className={cn('border-t border-line text-ink', strong && 'font-semibold')}>
                <th scope="row" className="py-1.5 pr-2 font-medium">{label}</th>
                <td className="py-1.5 pr-2">{b.matches}</td>
                <td className="py-1.5 pr-2">{b.innings}</td>
                <td className="py-1.5 pr-2">{b.notOuts}</td>
                <td className="py-1.5 pr-2">{b.runs}</td>
                <td className="py-1.5 pr-2">{b.highScore}{b.highScoreNotOut ? '*' : ''}</td>
                <td className="py-1.5 pr-2">{fmt(battingAverage(r))}</td>
                <td className="py-1.5 pr-2">{b.balls ? fmt(strikeRate(r), 1) : '-'}</td>
                <td className="py-1.5 pr-2">{b.hundreds + b.doubleHundreds}</td>
                <td className="py-1.5 pr-2">{b.fifties}</td>
                <td className="py-1.5 pr-2">{w.wickets}</td>
                <td className="py-1.5 pr-2">{w.bestInnings ? `${w.bestInnings.wickets}/${w.bestInnings.runs}` : '-'}</td>
                <td className="py-1.5 pr-2">{fmt(bowlingAverage(r))}</td>
                <td className="py-1.5 pr-2">{w.balls ? fmt(economy(r)) : '-'}</td>
                <td className="py-1.5 pr-2">{w.fiveWicketHauls}</td>
                <td className="py-1.5 pr-2">{r.fielding.catches}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
