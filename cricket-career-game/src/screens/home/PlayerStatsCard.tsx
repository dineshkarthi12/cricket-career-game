import { useT } from '@/i18n/react';
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
  const t = useT();
  const tabLabel = (id: string, label: string) =>
    id === 'overall' ? t('stats.overall') : id === 'first-class' ? t('stats.firstClass') : id === 'list-a' ? t('stats.listA') : id === 't20' ? t('stats.t20') : id === 'intl' ? t('stats.india') : label;

  return (
    <Card>
      <CardHeader
        title={t('stats.title')}
        titleSuffix={t('stats.season')}
        action={{ label: t('common.viewAll'), to: '/stats' }}
        className="mb-2.5"
      />
      <Tabs
        tabs={tabs.map(({ id, label }) => ({ id, label: tabLabel(id, label) }))}
        value={tab.id}
        onChange={setActive}
        label={t('stats.level')}
        className="mb-2"
      />
      <div className="grid grid-cols-4 gap-1">
        <StatTile label={t('stats.matches')} value={stats.matches} />
        <StatTile label={t('stats.runs')} value={stats.runs} />
        <StatTile label={t('stats.average')} value={decimal(stats.average)} />
        <StatTile label={t('stats.strikeRate')} value={decimal(stats.strikeRate)} />
        <StatTile label={t('stats.fifties')} value={stats.fifties} />
        <StatTile label={t('stats.hundreds')} value={stats.hundreds} />
        <StatTile label={t('stats.best')} value={seasonBest} />
        <StatTile label={t('stats.highScore')} value={stats.highScore} />
      </div>
    </Card>
  );
}
