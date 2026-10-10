/** The player database and shortlist: everyone the scouts know, filtered and compared. */
import { useMemo, useState } from 'react';
import { Search, Users } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Card, EmptyState, Modal, Tabs } from '@/components';
import { setTarget, toggleShortlist, watchPlayer } from '@/engine/manager';
import { useT } from '@/i18n/react';
import type { PlayerRole } from '@/types';
import type { ManagedPlayer, ManagerState } from '@/types/manager';
import { roleLabel } from '@/lib/format';
import { Button, DataTable, Estimate, Money, PageHeader, RoleTag, Select, StatLine, ToneBadge, shortOf, useManager } from './ui';

type View = 'known' | 'shortlist' | 'free' | 'prospects' | 'mine';
const ROLES: (PlayerRole | 'ANY')[] = ['ANY', 'OPENING_BATTER', 'BATTER', 'WICKET_KEEPER_BATTER', 'BATTING_ALLROUNDER', 'BOWLING_ALLROUNDER', 'PACE_BOWLER', 'SPIN_BOWLER'];

export default function PlayersScreen() {
  const t = useT();
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
      <PageHeader title={t('mgr.scout.database')} subtitle={t('mgr.pl.sub')} />
      <Card className="flex flex-col gap-3">
        <Tabs
          label={t('mgr.pl.lists')}
          value={view}
          onChange={(v) => setView(v as View)}
          tabs={[
            { id: 'known', label: t('mgr.pl.known', { n: Object.keys(state.reports).length }) },
            { id: 'shortlist', label: t('mgr.pl.shortlistN', { n: state.shortlist.length }) },
            { id: 'free', label: t('mgr.unsigned') },
            { id: 'prospects', label: t('mgr.pl.prospects') },
            { id: 'mine', label: t('mgr.pl.mine') },
          ]}
        />
        <div className="flex flex-wrap items-end gap-3">
          <label className="relative min-w-[200px] flex-1">
            <span className="text-[12px] font-semibold text-ink-muted">{t('mgr.pl.search')}</span>
            <Search className="pointer-events-none absolute bottom-3.5 left-3 size-4 text-ink-soft" aria-hidden />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('mgr.pl.namePlaceholder')} className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface pr-3 pl-9 text-[13px] focus:border-brand-blue/50 focus:ring-2 focus:ring-brand-blue/15 focus:outline-none" />
          </label>
          <Select className="w-56" label={t('mgr.col.role')} value={role} options={ROLES.map((r) => ({ id: r, label: r === 'ANY' ? t('mgr.scout.anyRole') : roleLabel(r) }))} onChange={setRole} />
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={Users} title={t('mgr.pl.nobody')} message={view === 'shortlist' ? t('mgr.pl.nobodyShortlist') : t('mgr.pl.nobodyBody')} />
        ) : (
          <DataTable caption={t('mgr.nav.players')} head={[t('mgr.col.player'), t('mgr.col.age'), t('mgr.col.role'), t('mgr.col.team'), t('mgr.col.rating'), t('mgr.col.potential'), t('mgr.col.base'), '']}>
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-line/60 last:border-0">
                <td className="px-2 py-2">
                  <button type="button" className="text-left font-semibold text-ink hover:text-brand-blue focus-visible:underline focus-visible:outline-none" onClick={() => setParams({ focus: p.id })}>
                    {p.name}
                  </button>
                  {p.prospect ? <ToneBadge tone="gold" className="ml-1">{t('mgr.prospect')}</ToneBadge> : null}
                </td>
                <td className="px-2 py-2">{p.age}</td>
                <td className="px-2 py-2"><RoleTag player={p} /></td>
                <td className="px-2 py-2">{p.contract ? shortOf(state, p.contract.franchiseId) : <span className="text-ink-muted">{t('mgr.unsigned')}</span>}</td>
                <td className="px-2 py-2"><Estimate report={state.reports[p.id]} /></td>
                <td className="px-2 py-2"><Estimate report={state.reports[p.id]} field="potential" /></td>
                <td className="px-2 py-2"><Money lakh={p.basePrice} /></td>
                <td className="px-2 py-2">
                  <Button variant={state.shortlist.includes(p.id) ? 'ghost' : 'secondary'} className="min-h-9 px-3" aria-pressed={state.shortlist.includes(p.id)} onClick={() => replace(toggleShortlist(state, p.id))}>
                    {state.shortlist.includes(p.id) ? '★' : '☆'}
                    <span className="sr-only">{state.shortlist.includes(p.id) ? t('mgr.pl.unshortlist') : t('mgr.pl.addShortlist')}</span>
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
  const t = useT();
  const { apply, replace } = useManager();
  const report = state.reports[player.id];
  const mine = player.contract?.franchiseId === state.franchiseId;
  const [maxBid, setMaxBid] = useState(String(report?.estPrice ?? player.basePrice));
  const s = player.season;
  const c = player.career;
  return (
    <Modal open onClose={onClose} title={player.name} subtitle={`${roleLabel(player.role)} · ${t('mgr.ageN', { n: player.age })} · ${player.nationality}${player.overseas ? ` ${t('mgr.pl.overseasParen')}` : ''}`}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-[12px] font-semibold tracking-wide text-ink-muted uppercase">{t('mgr.pl.report')}</p>
          {report ? (
            <>
              <StatLine label={t('mgr.pl.estRating')} value={<Estimate report={report} />} />
              <StatLine label={t('mgr.pl.estPotential')} value={<Estimate report={report} field="potential" />} />
              <StatLine label={t('mgr.col.fitness')} value={t(`mgr.est.fit.${report.estFitness}`)} />
              <StatLine label={t('mgr.pl.temperament')} value={t(`mgr.est.temp.${report.estTemperament}`)} />
              <StatLine label={t('mgr.pl.consistency')} value={t(`mgr.est.cons.${report.estConsistency}`)} />
              <StatLine label={t('mgr.pl.expectedPrice')} value={<Money lakh={report.estPrice} />} />
              <StatLine label={t('mgr.pl.looks')} value={`${report.observations}${report.trialled ? ` ${t('mgr.pl.trialled')}` : ''}`} />
              <StatLine label={t('mgr.pl.rivalInterest')} value={report.rivalInterest.length ? report.rivalInterest.map((id) => shortOf(state, id)).join(', ') : t('mgr.pl.noneSeen')} />
              <ul className="mt-2 list-disc pl-5 text-[12.5px] text-ink">
                {report.notes.map((n) => <li key={n}>{n}</li>)}
              </ul>
            </>
          ) : (
            <p className="text-[13px] text-ink-muted">{t('mgr.pl.notScouted')}</p>
          )}
        </div>
        <div>
          <p className="mb-1 text-[12px] font-semibold tracking-wide text-ink-muted uppercase">{t('mgr.pl.record')}</p>
          <StatLine label={t('mgr.scout.region')} value={t(`mgr.region.${player.region}`)} />
          <StatLine label={t('mgr.col.contract')} value={player.contract ? `${shortOf(state, player.contract.franchiseId)} · ${t('mgr.pl.yr', { n: player.contract.years })}` : t('mgr.unsigned')} hint={player.contract ? t('mgr.pl.lakhSeason', { n: player.contract.salary }) : undefined} />
          <StatLine label={t('mgr.auc.basePrice')} value={<Money lakh={player.basePrice} />} />
          <StatLine label={t('mgr.pl.thisSeason')} value={t('mgr.pl.statLine', { m: s.matches, r: s.runs, w: s.wickets })} />
          <StatLine label={t('mgr.pl.careerSave')} value={t('mgr.pl.statLine', { m: c.matches, r: c.runs, w: c.wickets })} />
          {mine ? <StatLine label={t('mgr.pl.fitnessForm')} value={`${Math.round(100 - player.condition.fatigue)}% · ${Math.round(player.condition.form)}`} /> : null}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <Button variant="secondary" onClick={() => apply(watchPlayer(state, player.id), t('mgr.pl.watchToast', { name: player.name }))}>{t('mgr.pl.watch')}</Button>
        <Button variant={state.shortlist.includes(player.id) ? 'ghost' : 'secondary'} onClick={() => replace(toggleShortlist(state, player.id))}>
          {state.shortlist.includes(player.id) ? t('mgr.pl.unshortlist') : t('mgr.pl.addShortlist')}
        </Button>
        {!player.contract ? (
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              apply(setTarget(state, player.id, Number(maxBid) || 0, 'HIGH'), t('mgr.pl.targetToast'));
            }}
          >
            <label className="text-[12px] font-semibold text-ink-muted">
              {t('mgr.pl.maxBidLakh')}
              <input inputMode="numeric" value={maxBid} onChange={(e) => setMaxBid(e.target.value.replace(/\D/g, ''))} className="mt-1 block min-h-11 w-28 rounded-lg border border-line px-3 text-[13px]" />
            </label>
            <Button type="submit">{t('mgr.pl.setTarget')}</Button>
          </form>
        ) : null}
      </div>
    </Modal>
  );
}
