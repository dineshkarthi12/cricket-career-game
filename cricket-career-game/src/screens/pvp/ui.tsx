/** Small shared bits for the Live PvP screens. */
import type { ReactNode } from 'react';
import { Coins, Gem, Ticket } from 'lucide-react';
import { CATALOG_BY_ID, effectiveOverall, type Currency, type OwnedCard, type PlayerCard } from '@/engine/pvp';
import { cn } from '@/lib/cn';
import { useT } from '@/i18n/react';

export function formatNumber(n: number): string {
  return n.toLocaleString('en-IN');
}

export function Price({ currency, amount, className }: { currency: Currency; amount: number; className?: string }) {
  const Icon = currency === 'COINS' ? Coins : currency === 'GEMS' ? Gem : Ticket;
  const t = useT();
  const label = t(currency === 'COINS' ? 'pvp.cur.coins' : currency === 'GEMS' ? 'pvp.cur.gems' : amount === 1 ? 'pvp.cur.token' : 'pvp.cur.tokens');
  return (
    <span className={cn('inline-flex items-center gap-1 font-semibold', className)}>
      <Icon className={cn('size-4', currency === 'COINS' ? 'text-brand-gold' : currency === 'GEMS' ? 'text-violet-500' : 'text-brand-green')} aria-hidden />
      {formatNumber(amount)}
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h1 className="text-[22px] leading-tight font-bold text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 text-[13px] text-ink-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function ownedCards(inventory: OwnedCard[]): { owned: OwnedCard; card: PlayerCard; overall: number }[] {
  return inventory
    .filter((o) => CATALOG_BY_ID[o.cardId])
    .map((o) => ({ owned: o, card: CATALOG_BY_ID[o.cardId], overall: effectiveOverall(CATALOG_BY_ID[o.cardId], o.upgrades) }));
}

export function primaryButton(extra?: string): string {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-xl bg-brand-blue px-4 py-2.5 text-[14px] font-semibold text-white shadow-sm transition-colors hover:bg-brand-blue/90 focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
    extra,
  );
}

export function secondaryButton(extra?: string): string {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-xl bg-brand-blue-soft px-4 py-2.5 text-[14px] font-semibold text-brand-blue transition-colors hover:bg-brand-blue/15 focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
    extra,
  );
}

export function chip(active: boolean): string {
  return cn(
    'rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:outline-none',
    active ? 'bg-brand-navy text-white' : 'bg-surface text-ink-muted shadow-sm hover:text-ink',
  );
}
