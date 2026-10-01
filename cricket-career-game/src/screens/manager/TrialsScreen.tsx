/** Trials and recruitment: invite unsigned players, read the results, offer development contracts. */
import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { Card, CardHeader, EmptyState } from '@/components';
import { MANAGER, acceptCounter, askingSalary, offerDevelopmentContract, runTrial, trialsLeft, trialsOpen } from '@/engine/manager';
import { cn } from '@/lib/cn';
import { Button, DataTable, Estimate, LockedNotice, PageHeader, RoleTag, ToneBadge, useManager } from './ui';

export default function TrialsScreen() {
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
      <PageHeader title="Trials & recruitment" subtitle={`Up to four players a trial day, ${MANAGER.rules.trialsPerSeason} days a season (${MANAGER.rules.trialCost} lakh a player). Impressive uncapped triallists can be offered development contracts before the auction - they may say no.`} />
      <LockedNotice responsibility="TRIALS" state={state} />
      {!open ? <p role="status" className="rounded-card bg-brand-blue-soft px-4 py-3 text-[13px] text-ink">Trials are held during scouting and trials weeks. The next window opens with the new season.</p> : null}

      <Card>
        <CardHeader title="Invite to trial" subtitle={`${trialsLeft(state)} trial day${trialsLeft(state) === 1 ? '' : 's'} left · ${picked.length}/4 selected`} className="mb-2" />
        {candidates.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No candidates" message="Shortlist unsigned players, or scout regions to find prospects." action={{ label: 'Go scouting', to: '/manager/scouting' }} />
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
              Hold trial day
            </Button>
          </>
        )}
      </Card>

      <Card>
        <CardHeader title={`Trial results ${state.season.year}`} subtitle={`${state.season.developmentSignings}/${MANAGER.rules.developmentSignings} development signings used`} className="mb-2" />
        {state.season.trials.length === 0 ? (
          <p className="text-[13px] text-ink-muted">No trials held yet this season.</p>
        ) : (
          <DataTable caption="Trial results" head={['Player', 'Bat', 'Bowl', 'Field', 'Fitness', 'Verdict', 'Offer']}>
            {state.season.trials.map((t) => {
              const p = state.players[t.playerId];
              const value = offers[t.playerId] ?? String(askingSalary(state, t.playerId));
              const canOffer = !p.contract && !p.capped;
              return (
                <tr key={t.playerId} className="border-b border-line/60 last:border-0">
                  <td className="px-2 py-2 font-semibold text-ink">{p.name}</td>
                  <td className="px-2 py-2 tabular-nums">{t.batting}</td>
                  <td className="px-2 py-2 tabular-nums">{t.bowling > 1 ? t.bowling : '-'}</td>
                  <td className="px-2 py-2 tabular-nums">{t.fielding}</td>
                  <td className="px-2 py-2 tabular-nums">{t.fitness}</td>
                  <td className="px-2 py-2">
                    <ToneBadge tone={t.verdict === 'IMPRESSIVE' ? 'green' : t.verdict === 'PROMISING' ? 'blue' : t.verdict === 'ORDINARY' ? 'grey' : 'red'}>{t.verdict.toLowerCase()}</ToneBadge>
                  </td>
                  <td className="px-2 py-2">
                    {p.contract ? (
                      <span className="text-[12px] text-brand-green">Signed</span>
                    ) : canOffer ? (
                      <form className="flex items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); apply(offerDevelopmentContract(state, t.playerId, Number(value) || 0)); }}>
                        <label className="sr-only" htmlFor={`offer-${t.playerId}`}>Salary in lakh</label>
                        <input id={`offer-${t.playerId}`} inputMode="numeric" value={value} onChange={(e) => setOffers({ ...offers, [t.playerId]: e.target.value.replace(/\D/g, '') })} className="min-h-10 w-16 rounded-lg border border-line px-2 text-[12.5px]" />
                        <Button type="submit" className="min-h-10 px-3" disabled={!open}>Offer</Button>
                      </form>
                    ) : (
                      <span className="text-[12px] text-ink-muted">Auction only</span>
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
          <CardHeader title="Offers" className="mb-2" />
          <ul className="grid gap-2">
            {negotiations.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-page px-3 py-2">
                <span className="text-[13px] text-ink">{n.note || state.players[n.playerId]?.name}</span>
                {n.status === 'COUNTERED' ? <Button className="min-h-9" onClick={() => apply(acceptCounter(state, n.id))}>Meet {n.counterSalary} lakh</Button> : <ToneBadge tone={n.status === 'ACCEPTED' ? 'green' : n.status === 'REJECTED' ? 'red' : 'grey'}>{n.status.toLowerCase()}</ToneBadge>}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
