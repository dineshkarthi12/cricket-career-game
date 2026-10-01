/** The player database and shortlist: everyone the scouts know, filtered and compared. */
import { useMemo, useState } from 'react';
import { Search, Users } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Card, EmptyState, Modal, Tabs } from '@/components';
import { REGION_LABEL, setTarget, toggleShortlist, watchPlayer } from '@/engine/manager';
import type { PlayerRole } from '@/types';
import type { ManagedPlayer, ManagerState } from '@/types/manager';
import { roleLabel } from '@/lib/format';
import { Button, DataTable, Estimate, Money, PageHeader, RoleTag, Select, StatLine, ToneBadge, shortOf, useManager } from './ui';

type View = 'known' | 'shortlist' | 'free' | 'prospects' | 'mine';
const ROLES: (PlayerRole | 'ANY')[] = ['ANY', 'OPENING_BATTER', 'BATTER', 'WICKET_KEEPER_BATTER', 'BATTING_ALLROUNDER', 'BOWLING_ALLROUNDER', 'PACE_BOWLER', 'SPIN_BOWLER'];

export default function PlayersScreen() {
  const { state, replace } = useManager();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<View>('known');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<PlayerRole | 'ANY'>('ANY');
  const focus = params.get('focus');

  const rows = useMemo(() => {
    const mine = new Set(state.franchises[state.franchiseId].squadIds);
    return Object.values(state.players)
      .filter((p) => !p.retired)
      .filter((p) => {
        if (view === 'mine') return mine.has(p.id);
        if (view === 'shortlist') return state.shortlist.includes(p.id);
        if (!state.reports[p.id]) return false;
        if (view === 'free') return !p.contract;
        if (view === 'prospects') return p.prospect;
        return true;
      })
      .filter((p) => role === 'ANY' || p.role === role)
      .filter((p) => !query.trim() || p.name.toLowerCase().includes(query.trim().toLowerCase()))
      .sort((a, b) => (state.reports[b.id]?.estOverall ?? 0) - (state.reports[a.id]?.estOverall ?? 0))
      .slice(0, 120);
  }, [state, view, role, query]);

  const selected = focus ? state.players[focus] : null;

  return (
    <div className="flex flex-col gap-3 pb-4">
      <PageHeader title="Player database" subtitle="Only what your scouts know. Ratings are estimates with a margin of error." />
      <Card className="flex flex-col gap-3">
        <Tabs
          label="Player lists"
          value={view}
          onChange={(v) => setView(v as View)}
          tabs={[
            { id: 'known', label: `All known (${Object.keys(state.reports).length})` },
            { id: 'shortlist', label: `Shortlist (${state.shortlist.length})` },
            { id: 'free', label: 'Unsigned' },
            { id: 'prospects', label: 'Prospects' },
            { id: 'mine', label: 'My squad' },
          ]}
        />
        <div className="flex flex-wrap items-end gap-3">
          <label className="relative min-w-[200px] flex-1">
            <span className="text-[12px] font-semibold text-ink-muted">Search</span>
            <Search className="pointer-events-none absolute bottom-3.5 left-3 size-4 text-ink-soft" aria-hidden />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Player name" className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface pr-3 pl-9 text-[13px] focus:border-brand-blue/50 focus:ring-2 focus:ring-brand-blue/15 focus:outline-none" />
          </label>
          <Select className="w-56" label="Role" value={role} options={ROLES.map((r) => ({ id: r, label: r === 'ANY' ? 'Any role' : roleLabel(r) }))} onChange={setRole} />
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={Users} title="Nobody here yet" message={view === 'shortlist' ? 'Add players to your shortlist from their profile or the scouting reports.' : 'Scout more regions to fill the database.'} />
        ) : (
          <DataTable caption="Players" head={['Player', 'Age', 'Role', 'Team', 'Rating', 'Potential', 'Base', '']}>
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-line/60 last:border-0">
                <td className="px-2 py-2">
                  <button type="button" className="text-left font-semibold text-ink hover:text-brand-blue focus-visible:underline focus-visible:outline-none" onClick={() => setParams({ focus: p.id })}>
                    {p.name}
                  </button>
                  {p.prospect ? <ToneBadge tone="gold" className="ml-1">Prospect</ToneBadge> : null}
                </td>
                <td className="px-2 py-2">{p.age}</td>
                <td className="px-2 py-2"><RoleTag player={p} /></td>
                <td className="px-2 py-2">{p.contract ? shortOf(state, p.contract.franchiseId) : <span className="text-ink-muted">Unsigned</span>}</td>
                <td className="px-2 py-2"><Estimate report={state.reports[p.id]} /></td>
                <td className="px-2 py-2"><Estimate report={state.reports[p.id]} field="potential" /></td>
                <td className="px-2 py-2"><Money lakh={p.basePrice} /></td>
                <td className="px-2 py-2">
                  <Button variant={state.shortlist.includes(p.id) ? 'ghost' : 'secondary'} className="min-h-9 px-3" aria-pressed={state.shortlist.includes(p.id)} onClick={() => replace(toggleShortlist(state, p.id))}>
                    {state.shortlist.includes(p.id) ? '★' : '☆'}
                    <span className="sr-only">{state.shortlist.includes(p.id) ? 'Remove from shortlist' : 'Add to shortlist'}</span>
                  </Button>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>
      {selected ? <PlayerModal state={state} player={selected} onClose={() => setParams({})} /> : null}
    </div>
  );
}

export function PlayerModal({ state, player, onClose }: { state: ManagerState; player: ManagedPlayer; onClose: () => void }) {
  const { apply, replace } = useManager();
  const report = state.reports[player.id];
  const mine = player.contract?.franchiseId === state.franchiseId;
  const [maxBid, setMaxBid] = useState(String(report?.estPrice ?? player.basePrice));
  const s = player.season;
  const c = player.career;
  return (
    <Modal open onClose={onClose} title={player.name} subtitle={`${roleLabel(player.role)} · age ${player.age} · ${player.nationality}${player.overseas ? ' (overseas)' : ''}`}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-[12px] font-semibold tracking-wide text-ink-muted uppercase">Scouting report</p>
          {report ? (
            <>
              <StatLine label="Estimated T20 rating" value={<Estimate report={report} />} />
              <StatLine label="Estimated potential" value={<Estimate report={report} field="potential" />} />
              <StatLine label="Fitness" value={report.estFitness.toLowerCase()} />
              <StatLine label="Temperament" value={report.estTemperament.replace('_', ' ').toLowerCase()} />
              <StatLine label="Consistency" value={report.estConsistency.toLowerCase()} />
              <StatLine label="Expected price" value={<Money lakh={report.estPrice} />} />
              <StatLine label="Looks" value={`${report.observations}${report.trialled ? ' (trialled)' : ''}`} />
              <StatLine label="Rival interest" value={report.rivalInterest.length ? report.rivalInterest.map((id) => shortOf(state, id)).join(', ') : 'None seen'} />
              <ul className="mt-2 list-disc pl-5 text-[12.5px] text-ink">
                {report.notes.map((n) => <li key={n}>{n}</li>)}
              </ul>
            </>
          ) : (
            <p className="text-[13px] text-ink-muted">Not scouted.</p>
          )}
        </div>
        <div>
          <p className="mb-1 text-[12px] font-semibold tracking-wide text-ink-muted uppercase">Record</p>
          <StatLine label="Region" value={REGION_LABEL[player.region]} />
          <StatLine label="Contract" value={player.contract ? `${shortOf(state, player.contract.franchiseId)} · ${player.contract.years} yr` : 'Unsigned'} hint={player.contract ? `${player.contract.salary} lakh/season` : undefined} />
          <StatLine label="Base price" value={<Money lakh={player.basePrice} />} />
          <StatLine label="This season" value={`${s.matches} m · ${s.runs} runs · ${s.wickets} wkts`} />
          <StatLine label="Career (in this save)" value={`${c.matches} m · ${c.runs} runs · ${c.wickets} wkts`} />
          {mine ? <StatLine label="Fitness / form" value={`${Math.round(100 - player.condition.fatigue)}% · ${Math.round(player.condition.form)}`} /> : null}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <Button variant="secondary" onClick={() => apply(watchPlayer(state, player.id), `A scout will watch ${player.name} closely.`)}>Watch closely</Button>
        <Button variant={state.shortlist.includes(player.id) ? 'ghost' : 'secondary'} onClick={() => replace(toggleShortlist(state, player.id))}>
          {state.shortlist.includes(player.id) ? 'Remove from shortlist' : 'Add to shortlist'}
        </Button>
        {!player.contract ? (
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              apply(setTarget(state, player.id, Number(maxBid) || 0, 'HIGH'), 'Added to your auction targets.');
            }}
          >
            <label className="text-[12px] font-semibold text-ink-muted">
              Max bid (lakh)
              <input inputMode="numeric" value={maxBid} onChange={(e) => setMaxBid(e.target.value.replace(/\D/g, ''))} className="mt-1 block min-h-11 w-28 rounded-lg border border-line px-3 text-[13px]" />
            </label>
            <Button type="submit">Set as target</Button>
          </form>
        ) : null}
      </div>
    </Modal>
  );
}
