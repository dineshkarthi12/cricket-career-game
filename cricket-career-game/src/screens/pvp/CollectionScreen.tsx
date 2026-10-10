/**
 * Player Collection: every card in the game, owned or not, with filters,
 * collection progress by series, and a large inspection view where a card
 * can be flipped and trained (within its rating cap).
 */
import { useMemo, useState } from 'react';
import { ArrowUpCircle, RotateCcw, Search } from 'lucide-react';
import { Card, Modal, ProgressBar } from '@/components';
import {
  CATALOG,
  TIER_ORDER,
  TIER_RULES,
  maxUpgradeLevel,
  upgradeCap,
  upgradeCost,
  type CardRole,
  type CardTier,
  type PlayerCard,
} from '@/engine/pvp';
import { cn } from '@/lib/cn';
import { usePvpStore } from '@/store/pvpStore';
import { rich, useLang, useT } from '@/i18n/react';
import { acquisitionLabel, bowlingStyleLabel, roleLabel, seriesLabel, tierLabel } from './labels';
import { PlayerCard3D } from './cards/PlayerCard3D';
import { Price, SectionTitle, chip, primaryButton } from './ui';

type Owned = 'all' | 'owned' | 'missing';

export default function CollectionScreen() {
  const profile = usePvpStore((s) => s.profile)!;
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<CardRole | 'ALL'>('ALL');
  const [tier, setTier] = useState<CardTier | 'ALL'>('ALL');
  const [owned, setOwned] = useState<Owned>('owned');
  const [inspect, setInspect] = useState<PlayerCard | null>(null);
  const t = useT();
  const ownedBy = useMemo(() => new Map(profile.inventory.map((o) => [o.cardId, o])), [profile.inventory]);

  const list = CATALOG.filter((c) => (role === 'ALL' || c.role === role) && (tier === 'ALL' || c.tier === tier))
    .filter((c) => (owned === 'all' ? true : owned === 'owned' ? ownedBy.has(c.id) : !ownedBy.has(c.id)))
    .filter((c) => !query || c.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => (ownedBy.get(b.id)?.upgrades ?? 0) + b.overall - ((ownedBy.get(a.id)?.upgrades ?? 0) + a.overall));

  const series = [...new Set(CATALOG.map((c) => c.series))];

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle title={t('pvp.nav.collection')} subtitle={t('pvp.col.subtitle', { n: ownedBy.size, total: CATALOG.length })} />

      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {series.map((s) => {
            const all = CATALOG.filter((c) => c.series === s);
            const have = all.filter((c) => ownedBy.has(c.id)).length;
            return (
              <div key={s}>
                <div className="flex justify-between text-[12.5px]">
                  <span className="font-semibold text-ink">{seriesLabel(t, s)}</span>
                  <span className="text-ink-muted">
                    {have}/{all.length}
                  </span>
                </div>
                <ProgressBar value={(have / all.length) * 100} tone={all[0].cls === 'FREE' ? 'blue' : 'gold'} className="mt-1" label={t('pvp.col.progress', { name: seriesLabel(t, s) })} />
              </div>
            );
          })}
        </div>
      </Card>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-w-[200px] flex-1 items-center gap-2 rounded-xl bg-surface px-3 py-2 shadow-sm">
            <Search className="size-4 text-ink-soft" aria-hidden />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('pvp.col.search')} className="w-full bg-transparent text-[13px] outline-none" aria-label={t('pvp.col.search')} />
          </label>
          {(['owned', 'missing', 'all'] as Owned[]).map((o) => (
            <button key={o} type="button" className={chip(owned === o)} onClick={() => setOwned(o)}>
              {t(o === 'owned' ? 'pvp.owned' : o === 'missing' ? 'pvp.col.missing' : 'pvp.all')}
            </button>
          ))}
        </div>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
          {(['ALL', 'BATTER', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER'] as const).map((r) => (
            <button key={r} type="button" className={chip(role === r)} onClick={() => setRole(r)}>
              {r === 'ALL' ? t('pvp.allRoles') : roleLabel(t, r)}
            </button>
          ))}
          <span className="mx-1 w-px shrink-0 bg-line" />
          {(['ALL', ...TIER_ORDER] as const).map((k) => (
            <button key={k} type="button" className={chip(tier === k)} onClick={() => setTier(k)}>
              {k === 'ALL' ? t('pvp.allTiers') : `${tierLabel(t, k)} ${TIER_RULES[k].min}-${TIER_RULES[k].max}`}
            </button>
          ))}
        </div>
      </div>

      {list.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] justify-items-center gap-x-3 gap-y-4 sm:grid-cols-[repeat(auto-fill,minmax(176px,1fr))]">
          {list.map((c) => {
            const o = ownedBy.get(c.id);
            return <PlayerCard3D key={c.id} card={c} upgrades={o?.upgrades ?? 0} owned={Boolean(o)} onClick={() => setInspect(c)} className="w-full max-w-[176px]" />;
          })}
        </div>
      ) : (
        <Card>
          <p className="text-[13px] text-ink-muted">{t('pvp.col.none')}</p>
        </Card>
      )}

      <InspectModal card={inspect} onClose={() => setInspect(null)} />
    </div>
  );
}

export function InspectModal({ card, onClose }: { card: PlayerCard | null; onClose: () => void }) {
  const profile = usePvpStore((s) => s.profile)!;
  const economy = usePvpStore((s) => s.economy);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const t = useT();
  const lang = useLang();
  if (!card) return null;
  const owned = profile.inventory.find((o) => o.cardId === card.id);
  const level = owned?.upgrades ?? 0;
  const max = maxUpgradeLevel(card);
  const next = level + 1;
  const cost = upgradeCost(card, next);
  const upgrade = async () => {
    if (!owned) return;
    setBusy(true);
    await economy('upgrade', { instanceId: owned.instanceId });
    setBusy(false);
  };
  return (
    <Modal open onClose={onClose} title={card.name} subtitle={`${roleLabel(t, card.role)} · ${tierLabel(t, card.tier)} · ${seriesLabel(t, card.series)}`}>
      <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center gap-2">
          <PlayerCard3D card={card} upgrades={level} owned={Boolean(owned)} size="lg" flipped={flipped} />
          <button type="button" onClick={() => setFlipped((f) => !f)} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-blue">
            <RotateCcw className="size-3.5" aria-hidden />
            {t('pvp.col.flip')}
          </button>
        </div>
        <div className="flex flex-col gap-3 text-[13px]">
          <dl className="grid grid-cols-2 gap-2">
            <Info label={t('pvp.attr.overall')} value={level ? t('pvp.col.withBase', { n: card.overall + level, b: card.overall }) : `${card.overall + level}`} />
            <Info label={t('pvp.col.cap')} value={`${upgradeCap(card)}`} />
            <Info label={t('pvp.col.class')} value={t(card.cls === 'FREE' ? 'pvp.col.clsFree' : 'pvp.col.clsPremium')} />
            <Info label={t('pvp.col.era')} value={t(card.era === 'LEGEND' ? 'pvp.col.eraLegend' : 'pvp.col.eraCurrent')} />
            <Info label={t('pvp.attr.batting')} value={t(card.battingStyle === 'LEFT_HAND_BAT' ? 'pvp.col.leftHanded' : 'pvp.col.rightHanded')} />
            <Info label={t('pvp.attr.bowling')} value={card.bowlingStyle === 'NONE' ? t('pvp.col.noBowl') : bowlingStyleLabel(t, lang, card.bowlingStyle)} />
          </dl>
          <div>
            <p className="text-[11.5px] font-semibold tracking-wide text-ink-muted uppercase">{t('pvp.col.howToGet')}</p>
            <p className="mt-0.5">{card.acquisition.map((a) => acquisitionLabel(t, a)).join(' · ')}</p>
          </div>
          <div className={cn('rounded-tile p-3', owned ? 'bg-brand-blue-soft' : 'bg-page')}>
            {owned ? (
              <>
                <p className="font-semibold text-ink">{t('pvp.col.level', { n: level, max })}</p>
                {next <= max ? (
                  <button type="button" disabled={busy || profile.coins < cost} onClick={upgrade} className={primaryButton('mt-2 w-full')}>
                    <ArrowUpCircle className="size-4" aria-hidden />
                    <span>{rich(t('pvp.col.train', { n: card.overall + next }), { price: <Price currency="COINS" amount={cost} /> })}</span>
                  </button>
                ) : (
                  <p className="mt-1 text-[12.5px] text-ink-muted">{t('pvp.col.atCap', { tier: tierLabel(t, card.tier), note: card.cls === 'FREE' ? t('pvp.col.freeNote') : '' })}</p>
                )}
              </>
            ) : (
              <p className="text-ink-muted">{t('pvp.col.notOwned')}</p>
            )}
          </div>
          <p className="text-[11.5px] text-ink-muted">{t('pvp.col.disclaimer')}</p>
        </div>
      </div>
    </Modal>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-tile bg-page px-3 py-2">
      <dt className="text-[10.5px] font-semibold tracking-wide text-ink-muted uppercase">{label}</dt>
      <dd className="font-semibold text-ink">{value}</dd>
    </div>
  );
}

