/** Auction preparation: retentions, squad gaps, the pool and a maximum bid for every target. */
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Card, CardHeader, ProgressBar } from '@/components';
import { MANAGER, auctionPool, isMegaAuction, marketValue, planSummary, removeTarget, retentionCost, setTarget, squadOf, squadWeaknesses, toggleRetention } from '@/engine/manager';
import type { AuctionTarget } from '@/types/manager';
import { Button, DataTable, Estimate, LockedNotice, Money, PageHeader, RoleTag, Select, ToneBadge, useManager } from './ui';

export default function AuctionPrepScreen() {
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
      <PageHeader title="Auction preparation" subtitle={mega ? 'Mega auction year: retain up to four, the rest go back into the pool.' : 'Mini auction: contracts carry over; fill the gaps.'} />
      <LockedNotice responsibility="AUCTION" state={state} />

      <div className="grid gap-3 lg:grid-cols-3">
        <Card>
          <CardHeader title="Purse" className="mb-2" />
          <p className="text-[22px] font-bold text-ink"><Money lakh={f.purse} /></p>
          <p className="text-[12.5px] text-ink-muted">{f.squadIds.length} players · {overseasInSquad}/{MANAGER.rules.overseasSquadMax} overseas · squad {MANAGER.rules.squadMin}-{MANAGER.rules.squadMax}</p>
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[12px]"><span className="text-ink-muted">Planned on must/high targets</span><span className="font-semibold"><Money lakh={plan.committed} /></span></div>
            <ProgressBar value={(plan.committed / Math.max(1, f.purse)) * 100} tone={plan.overBudget ? 'red' : 'blue'} label="Purse planned" />
            {plan.overBudget ? <p className="mt-1 text-[12px] text-brand-red" role="alert">Your maximum bids add up to more than the purse - you will not get them all.</p> : null}
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Squad gaps" subtitle="Where the current squad is thin" className="mb-2" />
          <ul className="flex flex-wrap gap-1.5">
            {gaps.map((g) => (
              <li key={g.area}>
                <ToneBadge tone={g.severity === 'OK' ? 'green' : g.severity === 'THIN' ? 'orange' : 'red'}>
                  {g.area.replace('_', ' ').toLowerCase()}: {g.note}
                </ToneBadge>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {mega ? (
        <Card>
          <CardHeader title="Retentions" subtitle={`${state.season.retentions.length}/${MANAGER.rules.maxRetentions} chosen · cost ${retentionCost(state.season.retentions.length)} lakh from the purse${retentionOpen ? '' : ' · window closed'}`} className="mb-2" />
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
        <CardHeader title="Your targets" subtitle="The most you will pay for each. In the auction, 'Bid to max' stops at this figure." className="mb-2" />
        {state.auctionPlan.targets.length === 0 ? (
          <p className="text-[13px] text-ink-muted">No targets yet - set them from the pool below or a player's profile.</p>
        ) : (
          <DataTable caption="Auction targets" head={['Player', 'Role', 'Rating', 'Expected', 'Max bid', 'Priority', '']}>
            {state.auctionPlan.targets.map((t) => {
              const p = state.players[t.playerId];
              return (
                <tr key={t.playerId} className="border-b border-line/60 last:border-0">
                  <td className="px-2 py-2 font-semibold text-ink">{p.name}</td>
                  <td className="px-2 py-2"><RoleTag player={p} /></td>
                  <td className="px-2 py-2"><Estimate report={state.reports[p.id]} /></td>
                  <td className="px-2 py-2"><Money lakh={state.reports[p.id]?.estPrice ?? p.basePrice} /></td>
                  <td className="px-2 py-2 font-semibold"><Money lakh={t.maxBid} /></td>
                  <td className="px-2 py-2"><ToneBadge tone={t.priority === 'MUST' ? 'red' : t.priority === 'HIGH' ? 'blue' : 'grey'}>{t.priority.toLowerCase()}</ToneBadge></td>
                  <td className="px-2 py-2">
                    <Button variant="secondary" className="min-h-9 px-3" aria-label={`Remove ${p.name}`} onClick={() => replace(removeTarget(state, t.playerId))}>
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
        <CardHeader title="The pool (scouted players)" subtitle={`${auctionPool(state).length} players registered; you have reports on ${pool.length >= 40 ? '40+' : pool.length}.`} className="mb-2" />
        <DataTable caption="Auction pool" head={['Player', 'Age', 'Role', 'Rating', 'Base', 'Expected', 'Max bid', 'Priority', '']}>
          {pool.map((p) => {
            const d = drafts[p.id] ?? { max: String(state.reports[p.id]?.estPrice ?? p.basePrice), priority: 'HIGH' as const };
            const targeted = state.auctionPlan.targets.some((t) => t.playerId === p.id);
            return (
              <tr key={p.id} className="border-b border-line/60 last:border-0">
                <td className="px-2 py-2 font-semibold text-ink">{p.name}{p.prospect ? <ToneBadge tone="gold" className="ml-1">Prospect</ToneBadge> : null}</td>
                <td className="px-2 py-2">{p.age}</td>
                <td className="px-2 py-2"><RoleTag player={p} /></td>
                <td className="px-2 py-2"><Estimate report={state.reports[p.id]} /></td>
                <td className="px-2 py-2"><Money lakh={p.basePrice} /></td>
                <td className="px-2 py-2"><Money lakh={state.reports[p.id]?.estPrice ?? p.basePrice} /></td>
                <td className="px-2 py-2">
                  <label className="sr-only" htmlFor={`max-${p.id}`}>Maximum bid for {p.name}, lakh</label>
                  <input id={`max-${p.id}`} inputMode="numeric" value={d.max} onChange={(e) => setDrafts({ ...drafts, [p.id]: { ...d, max: e.target.value.replace(/\D/g, '') } })} className="min-h-10 w-20 rounded-lg border border-line px-2 text-[12.5px]" />
                </td>
                <td className="px-2 py-2">
                  <Select label="Priority" className="w-28" value={d.priority} options={[{ id: 'MUST', label: 'Must' }, { id: 'HIGH', label: 'High' }, { id: 'BACKUP', label: 'Backup' }]} onChange={(priority) => setDrafts({ ...drafts, [p.id]: { ...d, priority } })} />
                </td>
                <td className="px-2 py-2">
                  <Button className="min-h-10 px-3" variant={targeted ? 'ghost' : 'primary'} onClick={() => apply(setTarget(state, p.id, Number(d.max) || 0, d.priority))}>
                    {targeted ? 'Update' : 'Target'}
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
