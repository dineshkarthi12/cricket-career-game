/** Auction preparation: retentions, squad gaps, the pool and a maximum bid for every target. */
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Card, CardHeader, ProgressBar } from '@/components';
import { MANAGER, auctionPool, isMegaAuction, marketValue, planSummary, removeTarget, retentionCost, setTarget, squadOf, squadWeaknesses, toggleRetention } from '@/engine/manager';
import type { AuctionTarget } from '@/types/manager';
import { useT } from '@/i18n/react';
import { Button, DataTable, Estimate, LockedNotice, Money, PageHeader, RoleTag, Select, ToneBadge, useManager } from './ui';

export default function AuctionPrepScreen() {
  const t = useT();
  const { state, apply, replace } = useManager();
  const f = state.franchises[state.franchiseId];
  const mega = isMegaAuction(state.season.year);
  const plan = planSummary(state);
  const gaps = squadWeaknesses(state, f.id);
  const pool = auctionPool(state)
    .filter((p) => state.reports[p.id])
    .sort((a, b) => (state.reports[b.id]?.estOverall ?? 0) - (state.reports[a.id]?.estOverall ?? 0))
    .slice(0, 40);
  const [drafts, setDrafts] = useState<Record<string, { max: string; priority: AuctionTarget['priority'] }>>({});
  const squad = squadOf(state, f.id).sort((a, b) => marketValue(b) - marketValue(a));
  const retentionOpen = state.season.phase === 'RETENTION' && mega;
  const overseasInSquad = squad.filter((p) => p.overseas).length;

  return (
    <div className="flex flex-col gap-3 pb-4">
      <PageHeader title={t('mgr.phase.AUCTION_PREP')} subtitle={mega ? t('mgr.prep.mega') : t('mgr.prep.mini')} />
      <LockedNotice responsibility="AUCTION" state={state} />

      <div className="grid gap-3 lg:grid-cols-3">
        <Card>
          <CardHeader title={t('mgr.purse')} className="mb-2" />
          <p className="text-[22px] font-bold text-ink"><Money lakh={f.purse} /></p>
          <p className="text-[12.5px] text-ink-muted">{t('mgr.prep.squadLine', { n: f.squadIds.length, os: overseasInSquad, osMax: MANAGER.rules.overseasSquadMax, min: MANAGER.rules.squadMin, max: MANAGER.rules.squadMax })}</p>
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[12px]"><span className="text-ink-muted">{t('mgr.prep.planned')}</span><span className="font-semibold"><Money lakh={plan.committed} /></span></div>
            <ProgressBar value={(plan.committed / Math.max(1, f.purse)) * 100} tone={plan.overBudget ? 'red' : 'blue'} label={t('mgr.prep.pursePlanned')} />
            {plan.overBudget ? <p className="mt-1 text-[12px] text-brand-red" role="alert">{t('mgr.prep.overBudget')}</p> : null}
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title={t('mgr.prep.gaps')} subtitle={t('mgr.prep.gapsSub')} className="mb-2" />
          <ul className="flex flex-wrap gap-1.5">
            {gaps.map((g) => (
              <li key={g.area}>
                <ToneBadge tone={g.severity === 'OK' ? 'green' : g.severity === 'THIN' ? 'orange' : 'red'}>
                  {t(`mgr.area.${g.area}`)}: {g.note}
                </ToneBadge>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {mega ? (
        <Card>
          <CardHeader title={t('mgr.prep.retentions')} subtitle={`${t('mgr.prep.retentionsSub', { n: state.season.retentions.length, max: MANAGER.rules.maxRetentions, cost: retentionCost(state.season.retentions.length) })}${retentionOpen ? '' : ` · ${t('mgr.prep.windowClosed')}`}`} className="mb-2" />
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {squad.slice(0, 16).map((p) => {
              const on = state.season.retentions.includes(p.id);
              return (
                <li key={p.id}>
                  <button type="button" aria-pressed={on} disabled={!retentionOpen} onClick={() => apply(toggleRetention(state, p.id))} className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left disabled:opacity-60 ${on ? 'border-brand-gold bg-brand-gold/15' : 'border-line bg-surface hover:bg-page'}`}>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-ink">{p.name}</span>
                      <RoleTag player={p} />
                    </span>
                    <Estimate report={state.reports[p.id]} />
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardHeader title={t('mgr.prep.targets')} subtitle={t('mgr.prep.targetsSub')} className="mb-2" />
        {state.auctionPlan.targets.length === 0 ? (
          <p className="text-[13px] text-ink-muted">{t('mgr.prep.noTargets')}</p>
        ) : (
          <DataTable caption={t('mgr.prep.targetsCaption')} head={[t('mgr.col.player'), t('mgr.col.role'), t('mgr.col.rating'), t('mgr.col.expected'), t('mgr.col.maxBid'), t('mgr.col.priority'), '']}>
            {state.auctionPlan.targets.map((tg) => {
              const p = state.players[tg.playerId];
              return (
                <tr key={tg.playerId} className="border-b border-line/60 last:border-0">
                  <td className="px-2 py-2 font-semibold text-ink">{p.name}</td>
                  <td className="px-2 py-2"><RoleTag player={p} /></td>
                  <td className="px-2 py-2"><Estimate report={state.reports[p.id]} /></td>
                  <td className="px-2 py-2"><Money lakh={state.reports[p.id]?.estPrice ?? p.basePrice} /></td>
                  <td className="px-2 py-2 font-semibold"><Money lakh={tg.maxBid} /></td>
                  <td className="px-2 py-2"><ToneBadge tone={tg.priority === 'MUST' ? 'red' : tg.priority === 'HIGH' ? 'blue' : 'grey'}>{t(`mgr.prio.lc.${tg.priority}`)}</ToneBadge></td>
                  <td className="px-2 py-2">
                    <Button variant="secondary" className="min-h-9 px-3" aria-label={t('mgr.prep.remove', { name: p.name })} onClick={() => replace(removeTarget(state, tg.playerId))}>
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </Card>

      <Card>
        <CardHeader title={t('mgr.prep.pool')} subtitle={t('mgr.prep.poolSub', { n: auctionPool(state).length, r: pool.length >= 40 ? '40+' : pool.length })} className="mb-2" />
        <DataTable caption={t('mgr.prep.poolCaption')} head={[t('mgr.col.player'), t('mgr.col.age'), t('mgr.col.role'), t('mgr.col.rating'), t('mgr.col.base'), t('mgr.col.expected'), t('mgr.col.maxBid'), t('mgr.col.priority'), '']}>
          {pool.map((p) => {
            const d = drafts[p.id] ?? { max: String(state.reports[p.id]?.estPrice ?? p.basePrice), priority: 'HIGH' as const };
            const targeted = state.auctionPlan.targets.some((tg) => tg.playerId === p.id);
            return (
              <tr key={p.id} className="border-b border-line/60 last:border-0">
                <td className="px-2 py-2 font-semibold text-ink">{p.name}{p.prospect ? <ToneBadge tone="gold" className="ml-1">{t('mgr.prospect')}</ToneBadge> : null}</td>
                <td className="px-2 py-2">{p.age}</td>
                <td className="px-2 py-2"><RoleTag player={p} /></td>
                <td className="px-2 py-2"><Estimate report={state.reports[p.id]} /></td>
                <td className="px-2 py-2"><Money lakh={p.basePrice} /></td>
                <td className="px-2 py-2"><Money lakh={state.reports[p.id]?.estPrice ?? p.basePrice} /></td>
                <td className="px-2 py-2">
                  <label className="sr-only" htmlFor={`max-${p.id}`}>{t('mgr.prep.maxFor', { name: p.name })}</label>
                  <input id={`max-${p.id}`} inputMode="numeric" value={d.max} onChange={(e) => setDrafts({ ...drafts, [p.id]: { ...d, max: e.target.value.replace(/\D/g, '') } })} className="min-h-10 w-20 rounded-lg border border-line px-2 text-[12.5px]" />
                </td>
                <td className="px-2 py-2">
                  <Select label={t('mgr.col.priority')} className="w-28" value={d.priority} options={[{ id: 'MUST', label: t('mgr.prio.MUST') }, { id: 'HIGH', label: t('mgr.prio.HIGH') }, { id: 'BACKUP', label: t('mgr.prio.BACKUP') }]} onChange={(priority) => setDrafts({ ...drafts, [p.id]: { ...d, priority } })} />
                </td>
                <td className="px-2 py-2">
                  <Button className="min-h-10 px-3" variant={targeted ? 'ghost' : 'primary'} onClick={() => apply(setTarget(state, p.id, Number(d.max) || 0, d.priority))}>
                    {targeted ? t('mgr.prep.update') : t('mgr.prep.target')}
                  </Button>
                </td>
              </tr>
            );
          })}
        </DataTable>
      </Card>
    </div>
  );
}
