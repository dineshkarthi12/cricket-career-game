/** The scouting network: scouts, trips, regions, budget and the latest reports. */
import { useState } from 'react';
import { MapPin, Radar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, EmptyState, ProgressBar } from '@/components';
import { MANAGER, REGION_LABEL, assignScout, knownPlayers, scoutsOf, toggleShortlist } from '@/engine/manager';
import type { PlayerRole } from '@/types';
import type { ScoutRegion } from '@/types/manager';
import { roleLabel } from '@/lib/format';
import { rich, useT } from '@/i18n/react';
import { Button, DataTable, Estimate, LockedNotice, Money, PageHeader, RoleTag, Select, ToneBadge, useManager } from './ui';

const REGIONS = Object.keys(REGION_LABEL) as ScoutRegion[];
const ROLES: (PlayerRole | 'ANY')[] = ['ANY', 'OPENING_BATTER', 'BATTER', 'WICKET_KEEPER_BATTER', 'BATTING_ALLROUNDER', 'BOWLING_ALLROUNDER', 'PACE_BOWLER', 'SPIN_BOWLER'];

export default function ScoutingScreen() {
  const t = useT();
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
      <PageHeader title={t('mgr.scout.title')} subtitle={t('mgr.scout.sub')} />
      <LockedNotice responsibility="SCOUTING" state={state} />

      <Card>
        <CardHeader title={t('mgr.scout.budget')} subtitle={t('mgr.scout.tripCost', { n: MANAGER.scouting.tripCost })} className="mb-2" />
        <div className="mb-1 flex justify-between text-[12.5px]">
          <span className="text-ink-muted">{t('mgr.scout.spent')}</span>
          <span className="font-semibold">{rich(t('mgr.scout.spentOf'), { spent: <Money lakh={spent} />, budget: <Money lakh={state.finances.budgets.scouting} /> })}</span>
        </div>
        <ProgressBar value={(spent / Math.max(1, state.finances.budgets.scouting)) * 100} tone={spent > state.finances.budgets.scouting * 0.85 ? 'orange' : 'blue'} label={t('mgr.scout.budgetUsed')} />
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {scouts.map((s) => {
          const plan = plans[s.id] ?? { region: 'SOUTH' as ScoutRegion, focus: 'ANY' as const };
          return (
            <Card key={s.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[14px] font-semibold text-ink">{s.name}</p>
                  <p className="text-[12px] text-ink-muted">{t('mgr.scout.quality', { n: s.quality })}</p>
                </div>
                {s.assignment ? <ToneBadge tone="blue">{t('mgr.scout.away')}</ToneBadge> : <ToneBadge tone="green">{t('mgr.scout.available')}</ToneBadge>}
              </div>
              {s.assignment ? (
                <p className="mt-3 flex items-center gap-2 text-[13px] text-ink">
                  <MapPin className="size-4 text-brand-blue" aria-hidden />
                  {t(`mgr.region.${s.assignment.region}`)}
                  {s.assignment.focus ? ` · ${roleLabel(s.assignment.focus)}` : ''} · {t(s.assignment.weeksLeft === 1 ? 'mgr.scout.back.one' : 'mgr.scout.back.many', { n: s.assignment.weeksLeft })}
                </p>
              ) : (
                <div className="mt-3 grid gap-2">
                  <Select label={t('mgr.scout.region')} value={plan.region} options={REGIONS.map((r) => ({ id: r, label: t(`mgr.region.${r}`) }))} onChange={(region) => setPlans({ ...plans, [s.id]: { ...plan, region } })} />
                  <Select label={t('mgr.scout.lookingFor')} value={plan.focus} options={ROLES.map((r) => ({ id: r, label: r === 'ANY' ? t('mgr.scout.anyRole') : roleLabel(r) }))} onChange={(focus) => setPlans({ ...plans, [s.id]: { ...plan, focus } })} />
                  <Button onClick={() => apply(assignScout(state, s.id, plan.region, plan.focus === 'ANY' ? null : plan.focus), t('mgr.scout.onWay', { name: s.name }))}>{t('mgr.scout.send')}</Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader title={t('mgr.scout.latest')} action={{ label: t('mgr.scout.database'), to: '/manager/players' }} className="mb-2" />
        {recent.length === 0 ? (
          <EmptyState icon={Radar} title={t('mgr.scout.noReports')} message={t('mgr.scout.noReportsBody')} />
        ) : (
          <DataTable caption={t('mgr.scout.latestCaption')} head={[t('mgr.col.player'), t('mgr.col.age'), t('mgr.col.role'), t('mgr.col.rating'), t('mgr.col.potential'), t('mgr.col.price'), t('mgr.col.notes'), '']}>
            {recent.map(({ player, report }) => (
              <tr key={player.id} className="border-b border-line/60 last:border-0">
                <td className="px-2 py-2 font-semibold text-ink">
                  <Link to={`/manager/players?focus=${player.id}`} className="hover:text-brand-blue">{player.name}</Link>
                  {player.prospect ? <ToneBadge tone="gold" className="ml-1">{t('mgr.prospect')}</ToneBadge> : null}
                </td>
                <td className="px-2 py-2">{player.age}</td>
                <td className="px-2 py-2"><RoleTag player={player} /></td>
                <td className="px-2 py-2"><Estimate report={report} /></td>
                <td className="px-2 py-2"><Estimate report={report} field="potential" /></td>
                <td className="px-2 py-2"><Money lakh={report.estPrice} /></td>
                <td className="max-w-[220px] px-2 py-2 text-[12px] text-ink-muted">{report.notes[0]}</td>
                <td className="px-2 py-2">
                  <Button variant={state.shortlist.includes(player.id) ? 'ghost' : 'secondary'} className="min-h-9 px-3" aria-pressed={state.shortlist.includes(player.id)} onClick={() => replace(toggleShortlist(state, player.id))}>
                    {state.shortlist.includes(player.id) ? t('mgr.shortlisted') : t('mgr.shortlist')}
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
