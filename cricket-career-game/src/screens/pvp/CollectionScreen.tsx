/**
 * Player Collection: every card in the game, owned or not, with filters
 * (rating, role, rarity, edition, country), side-by-side comparison, the
 * ownership and transaction history, and a gallery of the ten card designs.
 * A card opens large, flips to its details, and can be trained (within its
 * tier's ceiling).
 */
import { useMemo, useState } from 'react';
import { ArrowUpCircle, GitCompare, RotateCcw, Search, X } from 'lucide-react';
import { Card, Modal, ProgressBar } from '@/components';
import {
  ACQUISITION_LABEL,
  CATALOG,
  CATALOG_BY_ID,
  EDITION_LABEL,
  ROLE_LABEL,
  TIER_ORDER,
  TIER_RULES,
  maxUpgradeLevel,
  upgradeCap,
  upgradeCost,
  type CardEdition,
  type CardRole,
  type CardTier,
  type PlayerCard as Card_,
} from '@/engine/pvp';
import { cn } from '@/lib/cn';
import { usePvpStore } from '@/store/pvpStore';
import { PlayerCard, styleLine } from './cards/PlayerCard';
import { CARD_THEMES, CARD_VARIANTS, cardLabel } from './cards/cardThemes';
import { Price, SectionTitle, chip, primaryButton, secondaryButton } from './ui';

type Owned = 'all' | 'owned' | 'missing';
type Tab = 'cards' | 'history' | 'designs';
type Sort = 'rating' | 'name' | 'newest';
const EDITIONS: CardEdition[] = ['STANDARD', 'LIMITED', 'TEAM_OF_TOURNAMENT', 'PLAYER_OF_MATCH', 'LEGENDS'];
const STAT_KEYS = ['batting', 'bowling', 'fielding', 'fitness', 'mental'] as const;

export default function CollectionScreen() {
  const profile = usePvpStore((s) => s.profile)!;
  const [tab, setTab] = useState<Tab>('cards');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<CardRole | 'ALL'>('ALL');
  const [tier, setTier] = useState<CardTier | 'ALL'>('ALL');
  const [edition, setEdition] = useState<CardEdition | 'ALL'>('ALL');
  const [country, setCountry] = useState<string>('ALL');
  const [minRating, setMinRating] = useState(40);
  const [sort, setSort] = useState<Sort>('rating');
  const [owned, setOwned] = useState<Owned>('owned');
  const [inspect, setInspect] = useState<Card_ | null>(null);
  const [comparing, setComparing] = useState(false);
  const [compare, setCompare] = useState<string[]>([]);
  const ownedBy = useMemo(() => new Map(profile.inventory.map((o) => [o.cardId, o])), [profile.inventory]);
  const countries = useMemo(() => [...new Set(CATALOG.map((c) => c.country).filter((c): c is string => Boolean(c)))].sort(), []);

  const rating = (c: Card_) => c.overall + (ownedBy.get(c.id)?.upgrades ?? 0);
  const list = CATALOG.filter((c) => (role === 'ALL' || c.role === role) && (tier === 'ALL' || c.tier === tier) && (edition === 'ALL' || c.edition === edition))
    .filter((c) => country === 'ALL' || (country === 'FICTIONAL' ? c.fictional : c.country === country))
    .filter((c) => rating(c) >= minRating)
    .filter((c) => (owned === 'all' ? true : owned === 'owned' ? ownedBy.has(c.id) : !ownedBy.has(c.id)))
    .filter((c) => !query || c.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name)
        : sort === 'newest'
          ? (ownedBy.get(b.id)?.acquiredAt ?? '').localeCompare(ownedBy.get(a.id)?.acquiredAt ?? '')
          : rating(b) - rating(a),
    );

  const series = [...new Set(CATALOG.map((c) => c.series))];
  const pick = (c: Card_) => {
    if (!comparing) return setInspect(c);
    setCompare((cur) => (cur.includes(c.id) ? cur.filter((id) => id !== c.id) : [...cur, c.id].slice(-2)));
  };

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle title="Player Collection" subtitle={`${ownedBy.size} of ${CATALOG.length} players collected.`} />
      <div className="flex gap-1.5" role="tablist" aria-label="Collection views">
        {(
          [
            ['cards', 'Cards'],
            ['history', 'History'],
            ['designs', 'Card designs'],
          ] as const
        ).map(([t, label]) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={chip(tab === t)} onClick={() => setTab(t)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'history' ? <History /> : null}
      {tab === 'designs' ? <Designs /> : null}

      {tab === 'cards' ? (
        <>
          <Card>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {series.map((s) => {
                const all = CATALOG.filter((c) => c.series === s);
                const have = all.filter((c) => ownedBy.has(c.id)).length;
                return (
                  <div key={s}>
                    <div className="flex justify-between text-[12.5px]">
                      <span className="truncate font-semibold text-ink">{s}</span>
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
              <button
                type="button"
                className={chip(comparing)}
                aria-pressed={comparing}
                onClick={() => {
                  setComparing((c) => !c);
                  setCompare([]);
                }}
              >
                <GitCompare className="mr-1 inline size-3.5" aria-hidden />
                Compare
              </button>
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
                  {t === 'ALL' ? 'All rarities' : `${TIER_RULES[t].label} ${TIER_RULES[t].min}-${TIER_RULES[t].max}`}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Select label="Edition" value={edition} onChange={(v) => setEdition(v as CardEdition | 'ALL')} options={[['ALL', 'All editions'], ...EDITIONS.map((e) => [e, EDITION_LABEL[e]] as [string, string])]} />
              <Select label="Country" value={country} onChange={setCountry} options={[['ALL', 'All'], ['FICTIONAL', 'Fictional players'], ...countries.map((c) => [c, c] as [string, string])]} />
              <Select label="Sort" value={sort} onChange={(v) => setSort(v as Sort)} options={[['rating', 'Rating'], ['name', 'Name'], ['newest', 'Newest owned']]} />
              <label className="flex flex-col gap-1 rounded-xl bg-surface px-3 py-1.5 text-[11px] font-semibold text-ink-muted shadow-sm">
                Rating {minRating}+
                <input type="range" min={40} max={99} value={minRating} onChange={(e) => setMinRating(Number(e.target.value))} aria-label="Minimum rating" />
              </label>
            </div>
          </div>

          {comparing ? (
            <div className="flex flex-wrap items-center gap-2 rounded-tile bg-brand-blue-soft px-3 py-2 text-[13px] text-brand-blue">
              Pick two cards to compare ({compare.length}/2).
              {compare.length === 2 ? (
                <button type="button" className={primaryButton('py-1.5')} onClick={() => setComparing(false)}>
                  Show comparison
                </button>
              ) : null}
            </div>
          ) : null}

          {list.length ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] justify-items-center gap-x-3 gap-y-4 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
              {list.map((c) => {
                const o = ownedBy.get(c.id);
                return (
                  <PlayerCard
                    key={c.id}
                    card={c}
                    upgrades={o?.upgrades ?? 0}
                    owned={Boolean(o)}
                    onClick={() => pick(c)}
                    size="md"
                    still
                    className={cn('w-full max-w-[210px]', comparing && compare.includes(c.id) && 'rounded-[6%] ring-4 ring-brand-blue')}
                  />
                );
              })}
            </div>
          ) : (
            <Card>
              <p className="text-[13px] text-ink-muted">No players match these filters.</p>
            </Card>
          )}
          {!comparing && compare.length === 2 ? <CompareModal ids={compare as [string, string]} onClose={() => setCompare([])} /> : null}
        </>
      ) : null}

      <InspectModal card={inspect} onClose={() => setInspect(null)} />
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="flex flex-col gap-0.5 rounded-xl bg-surface px-3 py-1.5 text-[11px] font-semibold text-ink-muted shadow-sm">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-transparent text-[13px] font-semibold text-ink outline-none">
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function CompareModal({ ids, onClose }: { ids: [string, string]; onClose: () => void }) {
  const profile = usePvpStore((s) => s.profile)!;
  const cards = ids.map((id) => CATALOG_BY_ID[id]);
  const up = (id: string) => profile.inventory.find((o) => o.cardId === id)?.upgrades ?? 0;
  const rows: [string, (c: Card_) => number][] = [
    ['Overall', (c) => c.overall + up(c.id)],
    ...STAT_KEYS.map((k) => [k[0].toUpperCase() + k.slice(1), (c: Card_) => c[k]] as [string, (c: Card_) => number]),
  ];
  return (
    <Modal open onClose={onClose} title="Compare players" subtitle={`${cards[0].name} vs ${cards[1].name}`}>
      <div className="flex flex-col gap-4">
        <div className="flex justify-center gap-3">
          {cards.map((c) => (
            <PlayerCard key={c.id} card={c} upgrades={up(c.id)} size="sm" still />
          ))}
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] text-ink-muted uppercase">
              <th className="py-1">Attribute</th>
              <th className="py-1 text-right">{cards[0].name}</th>
              <th className="py-1 text-right">{cards[1].name}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, get]) => {
              const [a, b] = cards.map(get);
              return (
                <tr key={label} className="border-t border-line">
                  <td className="py-1.5">{label}</td>
                  <td className={cn('py-1.5 text-right font-semibold', a > b && 'text-brand-green')}>{a}</td>
                  <td className={cn('py-1.5 text-right font-semibold', b > a && 'text-brand-green')}>{b}</td>
                </tr>
              );
            })}
            <tr className="border-t border-line">
              <td className="py-1.5">Role</td>
              {cards.map((c) => (
                <td key={c.id} className="py-1.5 text-right">
                  {ROLE_LABEL[c.role]}
                </td>
              ))}
            </tr>
            <tr className="border-t border-line">
              <td className="py-1.5">Styles</td>
              {cards.map((c) => (
                <td key={c.id} className="py-1.5 text-right text-[12px]">
                  {styleLine(c)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        <button type="button" className={secondaryButton()} onClick={onClose}>
          <X className="size-4" aria-hidden />
          Close
        </button>
      </div>
    </Modal>
  );
}

function History() {
  const profile = usePvpStore((s) => s.profile)!;
  const owned = [...profile.inventory].sort((a, b) => b.acquiredAt.localeCompare(a.acquiredAt));
  const ledger = [...profile.ledger].reverse();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h2 className="text-[15px] font-semibold text-ink">Ownership</h2>
        <ul className="mt-2 flex max-h-[420px] flex-col divide-y divide-line overflow-y-auto text-[13px]">
          {owned.map((o) => {
            const c = CATALOG_BY_ID[o.cardId];
            return (
              <li key={o.instanceId} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0">
                  <b className="block truncate">{c ? c.name : `Unknown card ${o.cardId}`}</b>
                  <span className="text-[11.5px] text-ink-muted">
                    {c ? cardLabel(c) : ''} · {o.acquiredVia === 'REWARD' ? 'Reward' : ACQUISITION_LABEL[o.acquiredVia]}
                  </span>
                </span>
                <time className="shrink-0 text-[11.5px] text-ink-muted" dateTime={o.acquiredAt}>
                  {new Date(o.acquiredAt).toLocaleDateString()}
                </time>
              </li>
            );
          })}
        </ul>
      </Card>
      <Card>
        <h2 className="text-[15px] font-semibold text-ink">Transactions</h2>
        {ledger.length ? (
          <ul className="mt-2 flex max-h-[420px] flex-col divide-y divide-line overflow-y-auto text-[13px]">
            {ledger.map((t) => (
              <li key={t.id} className="py-2">
                <div className="flex justify-between gap-2">
                  <b className="truncate">{t.note}</b>
                  <time className="shrink-0 text-[11.5px] text-ink-muted" dateTime={t.at}>
                    {new Date(t.at).toLocaleDateString()}
                  </time>
                </div>
                <p className="text-[11.5px] text-ink-muted">
                  {[t.coins ? `${t.coins > 0 ? '+' : ''}${t.coins} coins` : null, t.gems ? `${t.gems > 0 ? '+' : ''}${t.gems} gems` : null, t.eventTokens ? `${t.eventTokens > 0 ? '+' : ''}${t.eventTokens} tokens` : null, t.cards.length ? `${t.cards.length} card${t.cards.length > 1 ? 's' : ''}` : null]
                    .filter(Boolean)
                    .join(' · ') || 'No balance change'}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[13px] text-ink-muted">No transactions yet.</p>
        )}
      </Card>
    </div>
  );
}

/** Every card design, on one sample card, so the ten looks can be checked side by side. */
function Designs() {
  const sample = CATALOG.find((c) => !c.fictional) ?? CATALOG[0];
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-ink-muted">
        The ten card designs, shown on {sample.name}. A card wears its edition's design when it has one, otherwise its rarity's. Rarity tiers: {TIER_ORDER.map((t) => `${TIER_RULES[t].label} ${TIER_RULES[t].min}-${TIER_RULES[t].max}`).join(', ')}.
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] justify-items-center gap-4 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
        {CARD_VARIANTS.map((v) => (
          <figure key={v} className="flex w-full max-w-[220px] flex-col items-center gap-1.5">
            <PlayerCard card={sample} variant={v} size="md" className="w-full max-w-[220px]" />
            <figcaption className="text-[12.5px] font-semibold text-ink">{CARD_THEMES[v].label}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

export function InspectModal({ card, onClose }: { card: Card_ | null; onClose: () => void }) {
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
    <Modal open onClose={onClose} title={card.name} subtitle={`${ROLE_LABEL[card.role]} · ${cardLabel(card)} · ${card.series}`}>
      <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center gap-2">
          <PlayerCard card={card} upgrades={level} owned={Boolean(owned)} size="lg" flipped={flipped} onClick={() => setFlipped((f) => !f)} />
          <button type="button" onClick={() => setFlipped((f) => !f)} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-blue">
            <RotateCcw className="size-3.5" aria-hidden />
            Flip card
          </button>
        </div>
        <div className="flex flex-col gap-3 text-[13px]">
          <dl className="grid grid-cols-2 gap-2">
            <Info label="Overall" value={`${card.overall + level}${level ? ` (base ${card.overall})` : ''}`} />
            <Info label="Training cap" value={`${upgradeCap(card)} (top of ${TIER_RULES[card.tier].label})`} />
            <Info label="Class" value={card.cls === 'FREE' ? 'Free (coins and play)' : 'Premium (gems)'} />
            <Info label="Side" value={card.country ?? `${card.team} (fictional)`} />
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
                <p className="font-semibold text-ink">
                  Owned · training level {level} of {max}
                </p>
                {next <= max ? (
                  <button type="button" disabled={busy || profile.coins < cost} onClick={upgrade} className={primaryButton('mt-2 w-full')}>
                    <ArrowUpCircle className="size-4" aria-hidden />
                    Train to {card.overall + next} for <Price currency="COINS" amount={cost} />
                  </button>
                ) : (
                  <p className="mt-1 text-[12.5px] text-ink-muted">At the ceiling for a {TIER_RULES[card.tier].label} card: training never moves a card up a tier.</p>
                )}
              </>
            ) : (
              <p className="text-ink-muted">Not in your collection yet.</p>
            )}
          </div>
          <p className="text-[11.5px] text-ink-muted">
            {card.fictional
              ? 'A fictional player with an original illustrated portrait. Ratings are gameplay values.'
              : 'A real cricketer. Career figures on the back are labelled by format with their sources; the game ratings are design values from a published formula, not official statistics.'}
          </p>
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
