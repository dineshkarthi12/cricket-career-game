/**
 * Player Market: buy specific players - current era or retired legends - at
 * fixed published prices, with confirmation and a transaction history.
 * Free players cost coins; premium players cost gems.
 */
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Card, CardHeader, ConfirmDialog, Tabs } from '@/components';
import { CATALOG, ECONOMY, TIER_RULES, type CardRole, type PlayerCard } from '@/engine/pvp';
import { usePvpStore } from '@/store/pvpStore';
import { rich, useT } from '@/i18n/react';
import { roleLabel, tierLabel } from './labels';
import { PlayerCard3D } from './cards/PlayerCard3D';
import { InspectModal } from './CollectionScreen';
import { Price, SectionTitle, chip, formatNumber } from './ui';

type Tab = 'current' | 'legends' | 'featured' | 'history';

export default function MarketScreen() {
  const profile = usePvpStore((s) => s.profile)!;
  const economy = usePvpStore((s) => s.economy);
  const [params, setParams] = useSearchParams();
  const t = useT();
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
    return Object.keys(TIER_RULES).map((tier) => {
      const pool = CATALOG.filter((c) => c.tier === tier);
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
      <SectionTitle title={t('pvp.nav.market')} subtitle={t('pvp.mkt.subtitle')} />
      <Tabs
        tabs={[
          { id: 'current', label: t('pvp.mkt.current') },
          { id: 'legends', label: t('pvp.mkt.legends') },
          { id: 'featured', label: t('pvp.mkt.featured') },
          { id: 'history', label: t('pvp.mkt.history') },
        ]}
        value={tab}
        onChange={(id) => setParams({ tab: id })}
        label={t('pvp.mkt.sections')}
      />

      {tab === 'history' ? (
        <Card>
          <CardHeader title={t('pvp.mkt.historyTitle')} subtitle={t('pvp.mkt.historySub')} />
          {profile.ledger.length ? (
            <ul className="mt-2 divide-y divide-line">
              {[...profile.ledger].reverse().map((x) => (
                <li key={x.id} className="flex flex-wrap items-center gap-2 py-2.5 text-[13px]">
                  <span className="w-24 shrink-0 text-[11.5px] text-ink-muted">{new Date(x.at).toLocaleDateString()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold text-ink">{x.note}</span>
                    {x.cards.length ? <span className="block text-[11.5px] text-ink-muted">{t(x.cards.length > 1 ? 'pvp.cards.many' : 'pvp.cards.one', { n: x.cards.length })}</span> : null}
                  </span>
                  {x.coins ? <span className={x.coins > 0 ? 'text-brand-green' : 'text-brand-red'}>{t('pvp.coinsN', { n: `${x.coins > 0 ? '+' : ''}${formatNumber(x.coins)}` })}</span> : null}
                  {x.gems ? <span className={x.gems > 0 ? 'text-brand-green' : 'text-brand-red'}>{t('pvp.gemsN', { n: `${x.gems > 0 ? '+' : ''}${formatNumber(x.gems)}` })}</span> : null}
                  {x.eventTokens ? <span className={x.eventTokens > 0 ? 'text-brand-green' : 'text-brand-red'}>{t('pvp.tokenN', { n: `${x.eventTokens > 0 ? '+' : ''}${x.eventTokens}` })}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[13px] text-ink-muted">{t('pvp.mkt.noTxn')}</p>
          )}
        </Card>
      ) : (
        <>
          {tab !== 'featured' ? (
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2 shadow-sm">
                <Search className="size-4 text-ink-soft" aria-hidden />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('pvp.mkt.search')} className="w-full bg-transparent text-[13px] outline-none" aria-label={t('pvp.mkt.search')} />
              </label>
              <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
                {(['ALL', 'BATTER', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER'] as const).map((r) => (
                  <button key={r} type="button" className={chip(role === r)} onClick={() => setRole(r)}>
                    {r === 'ALL' ? t('pvp.allRoles') : roleLabel(t, r)}
                  </button>
                ))}
                {tab === 'current'
                  ? (['ALL', 'FREE', 'PREMIUM'] as const).map((b) => (
                      <button key={b} type="button" className={chip(band === b)} onClick={() => setBand(b)}>
                        {t(b === 'ALL' ? 'pvp.mkt.allRatings' : b === 'FREE' ? 'pvp.mkt.free' : 'pvp.mkt.premium')}
                      </button>
                    ))
                  : null}
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-ink-muted">{t('pvp.mkt.featuredNote')}</p>
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
                    {have ? t('pvp.owned') : <span>{rich(t('pvp.mkt.buy'), { price: <Price currency={p.currency} amount={p.amount} /> })}</span>}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(buy)}
        title={buy ? t('pvp.mkt.buyQ', { name: buy.name }) : ''}
        message={
          buy && price
            ? t('pvp.mkt.buyMsg', {
                tier: tierLabel(t, buy.tier),
                role: roleLabel(t, buy.role),
                n: buy.overall,
                price: formatNumber(price.amount),
                cur: t(price.currency === 'COINS' ? 'pvp.cur.coins' : 'pvp.cur.gems'),
                have: formatNumber(balance),
                short: balance < price.amount ? t('pvp.mkt.short') : '',
              })
            : ''
        }
        confirmLabel={t('pvp.mkt.buyPlayer')}
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
