import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { followersText } from '@/engine/pro/fans';
import { formatDayMonth } from '@/lib/format';
import { useT } from '@/i18n/react';
import type { FollowerPoint } from '@/types';

/** The following, match by match. One series, so no legend: the card title names it. Loaded on demand. */
export default function FollowersChart({ data }: { data: FollowerPoint[] }) {
  const t = useT();
  // A time axis: points sit by date, ticks fall on 1 January.
  const points = data.map((p) => ({ ...p, at: Date.parse(p.date), label: formatDayMonth(p.date), year: p.date.slice(0, 4) }));
  const first = Number(data[0].date.slice(0, 4));
  const last = Number(data[data.length - 1].date.slice(0, 4));
  const step = Math.max(1, Math.ceil((last - first) / 5));
  const ticks: number[] = [];
  for (let y = first + 1; y <= last; y += step) ticks.push(Date.UTC(y, 0, 1));
  return (
    <div className="h-56" role="img" aria-label={t('pro.com.growth')}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -4 }}>
          <defs>
            <linearGradient id="followers-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1E5EF0" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#1E5EF0" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#E8ECF5" vertical={false} />
          <XAxis dataKey="at" type="number" scale="time" domain={['dataMin', 'dataMax']} ticks={ticks} tickFormatter={(v: number) => String(new Date(v).getUTCFullYear())} tick={{ fill: '#5B6577', fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={(v: number) => followersText(v)} tick={{ fill: '#5B6577', fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
          <Tooltip
            cursor={{ stroke: '#5B6577', strokeDasharray: '3 3' }}
            formatter={(v) => [followersText(Number(v ?? 0)), t('pro.com.followers')]}
            labelFormatter={(_, payload) => {
              const p = payload?.[0]?.payload as { label: string; year: string } | undefined;
              return p ? `${p.label} ${p.year}` : '';
            }}
          />
          <Area type="monotone" dataKey="followers" stroke="#1E5EF0" strokeWidth={2} fill="url(#followers-fill)" dot={false} activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
