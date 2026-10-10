import { lazy, Suspense, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { Card, CardHeader, EmptyState, StatTile, Tabs } from '@/components';
import { battingAverage, bowlingAverage } from '@/engine/records';
import { competitionTotals, statsByLevel } from '@/engine/pro/legacy';
import { competitionName } from '@/lib/pro';
import { useGameStore } from '@/store/gameStore';
import { CaptaincyCard } from './CaptaincyCard';
import { RecordTable, type RecordRow } from './RecordTable';
import type { GameState, MatchFormat } from '@/types';
import { isKey, tr, type Key } from '@/i18n/core';
import { useT } from '@/i18n/react';

const SeasonChart = lazy(() => import('./SeasonChart'));

const FORMAT_ORDER: MatchFormat[] = ['TEST', 'MULTI_DAY', 'ODI', 'ONE_DAY', 'T20'];

const TABS = ['format', 'competition', 'level', 'seasons', 'captaincy'] as const;

export default function StatsScreen() {
  const state = useGameStore((s) => s.state);
  const t = useT();
  if (!state) return <p className="py-20 text-center text-[14px] text-ink-muted">{t('common.loadingCareer')}</p>;
  return <Stats state={state} />;
}

/** A level-and-format row name, e.g. "Senior domestic List A". */
function levelLabel(level: string, format: string, english: string): string {
  const key = `misc.stats.lvl.${level}.${format}`;
  return isKey(key) ? tr(key) : english;
}

const fmt = (n: number | null) => (n === null || !Number.isFinite(n) ? '-' : n.toFixed(2));

function Stats({ state }: { state: GameState }) {
  const [tab, setTab] = useState('format');
  const t = useT();
  const all = competitionTotals(state, Object.keys(state.player.record.byCompetition));
  const header = (
    <div>
      <h1 className="text-[22px] leading-tight font-bold text-ink">{t('misc.stats.title')}</h1>
      <p className="text-[13px] text-ink-muted">{t('misc.stats.intro')}</p>
    </div>
  );
  if (all.batting.matches === 0) {
    return (
      <div className="flex flex-col gap-3 pb-4">
        {header}
        <EmptyState icon={BarChart3} title={t('misc.stats.noMatches')} message={t('misc.stats.noMatchesBody')} action={{ label: t('misc.stats.seeCalendar'), to: '/calendar' }} />
      </div>
    );
  }
  const byFormat: RecordRow[] = FORMAT_ORDER.filter((f) => (state.player.record.byFormat[f]?.batting.matches ?? 0) > 0).map((f) => ({ key: f, label: t(`misc.stats.fmt.${f}` as Key), record: state.player.record.byFormat[f] }));
  const byCompetition: RecordRow[] = Object.entries(state.player.record.byCompetition)
    .filter(([, r]) => r.batting.matches > 0)
    .sort((a, b) => b[1].batting.matches - a[1].batting.matches)
    .map(([id, r]) => ({ key: id, label: competitionName(id), record: r }));
  const byLevel: RecordRow[] = statsByLevel(state).map((r) => ({ key: `${r.level}-${r.format}`, label: levelLabel(r.level, r.format, r.label), record: r.record, strong: r.level === 'INTERNATIONAL' }));
  const seasons = [...state.career.seasonReviews].sort((a, b) => a.seasonYear - b.seasonYear);
  return (
    <div className="flex flex-col gap-3 pb-4">
      {header}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label={t('misc.stats.matches')} value={all.batting.matches} />
        <StatTile label={t('misc.stats.runs')} value={all.batting.runs.toLocaleString('en-IN')} />
        <StatTile label={t('misc.stats.batAvg')} value={fmt(battingAverage(all))} />
        <StatTile label={t('misc.stats.wickets')} value={all.bowling.wickets} />
        <StatTile label={t('misc.stats.bowlAvg')} value={fmt(bowlingAverage(all))} />
        <StatTile label={t('misc.stats.potm')} value={state.player.record.manOfTheMatch} />
      </div>
      <Tabs tabs={TABS.map((id) => ({ id, label: t(`misc.stats.tab.${id}`) }))} value={tab} onChange={setTab} label={t('misc.stats.sections')} />
      {tab === 'format' ? (
        <Card>
          <CardHeader title={t('misc.stats.tab.format')} className="mb-2" />
          <RecordTable rows={byFormat} caption={t('misc.stats.byFormatCaption')} />
        </Card>
      ) : null}
      {tab === 'competition' ? (
        <Card>
          <CardHeader title={t('misc.stats.tab.competition')} subtitle={t('misc.stats.mostFirst')} className="mb-2" />
          <RecordTable rows={byCompetition} caption={t('misc.stats.byCompetitionCaption')} />
        </Card>
      ) : null}
      {tab === 'level' ? (
        <Card>
          <CardHeader title={t('misc.stats.tab.level')} subtitle={t('misc.stats.levelHint')} className="mb-2" />
          <RecordTable rows={byLevel} caption={t('misc.stats.byLevelCaption')} />
        </Card>
      ) : null}
      {tab === 'seasons' ? (
        <Card>
          <CardHeader title={t('misc.stats.bySeason')} className="mb-2" />
          {seasons.length === 0 ? (
            <p className="text-[13px] text-ink-muted">{t('misc.stats.seasonsLater')}</p>
          ) : (
            <>
              <Suspense fallback={<div className="h-64 animate-pulse rounded-tile bg-page" />}>
                <SeasonChart data={seasons.map((s) => ({ season: s.label, runs: s.stats.runs, wickets: s.stats.wickets }))} />
              </Suspense>
              <div className="mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label={t('misc.stats.seasonFigures')}>
                <table className="w-full min-w-[640px] text-left text-[12.5px]">
                  <thead className="text-[11.5px] text-ink-muted">
                    <tr>
                      {[
                        t('misc.stats.col.season'),
                        t('misc.stats.col.age'),
                        'M',
                        t('misc.stats.col.runs'),
                        'Avg',
                        'SR',
                        t('misc.stats.col.wkts'),
                        'Avg',
                        'Econ',
                        t('misc.stats.col.rating'),
                        t('misc.stats.col.outcome'),
                      ].map((h, i) => (
                        <th key={`${h}-${i}`} scope="col" className="py-1 pr-2 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...seasons].reverse().map((s) => (
                      <tr key={s.seasonYear} className="border-t border-line text-ink">
                        <th scope="row" className="py-1.5 pr-2 font-medium">{s.label}</th>
                        <td className="py-1.5 pr-2">{s.age}</td>
                        <td className="py-1.5 pr-2">{s.stats.matches}</td>
                        <td className="py-1.5 pr-2">{s.stats.runs}</td>
                        <td className="py-1.5 pr-2">{fmt(s.stats.average)}</td>
                        <td className="py-1.5 pr-2">{s.stats.strikeRate === null ? '-' : s.stats.strikeRate.toFixed(1)}</td>
                        <td className="py-1.5 pr-2">{s.stats.wickets}</td>
                        <td className="py-1.5 pr-2">{fmt(s.stats.bowlingAverage)}</td>
                        <td className="py-1.5 pr-2">{fmt(s.stats.economy)}</td>
                        <td className="py-1.5 pr-2">{s.stats.averageRating.toFixed(1)}</td>
                        <td className="py-1.5 pr-2">{s.headline}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      ) : null}
      {tab === 'captaincy' ? <CaptaincyCard state={state} /> : null}
    </div>
  );
}
