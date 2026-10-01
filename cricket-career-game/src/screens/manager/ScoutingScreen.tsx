/** The scouting network: scouts, trips, regions, budget and the latest reports. */
import { useState } from 'react';
import { MapPin, Radar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, EmptyState, ProgressBar } from '@/components';
import { MANAGER, REGION_LABEL, assignScout, knownPlayers, scoutsOf, toggleShortlist } from '@/engine/manager';
import type { PlayerRole } from '@/types';
import type { ScoutRegion } from '@/types/manager';
import { roleLabel } from '@/lib/format';
import { Button, DataTable, Estimate, LockedNotice, Money, PageHeader, RoleTag, Select, ToneBadge, useManager } from './ui';

const REGIONS = Object.keys(REGION_LABEL) as ScoutRegion[];
const ROLES: (PlayerRole | 'ANY')[] = ['ANY', 'OPENING_BATTER', 'BATTER', 'WICKET_KEEPER_BATTER', 'BATTING_ALLROUNDER', 'BOWLING_ALLROUNDER', 'PACE_BOWLER', 'SPIN_BOWLER'];

export default function ScoutingScreen() {
  const { state, apply, replace } = useManager();
  const scouts = scoutsOf(state);
  const [plans, setPlans] = useState<Record<string, { region: ScoutRegion; focus: PlayerRole | 'ANY' }>>({});
  const spent = state.finances.ledger.filter((e) => e.season === state.season.year && e.kind === 'SCOUTING').reduce((n, e) => n - e.amount, 0);
  const recent = knownPlayers(state)
    .filter(({ player }) => !player.contract || player.contract.franchiseId !== state.franchiseId)
    .sort((a, b) => b.report.updated - a.report.updated || b.report.estPotential - a.report.estPotential)
    .slice(0, 25);

  return (
    <div className="flex flex-col gap-3 pb-4">
      <PageHeader title="Scouting network" subtitle="Send scouts to the regions. Each trip lasts two weeks and files reports when it ends. Estimates carry uncertainty - a trial or more looks narrow it." />
      <LockedNotice responsibility="SCOUTING" state={state} />

      <Card>
        <CardHeader title="Scouting budget" subtitle={`${MANAGER.scouting.tripCost} lakh a trip (double overseas)`} className="mb-2" />
        <div className="mb-1 flex justify-between text-[12.5px]">
          <span className="text-ink-muted">Spent this season</span>
          <span className="font-semibold"><Money lakh={spent} /> of <Money lakh={state.finances.budgets.scouting} /></span>
        </div>
        <ProgressBar value={(spent / Math.max(1, state.finances.budgets.scouting)) * 100} tone={spent > state.finances.budgets.scouting * 0.85 ? 'orange' : 'blue'} label="Scouting budget used" />
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {scouts.map((s) => {
          const plan = plans[s.id] ?? { region: 'SOUTH' as ScoutRegion, focus: 'ANY' as const };
          return (
            <Card key={s.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[14px] font-semibold text-ink">{s.name}</p>
                  <p className="text-[12px] text-ink-muted">Scout · quality {s.quality}</p>
                </div>
                {s.assignment ? <ToneBadge tone="blue">Away</ToneBadge> : <ToneBadge tone="green">Available</ToneBadge>}
              </div>
              {s.assignment ? (
                <p className="mt-3 flex items-center gap-2 text-[13px] text-ink">
                  <MapPin className="size-4 text-brand-blue" aria-hidden />
                  {REGION_LABEL[s.assignment.region]}
                  {s.assignment.focus ? ` · ${roleLabel(s.assignment.focus)}` : ''} · back in {s.assignment.weeksLeft} week{s.assignment.weeksLeft === 1 ? '' : 's'}
                </p>
              ) : (
                <div className="mt-3 grid gap-2">
                  <Select label="Region" value={plan.region} options={REGIONS.map((r) => ({ id: r, label: REGION_LABEL[r] }))} onChange={(region) => setPlans({ ...plans, [s.id]: { ...plan, region } })} />
                  <Select label="Looking for" value={plan.focus} options={ROLES.map((r) => ({ id: r, label: r === 'ANY' ? 'Any role' : roleLabel(r) }))} onChange={(focus) => setPlans({ ...plans, [s.id]: { ...plan, focus } })} />
                  <Button onClick={() => apply(assignScout(state, s.id, plan.region, plan.focus === 'ANY' ? null : plan.focus), `${s.name} is on his way.`)}>Send on trip</Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader title="Latest reports" action={{ label: 'Player database', to: '/manager/players' }} className="mb-2" />
        {recent.length === 0 ? (
          <EmptyState icon={Radar} title="No reports yet" message="Send a scout on a trip and advance the week - reports arrive when they get back." />
        ) : (
          <DataTable caption="Latest scouting reports" head={['Player', 'Age', 'Role', 'Rating', 'Potential', 'Price', 'Notes', '']}>
            {recent.map(({ player, report }) => (
              <tr key={player.id} className="border-b border-line/60 last:border-0">
                <td className="px-2 py-2 font-semibold text-ink">
                  <Link to={`/manager/players?focus=${player.id}`} className="hover:text-brand-blue">{player.name}</Link>
                  {player.prospect ? <ToneBadge tone="gold" className="ml-1">Prospect</ToneBadge> : null}
                </td>
                <td className="px-2 py-2">{player.age}</td>
                <td className="px-2 py-2"><RoleTag player={player} /></td>
                <td className="px-2 py-2"><Estimate report={report} /></td>
                <td className="px-2 py-2"><Estimate report={report} field="potential" /></td>
                <td className="px-2 py-2"><Money lakh={report.estPrice} /></td>
                <td className="max-w-[220px] px-2 py-2 text-[12px] text-ink-muted">{report.notes[0]}</td>
                <td className="px-2 py-2">
                  <Button variant={state.shortlist.includes(player.id) ? 'ghost' : 'secondary'} className="min-h-9 px-3" aria-pressed={state.shortlist.includes(player.id)} onClick={() => replace(toggleShortlist(state, player.id))}>
                    {state.shortlist.includes(player.id) ? 'Shortlisted' : 'Shortlist'}
                  </Button>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>
    </div>
  );
}
