/** The office: staff, contracts and retention, finances and budgets, news and negotiations. */
import { useState } from 'react';
import { Newspaper } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, ConfirmDialog, EmptyState, ProgressBar, Tabs } from '@/components';
import {
  MANAGER,
  STAFF_LABEL,
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
import { Button, DataTable, LockedNotice, Money, PageHeader, RoleTag, ToneBadge, nameOf, useManager } from './ui';

export function StaffScreen() {
  const { state, apply } = useManager();
  const [release, setRelease] = useState<string | null>(null);
  const cost = staffCost(state);
  return (
    <div className="flex flex-col gap-3 pb-4">
      <PageHeader title="Staff" subtitle="Scouts find and judge talent; coaches drive development; the analyst sharpens every report; fitness staff keep players on the park." />
      <LockedNotice responsibility="STAFF" state={state} />
      <Card>
        <div className="mb-1 flex justify-between text-[12.5px]"><span className="text-ink-muted">Staff wages this season</span><span className="font-semibold"><Money lakh={cost} /> of <Money lakh={state.finances.budgets.staff} /></span></div>
        <ProgressBar value={(cost / Math.max(1, state.finances.budgets.staff)) * 100} tone={cost > state.finances.budgets.staff * 0.9 ? 'orange' : 'blue'} label="Staff budget" />
      </Card>
      <Card>
        <CardHeader title="Your backroom" className="mb-2" />
        <DataTable caption="Staff" head={['Name', 'Role', 'Quality', 'Salary', '']}>
          {state.staff.map((s) => (
            <tr key={s.id} className="border-b border-line/60 last:border-0">
              <td className="px-2 py-2 font-semibold text-ink">{s.name}</td>
              <td className="px-2 py-2">{STAFF_LABEL[s.kind]}</td>
              <td className="px-2 py-2"><ToneBadge tone={s.quality >= 75 ? 'green' : s.quality >= 55 ? 'blue' : 'orange'}>{s.quality}</ToneBadge></td>
              <td className="px-2 py-2"><Money lakh={s.salary} /></td>
              <td className="px-2 py-2">
                <div className="flex gap-1.5">
                  <Button variant="ghost" className="min-h-9 px-3" onClick={() => apply(developStaff(state, s.id), `${s.name} is off on a course.`)}>Course</Button>
                  <Button variant="secondary" className="min-h-9 px-3" onClick={() => setRelease(s.id)}>Release</Button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      </Card>
      <Card>
        <CardHeader title="Available to hire" subtitle="A new coach replaces the one in post; up to four scouts." className="mb-2" />
        <DataTable caption="Staff market" head={['Name', 'Role', 'Quality', 'Salary', '']}>
          {state.staffMarket.map((s) => (
            <tr key={s.id} className="border-b border-line/60 last:border-0">
              <td className="px-2 py-2 font-semibold text-ink">{s.name}</td>
              <td className="px-2 py-2">{STAFF_LABEL[s.kind]}</td>
              <td className="px-2 py-2">{s.quality}</td>
              <td className="px-2 py-2"><Money lakh={s.salary} /></td>
              <td className="px-2 py-2"><Button className="min-h-9 px-3" onClick={() => apply(hireStaff(state, s.id))}>Hire</Button></td>
            </tr>
          ))}
        </DataTable>
      </Card>
      <ConfirmDialog
        open={release !== null}
        danger
        title="Release this member of staff?"
        message="They leave with a quarter of a season's pay as settlement."
        confirmLabel="Release"
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
  const { state, apply } = useManager();
  const [release, setRelease] = useState<string | null>(null);
  const [offers, setOffers] = useState<Record<string, { salary: string; years: number }>>({});
  const squad = squadOf(state, state.franchiseId).sort((a, b) => (b.contract?.salary ?? 0) - (a.contract?.salary ?? 0));
  const expiring = new Set(expiringContracts(state));
  const nextMega = isMegaAuction(state.season.year + 1);
  const payroll = squad.reduce((n, p) => n + (p.contract?.salary ?? 0), 0);
  return (
    <div className="flex flex-col gap-3 pb-4">
      <PageHeader title="Contracts, retention & releases" subtitle={`Payroll ${(payroll / 100).toFixed(2)} Cr · ${contractsOpen(state) ? 'the squad window is open' : 'squad changes wait for the off-season'}`} />
      <LockedNotice responsibility="CONTRACTS" state={state} />
      {state.season.phase === 'SEASON_END' ? (
        <p role="note" className="rounded-card bg-brand-blue-soft px-4 py-3 text-[13px] text-ink">
          {nextMega ? 'Next season is a mega auction: every contract ends except up to four retentions, made in the retention window.' : 'Renew the players whose deals are ending, or let them go into the auction.'}
        </p>
      ) : null}
      <Card>
        <DataTable caption="Contracts" head={['Player', 'Role', 'Salary', 'Years left', 'Signed', 'Status', '']}>
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
                <td className="px-2 py-2 text-[12px]">{c.signedSeason} · {c.via.toLowerCase()}</td>
                <td className="px-2 py-2">{ending ? <ToneBadge tone="orange">Ending</ToneBadge> : <ToneBadge tone="green">Under contract</ToneBadge>}</td>
                <td className="px-2 py-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {ending && state.season.phase === 'SEASON_END' && !nextMega ? (
                      <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); apply(offerRenewal(state, p.id, Number(draft.salary) || 0, draft.years)); }}>
                        <label className="sr-only" htmlFor={`renew-${p.id}`}>Salary for {p.name}, lakh</label>
                        <input id={`renew-${p.id}`} inputMode="numeric" value={draft.salary} onChange={(e) => setOffers({ ...offers, [p.id]: { ...draft, salary: e.target.value.replace(/\D/g, '') } })} className="min-h-9 w-16 rounded-lg border border-line px-2 text-[12.5px]" />
                        <label className="sr-only" htmlFor={`years-${p.id}`}>Years</label>
                        <select id={`years-${p.id}`} value={draft.years} onChange={(e) => setOffers({ ...offers, [p.id]: { ...draft, years: Number(e.target.value) } })} className="min-h-9 rounded-lg border border-line px-1 text-[12.5px]">
                          {[1, 2, 3].map((y) => <option key={y} value={y}>{y}y</option>)}
                        </select>
                        <Button type="submit" className="min-h-9 px-3">Renew</Button>
                      </form>
                    ) : null}
                    <Button variant="secondary" className="min-h-9 px-3" disabled={!contractsOpen(state)} onClick={() => setRelease(p.id)}>Release</Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </DataTable>
      </Card>
      <Card>
        <CardHeader title="Negotiations" className="mb-2" />
        {state.negotiations.length === 0 ? (
          <p className="text-[13px] text-ink-muted">No negotiations yet.</p>
        ) : (
          <ul className="grid gap-1.5 text-[13px]">
            {state.negotiations.slice(0, 15).map((n) => (
              <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-page px-3 py-2">
                <span>{nameOf(state, n.playerId)} · {n.kind.replace('_', ' ').toLowerCase()} · offered <Money lakh={n.offeredSalary} /> (asking <Money lakh={n.asking} />)</span>
                <ToneBadge tone={n.status === 'ACCEPTED' ? 'green' : n.status === 'REJECTED' ? 'red' : n.status === 'COUNTERED' ? 'orange' : 'grey'}>{n.status.toLowerCase()}</ToneBadge>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <ConfirmDialog
        open={release !== null}
        danger
        title={`Release ${release ? nameOf(state, release) : ''}?`}
        message={`Half of this season's salary is paid as settlement, and he goes back into the auction pool.`}
        confirmLabel="Release"
        onCancel={() => setRelease(null)}
        onConfirm={() => {
          if (release) apply(releasePlayer(state, release));
          setRelease(null);
        }}
      />
      <p className="text-[12px] text-ink-muted">Squad limits: {MANAGER.rules.squadMin}-{MANAGER.rules.squadMax} players, {MANAGER.rules.overseasSquadMax} overseas.</p>
    </div>
  );
}

const KIND_LABEL: Record<LedgerEntry['kind'], string> = {
  SPONSORSHIP: 'Sponsorship', GATE: 'Gate receipts', PRIZE: 'Prize money', MEDIA: 'Media rights', SALARY: 'Player salaries', STAFF: 'Staff', SCOUTING: 'Scouting', TRIALS: 'Trials', DEVELOPMENT: 'Development', SIGNING: 'Signing fees', BONUS: 'Win bonuses', OTHER: 'Other',
};

export function FinancesScreen() {
  const { state, apply } = useManager();
  const report = financeReport(state);
  const fc = forecast(state);
  const [budgets, setBudgetDraft] = useState(state.finances.budgets);
  const seasons = Array.from(new Set(state.finances.ledger.map((e) => e.season))).sort((a, b) => b - a);
  return (
    <div className="flex flex-col gap-3 pb-4">
      <PageHeader title="Finances" subtitle="The auction purse pays the players' salaries cap; this is the franchise's operating money." />
      <div className="grid gap-3 md:grid-cols-4">
        <Card><p className="text-[12px] text-ink-muted">Balance</p><p className="text-[20px] font-bold"><Money lakh={state.finances.balance} className={state.finances.balance < 0 ? 'text-brand-red' : ''} /></p></Card>
        <Card><p className="text-[12px] text-ink-muted">Income {state.season.year}</p><p className="text-[20px] font-bold text-brand-green"><Money lakh={report.income} /></p></Card>
        <Card><p className="text-[12px] text-ink-muted">Spending {state.season.year}</p><p className="text-[20px] font-bold text-brand-red"><Money lakh={report.spending} /></p></Card>
        <Card><p className="text-[12px] text-ink-muted">Season forecast</p><p className={cn('text-[20px] font-bold', fc.profit < 0 ? 'text-brand-red' : 'text-brand-green')}><Money lakh={fc.profit} /></p><p className="text-[11.5px] text-ink-muted">End balance <Money lakh={fc.endBalance} /></p></Card>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title="Where the money goes" className="mb-2" />
          <ul className="grid gap-1">
            {Object.entries(report.byKind).sort((a, b) => a[1] - b[1]).map(([kind, amount]) => (
              <li key={kind} className="flex justify-between border-b border-line/60 py-1.5 text-[13px] last:border-0">
                <span>{KIND_LABEL[kind as LedgerEntry['kind']]}</span>
                <Money lakh={amount} className={amount < 0 ? 'text-brand-red' : 'text-brand-green'} />
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Budgets" subtitle="Move money between departments (Director of Cricket)" className="mb-2" />
          <LockedNotice responsibility="FINANCE" state={state} />
          <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); apply(setBudgets(state, budgets), 'Budgets updated.'); }}>
            {(['scouting', 'development', 'staff'] as const).map((k) => (
              <label key={k} className="flex items-center justify-between gap-2 text-[13px] capitalize">
                {k}
                <input inputMode="numeric" value={budgets[k]} onChange={(e) => setBudgetDraft({ ...budgets, [k]: Number(e.target.value.replace(/\D/g, '')) || 0 })} className="min-h-10 w-28 rounded-lg border border-line px-2 text-right text-[13px]" />
              </label>
            ))}
            <Button type="submit" className="mt-1">Save budgets</Button>
          </form>
        </Card>
      </div>
      <Card>
        <CardHeader title="Ledger" className="mb-2" />
        <DataTable caption="Transactions" head={['Season', 'Item', 'Type', 'Amount']}>
          {[...state.finances.ledger].reverse().slice(0, 60).map((e) => (
            <tr key={e.id} className="border-b border-line/60 last:border-0">
              <td className="px-2 py-1.5">{e.season}</td>
              <td className="px-2 py-1.5">{e.note}</td>
              <td className="px-2 py-1.5">{KIND_LABEL[e.kind]}</td>
              <td className="px-2 py-1.5"><Money lakh={e.amount} className={e.amount < 0 ? 'text-brand-red' : 'text-brand-green'} /></td>
            </tr>
          ))}
        </DataTable>
        {seasons.length > 1 ? <p className="mt-2 text-[12px] text-ink-muted">Past seasons: {seasons.slice(1).map((s) => `${s}: ${financeReport(state, s).profit >= 0 ? '+' : ''}${financeReport(state, s).profit} L`).join(' · ')}</p> : null}
      </Card>
    </div>
  );
}

export function NewsScreen() {
  const { state, replace } = useManager();
  const [kind, setKind] = useState('ALL');
  const list = state.news.filter((n) => kind === 'ALL' || n.kind === kind);
  const markAll = () => replace(produce(state, (d) => d.news.forEach((n) => (n.read = true))));
  return (
    <div className="flex flex-col gap-3 pb-4">
      <PageHeader title="News & inbox">
        <Button variant="secondary" onClick={markAll}>Mark all read</Button>
      </PageHeader>
      <Tabs label="Filter news" value={kind} onChange={setKind} tabs={[{ id: 'ALL', label: 'All' }, { id: 'BOARD', label: 'Board' }, { id: 'SCOUTING', label: 'Scouting' }, { id: 'AUCTION', label: 'Auction' }, { id: 'MATCH', label: 'Matches' }, { id: 'CONTRACT', label: 'Contracts' }, { id: 'CAREER', label: 'Career' }]} />
      {list.length === 0 ? (
        <EmptyState icon={Newspaper} title="Nothing here" message="News arrives as the season moves on." />
      ) : (
        <ul className="grid gap-2">
          {list.map((n) => (
            <li key={n.id}>
              <Card className={cn('py-3', !n.read && 'border-brand-blue/40')}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={cn('text-[14px] text-ink', !n.read && 'font-semibold')}>{n.title}{!n.read ? <span className="sr-only"> (unread)</span> : null}</p>
                    <p className="mt-0.5 text-[13px] text-ink-muted">{n.body}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ToneBadge tone="grey">{n.kind.toLowerCase()} · {n.season}</ToneBadge>
                    {n.route ? (
                      <Link to={n.route} onClick={() => replace(produce(state, (d) => { const x = d.news.find((y) => y.id === n.id); if (x) x.read = true; }))} className="text-[12.5px] font-semibold text-brand-blue">Open</Link>
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
