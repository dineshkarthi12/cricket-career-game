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

const SeasonChart = lazy(() => import('./SeasonChart'));

const FORMAT_NAME: Record<MatchFormat, string> = { TEST: 'Tests', MULTI_DAY: 'Multi-day', ODI: 'ODIs', ONE_DAY: 'One-day', T20: 'T20' };
const FORMAT_ORDER: MatchFormat[] = ['TEST', 'MULTI_DAY', 'ODI', 'ONE_DAY', 'T20'];

const TABS = [
  { id: 'format', label: 'By format' },
  { id: 'competition', label: 'By competition' },
  { id: 'level', label: 'By level' },
  { id: 'seasons', label: 'Seasons' },
  { id: 'captaincy', label: 'Captaincy' },
];

export default function StatsScreen() {
  const state = useGameStore((s) => s.state);
  if (!state) return <p className="py-20 text-center text-[14px] text-ink-muted">Loading your career…</p>;
  return <Stats state={state} />;
}

const fmt = (n: number | null) => (n === null || !Number.isFinite(n) ? '-' : n.toFixed(2));

function Stats({ state }: { state: GameState }) {
  const [tab, setTab] = useState('format');
  const all = competitionTotals(state, Object.keys(state.player.record.byCompetition));
  const header = (
    <div>
      <h1 className="text-[22px] leading-tight font-bold text-ink">Stats</h1>
      <p className="text-[13px] text-ink-muted">Career figures by format, competition, level and season.</p>
    </div>
  );
  if (all.batting.matches === 0) {
    return (
      <div className="flex flex-col gap-3 pb-4">
        {header}
        <EmptyState icon={BarChart3} title="No matches yet" message="Your figures appear here after your first match - batting, bowling and fielding, split by format and competition." action={{ label: 'See the calendar', to: '/calendar' }} />
      </div>
    );
  }
  const byFormat: RecordRow[] = FORMAT_ORDER.filter((f) => (state.player.record.byFormat[f]?.batting.matches ?? 0) > 0).map((f) => ({ key: f, label: FORMAT_NAME[f], record: state.player.record.byFormat[f] }));
  const byCompetition: RecordRow[] = Object.entries(state.player.record.byCompetition)
    .filter(([, r]) => r.batting.matches > 0)
    .sort((a, b) => b[1].batting.matches - a[1].batting.matches)
    .map(([id, r]) => ({ key: id, label: competitionName(id), record: r }));
  const byLevel: RecordRow[] = statsByLevel(state).map((r) => ({ key: `${r.level}-${r.format}`, label: r.label, record: r.record, strong: r.level === 'INTERNATIONAL' }));
  const seasons = [...state.career.seasonReviews].sort((a, b) => a.seasonYear - b.seasonYear);
  return (
    <div className="flex flex-col gap-3 pb-4">
      {header}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Matches" value={all.batting.matches} />
        <StatTile label="Runs" value={all.batting.runs.toLocaleString('en-IN')} />
        <StatTile label="Batting avg" value={fmt(battingAverage(all))} />
        <StatTile label="Wickets" value={all.bowling.wickets} />
        <StatTile label="Bowling avg" value={fmt(bowlingAverage(all))} />
        <StatTile label="Player of the match" value={state.player.record.manOfTheMatch} />
      </div>
      <Tabs tabs={TABS} value={tab} onChange={setTab} label="Stats sections" />
      {tab === 'format' ? (
        <Card>
          <CardHeader title="By format" className="mb-2" />
          <RecordTable rows={byFormat} caption="Career figures by format" />
        </Card>
      ) : null}
      {tab === 'competition' ? (
        <Card>
          <CardHeader title="By competition" subtitle="Most matches first" className="mb-2" />
          <RecordTable rows={byCompetition} caption="Career figures by competition" />
        </Card>
      ) : null}
      {tab === 'level' ? (
        <Card>
          <CardHeader title="By level" subtitle="International, IPL, India A, senior domestic, age-group and club" className="mb-2" />
          <RecordTable rows={byLevel} caption="Career figures by level" />
        </Card>
      ) : null}
      {tab === 'seasons' ? (
        <Card>
          <CardHeader title="Season by season" className="mb-2" />
          {seasons.length === 0 ? (
            <p className="text-[13px] text-ink-muted">Each season is added here at its review, on 31 May.</p>
          ) : (
            <>
              <Suspense fallback={<div className="h-64 animate-pulse rounded-tile bg-page" />}>
                <SeasonChart data={seasons.map((s) => ({ season: s.label, runs: s.stats.runs, wickets: s.stats.wickets }))} />
              </Suspense>
              <div className="mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label="Season by season figures">
                <table className="w-full min-w-[640px] text-left text-[12.5px]">
                  <thead className="text-[11.5px] text-ink-muted">
                    <tr>
                      {['Season', 'Age', 'M', 'Runs', 'Avg', 'SR', 'Wkts', 'Avg', 'Econ', 'Rating', 'Outcome'].map((h, i) => (
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
