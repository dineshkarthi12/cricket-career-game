import { useState } from 'react';
import { Card, CardHeader, StatTile, Tabs } from '@/components';
import { statsForTab, statsTabs } from '@/lib/selectors';
import { decimal } from '@/lib/format';
import type { GameState } from '@/types';

/** Season figures, split by the level and format they were made in. */
export function PlayerStatsCard({ state }: { state: GameState }) {
  const tabs = statsTabs(state);
  const [active, setActive] = useState(tabs[0]?.id ?? 'overall');
  const tab = tabs.find((t) => t.id === active) ?? tabs[0];
  const stats = statsForTab(state, tab);
  const seasonBest = state.season.summary.matches > 0 ? stats.highScore : 0;

  return (
    <Card>
      <CardHeader
        title="Player Stats"
        titleSuffix="(Current Season)"
        action={{ label: 'View All', to: '/stats' }}
        className="mb-2.5"
      />
      <Tabs
        tabs={tabs.map(({ id, label }) => ({ id, label }))}
        value={tab.id}
        onChange={setActive}
        label="Statistics level"
        className="mb-2"
      />
      <div className="grid grid-cols-4 gap-1">
        <StatTile label="Matches" value={stats.matches} />
        <StatTile label="Runs" value={stats.runs} />
        <StatTile label="Average" value={decimal(stats.average)} />
        <StatTile label="Strike Rate" value={decimal(stats.strikeRate)} />
        <StatTile label="50s" value={stats.fifties} />
        <StatTile label="100s" value={stats.hundreds} />
        <StatTile label="Best" value={seasonBest} />
        <StatTile label="High Score" value={stats.highScore} />
      </div>
    </Card>
  );
}
