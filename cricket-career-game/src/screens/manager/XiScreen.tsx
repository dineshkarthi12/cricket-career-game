/** Playing XI and team formation: pick eleven, order them, name the keeper and captain. Illegal XIs are refused. */
import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Crown, Wand2 } from 'lucide-react';
import { Card, CardHeader } from '@/components';
import { MANAGER, autoXi, canKeep, selectionAdvice, setPlayingXi, squadOf, xiProblems, battingOrder } from '@/engine/manager';
import { cn } from '@/lib/cn';
import { useT } from '@/i18n/react';
import { Button, Estimate, LockedNotice, PageHeader, RoleTag, Select, ToneBadge, fitnessTone, useManager } from './ui';

export default function XiScreen() {
  const t = useT();
  const { state, apply } = useManager();
  const f = state.franchises[state.franchiseId];
  const [xi, setXi] = useState<string[]>(state.tactics.xiIds);
  const [wk, setWk] = useState<string | null>(state.tactics.wicketkeeperId);
  const [captain, setCaptain] = useState<string | null>(state.tactics.captainId);
  useEffect(() => {
    setXi(state.tactics.xiIds);
    setWk(state.tactics.wicketkeeperId);
    setCaptain(state.tactics.captainId);
  }, [state.tactics]);

  const squad = squadOf(state, f.id);
  const problems = xiProblems(state, f.id, xi, wk);
  const advice = selectionAdvice(state, f.id, { ...state.tactics, xiIds: xi, wicketkeeperId: wk });
  const toggle = (id: string) => setXi((x) => (x.includes(id) ? x.filter((y) => y !== id) : x.length >= 11 ? x : [...x, id]));
  const move = (id: string, by: number) => setXi((x) => {
    const i = x.indexOf(id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= x.length) return x;
    const next = [...x];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const overseas = xi.filter((id) => state.players[id]?.overseas).length;
  const changed = JSON.stringify([xi, wk, captain]) !== JSON.stringify([state.tactics.xiIds, state.tactics.wicketkeeperId, state.tactics.captainId]);

  return (
    <div className="flex flex-col gap-3 pb-4">
      <PageHeader title={t('mgr.nav.xi')} subtitle={t('mgr.xi.sub', { n: xi.length, os: overseas, osMax: MANAGER.rules.overseasXiMax, bowl: MANAGER.rules.minBowlingOptions })}>
        <Button variant="secondary" onClick={() => {
          const auto = autoXi(state, f.id);
          setXi(auto.xiIds);
          setWk(auto.wicketkeeperId);
        }}>
          <Wand2 className="size-4" aria-hidden /> {t('mgr.xi.suggest')}
        </Button>
        <Button variant="secondary" onClick={() => setXi(battingOrder(xi.map((id) => state.players[id]).filter(Boolean)).map((p) => p.id))}>{t('mgr.xi.sortOrder')}</Button>
        <Button disabled={!changed || problems.length > 0} onClick={() => apply(setPlayingXi(state, xi, wk, captain), t('mgr.xi.saved'))}>{t('mgr.xi.save')}</Button>
      </PageHeader>
      <LockedNotice responsibility="SELECTION" state={state} />
      <div role="status" aria-live="polite">
        {problems.length ? (
          <ul className="rounded-card border border-brand-red/25 bg-brand-red/8 px-4 py-3 text-[13px] text-ink">
            {problems.map((p) => <li key={p}>{p}</li>)}
          </ul>
        ) : (
          <p className="rounded-card border border-brand-green/25 bg-brand-green/8 px-4 py-2 text-[13px] text-ink">{changed ? t('mgr.xi.legalSave') : t('mgr.xi.legal')}</p>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('mgr.xi.battingOrder')} className="mb-2" />
          <ol className="grid gap-1.5">
            {xi.map((id, i) => {
              const p = state.players[id];
              if (!p) return null;
              return (
                <li key={id} className="flex items-center gap-2 rounded-lg bg-page px-2 py-1.5">
                  <span className="w-5 text-center text-[12px] font-semibold text-ink-muted">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 truncate text-[13px] font-semibold text-ink">
                      {p.name}
                      {captain === id ? <Crown className="size-3.5 fill-brand-gold text-brand-gold" aria-label={t('mgr.xi.captain')} /> : null}
                      {wk === id ? <span className="rounded bg-brand-blue-soft px-1 text-[10px] font-bold text-brand-blue">WK</span> : null}
                    </span>
                    <RoleTag player={p} />
                  </span>
                  <button type="button" aria-label={t('mgr.xi.moveUp', { name: p.name })} onClick={() => move(id, -1)} className="grid size-10 place-items-center rounded-lg text-ink-muted hover:bg-surface disabled:opacity-30" disabled={i === 0}><ArrowUp className="size-4" /></button>
                  <button type="button" aria-label={t('mgr.xi.moveDown', { name: p.name })} onClick={() => move(id, 1)} className="grid size-10 place-items-center rounded-lg text-ink-muted hover:bg-surface disabled:opacity-30" disabled={i === xi.length - 1}><ArrowDown className="size-4" /></button>
                </li>
              );
            })}
          </ol>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Select label={t('mgr.xi.keeper')} value={wk ?? ''} options={[{ id: '', label: t('mgr.choose') }, ...xi.filter((id) => state.players[id] && canKeep(state.players[id])).map((id) => ({ id, label: state.players[id].name }))]} onChange={(v) => setWk(v || null)} />
            <Select label={t('mgr.xi.captain')} value={captain ?? ''} options={[{ id: '', label: t('mgr.choose') }, ...xi.map((id) => ({ id, label: state.players[id]?.name ?? id }))]} onChange={(v) => setCaptain(v || null)} />
          </div>
          {advice.length ? (
            <div className="mt-3 rounded-lg bg-brand-blue-soft px-3 py-2">
              <p className="text-[12px] font-semibold text-brand-blue">{t('mgr.xi.analyst')}</p>
              <ul className="mt-1 list-disc pl-5 text-[12.5px] text-ink">{advice.map((a) => <li key={a}>{a}</li>)}</ul>
            </div>
          ) : null}
        </Card>

        <Card>
          <CardHeader title={t('mgr.nav.squad')} subtitle={t('mgr.xi.tap')} className="mb-2" />
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {squad.map((p) => {
              const on = xi.includes(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    disabled={p.injuredWeeks > 0 && !on}
                    onClick={() => toggle(p.id)}
                    className={cn('flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border px-3 py-1.5 text-left focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:outline-none disabled:opacity-45', on ? 'border-brand-blue bg-brand-blue-soft' : 'border-line bg-surface hover:bg-page')}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-ink">{p.name}</span>
                      <RoleTag player={p} />
                    </span>
                    <span className="flex flex-col items-end gap-0.5">
                      <Estimate report={state.reports[p.id]} />
                      {p.injuredWeeks > 0 ? <ToneBadge tone="red">{t('mgr.injured')}</ToneBadge> : <ToneBadge tone={fitnessTone(p.condition.fatigue)}>{Math.round(100 - p.condition.fatigue)}%</ToneBadge>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}
