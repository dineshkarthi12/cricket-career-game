/**
 * Player Collection: every card in the game, owned or not, with filters,
 * collection progress by series, and a large inspection view where a card
 * can be flipped and trained (within its rating cap).
 */
import { useMemo, useState } from 'react';
import { ArrowUpCircle, RotateCcw, Search } from 'lucide-react';
import { Card, Modal, ProgressBar } from '@/components';
import {
  ACQUISITION_LABEL,
  CATALOG,
  ROLE_LABEL,
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
  const ownedBy = useMemo(() => new Map(profile.inventory.map((o) => [o.cardId, o])), [profile.inventory]);

  const list = CATALOG.filter((c) => (role === 'ALL' || c.role === role) && (tier === 'ALL' || c.tier === tier))
    .filter((c) => (owned === 'all' ? true : owned === 'owned' ? ownedBy.has(c.id) : !ownedBy.has(c.id)))
    .filter((c) => !query || c.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => (ownedBy.get(b.id)?.upgrades ?? 0) + b.overall - ((ownedBy.get(a.id)?.upgrades ?? 0) + a.overall));

  const series = [...new Set(CATALOG.map((c) => c.series))];

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle title="Player Collection" subtitle={`${ownedBy.size} of ${CATALOG.length} players collected. All players are fictional.`} />

      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {series.map((s) => {
            const all = CATALOG.filter((c) => c.series === s);
            const have = all.filter((c) => ownedBy.has(c.id)).length;
            return (
              <div key={s}>
                <div className="flex justify-between text-[12.5px]">
                  <span className="font-semibold text-ink">{s}</span>
                  <span className="text-ink-muted">
                    {have}/{all.length}
                  </span>
                </div>
                <ProgressBar value={(have / all.length) * 100} tone={all[0].cls === 'FREE' ? 'blue' : 'gold'} className="mt-1" label={`${s} progress`} />
              </div>
            );
          })}
        </div>
      </Card>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-w-[200px] flex-1 items-center gap-2 rounded-xl bg-surface px-3 py-2 shadow-sm">
            <Search className="size-4 text-ink-soft" aria-hidden />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search players" className="w-full bg-transparent text-[13px] outline-none" aria-label="Search players" />
          </label>
          {(['owned', 'missing', 'all'] as Owned[]).map((o) => (
            <button key={o} type="button" className={chip(owned === o)} onClick={() => setOwned(o)}>
              {o === 'owned' ? 'Owned' : o === 'missing' ? 'Not owned' : 'All'}
            </button>
          ))}
        </div>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
          {(['ALL', 'BATTER', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER'] as const).map((r) => (
            <button key={r} type="button" className={chip(role === r)} onClick={() => setRole(r)}>
              {r === 'ALL' ? 'All roles' : ROLE_LABEL[r]}
            </button>
          ))}
          <span className="mx-1 w-px shrink-0 bg-line" />
          {(['ALL', ...TIER_ORDER] as const).map((t) => (
            <button key={t} type="button" className={chip(tier === t)} onClick={() => setTier(t)}>
              {t === 'ALL' ? 'All tiers' : `${TIER_RULES[t].label} ${TIER_RULES[t].min}-${TIER_RULES[t].max}`}
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
          <p className="text-[13px] text-ink-muted">No players match these filters.</p>
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
    <Modal open onClose={onClose} title={card.name} subtitle={`${ROLE_LABEL[card.role]} · ${TIER_RULES[card.tier].label} · ${card.series}`}>
      <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center gap-2">
          <PlayerCard3D card={card} upgrades={level} owned={Boolean(owned)} size="lg" flipped={flipped} />
          <button type="button" onClick={() => setFlipped((f) => !f)} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-blue">
            <RotateCcw className="size-3.5" aria-hidden />
            Flip card
          </button>
        </div>
        <div className="flex flex-col gap-3 text-[13px]">
          <dl className="grid grid-cols-2 gap-2">
            <Info label="Overall" value={`${card.overall + level}${level ? ` (base ${card.overall})` : ''}`} />
            <Info label="Rating cap" value={`${upgradeCap(card)}`} />
            <Info label="Class" value={card.cls === 'FREE' ? 'Free (45-65)' : 'Premium (70-99)'} />
            <Info label="Era" value={card.era === 'LEGEND' ? 'Retired legend' : 'Current'} />
            <Info label="Batting" value={card.battingStyle === 'LEFT_HAND_BAT' ? 'Left-handed' : 'Right-handed'} />
            <Info label="Bowling" value={card.bowlingStyle === 'NONE' ? 'Does not bowl' : card.bowlingStyle.replaceAll('_', ' ').toLowerCase()} />
          </dl>
          <div>
            <p className="text-[11.5px] font-semibold tracking-wide text-ink-muted uppercase">How to get</p>
            <p className="mt-0.5">{card.acquisition.map((a) => ACQUISITION_LABEL[a]).join(' · ')}</p>
          </div>
          <div className={cn('rounded-tile p-3', owned ? 'bg-brand-blue-soft' : 'bg-page')}>
            {owned ? (
              <>
                <p className="font-semibold text-ink">Owned · training level {level} of {max}</p>
                {next <= max ? (
                  <button type="button" disabled={busy || profile.coins < cost} onClick={upgrade} className={primaryButton('mt-2 w-full')}>
                    <ArrowUpCircle className="size-4" aria-hidden />
                    Train to {card.overall + next} for <Price currency="COINS" amount={cost} />
                  </button>
                ) : (
                  <p className="mt-1 text-[12.5px] text-ink-muted">At the cap for a {TIER_RULES[card.tier].label} card{card.cls === 'FREE' ? ' (free players never pass 65)' : ''}.</p>
                )}
              </>
            ) : (
              <p className="text-ink-muted">Not in your collection yet.</p>
            )}
          </div>
          <p className="text-[11.5px] text-ink-muted">A fictional player with an original illustrated portrait. Ratings are gameplay values only, not real statistics.</p>
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

