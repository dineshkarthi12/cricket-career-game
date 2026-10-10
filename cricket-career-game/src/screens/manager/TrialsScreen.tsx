/** Trials and recruitment: invite unsigned players, read the results, offer development contracts. */
import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { Card, CardHeader, EmptyState } from '@/components';
import { MANAGER, acceptCounter, askingSalary, offerDevelopmentContract, runTrial, trialsLeft, trialsOpen } from '@/engine/manager';
import { cn } from '@/lib/cn';
import { useT } from '@/i18n/react';
import { Button, DataTable, Estimate, LockedNotice, PageHeader, RoleTag, ToneBadge, useManager } from './ui';

export default function TrialsScreen() {
  const t = useT();
  const { state, apply } = useManager();
  const [picked, setPicked] = useState<string[]>([]);
  const [offers, setOffers] = useState<Record<string, string>>({});
  const candidates = state.shortlist
    .map((id) => state.players[id])
    .filter((p) => p && !p.contract && !p.retired)
    .concat(Object.values(state.reports).map((r) => state.players[r.playerId]).filter((p) => p?.prospect && !p.contract && !state.shortlist.includes(p.id)))
    .slice(0, 40);
  const open = trialsOpen(state);
  const toggle = (id: string) => setPicked((x) => (x.includes(id) ? x.filter((y) => y !== id) : x.length >= 4 ? x : [...x, id]));
  const negotiations = state.negotiations.filter((n) => n.kind === 'TRIAL_OFFER').slice(0, 8);

  return (
    <div className="flex flex-col gap-3 pb-4">
      <PageHeader title={t('mgr.trials.title')} subtitle={t('mgr.trials.sub', { days: MANAGER.rules.trialsPerSeason, cost: MANAGER.rules.trialCost })} />
      <LockedNotice responsibility="TRIALS" state={state} />
      {!open ? <p role="status" className="rounded-card bg-brand-blue-soft px-4 py-3 text-[13px] text-ink">{t('mgr.trials.closed')}</p> : null}

      <Card>
        <CardHeader title={t('mgr.trials.invite')} subtitle={`${t(trialsLeft(state) === 1 ? 'mgr.trials.daysLeft.one' : 'mgr.trials.daysLeft.many', { n: trialsLeft(state) })} · ${t('mgr.trials.selected', { n: picked.length })}`} className="mb-2" />
        {candidates.length === 0 ? (
          <EmptyState icon={ClipboardList} title={t('mgr.trials.noCandidates')} message={t('mgr.trials.noCandidatesBody')} action={{ label: t('mgr.trials.goScouting'), to: '/manager/scouting' }} />
        ) : (
          <>
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {candidates.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    aria-pressed={picked.includes(p.id)}
                    onClick={() => toggle(p.id)}
                    className={cn('flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:outline-none', picked.includes(p.id) ? 'border-brand-blue bg-brand-blue-soft' : 'border-line bg-surface hover:bg-page')}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-ink">{p.name}</span>
                      <RoleTag player={p} /> <span className="text-[11.5px] text-ink-muted">· {p.age}</span>
                    </span>
                    <Estimate report={state.reports[p.id]} field="potential" />
                  </button>
                </li>
              ))}
            </ul>
            <Button className="mt-3" disabled={!open || picked.length === 0 || trialsLeft(state) === 0} onClick={() => apply(runTrial(state, picked)) && setPicked([])}>
              {t('mgr.trials.hold')}
            </Button>
          </>
        )}
      </Card>

      <Card>
        <CardHeader title={t('mgr.trials.results', { year: state.season.year })} subtitle={t('mgr.trials.devUsed', { n: state.season.developmentSignings, max: MANAGER.rules.developmentSignings })} className="mb-2" />
        {state.season.trials.length === 0 ? (
          <p className="text-[13px] text-ink-muted">{t('mgr.trials.none')}</p>
        ) : (
          <DataTable caption={t('mgr.trials.resultsCaption')} head={[t('mgr.col.player'), t('mgr.col.bat'), t('mgr.col.bowl'), t('mgr.col.field'), t('mgr.col.fitness'), t('mgr.col.verdict'), t('mgr.col.offer')]}>
            {state.season.trials.map((tr) => {
              const p = state.players[tr.playerId];
              const value = offers[tr.playerId] ?? String(askingSalary(state, tr.playerId));
              const canOffer = !p.contract && !p.capped;
              return (
                <tr key={tr.playerId} className="border-b border-line/60 last:border-0">
                  <td className="px-2 py-2 font-semibold text-ink">{p.name}</td>
                  <td className="px-2 py-2 tabular-nums">{tr.batting}</td>
                  <td className="px-2 py-2 tabular-nums">{tr.bowling > 1 ? tr.bowling : '-'}</td>
                  <td className="px-2 py-2 tabular-nums">{tr.fielding}</td>
                  <td className="px-2 py-2 tabular-nums">{tr.fitness}</td>
                  <td className="px-2 py-2">
                    <ToneBadge tone={tr.verdict === 'IMPRESSIVE' ? 'green' : tr.verdict === 'PROMISING' ? 'blue' : tr.verdict === 'ORDINARY' ? 'grey' : 'red'}>{t(`mgr.verdict.${tr.verdict}`)}</ToneBadge>
                  </td>
                  <td className="px-2 py-2">
                    {p.contract ? (
                      <span className="text-[12px] text-brand-green">{t('mgr.trials.signed')}</span>
                    ) : canOffer ? (
                      <form className="flex items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); apply(offerDevelopmentContract(state, tr.playerId, Number(value) || 0)); }}>
                        <label className="sr-only" htmlFor={`offer-${tr.playerId}`}>{t('mgr.salaryLakh')}</label>
                        <input id={`offer-${tr.playerId}`} inputMode="numeric" value={value} onChange={(e) => setOffers({ ...offers, [tr.playerId]: e.target.value.replace(/\D/g, '') })} className="min-h-10 w-16 rounded-lg border border-line px-2 text-[12.5px]" />
                        <Button type="submit" className="min-h-10 px-3" disabled={!open}>{t('mgr.col.offer')}</Button>
                      </form>
                    ) : (
                      <span className="text-[12px] text-ink-muted">{t('mgr.trials.auctionOnly')}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </Card>

      {negotiations.length ? (
        <Card>
          <CardHeader title={t('mgr.offers')} className="mb-2" />
          <ul className="grid gap-2">
            {negotiations.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-page px-3 py-2">
                <span className="text-[13px] text-ink">{n.note || state.players[n.playerId]?.name}</span>
                {n.status === 'COUNTERED' ? <Button className="min-h-9" onClick={() => apply(acceptCounter(state, n.id))}>{t('mgr.meetLakh', { n: n.counterSalary ?? 0 })}</Button> : <ToneBadge tone={n.status === 'ACCEPTED' ? 'green' : n.status === 'REJECTED' ? 'red' : 'grey'}>{t(`mgr.negStatus.${n.status}`)}</ToneBadge>}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
