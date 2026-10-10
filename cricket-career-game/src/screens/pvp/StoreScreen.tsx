/**
 * Packs & Store. Every pack shows its price, contents and the exact odds of
 * every card slot before purchase. Opening is: choose, read the odds, confirm,
 * watch the pack open, then reveal each card. Packs are bought with coins
 * (earned), event tokens (missions) or gems (development currency only -
 * no real-money purchase exists).
 */
import { useState } from 'react';
import { ChevronDown, Gem, Info, PackageOpen, Sparkles } from 'lucide-react';
import { Badge, Card, Modal } from '@/components';
import { CATALOG_BY_ID, ECONOMY, PACKS, TIER_RULES, type PackDefinition, type Transaction } from '@/engine/pvp';
import { cn } from '@/lib/cn';
import { usePvpStore } from '@/store/pvpStore';
import { useT } from '@/i18n/react';
import { packDescription, packGuarantee, packName, tierLabel } from './labels';
import { PlayerCard3D } from './cards/PlayerCard3D';
import { Price, SectionTitle, formatNumber, primaryButton, secondaryButton } from './ui';

export default function StoreScreen() {
  const profile = usePvpStore((s) => s.profile)!;
  const backend = usePvpStore((s) => s.backend);
  const economy = usePvpStore((s) => s.economy);
  const [confirm, setConfirm] = useState<PackDefinition | null>(null);
  const [opening, setOpening] = useState<{ pack: PackDefinition; txn: Transaction | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const t = useT();

  const balance = (p: PackDefinition) => (p.currency === 'COINS' ? profile.coins : p.currency === 'GEMS' ? profile.gems : profile.eventTokens);

  const buy = async (pack: PackDefinition) => {
    setConfirm(null);
    setBusy(true);
    setOpening({ pack, txn: null });
    const r = await economy('openPack', { packId: pack.id });
    setBusy(false);
    if (r.ok && r.data.txn) setOpening({ pack, txn: r.data.txn });
    else setOpening(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle title={t('pvp.nav.store')} subtitle={t('pvp.store.subtitle')} />

      {!profile.starterClaimed ? (
        <Card className="border-brand-gold/50">
          <div className="flex flex-wrap items-center gap-3">
            <PackageOpen className="size-6 text-brand-gold" aria-hidden />
            <p className="flex-1 text-[14px] font-semibold">{t('pvp.store.starter')}</p>
            <button
              type="button"
              disabled={busy}
              className={primaryButton()}
              onClick={async () => {
                setBusy(true);
                const r = await economy('claimStarter');
                setBusy(false);
                if (r.ok && r.data.txn) setOpening({ pack: { id: 'starter', name: 'Starter Pack', description: '', currency: 'COINS', price: 0, eras: ['CURRENT'], slots: [], guarantee: null }, txn: r.data.txn });
              }}
            >
              {t('pvp.store.openFree')}
            </button>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {PACKS.map((p) => (
          <PackTile key={p.id} pack={p} affordable={balance(p) >= p.price} onBuy={() => setConfirm(p)} />
        ))}
      </div>

      {backend?.devGems ? (
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <Gem className="size-6 text-violet-500" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold">{t('pvp.store.devTitle')}</p>
              <p className="text-[12.5px] text-ink-muted">
                {t('pvp.store.devBody', { n: ECONOMY.devGemGrant })} {t(backend.mode === 'OFFLINE_DEMO' ? 'pvp.store.devOffline' : 'pvp.store.devServer')} {t('pvp.store.noMoney')}
              </p>
            </div>
            <button type="button" className={secondaryButton()} onClick={() => void economy('devGems')}>
              {t('pvp.store.addDev', { n: ECONOMY.devGemGrant })}
            </button>
          </div>
        </Card>
      ) : null}

      <Modal open={Boolean(confirm)} onClose={() => setConfirm(null)} title={confirm ? t('pvp.store.openQ', { name: packName(t, confirm) }) : ''} subtitle={confirm ? packDescription(t, confirm) : undefined}>
        {confirm ? (
          <div className="flex flex-col gap-3 text-[13px]">
            <OddsTable pack={confirm} />
            <div className="flex items-center justify-between rounded-tile bg-page px-3 py-2">
              <span>{t('pvp.store.price')}</span>
              <Price currency={confirm.currency} amount={confirm.price} />
            </div>
            <div className="flex items-center justify-between rounded-tile bg-page px-3 py-2">
              <span>{t('pvp.store.youHave')}</span>
              <Price currency={confirm.currency} amount={balance(confirm)} />
            </div>
            <p className="text-[12px] text-ink-muted">{t('pvp.store.dupes', { min: formatNumber(ECONOMY.duplicateCoins.COMMON), max: formatNumber(ECONOMY.duplicateCoins.ICON) })}</p>
            <div className="flex justify-end gap-2">
              <button type="button" className={secondaryButton()} onClick={() => setConfirm(null)}>
                {t('common.cancel')}
              </button>
              <button type="button" className={primaryButton()} disabled={balance(confirm) < confirm.price || busy} onClick={() => void buy(confirm)}>
                {t('pvp.store.confirm')}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {opening ? <Reveal pack={opening.pack} txn={opening.txn} onClose={() => setOpening(null)} /> : null}
    </div>
  );
}

function PackTile({ pack, affordable, onBuy }: { pack: PackDefinition; affordable: boolean; onBuy: () => void }) {
  const [odds, setOdds] = useState(false);
  const t = useT();
  const premium = pack.currency === 'GEMS';
  return (
    <Card className={cn('flex flex-col gap-3', pack.featured && 'ring-2 ring-brand-gold/50')}>
      <div className={cn('relative grid h-36 place-items-center overflow-hidden rounded-tile', premium ? 'bg-gradient-to-br from-violet-600 via-fuchsia-500 to-amber-400' : pack.currency === 'EVENT_TOKENS' ? 'bg-gradient-to-br from-emerald-500 to-sky-500' : 'bg-gradient-to-br from-brand-blue to-brand-navy')}>
        <div className="foil-rainbow absolute inset-0 opacity-30 mix-blend-color-dodge" aria-hidden />
        <div className="relative text-center text-white">
          <Sparkles className="mx-auto size-7" aria-hidden />
          <p className="mt-1 text-[18px] font-extrabold tracking-wide break-words uppercase">{packName(t, pack)}</p>
          <p className="text-[12px] text-white/80">{t('pvp.cards.many', { n: pack.slots.length })}</p>
        </div>
        {pack.featured ? <Badge tone="gold" className="absolute top-2 left-2 text-[10px]">{t('pvp.store.featured')}</Badge> : null}
      </div>
      <p className="text-[13px] text-ink-muted">{packDescription(t, pack)}</p>
      {pack.guarantee ? <p className="text-[12.5px] font-semibold text-brand-green">{t('pvp.store.guaranteed', { text: packGuarantee(t, pack) ?? '' })}</p> : null}
      <button type="button" onClick={() => setOdds((v) => !v)} className="inline-flex items-center gap-1 self-start text-[12.5px] font-semibold text-brand-blue" aria-expanded={odds}>
        <Info className="size-3.5" aria-hidden />
        {t(odds ? 'pvp.store.hideOdds' : 'pvp.store.showOdds')}
        <ChevronDown className={cn('size-3.5 transition-transform', odds && 'rotate-180')} aria-hidden />
      </button>
      {odds ? <OddsTable pack={pack} /> : null}
      <div className="mt-auto flex items-center justify-between gap-2">
        <Price currency={pack.currency} amount={pack.price} className="text-[15px]" />
        <button type="button" onClick={onBuy} disabled={!affordable} className={primaryButton('py-2')} title={affordable ? undefined : t('pvp.store.notEnough')}>
          {t('pvp.store.openPack')}
        </button>
      </div>
    </Card>
  );
}

function OddsTable({ pack }: { pack: PackDefinition }) {
  const t = useT();
  // Merge identical slots so the table reads "Cards 1-3: ...".
  const groups: { label: string; count: number; odds: PackDefinition['slots'][number]['odds'] }[] = [];
  pack.slots.forEach((s, i) => {
    const prev = groups[groups.length - 1];
    if (prev && JSON.stringify(prev.odds) === JSON.stringify(s.odds)) {
      prev.count += 1;
      prev.label = t('pvp.slot.range', { a: i + 2 - prev.count, b: i + 1 });
    } else groups.push({ label: t('pvp.slot.one', { n: i + 1 }), count: 1, odds: s.odds });
  });
  return (
    <table className="w-full text-left text-[12.5px]">
      <caption className="sr-only">{t('pvp.store.oddsCaption', { name: packName(t, pack) })}</caption>
      <thead className="text-[11px] tracking-wide text-ink-muted uppercase">
        <tr>
          <th className="py-1">{t('pvp.store.slot')}</th>
          <th className="py-1">{t('pvp.store.tierRating')}</th>
          <th className="py-1 text-right">{t('pvp.store.chance')}</th>
        </tr>
      </thead>
      <tbody>
        {groups.flatMap((g) =>
          g.odds.map((o, i) => (
            <tr key={`${g.label}-${o.tier}`} className="border-t border-line">
              <td className="py-1 text-ink-muted">{i === 0 ? g.label : ''}</td>
              <td className="py-1">
                {tierLabel(t, o.tier)} ({TIER_RULES[o.tier].min}-{TIER_RULES[o.tier].max})
              </td>
              <td className="py-1 text-right font-semibold">{o.percent}%</td>
            </tr>
          )),
        )}
      </tbody>
    </table>
  );
}

function Reveal({ pack, txn, onClose }: { pack: PackDefinition; txn: Transaction | null; onClose: () => void }) {
  const [shown, setShown] = useState(0);
  const cards = txn?.cards ?? [];
  const dupes = [...(txn?.duplicates ?? [])];
  const all = shown >= cards.length && cards.length > 0;
  const t = useT();
  const name = packName(t, pack);
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 overflow-y-auto bg-brand-navy/90 p-4 backdrop-blur" role="dialog" aria-modal="true" aria-label={t('pvp.store.openingName', { name })}>
      {!txn ? (
        <div className="pack-shake grid h-64 w-44 place-items-center rounded-2xl bg-gradient-to-br from-brand-gold via-amber-300 to-brand-blue text-center text-brand-navy shadow-2xl">
          <div>
            <Sparkles className="mx-auto size-8" aria-hidden />
            <p className="mt-2 text-[16px] font-extrabold break-words uppercase">{name}</p>
            <p className="text-[12px]">{t('pvp.store.opening')}</p>
          </div>
        </div>
      ) : (
        <>
          <p className="text-[18px] font-bold text-white">{name}</p>
          <div className="flex max-w-5xl flex-wrap justify-center gap-3">
            {cards.map((id, i) => {
              const card = CATALOG_BY_ID[id];
              if (i >= shown) {
                return (
                  <button key={`${id}-${i}`} type="button" onClick={() => setShown(i + 1)} className="grid aspect-[5/7] w-[150px] place-items-center rounded-[14px] bg-gradient-to-br from-brand-blue to-brand-navy text-white shadow-xl ring-2 ring-white/20 hover:ring-brand-gold" aria-label={t('pvp.store.revealN', { n: i + 1 })}>
                    <span className="px-2 text-center text-[13px] font-semibold">{t('pvp.store.tap')}</span>
                  </button>
                );
              }
              const dupIndex = dupes.indexOf(id);
              const duplicate = dupIndex >= 0;
              if (duplicate) dupes.splice(dupIndex, 1);
              return (
                <div key={`${id}-${i}`} className="card-reveal flex flex-col items-center gap-1">
                  <PlayerCard3D card={card} size="md" className="w-[150px]" />
                  <Badge tone={duplicate ? 'grey' : 'green'} className="text-[11px]">
                    {duplicate ? t('pvp.store.dup', { n: ECONOMY.duplicateCoins[card.tier] }) : t('pvp.store.new')}
                  </Badge>
                </div>
              );
            })}
          </div>
          <div className="flex gap-2">
            {!all ? (
              <button type="button" className={primaryButton('bg-brand-gold text-brand-navy hover:bg-brand-gold/90')} onClick={() => setShown(cards.length)}>
                {t('pvp.store.revealAll')}
              </button>
            ) : null}
            <button type="button" className={secondaryButton('bg-white/15 text-white hover:bg-white/25')} onClick={onClose}>
              {all ? t('pvp.store.add') : t('common.close')}
            </button>
          </div>
          {all ? <p className="text-[12.5px] text-white/70">{txn.note}</p> : null}
        </>
      )}
    </div>
  );
}

