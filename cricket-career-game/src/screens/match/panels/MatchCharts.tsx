/**
 * Worm, manhattan, over-by-over and wagon wheel. All four are built from the
 * ball log, so they work live and after the match without any extra state.
 */
import { memo, useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Ball, Innings, Venue } from '@/types';
import { WagonWheel, WAGON_LEGEND } from '../ground/WagonWheel';

export interface OverSummary {
  over: number;
  runs: number;
  wickets: number;
  cumulative: number;
}

/** Roll the ball log up into overs. */
export function overSummaries(deliveries: Ball[]): OverSummary[] {
  const byOver = new Map<number, OverSummary>();
  let running = 0;
  for (const ball of deliveries) {
    const runs = ball.runsOffBat + (ball.extras?.runs ?? 0);
    running += runs;
    const entry = byOver.get(ball.over) ?? {
      over: ball.over + 1,
      runs: 0,
      wickets: 0,
      cumulative: 0,
    };
    entry.runs += runs;
    if (ball.wicket) entry.wickets += 1;
    entry.cumulative = running;
    byOver.set(ball.over, entry);
  }
  return [...byOver.values()].sort((a, b) => a.over - b.over);
}

const AXIS = { stroke: '#8a93a6', fontSize: 10.5 };

export const Worm = memo(function Worm({
  innings,
  height = 150,
}: {
  innings: { label: string; deliveries: Ball[] }[];
  height?: number;
}) {
  const data = useMemo(() => {
    const series = innings.map((i) => overSummaries(i.deliveries));
    const overs = Math.max(0, ...series.map((s) => s.length));
    return Array.from({ length: overs }, (_, index) => {
      const row: Record<string, number> = { over: index + 1 };
      series.forEach((s, i) => {
        const point = s[index];
        if (point) row[`i${i}`] = point.cumulative;
      });
      return row;
    });
  }, [innings]);

  const colours = ['#1e5ef0', '#f59e0b', '#22a45d', '#e5484d'];

  return (
    <div style={{ height }} role="img" aria-label="Runs scored over by over">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
          <CartesianGrid stroke="#e8ecf5" vertical={false} />
          <XAxis dataKey="over" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: '1px solid #e8ecf5', fontSize: 12 }}
            labelFormatter={(over) => `Over ${over}`}
          />
          {innings.map((i, index) => (
            <Area
              key={i.label}
              type="monotone"
              dataKey={`i${index}`}
              name={i.label}
              stroke={colours[index % colours.length]}
              fill={colours[index % colours.length]}
              fillOpacity={0.1}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
});

export const Manhattan = memo(function Manhattan({
  deliveries,
  height = 150,
}: {
  deliveries: Ball[];
  height?: number;
}) {
  const data = useMemo(() => overSummaries(deliveries), [deliveries]);

  return (
    <div style={{ height }} role="img" aria-label="Runs per over, with wickets marked">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
          <CartesianGrid stroke="#e8ecf5" vertical={false} />
          <XAxis dataKey="over" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: '1px solid #e8ecf5', fontSize: 12 }}
            labelFormatter={(over) => `Over ${over}`}
          />
          <Bar dataKey="runs" name="Runs" radius={[3, 3, 0, 0]}>
            {data.map((row) => (
              <Cell key={row.over} fill={row.wickets > 0 ? '#e5484d' : '#1e5ef0'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});

/** A compact over-by-over list: runs, wickets and the balls in each over. */
export const OverByOver = memo(function OverByOver({
  deliveries,
  limit = 12,
}: {
  deliveries: Ball[];
  limit?: number;
}) {
  const overs = useMemo(() => {
    const byOver = new Map<number, Ball[]>();
    for (const ball of deliveries) {
      const list = byOver.get(ball.over) ?? [];
      list.push(ball);
      byOver.set(ball.over, list);
    }
    return [...byOver.entries()].sort((a, b) => b[0] - a[0]).slice(0, limit);
  }, [deliveries, limit]);

  if (overs.length === 0) return <p className="text-[13px] text-ink-muted">No overs bowled.</p>;

  return (
    <ul className="flex flex-col gap-1.5">
      {overs.map(([over, balls]) => {
        const runs = balls.reduce((sum, b) => sum + b.runsOffBat + (b.extras?.runs ?? 0), 0);
        const wickets = balls.filter((b) => b.wicket).length;
        return (
          <li key={over} className="flex items-center gap-2 text-[12.5px]">
            <span className="w-[26px] shrink-0 font-semibold text-ink-soft tabular-nums">
              {over + 1}
            </span>
            <span className="flex flex-1 flex-wrap gap-1">
              {balls.map((ball) => (
                <span
                  key={ball.id}
                  className={`grid size-5 place-items-center rounded text-[10.5px] font-bold ${
                    ball.wicket
                      ? 'bg-brand-red text-white'
                      : ball.isBoundarySix
                        ? 'bg-brand-gold text-brand-navy'
                        : ball.isBoundaryFour
                          ? 'bg-brand-green text-white'
                          : ball.extras
                            ? 'bg-brand-orange/20 text-brand-orange'
                            : ball.runsOffBat === 0
                              ? 'bg-page text-ink-soft'
                              : 'bg-brand-blue-soft text-brand-blue'
                  }`}
                >
                  {ball.wicket ? 'W' : ball.runsOffBat + (ball.extras?.runs ?? 0)}
                </span>
              ))}
            </span>
            <span className="shrink-0 font-semibold text-ink tabular-nums">
              {runs}
              {wickets > 0 ? <span className="text-brand-red">/{wickets}</span> : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
});

/** The wagon wheel with its legend, for the charts tab. */
export function WagonWheelPanel({
  venue,
  deliveries,
  leftHanded,
  batterId,
}: {
  venue: Venue;
  deliveries: Ball[];
  leftHanded: boolean;
  batterId?: string | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      <WagonWheel
        venue={venue}
        balls={deliveries}
        leftHanded={leftHanded}
        batterId={batterId}
        className="mx-auto h-[220px] w-auto"
      />
      <ul className="flex flex-wrap items-center justify-center gap-2.5">
        {WAGON_LEGEND.map((entry) => (
          <li key={entry.label} className="flex items-center gap-1 text-[11.5px] text-ink-muted">
            <span
              className="inline-block h-0.5 w-3.5 rounded"
              style={{ backgroundColor: entry.colour }}
            />
            {entry.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Everything the charts tab shows for one innings. */
export function chartInnings(completed: Innings[], current: Innings | null) {
  const all = current ? [...completed, current] : completed;
  return all.map((innings, index) => ({
    label: `Innings ${innings.number || index + 1}`,
    deliveries: innings.deliveries,
  }));
}
