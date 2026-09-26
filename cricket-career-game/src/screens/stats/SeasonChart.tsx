import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface SeasonPoint {
  season: string;
  runs: number;
  wickets: number;
}

/** Runs and wickets per season. Loaded on demand with the chart library. */
export default function SeasonChart({ data }: { data: SeasonPoint[] }) {
  return (
    <div className="h-64" role="img" aria-label={`Runs and wickets per season, ${data.length} seasons`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="#E8ECF5" vertical={false} />
          <XAxis dataKey="season" tick={{ fill: '#5B6577', fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis yAxisId="runs" tick={{ fill: '#5B6577', fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis yAxisId="wkts" orientation="right" tick={{ fill: '#5B6577', fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: 'rgb(30 94 240 / 0.06)' }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="runs" dataKey="runs" name="Runs" fill="#1E5EF0" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          <Bar yAxisId="wkts" dataKey="wickets" name="Wickets" fill="#22A45D" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
