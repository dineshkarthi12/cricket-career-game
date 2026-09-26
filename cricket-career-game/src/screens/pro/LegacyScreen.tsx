import { useState } from 'react';
import { Badge, Card, CardHeader, Modal, ProgressBar, StatTile, Tabs } from '@/components';
import { battingAverage, bowlingAverage, economy, strikeRate } from '@/engine/records';
import { LEGACY_PART_LABEL, legacyRating, recordsBook, statsByLevel, competitionTotals, type LegacyPart } from '@/engine/pro/legacy';
import { SCOPE_LABEL, retirableScopes } from '@/engine/pro/retirement';
import { totalCaps } from '@/engine/pro/national';
import { winPercent } from '@/engine/career/captaincy';
import { formatLongDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useGameStore } from '@/store/gameStore';
import type { GameState, RetirementScope } from '@/types';

const TABS = [
  { id: 'stats', label: 'Career statistics' },
  { id: 'records', label: 'Records book' },
  { id: 'captaincy', label: 'Captaincy' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'retirement', label: 'Retirement' },
];

const DOMESTIC = ['ranji-trophy', 'vijay-hazare', 'syed-mushtaq-ali', 'duleep-trophy', 'irani-cup'];

export default function LegacyScreen() {
  const state = useGameStore((s) => s.state);
  if (!state) return <p className="py-20 text-center text-[14px] text-ink-muted">Loading your career…</p>;
  return <Legacy state={state} />;
}

function domesticSeasons(state: GameState): number {
  const seasons = new Set<number>();
  for (const m of Object.values(state.matches)) if (m.userPerformance && DOMESTIC.includes(m.tournamentId)) seasons.add(m.seasonYear);
  return seasons.size;
}

function Legacy({ state }: { state: GameState }) {
  const [tab, setTab] = useState('stats');
  const legacy = legacyRating(state);
  const all = competitionTotals(state, Object.keys(state.player.record.byCompetition));
  const done = state.pro.retirement.complete;
  return (
    <div className="flex flex-col gap-3 pb-4">
      <div>
        <h1 className="text-[22px] leading-tight font-bold text-ink">Legacy</h1>
        <p className="text-[13px] text-ink-muted">
          {done ? `Retired on ${formatLongDate(state.player.retiredOn ?? state.season.currentDate)}, aged ${state.player.age}. This is what the career added up to.` : 'What the career adds up to so far - and when the time comes, how it ends.'}
        </p>
      </div>
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-[12px] text-ink-muted">Legacy rating</p>
            <p className="text-[26px] leading-tight font-bold text-ink">{legacy.label}</p>
          </div>
          <div className="min-w-[180px] flex-1">
            <div className="mb-1 flex justify-between text-[12px] text-ink-muted"><span>0</span><span>{legacy.score}/100</span><span>All-Time Great</span></div>
            <ProgressBar value={legacy.score} tone={legacy.score >= 70 ? 'gold' : legacy.score >= 40 ? 'green' : 'blue'} height={10} label="Legacy score" />
          </div>
        </div>
        {legacy.reasons.length ? <p className="mt-3 text-[13px] text-ink">{legacy.reasons.join(' · ')}</p> : <p className="mt-3 text-[13px] text-ink-muted">A career still being written.</p>}
        {legacy.score > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Where the legacy score comes from">
            {(Object.entries(legacy.parts) as [LegacyPart, number][]).filter(([, v]) => v >= 0.5).map(([k, v]) => (
              <li key={k}><Badge tone="grey">{LEGACY_PART_LABEL[k]} +{Math.round(v)}</Badge></li>
            ))}
          </ul>
        ) : null}
      </Card>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <StatTile label="Matches" value={all.batting.matches} />
        <StatTile label="Runs" value={all.batting.runs.toLocaleString('en-IN')} />
        <StatTile label="Wickets" value={all.bowling.wickets} />
        <StatTile label="India caps" value={totalCaps(state)} />
        <StatTile label="IPL seasons" value={state.pro.ipl.seasons.filter((s) => s.matches > 0).length} />
        <StatTile label="Domestic seasons" value={domesticSeasons(state)} />
        <StatTile label="Awards" value={state.pro.awards.length} />
        <StatTile label="Trophies" value={state.trophies.filter((t) => t.unlocked).length} />
      </div>
      <Tabs tabs={TABS} value={tab} onChange={setTab} label="Legacy sections" />
      {tab === 'stats' ? <Stats state={state} /> : null}
      {tab === 'records' ? <Records state={state} /> : null}
      {tab === 'captaincy' ? <Captaincy state={state} /> : null}
      {tab === 'timeline' ? <Timeline state={state} /> : null}
      {tab === 'retirement' ? <Retirement state={state} /> : null}
    </div>
  );
}

const fmt = (n: number | null, digits = 2) => (n === null || !Number.isFinite(n) ? '-' : n.toFixed(digits));

function Stats({ state }: { state: GameState }) {
  const rows = statsByLevel(state);
  return (
    <Card>
      <CardHeader title="Statistics by level and format" className="mb-2" />
      {rows.length === 0 ? <p className="text-[13px] text-ink-muted">No matches yet.</p> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-[12.5px]">
          <thead className="text-[11.5px] text-ink-muted">
            <tr>
              {['', 'M', 'Inn', 'Runs', 'HS', 'Avg', 'SR', '100s', '50s', 'Wkts', 'Best', 'Avg', 'Econ', '5w', 'Ct', 'St'].map((h, i) => (
                <th key={i} className="py-1 pr-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const b = r.record.batting;
              const w = r.record.bowling;
              return (
                <tr key={`${r.level}-${r.format}`} className={cn('border-t border-line', r.level === 'INTERNATIONAL' && 'font-semibold')}>
                  <td className="py-1.5 pr-2 text-ink">{r.label}</td>
                  <td className="py-1.5 pr-2 text-ink">{b.matches}</td>
                  <td className="py-1.5 pr-2 text-ink">{b.innings}</td>
                  <td className="py-1.5 pr-2 text-ink">{b.runs}</td>
                  <td className="py-1.5 pr-2 text-ink">{b.highScore}{b.highScoreNotOut ? '*' : ''}</td>
                  <td className="py-1.5 pr-2 text-ink">{fmt(battingAverage(r.record))}</td>
                  <td className="py-1.5 pr-2 text-ink">{fmt(strikeRate(r.record), 1)}</td>
                  <td className="py-1.5 pr-2 text-ink">{b.hundreds + b.doubleHundreds}</td>
                  <td className="py-1.5 pr-2 text-ink">{b.fifties}</td>
                  <td className="py-1.5 pr-2 text-ink">{w.wickets}</td>
                  <td className="py-1.5 pr-2 text-ink">{w.bestInnings ? `${w.bestInnings.wickets}/${w.bestInnings.runs}` : '-'}</td>
                  <td className="py-1.5 pr-2 text-ink">{fmt(bowlingAverage(r.record))}</td>
                  <td className="py-1.5 pr-2 text-ink">{w.balls ? fmt(economy(r.record)) : '-'}</td>
                  <td className="py-1.5 pr-2 text-ink">{w.fiveWicketHauls}</td>
                  <td className="py-1.5 pr-2 text-ink">{r.record.fielding.catches}</td>
                  <td className="py-1.5 pr-2 text-ink">{r.record.fielding.stumpings}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Records({ state }: { state: GameState }) {
  const book = recordsBook(state);
  const broken = book.filter((b) => b.entry?.broke);
  return (
    <Card>
      <CardHeader title="Records book" subtitle={broken.length ? `${broken.length} record${broken.length === 1 ? '' : 's'} broken` : 'National and league records - and how close you are'} className="mb-2" />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-[12.5px]">
          <thead className="text-[11.5px] text-ink-muted">
            <tr>
              <th className="py-1 pr-2 font-medium">Book</th>
              <th className="py-1 pr-2 font-medium">Record</th>
              <th className="py-1 pr-2 font-medium">Holder</th>
              <th className="py-1 pr-2 font-medium">Yours</th>
              <th className="py-1 font-medium" />
            </tr>
          </thead>
          <tbody>
            {book.map(({ def, mine, entry }) => (
              <tr key={def.id} className={cn('border-t border-line', entry?.broke && 'bg-brand-gold/10')}>
                <td className="py-1.5 pr-2 text-ink-muted">{def.book}</td>
                <td className="py-1.5 pr-2 text-ink">{def.label}</td>
                <td className="py-1.5 pr-2 text-ink">{entry?.broke ? 'You' : `${def.holder}, ${def.display}`}</td>
                <td className="py-1.5 pr-2 font-semibold text-ink">{entry?.value ?? (mine.value > 0 ? mine.display : '-')}</td>
                <td className="py-1.5">{entry?.broke ? <Badge tone="gold">Record</Badge> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[12px] text-ink-muted">Season records keep your best season; the others are career figures across the competitions shown.</p>
    </Card>
  );
}

function Captaincy({ state }: { state: GameState }) {
  const l = state.pro.leadership;
  const records = Object.entries(l.records);
  const juniors = Object.entries(state.career.captaincy.byTeam).filter(([id]) => !['STATE_SENIOR', 'FRANCHISE', 'INTERNATIONAL'].includes(state.teams[id]?.level ?? ''));
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card>
        <CardHeader title="Leadership" subtitle={`${l.posts.length} appointment${l.posts.length === 1 ? '' : 's'} · ${l.declined} declined`} className="mb-2" />
        {l.posts.length === 0 ? <p className="text-[13px] text-ink-muted">Never appointed. Leadership, temperament, form and seniority bring the offers.</p> : null}
        <ul className="flex flex-col gap-1.5">
          {[...l.posts].reverse().map((p, i) => (
            <li key={i} className="rounded-tile bg-page px-3 py-2 text-[13px]">
              <span className="font-semibold text-ink">{p.role === 'CAPTAIN' ? 'Captain' : 'Vice-captain'}, {p.teamName}</span>
              <span className="text-ink-muted"> · {formatLongDate(p.since)}{p.until ? ` to ${formatLongDate(p.until)}` : ' - present'}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader title="Captaincy record" subtitle="Per team and format" className="mb-2" />
        {records.length + juniors.length === 0 ? <p className="text-[13px] text-ink-muted">No matches as captain.</p> : null}
        <table className="w-full text-left text-[12.5px]">
          <tbody>
            {records.map(([key, r]) => {
              const [level, format] = key.split('|');
              return (
                <tr key={key} className="border-t border-line">
                  <td className="py-1.5 pr-2 text-ink">{level === 'INDIA' ? `India ${format === 'TEST' ? 'Tests' : format === 'ODI' ? 'ODIs' : 'T20Is'}` : level === 'IPL' ? 'IPL' : 'State'}</td>
                  <td className="py-1.5 pr-2 text-ink">P {r.matches} · W {r.won} · L {r.lost} · D {r.drawn + r.tied}</td>
                  <td className="py-1.5 text-ink">{winPercent(r) !== null ? `${winPercent(r)}%` : '-'}</td>
                </tr>
              );
            })}
            {juniors.map(([id, r]) => (
              <tr key={id} className="border-t border-line">
                <td className="py-1.5 pr-2 text-ink">{state.teams[id]?.name ?? id}</td>
                <td className="py-1.5 pr-2 text-ink">P {r.matches} · W {r.won} · L {r.lost}</td>
                <td className="py-1.5 text-ink">{winPercent(r) !== null ? `${winPercent(r)}%` : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Timeline({ state }: { state: GameState }) {
  const events = state.career.events.filter((e) => ['DEBUT', 'PROMOTION', 'CONTRACT', 'CAPTAINCY', 'AWARD', 'RETIREMENT', 'SELECTION', 'DROPPED', 'MILESTONE'].includes(e.kind));
  const dob = state.player.dateOfBirth;
  const ageAt = (date: string) => Math.floor((new Date(date).getTime() - new Date(dob).getTime()) / (365.25 * 86400000));
  return (
    <Card>
      <CardHeader title="Career timeline" subtitle="Every turning point, oldest first" className="mb-2" />
      <ol className="relative ml-2 border-l-2 border-line pl-4">
        {events.map((e) => (
          <li key={e.id} className="mb-2.5">
            <span className={cn('absolute -left-[7px] mt-1.5 size-3 rounded-full', e.kind === 'DEBUT' || e.kind === 'AWARD' ? 'bg-brand-gold' : e.kind === 'DROPPED' ? 'bg-brand-red' : 'bg-brand-blue')} aria-hidden />
            <p className="text-[12px] text-ink-muted">{formatLongDate(e.date)} · age {ageAt(e.date)}</p>
            <p className="text-[13px] text-ink"><span className="font-semibold">{e.title}</span> - {e.detail}</p>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function Retirement({ state }: { state: GameState }) {
  const retire = useGameStore((s) => s.retire);
  const [confirm, setConfirm] = useState<RetirementScope | null>(null);
  const r = state.pro.retirement;
  const scopes = retirableScopes(state);
  return (
    <Card>
      <CardHeader title="Retirement" subtitle="Your call. Retire from one format at a time, or from all cricket." className="mb-2" />
      {r.retiredFrom.length ? (
        <ul className="mb-3 flex flex-col gap-1 text-[13px]">
          {r.retiredFrom.map((s) => (
            <li key={s} className="text-ink">Retired from {SCOPE_LABEL[s]} on {formatLongDate(r.retiredOn[s] ?? '')}</li>
          ))}
        </ul>
      ) : null}
      {r.overlooked.length ? <p className="mb-3 text-[13px] text-brand-red">The selectors have moved on in: {r.overlooked.map((s) => SCOPE_LABEL[s]).join(', ')}.</p> : null}
      {r.complete ? (
        <p className="text-[13px] text-ink">The career is over. Thank you for playing it.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {scopes.map((s) => (
            <button key={s} type="button" onClick={() => setConfirm(s)} className={cn('rounded-full border px-3 py-1.5 text-[13px] font-semibold', s === 'ALL' ? 'border-brand-red bg-brand-red text-white' : 'border-line bg-surface text-ink hover:bg-page')}>
              Retire from {SCOPE_LABEL[s]}
            </button>
          ))}
        </div>
      )}
      <p className="mt-3 text-[12px] text-ink-muted">
        Age brings decline (from about 31), injuries come back, and selectors look to younger players. Many players leave Tests first and play white-ball cricket for longer. Retiring from all cricket ends the career and completes stage 20.
      </p>
      <Modal open={confirm !== null} onClose={() => setConfirm(null)} title={confirm ? `Retire from ${SCOPE_LABEL[confirm]}?` : ''} subtitle="This cannot be undone.">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              if (confirm) retire(confirm);
              setConfirm(null);
            }}
            className="rounded-full bg-brand-red px-4 py-2 text-[13px] font-semibold text-white"
          >
            Retire
          </button>
          <button type="button" onClick={() => setConfirm(null)} className="rounded-full border border-line px-4 py-2 text-[13px] font-semibold text-ink">
            Not yet
          </button>
        </div>
      </Modal>
    </Card>
  );
}
