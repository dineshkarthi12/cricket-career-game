/**
 * Player Market: buy specific players - current era or retired legends - at
 * fixed published prices, with confirmation and a transaction history.
 * Free players cost coins; premium players cost gems.
 */
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Card, CardHeader, ConfirmDialog, Tabs } from '@/components';
import { CATALOG, ECONOMY, ROLE_LABEL, TIER_RULES, type CardRole, type PlayerCard } from '@/engine/pvp';
import { usePvpStore } from '@/store/pvpStore';
import { PlayerCard3D } from './cards/PlayerCard3D';
import { InspectModal } from './CollectionScreen';
import { Price, SectionTitle, chip, formatNumber } from './ui';

type Tab = 'current' | 'legends' | 'featured' | 'history';

export default function MarketScreen() {
  const profile = usePvpStore((s) => s.profile)!;
  const economy = usePvpStore((s) => s.economy);
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) ?? 'current';
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<CardRole | 'ALL'>('ALL');
  const [band, setBand] = useState<'ALL' | 'FREE' | 'PREMIUM'>('ALL');
  const [buy, setBuy] = useState<PlayerCard | null>(null);
  const [inspect, setInspect] = useState<PlayerCard | null>(null);
  const owned = useMemo(() => new Set(profile.inventory.map((o) => o.cardId)), [profile.inventory]);

  const featured = useMemo(() => {
    // A rotating daily selection: one card from each tier.
    const day = Math.floor(Date.now() / 86_400_000);
    return Object.keys(TIER_RULES).map((t) => {
      const pool = CATALOG.filter((c) => c.tier === t);
      return pool[day % pool.length];
    });
  }, []);

  const list =
    tab === 'featured'
      ? featured
      : CATALOG.filter((c) => (tab === 'legends' ? c.era === 'LEGEND' : c.era === 'CURRENT'))
          .filter((c) => role === 'ALL' || c.role === role)
          .filter((c) => band === 'ALL' || c.cls === band)
          .filter((c) => !query || c.name.toLowerCase().includes(query.toLowerCase()))
          .sort((a, b) => b.overall - a.overall);

  const price = buy ? ECONOMY.marketPrice[buy.tier] : null;
  const balance = price ? (price.currency === 'COINS' ? profile.coins : profile.gems) : 0;

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle title="Player Market" subtitle="Fixed prices, no auctions, no randomness. Free players for coins; premium players and legends for gems." />
      <Tabs
        tabs={[
          { id: 'current', label: 'Current era' },
          { id: 'legends', label: 'Retired legends' },
          { id: 'featured', label: 'Featured today' },
          { id: 'history', label: 'Transactions' },
        ]}
        value={tab}
        onChange={(id) => setParams({ tab: id })}
        label="Market sections"
      />

      {tab === 'history' ? (
        <Card>
          <CardHeader title="Transaction history" subtitle="Every coin, gem and card movement on this profile." />
          {profile.ledger.length ? (
            <ul className="mt-2 divide-y divide-line">
              {[...profile.ledger].reverse().map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-2 py-2.5 text-[13px]">
                  <span className="w-24 shrink-0 text-[11.5px] text-ink-muted">{new Date(t.at).toLocaleDateString()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold text-ink">{t.note}</span>
                    {t.cards.length ? <span className="block text-[11.5px] text-ink-muted">{t.cards.length} card{t.cards.length > 1 ? 's' : ''}</span> : null}
                  </span>
                  {t.coins ? <span className={t.coins > 0 ? 'text-brand-green' : 'text-brand-red'}>{t.coins > 0 ? '+' : ''}{formatNumber(t.coins)} coins</span> : null}
                  {t.gems ? <span className={t.gems > 0 ? 'text-brand-green' : 'text-brand-red'}>{t.gems > 0 ? '+' : ''}{formatNumber(t.gems)} gems</span> : null}
                  {t.eventTokens ? <span className={t.eventTokens > 0 ? 'text-brand-green' : 'text-brand-red'}>{t.eventTokens > 0 ? '+' : ''}{t.eventTokens} token</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[13px] text-ink-muted">No transactions yet.</p>
          )}
        </Card>
      ) : (
        <>
          {tab !== 'featured' ? (
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2 shadow-sm">
                <Search className="size-4 text-ink-soft" aria-hidden />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the market" className="w-full bg-transparent text-[13px] outline-none" aria-label="Search the market" />
              </label>
              <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
                {(['ALL', 'BATTER', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER'] as const).map((r) => (
                  <button key={r} type="button" className={chip(role === r)} onClick={() => setRole(r)}>
                    {r === 'ALL' ? 'All roles' : ROLE_LABEL[r]}
                  </button>
                ))}
                {tab === 'current'
                  ? (['ALL', 'FREE', 'PREMIUM'] as const).map((b) => (
                      <button key={b} type="button" className={chip(band === b)} onClick={() => setBand(b)}>
                        {b === 'ALL' ? 'All ratings' : b === 'FREE' ? 'Free 45-65' : 'Premium 70-99'}
                      </button>
                    ))
                  : null}
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-ink-muted">One player from every tier, changing daily.</p>
          )}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] justify-items-center gap-x-3 gap-y-5 sm:grid-cols-[repeat(auto-fill,minmax(176px,1fr))]">
            {list.map((c) => {
              const p = ECONOMY.marketPrice[c.tier];
              const have = owned.has(c.id);
              return (
                <div key={c.id} className="flex w-full max-w-[176px] flex-col gap-1.5">
                  <PlayerCard3D card={c} owned={have} onClick={() => setInspect(c)} className="w-full" still />
                  <button
                    type="button"
                    disabled={have}
                    onClick={() => setBuy(c)}
                    className="flex items-center justify-center gap-2 rounded-xl bg-surface px-3 py-2 text-[13px] font-semibold shadow-sm hover:bg-brand-blue-soft disabled:opacity-60"
                  >
                    {have ? 'Owned' : (
                      <>
                        Buy <Price currency={p.currency} amount={p.amount} />
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(buy)}
        title={buy ? `Buy ${buy.name}?` : ''}
        message={buy && price ? `${TIER_RULES[buy.tier].label} ${ROLE_LABEL[buy.role]}, rated ${buy.overall}. Price: ${formatNumber(price.amount)} ${price.currency === 'COINS' ? 'coins' : 'gems'}. You have ${formatNumber(balance)}.${balance < price.amount ? ' Not enough to buy.' : ''}` : ''}
        confirmLabel="Buy player"
        onConfirm={async () => {
          const c = buy;
          setBuy(null);
          if (c) await economy('buyCard', { cardId: c.id });
        }}
        onCancel={() => setBuy(null)}
      />
      <InspectModal card={inspect} onClose={() => setInspect(null)} />
    </div>
  );
}
