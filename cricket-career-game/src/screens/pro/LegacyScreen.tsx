import { useState } from 'react';
import { Badge, Card, CardHeader, Modal, ProgressBar, StatTile, Tabs } from '@/components';
import { battingAverage, bowlingAverage, economy, strikeRate } from '@/engine/records';
import { legacyRating, recordsBook, statsByLevel, competitionTotals, type LegacyPart } from '@/engine/pro/legacy';
import { retirableScopes } from '@/engine/pro/retirement';
import { totalCaps } from '@/engine/pro/national';
import { winPercent } from '@/engine/career/captaincy';
import { formatLongDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useGameStore } from '@/store/gameStore';
import { useT } from '@/i18n/react';
import type { Key } from '@/i18n/core';
import type { GameState, RetirementScope } from '@/types';

const TABS = ['stats', 'records', 'captaincy', 'timeline', 'retirement'];

/** A retirement scope as a noun ("Test cricket") and as what one retires from (the Tamil ablative). */
const scopeKey = (s: RetirementScope) => `pro.scope.${s}` as Key;
const scopeFrom = (s: RetirementScope) => `@pro.scopeFrom.${s}`;

const DOMESTIC = ['ranji-trophy', 'vijay-hazare', 'syed-mushtaq-ali', 'duleep-trophy', 'irani-cup'];

export default function LegacyScreen() {
  const state = useGameStore((s) => s.state);
  const t = useT();
  if (!state) return <p className="py-20 text-center text-[14px] text-ink-muted">{t('common.loadingCareer')}</p>;
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
  const t = useT();
  return (
    <div className="flex flex-col gap-3 pb-4">
      <div>
        <h1 className="text-[22px] leading-tight font-bold text-ink">{t('nav.legacy')}</h1>
        <p className="text-[13px] text-ink-muted">
          {done ? t('pro.lg.retired', { date: formatLongDate(state.player.retiredOn ?? state.season.currentDate), age: state.player.age }) : t('pro.lg.soFar')}
        </p>
      </div>
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-0">
            <p className="text-[12px] text-ink-muted">{t('pro.lg.rating')}</p>
            <p className="text-[26px] leading-tight font-bold break-words text-ink">{t(`pro.tier.${legacy.tier}` as Key)}</p>
          </div>
          <div className="min-w-[180px] flex-1">
            <div className="mb-1 flex justify-between gap-2 text-[12px] text-ink-muted"><span>0</span><span>{legacy.score}/100</span><span className="text-right">{t('pro.tier.ALL_TIME_GREAT')}</span></div>
            <ProgressBar value={legacy.score} tone={legacy.score >= 70 ? 'gold' : legacy.score >= 40 ? 'green' : 'blue'} height={10} label={t('pro.lg.score')} />
          </div>
        </div>
        {legacy.reasons.length ? <p className="mt-3 text-[13px] text-ink">{legacy.reasons.join(' · ')}</p> : <p className="mt-3 text-[13px] text-ink-muted">{t('pro.lg.stillWritten')}</p>}
        {legacy.score > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={t('pro.lg.where')}>
            {(Object.entries(legacy.parts) as [LegacyPart, number][]).filter(([, v]) => v >= 0.5).map(([k, v]) => (
              <li key={k}><Badge tone="grey">{t(`pro.part.${k}` as Key)} +{Math.round(v)}</Badge></li>
            ))}
          </ul>
        ) : null}
      </Card>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <StatTile label={t('stats.matches')} value={all.batting.matches} />
        <StatTile label={t('stats.runs')} value={all.batting.runs.toLocaleString('en-IN')} />
        <StatTile label={t('pro.lg.wickets')} value={all.bowling.wickets} />
        <StatTile label={t('pro.lg.indiaCaps')} value={totalCaps(state)} />
        <StatTile label={t('pro.ct.seasons')} value={state.pro.ipl.seasons.filter((s) => s.matches > 0).length} />
        <StatTile label={t('pro.lg.domesticSeasons')} value={domesticSeasons(state)} />
        <StatTile label={t('nav.awards')} value={state.pro.awards.length} />
        <StatTile label={t('pro.aw.trophies')} value={state.trophies.filter((x) => x.unlocked).length} />
      </div>
      <Tabs tabs={TABS.map((id) => ({ id, label: t(`pro.lg.tab.${id}` as Key) }))} value={tab} onChange={setTab} label={t('pro.lg.tabsLabel')} />
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
  const t = useT();
  return (
    <Card>
      <CardHeader title={t('pro.lg.statsTitle')} className="mb-2" />
      {rows.length === 0 ? <p className="text-[13px] text-ink-muted">{t('pro.lg.noMatches')}</p> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-[12.5px]">
          <thead className="text-[11.5px] text-ink-muted">
            <tr>
              {['', 'M', 'Inn', t('stats.runs'), 'HS', 'Avg', 'SR', '100s', '50s', 'Wkts', t('pro.lg.best'), 'Avg', 'Econ', '5w', 'Ct', 'St'].map((h, i) => (
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
                  <td className="py-1.5 pr-2 text-ink">{t(`pro.row.${r.level}.${r.format}` as Key)}</td>
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
  const t = useT();
  return (
    <Card>
      <CardHeader title={t('pro.lg.tab.records')} subtitle={broken.length ? t(broken.length === 1 ? 'pro.lg.broken.one' : 'pro.lg.broken.many', { n: broken.length }) : t('pro.lg.recordsSub')} className="mb-2" />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-[12.5px]">
          <thead className="text-[11.5px] text-ink-muted">
            <tr>
              <th className="py-1 pr-2 font-medium">{t('pro.lg.col.book')}</th>
              <th className="py-1 pr-2 font-medium">{t('pro.lg.col.record')}</th>
              <th className="py-1 pr-2 font-medium">{t('pro.lg.col.holder')}</th>
              <th className="py-1 pr-2 font-medium">{t('pro.lg.col.yours')}</th>
              <th className="py-1 font-medium" />
            </tr>
          </thead>
          <tbody>
            {book.map(({ def, mine, entry }) => (
              <tr key={def.id} className={cn('border-t border-line', entry?.broke && 'bg-brand-gold/10')}>
                <td className="py-1.5 pr-2 text-ink-muted">{def.book}</td>
                <td className="py-1.5 pr-2 text-ink">{def.label}</td>
                <td className="py-1.5 pr-2 text-ink">{entry?.broke ? t('player.you') : `${def.holder}, ${def.display}`}</td>
                <td className="py-1.5 pr-2 font-semibold text-ink">{entry?.value ?? (mine.value > 0 ? mine.display : '-')}</td>
                <td className="py-1.5">{entry?.broke ? <Badge tone="gold">{t('pro.lg.col.record')}</Badge> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[12px] text-ink-muted">{t('pro.lg.recordsNote')}</p>
    </Card>
  );
}

function Captaincy({ state }: { state: GameState }) {
  const l = state.pro.leadership;
  const records = Object.entries(l.records);
  const juniors = Object.entries(state.career.captaincy.byTeam).filter(([id]) => !['STATE_SENIOR', 'FRANCHISE', 'INTERNATIONAL'].includes(state.teams[id]?.level ?? ''));
  const t = useT();
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card>
        <CardHeader title={t('pro.lg.leadership')} subtitle={t(l.posts.length === 1 ? 'pro.lg.appts.one' : 'pro.lg.appts.many', { n: l.posts.length, declined: l.declined })} className="mb-2" />
        {l.posts.length === 0 ? <p className="text-[13px] text-ink-muted">{t('pro.lg.neverAppointed')}</p> : null}
        <ul className="flex flex-col gap-1.5">
          {[...l.posts].reverse().map((p, i) => (
            <li key={i} className="rounded-tile bg-page px-3 py-2 text-[13px]">
              <span className="font-semibold text-ink">{p.role === 'CAPTAIN' ? t('m.captain') : t('pro.viceCaptain')}, {p.teamName}</span>
              <span className="text-ink-muted"> · {p.until ? t('pro.lg.span', { from: formatLongDate(p.since), to: formatLongDate(p.until) }) : t('pro.lg.present', { from: formatLongDate(p.since) })}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader title={t('pro.lg.capRecord')} subtitle={t('pro.lg.capRecordSub')} className="mb-2" />
        {records.length + juniors.length === 0 ? <p className="text-[13px] text-ink-muted">{t('pro.lg.noCapMatches')}</p> : null}
        <table className="w-full text-left text-[12.5px]">
          <tbody>
            {records.map(([key, r]) => {
              const [level, format] = key.split('|');
              return (
                <tr key={key} className="border-t border-line">
                  <td className="py-1.5 pr-2 text-ink">{level === 'INDIA' ? `India ${t(format === 'TEST' ? 'pro.fmt.TEST' : format === 'ODI' ? 'pro.fmt.ODI' : 'pro.fmt.T20I')}` : level === 'IPL' ? 'IPL' : t('pro.lg.state')}</td>
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
  const t = useT();
  return (
    <Card>
      <CardHeader title={t('pro.lg.timeline')} subtitle={t('pro.lg.timelineSub')} className="mb-2" />
      <ol className="relative ml-2 border-l-2 border-line pl-4">
        {events.map((e) => (
          <li key={e.id} className="mb-2.5">
            <span className={cn('absolute -left-[7px] mt-1.5 size-3 rounded-full', e.kind === 'DEBUT' || e.kind === 'AWARD' ? 'bg-brand-gold' : e.kind === 'DROPPED' ? 'bg-brand-red' : 'bg-brand-blue')} aria-hidden />
            <p className="text-[12px] text-ink-muted">{formatLongDate(e.date)} · {t('pro.lg.age', { n: ageAt(e.date) })}</p>
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
  const t = useT();
  return (
    <Card>
      <CardHeader title={t('pro.lg.tab.retirement')} subtitle={t('pro.lg.retireSub')} className="mb-2" />
      {r.retiredFrom.length ? (
        <ul className="mb-3 flex flex-col gap-1 text-[13px]">
          {r.retiredFrom.map((s) => (
            <li key={s} className="text-ink">{t('pro.lg.retiredFrom', { scope: scopeFrom(s), date: formatLongDate(r.retiredOn[s] ?? '') })}</li>
          ))}
        </ul>
      ) : null}
      {r.overlooked.length ? <p className="mb-3 text-[13px] text-brand-red">{t('pro.lg.movedOn', { list: r.overlooked.map((s) => t(scopeKey(s))).join(', ') })}</p> : null}
      {r.complete ? (
        <p className="text-[13px] text-ink">{t('pro.lg.over')}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {scopes.map((s) => (
            <button key={s} type="button" onClick={() => setConfirm(s)} className={cn('rounded-full border px-3 py-1.5 text-[13px] font-semibold', s === 'ALL' ? 'border-brand-red bg-brand-red text-white' : 'border-line bg-surface text-ink hover:bg-page')}>
              {t('pro.lg.retireFrom', { scope: scopeFrom(s) })}
            </button>
          ))}
        </div>
      )}
      <p className="mt-3 text-[12px] text-ink-muted">
        {t('pro.lg.decline')}
      </p>
      <Modal open={confirm !== null} onClose={() => setConfirm(null)} title={confirm ? t('pro.lg.confirm', { scope: scopeFrom(confirm) }) : ''} subtitle={t('pro.lg.cannotUndo')}>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              if (confirm) retire(confirm);
              setConfirm(null);
            }}
            className="rounded-full bg-brand-red px-4 py-2 text-[13px] font-semibold text-white"
          >
            {t('pro.lg.retire')}
          </button>
          <button type="button" onClick={() => setConfirm(null)} className="rounded-full border border-line px-4 py-2 text-[13px] font-semibold text-ink">
            {t('pro.lg.notYet')}
          </button>
        </div>
      </Modal>
    </Card>
  );
}
