/** The office: staff, contracts and retention, finances and budgets, news and negotiations. */
import { useState } from 'react';
import { Newspaper } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, ConfirmDialog, EmptyState, ProgressBar, Tabs } from '@/components';
import {
  MANAGER,
  contractsOpen,
  developStaff,
  expiringContracts,
  financeReport,
  forecast,
  hireStaff,
  isMegaAuction,
  offerRenewal,
  releasePlayer,
  releaseStaff,
  renewalAsking,
  setBudgets,
  squadOf,
  staffCost,
  produce,
} from '@/engine/manager';
import type { LedgerEntry } from '@/types/manager';
import { cn } from '@/lib/cn';
import { rich, useT } from '@/i18n/react';
import { Button, DataTable, LockedNotice, Money, PageHeader, RoleTag, ToneBadge, nameOf, useManager } from './ui';

export function StaffScreen() {
  const t = useT();
  const { state, apply } = useManager();
  const [release, setRelease] = useState<string | null>(null);
  const cost = staffCost(state);
  return (
    <div className="flex flex-col gap-3 pb-4">
      <PageHeader title={t('mgr.nav.staff')} subtitle={t('mgr.staff.sub')} />
      <LockedNotice responsibility="STAFF" state={state} />
      <Card>
        <div className="mb-1 flex justify-between text-[12.5px]"><span className="text-ink-muted">{t('mgr.staff.wages')}</span><span className="font-semibold">{rich(t('mgr.scout.spentOf'), { spent: <Money lakh={cost} />, budget: <Money lakh={state.finances.budgets.staff} /> })}</span></div>
        <ProgressBar value={(cost / Math.max(1, state.finances.budgets.staff)) * 100} tone={cost > state.finances.budgets.staff * 0.9 ? 'orange' : 'blue'} label={t('mgr.staff.budget')} />
      </Card>
      <Card>
        <CardHeader title={t('mgr.staff.backroom')} className="mb-2" />
        <DataTable caption={t('mgr.nav.staff')} head={[t('mgr.col.name'), t('mgr.col.role'), t('mgr.col.quality'), t('mgr.col.salary'), '']}>
          {state.staff.map((s) => (
            <tr key={s.id} className="border-b border-line/60 last:border-0">
              <td className="px-2 py-2 font-semibold text-ink">{s.name}</td>
              <td className="px-2 py-2">{t(`mgr.staffKind.${s.kind}`)}</td>
              <td className="px-2 py-2"><ToneBadge tone={s.quality >= 75 ? 'green' : s.quality >= 55 ? 'blue' : 'orange'}>{s.quality}</ToneBadge></td>
              <td className="px-2 py-2"><Money lakh={s.salary} /></td>
              <td className="px-2 py-2">
                <div className="flex gap-1.5">
                  <Button variant="ghost" className="min-h-9 px-3" onClick={() => apply(developStaff(state, s.id), t('mgr.staff.courseToast', { name: s.name }))}>{t('mgr.staff.course')}</Button>
                  <Button variant="secondary" className="min-h-9 px-3" onClick={() => setRelease(s.id)}>{t('mgr.release')}</Button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      </Card>
      <Card>
        <CardHeader title={t('mgr.staff.hireTitle')} subtitle={t('mgr.staff.hireSub')} className="mb-2" />
        <DataTable caption={t('mgr.staff.market')} head={[t('mgr.col.name'), t('mgr.col.role'), t('mgr.col.quality'), t('mgr.col.salary'), '']}>
          {state.staffMarket.map((s) => (
            <tr key={s.id} className="border-b border-line/60 last:border-0">
              <td className="px-2 py-2 font-semibold text-ink">{s.name}</td>
              <td className="px-2 py-2">{t(`mgr.staffKind.${s.kind}`)}</td>
              <td className="px-2 py-2">{s.quality}</td>
              <td className="px-2 py-2"><Money lakh={s.salary} /></td>
              <td className="px-2 py-2"><Button className="min-h-9 px-3" onClick={() => apply(hireStaff(state, s.id))}>{t('mgr.staff.hire')}</Button></td>
            </tr>
          ))}
        </DataTable>
      </Card>
      <ConfirmDialog
        open={release !== null}
        danger
        title={t('mgr.staff.releaseTitle')}
        message={t('mgr.staff.releaseBody')}
        confirmLabel={t('mgr.release')}
        onCancel={() => setRelease(null)}
        onConfirm={() => {
          if (release) apply(releaseStaff(state, release));
          setRelease(null);
        }}
      />
    </div>
  );
}

export function ContractsScreen() {
  const t = useT();
  const { state, apply } = useManager();
  const [release, setRelease] = useState<string | null>(null);
  const [offers, setOffers] = useState<Record<string, { salary: string; years: number }>>({});
  const squad = squadOf(state, state.franchiseId).sort((a, b) => (b.contract?.salary ?? 0) - (a.contract?.salary ?? 0));
  const expiring = new Set(expiringContracts(state));
  const nextMega = isMegaAuction(state.season.year + 1);
  const payroll = squad.reduce((n, p) => n + (p.contract?.salary ?? 0), 0);
  return (
    <div className="flex flex-col gap-3 pb-4">
      <PageHeader title={t('mgr.con.title')} subtitle={`${t('mgr.con.payroll', { cr: (payroll / 100).toFixed(2) })} · ${contractsOpen(state) ? t('mgr.con.open') : t('mgr.con.closed')}`} />
      <LockedNotice responsibility="CONTRACTS" state={state} />
      {state.season.phase === 'SEASON_END' ? (
        <p role="note" className="rounded-card bg-brand-blue-soft px-4 py-3 text-[13px] text-ink">
          {nextMega ? t('mgr.con.megaNext') : t('mgr.con.renewHint')}
        </p>
      ) : null}
      <Card>
        <DataTable caption={t('mgr.nav.contracts')} head={[t('mgr.col.player'), t('mgr.col.role'), t('mgr.col.salary'), t('mgr.col.yearsLeft'), t('mgr.col.signed'), t('mgr.col.status'), '']}>
          {squad.map((p) => {
            const c = p.contract!;
            const ending = expiring.has(p.id);
            const draft = offers[p.id] ?? { salary: String(renewalAsking(state, p.id)), years: 2 };
            return (
              <tr key={p.id} className="border-b border-line/60 last:border-0">
                <td className="px-2 py-2 font-semibold text-ink">{p.name}</td>
                <td className="px-2 py-2"><RoleTag player={p} /></td>
                <td className="px-2 py-2"><Money lakh={c.salary} /></td>
                <td className="px-2 py-2">{c.years}</td>
                <td className="px-2 py-2 text-[12px]">{c.signedSeason} · {t(`mgr.via.${c.via}`)}</td>
                <td className="px-2 py-2">{ending ? <ToneBadge tone="orange">{t('mgr.con.ending')}</ToneBadge> : <ToneBadge tone="green">{t('mgr.con.under')}</ToneBadge>}</td>
                <td className="px-2 py-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {ending && state.season.phase === 'SEASON_END' && !nextMega ? (
                      <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); apply(offerRenewal(state, p.id, Number(draft.salary) || 0, draft.years)); }}>
                        <label className="sr-only" htmlFor={`renew-${p.id}`}>{t('mgr.con.salaryFor', { name: p.name })}</label>
                        <input id={`renew-${p.id}`} inputMode="numeric" value={draft.salary} onChange={(e) => setOffers({ ...offers, [p.id]: { ...draft, salary: e.target.value.replace(/\D/g, '') } })} className="min-h-9 w-16 rounded-lg border border-line px-2 text-[12.5px]" />
                        <label className="sr-only" htmlFor={`years-${p.id}`}>{t('mgr.con.years')}</label>
                        <select id={`years-${p.id}`} value={draft.years} onChange={(e) => setOffers({ ...offers, [p.id]: { ...draft, years: Number(e.target.value) } })} className="min-h-9 rounded-lg border border-line px-1 text-[12.5px]">
                          {[1, 2, 3].map((y) => <option key={y} value={y}>{t('mgr.yearsShort', { n: y })}</option>)}
                        </select>
                        <Button type="submit" className="min-h-9 px-3">{t('mgr.con.renew')}</Button>
                      </form>
                    ) : null}
                    <Button variant="secondary" className="min-h-9 px-3" disabled={!contractsOpen(state)} onClick={() => setRelease(p.id)}>{t('mgr.release')}</Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </DataTable>
      </Card>
      <Card>
        <CardHeader title={t('mgr.con.negotiations')} className="mb-2" />
        {state.negotiations.length === 0 ? (
          <p className="text-[13px] text-ink-muted">{t('mgr.con.noNeg')}</p>
        ) : (
          <ul className="grid gap-1.5 text-[13px]">
            {state.negotiations.slice(0, 15).map((n) => (
              <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-page px-3 py-2">
                <span>{nameOf(state, n.playerId)} · {t(`mgr.negKind.${n.kind}`)} · {rich(t('mgr.con.offered'), { offered: <Money lakh={n.offeredSalary} />, asking: <Money lakh={n.asking} /> })}</span>
                <ToneBadge tone={n.status === 'ACCEPTED' ? 'green' : n.status === 'REJECTED' ? 'red' : n.status === 'COUNTERED' ? 'orange' : 'grey'}>{t(`mgr.negStatus.${n.status}`)}</ToneBadge>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <ConfirmDialog
        open={release !== null}
        danger
        title={t('mgr.con.releaseTitle', { name: release ? nameOf(state, release) : '' })}
        message={t('mgr.con.releaseBody')}
        confirmLabel={t('mgr.release')}
        onCancel={() => setRelease(null)}
        onConfirm={() => {
          if (release) apply(releasePlayer(state, release));
          setRelease(null);
        }}
      />
      <p className="text-[12px] text-ink-muted">{t('mgr.con.limits', { min: MANAGER.rules.squadMin, max: MANAGER.rules.squadMax, os: MANAGER.rules.overseasSquadMax })}</p>
    </div>
  );
}

/** A ledger entry's kind, in the current language. */
const kindLabel = (t: ReturnType<typeof useT>, kind: LedgerEntry['kind']) => t(`mgr.ledger.${kind}`);

export function FinancesScreen() {
  const t = useT();
  const { state, apply } = useManager();
  const report = financeReport(state);
  const fc = forecast(state);
  const [budgets, setBudgetDraft] = useState(state.finances.budgets);
  const seasons = Array.from(new Set(state.finances.ledger.map((e) => e.season))).sort((a, b) => b - a);
  return (
    <div className="flex flex-col gap-3 pb-4">
      <PageHeader title={t('mgr.nav.finances')} subtitle={t('mgr.fin.sub')} />
      <div className="grid gap-3 md:grid-cols-4">
        <Card><p className="text-[12px] text-ink-muted">{t('mgr.balance')}</p><p className="text-[20px] font-bold"><Money lakh={state.finances.balance} className={state.finances.balance < 0 ? 'text-brand-red' : ''} /></p></Card>
        <Card><p className="text-[12px] text-ink-muted">{t('mgr.fin.income', { year: state.season.year })}</p><p className="text-[20px] font-bold text-brand-green"><Money lakh={report.income} /></p></Card>
        <Card><p className="text-[12px] text-ink-muted">{t('mgr.fin.spending', { year: state.season.year })}</p><p className="text-[20px] font-bold text-brand-red"><Money lakh={report.spending} /></p></Card>
        <Card><p className="text-[12px] text-ink-muted">{t('mgr.fin.forecast')}</p><p className={cn('text-[20px] font-bold', fc.profit < 0 ? 'text-brand-red' : 'text-brand-green')}><Money lakh={fc.profit} /></p><p className="text-[11.5px] text-ink-muted">{t('mgr.fin.endBalance')} <Money lakh={fc.endBalance} /></p></Card>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('mgr.fin.where')} className="mb-2" />
          <ul className="grid gap-1">
            {Object.entries(report.byKind).sort((a, b) => a[1] - b[1]).map(([kind, amount]) => (
              <li key={kind} className="flex justify-between border-b border-line/60 py-1.5 text-[13px] last:border-0">
                <span>{kindLabel(t, kind as LedgerEntry['kind'])}</span>
                <Money lakh={amount} className={amount < 0 ? 'text-brand-red' : 'text-brand-green'} />
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title={t('mgr.resp.FINANCE')} subtitle={t('mgr.fin.budgetsSub')} className="mb-2" />
          <LockedNotice responsibility="FINANCE" state={state} />
          <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); apply(setBudgets(state, budgets), t('mgr.fin.budgetsToast')); }}>
            {(['scouting', 'development', 'staff'] as const).map((k) => (
              <label key={k} className="flex items-center justify-between gap-2 text-[13px] capitalize">
                {t(`mgr.fin.dept.${k}`)}
                <input inputMode="numeric" value={budgets[k]} onChange={(e) => setBudgetDraft({ ...budgets, [k]: Number(e.target.value.replace(/\D/g, '')) || 0 })} className="min-h-10 w-28 rounded-lg border border-line px-2 text-right text-[13px]" />
              </label>
            ))}
            <Button type="submit" className="mt-1">{t('mgr.fin.saveBudgets')}</Button>
          </form>
        </Card>
      </div>
      <Card>
        <CardHeader title={t('mgr.fin.ledger')} className="mb-2" />
        <DataTable caption={t('mgr.fin.transactions')} head={[t('mgr.col.season'), t('mgr.col.item'), t('mgr.col.type'), t('mgr.col.amount')]}>
          {[...state.finances.ledger].reverse().slice(0, 60).map((e) => (
            <tr key={e.id} className="border-b border-line/60 last:border-0">
              <td className="px-2 py-1.5">{e.season}</td>
              <td className="px-2 py-1.5">{e.note}</td>
              <td className="px-2 py-1.5">{kindLabel(t, e.kind)}</td>
              <td className="px-2 py-1.5"><Money lakh={e.amount} className={e.amount < 0 ? 'text-brand-red' : 'text-brand-green'} /></td>
            </tr>
          ))}
        </DataTable>
        {seasons.length > 1 ? <p className="mt-2 text-[12px] text-ink-muted">{t('mgr.fin.past')}: {seasons.slice(1).map((s) => `${s}: ${financeReport(state, s).profit >= 0 ? '+' : ''}${financeReport(state, s).profit} L`).join(' · ')}</p> : null}
      </Card>
    </div>
  );
}

export function NewsScreen() {
  const t = useT();
  const { state, replace } = useManager();
  const [kind, setKind] = useState('ALL');
  const list = state.news.filter((n) => kind === 'ALL' || n.kind === kind);
  const markAll = () => replace(produce(state, (d) => d.news.forEach((n) => (n.read = true))));
  return (
    <div className="flex flex-col gap-3 pb-4">
      <PageHeader title={t('mgr.news.title')}>
        <Button variant="secondary" onClick={markAll}>{t('mgr.news.markAll')}</Button>
      </PageHeader>
      <Tabs label={t('mgr.news.filter')} value={kind} onChange={setKind} tabs={[{ id: 'ALL', label: t('mgr.news.tab.ALL') }, { id: 'BOARD', label: t('mgr.news.tab.BOARD') }, { id: 'SCOUTING', label: t('mgr.news.tab.SCOUTING') }, { id: 'AUCTION', label: t('mgr.news.tab.AUCTION') }, { id: 'MATCH', label: t('mgr.news.tab.MATCH') }, { id: 'CONTRACT', label: t('mgr.news.tab.CONTRACT') }, { id: 'CAREER', label: t('mgr.news.tab.CAREER') }]} />
      {list.length === 0 ? (
        <EmptyState icon={Newspaper} title={t('mgr.news.empty')} message={t('mgr.news.emptyBody')} />
      ) : (
        <ul className="grid gap-2">
          {list.map((n) => (
            <li key={n.id}>
              <Card className={cn('py-3', !n.read && 'border-brand-blue/40')}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={cn('text-[14px] text-ink', !n.read && 'font-semibold')}>{n.title}{!n.read ? <span className="sr-only"> {t('mgr.news.unread')}</span> : null}</p>
                    <p className="mt-0.5 text-[13px] text-ink-muted">{n.body}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ToneBadge tone="grey">{t(`mgr.newsKind.${n.kind}`)} · {n.season}</ToneBadge>
                    {n.route ? (
                      <Link to={n.route} onClick={() => replace(produce(state, (d) => { const x = d.news.find((y) => y.id === n.id); if (x) x.read = true; }))} className="text-[12.5px] font-semibold text-brand-blue">{t('mgr.news.open')}</Link>
                    ) : null}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
