/** Squad management: every player, their contract, role, fitness, form and morale, and where the squad is short. */
import { useState } from 'react';
import { Users } from 'lucide-react';
import { Card, CardHeader, EmptyState, Tabs } from '@/components';
import { MANAGER, battingRating, bowlingRating, squadOf, squadProblems, squadWeaknesses } from '@/engine/manager';
import type { ManagedPlayer } from '@/types/manager';
import { useSearchParams } from 'react-router-dom';
import { DataTable, Estimate, Money, PageHeader, RoleTag, ToneBadge, fitnessTone, formWord, useManager } from './ui';
import { PlayerModal } from './PlayersScreen';

type Sort = 'role' | 'value' | 'fitness' | 'form';

export default function SquadScreen() {
  const { state } = useManager();
  const [params, setParams] = useSearchParams();
  const [sort, setSort] = useState<Sort>('role');
  const f = state.franchises[state.franchiseId];
  const squad = squadOf(state, f.id);
  const problems = squadProblems(state, f.id);
  const weak = squadWeaknesses(state, f.id);
  const roleOrder = ['OPENING_BATTER', 'BATTER', 'WICKET_KEEPER_BATTER', 'BATTING_ALLROUNDER', 'BOWLING_ALLROUNDER', 'PACE_BOWLER', 'SPIN_BOWLER'];
  const sorted = [...squad].sort((a, b) => {
    if (sort === 'value') return Math.max(battingRating(b), bowlingRating(b)) - Math.max(battingRating(a), bowlingRating(a));
    if (sort === 'fitness') return a.condition.fatigue - b.condition.fatigue;
    if (sort === 'form') return b.condition.form - a.condition.form;
    return roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role);
  });
  const payroll = squad.reduce((n, p) => n + (p.contract?.salary ?? 0), 0);
  const selected = params.get('focus') ? state.players[params.get('focus')!] : null;

  return (
    <div className="flex flex-col gap-3 pb-4">
      <PageHeader title="Squad" subtitle={`${squad.length} players (${MANAGER.rules.squadMin}-${MANAGER.rules.squadMax}) · ${squad.filter((p) => p.overseas).length}/${MANAGER.rules.overseasSquadMax} overseas · payroll ${(payroll / 100).toFixed(2)} Cr`} />
      {problems.length ? (
        <div role="alert" className="rounded-card border border-brand-red/25 bg-brand-red/8 px-4 py-3 text-[13px] text-ink">
          {problems.map((p) => <p key={p}>{p}</p>)}
        </div>
      ) : null}
      <Card>
        <CardHeader title="Balance" subtitle="Batting depth, pace, spin, finishing, death bowling and keeping" className="mb-2" />
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {weak.map((w) => (
            <li key={w.area} className="flex items-center justify-between gap-2 rounded-lg bg-page px-3 py-2">
              <span className="text-[12.5px] text-ink">{w.note}</span>
              <ToneBadge tone={w.severity === 'OK' ? 'green' : w.severity === 'THIN' ? 'orange' : 'red'}>{w.severity.toLowerCase()}</ToneBadge>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[14px] font-semibold text-ink">Players</h2>
          <Tabs label="Sort squad" value={sort} onChange={(v) => setSort(v as Sort)} tabs={[{ id: 'role', label: 'By role' }, { id: 'value', label: 'Best' }, { id: 'fitness', label: 'Freshest' }, { id: 'form', label: 'Form' }]} />
        </div>
        {squad.length === 0 ? (
          <EmptyState icon={Users} title="No players under contract" message="Sign players at the auction." />
        ) : (
          <DataTable caption="Squad" head={['Player', 'Age', 'Role', 'Rating', 'Fitness', 'Form', 'Morale', 'Contract', 'Season']}>
            {sorted.map((p) => (
              <Row key={p.id} p={p} onOpen={() => setParams({ focus: p.id })} report={<Estimate report={state.reports[p.id]} />} />
            ))}
          </DataTable>
        )}
      </Card>
      {selected ? <PlayerModal state={state} player={selected} onClose={() => setParams({})} /> : null}
    </div>
  );
}

function Row({ p, onOpen, report }: { p: ManagedPlayer; onOpen: () => void; report: React.ReactNode }) {
  const fitness = Math.round(100 - p.condition.fatigue);
  return (
    <tr className="border-b border-line/60 last:border-0">
      <td className="px-2 py-2">
        <button type="button" onClick={onOpen} className="text-left font-semibold text-ink hover:text-brand-blue focus-visible:underline focus-visible:outline-none">{p.name}</button>
        {p.injuredWeeks > 0 ? <ToneBadge tone="red" className="ml-1">Injured {p.injuredWeeks}w</ToneBadge> : null}
      </td>
      <td className="px-2 py-2">{p.age}</td>
      <td className="px-2 py-2"><RoleTag player={p} /></td>
      <td className="px-2 py-2">{report}</td>
      <td className="px-2 py-2"><ToneBadge tone={fitnessTone(p.condition.fatigue)}>{fitness}%</ToneBadge></td>
      <td className="px-2 py-2">{formWord(p.condition.form)}</td>
      <td className="px-2 py-2">{p.condition.morale >= 65 ? 'High' : p.condition.morale >= 40 ? 'Steady' : 'Low'}</td>
      <td className="px-2 py-2 whitespace-nowrap">{p.contract ? <><Money lakh={p.contract.salary} /> · {p.contract.years}y</> : '-'}</td>
      <td className="px-2 py-2 whitespace-nowrap text-[12px]">{p.season.matches}m · {p.season.runs}r · {p.season.wickets}w</td>
    </tr>
  );
}
