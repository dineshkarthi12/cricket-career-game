/**
 * The Live PvP frame: same Cricket Career 26 layout as the other modes
 * (sidebar on desktop, icon rail on tablets, bottom tabs on phones) with the
 * mode's own navigation, wallet, and a permanent label saying whether play is
 * the offline demo or a real online server.
 */
import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Boxes,
  Coins,
  Crown,
  Gem,
  Home,
  Layers,
  MoreHorizontal,
  Radio,
  Shirt,
  ShoppingBag,
  Store,
  Swords,
  Trophy,
  Users,
  Wifi,
  WifiOff,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Logo } from '@/layout/Logo';
import { cn } from '@/lib/cn';
import { formatNumber } from './ui';
import { backendLabel } from './labels';
import { usePvpStore } from '@/store/pvpStore';
import { useT } from '@/i18n/react';
import type { Key } from '@/i18n/core';

interface Item {
  /** Dictionary key of the label. */
  label: Key;
  /** Shorter label for the phone tab bar. */
  short?: Key;
  to: string;
  icon: LucideIcon;
  end?: boolean;
}

export const PVP_NAV: Item[] = [
  { label: 'nav.home', to: '/start', icon: Home },
  { label: 'pvp.nav.careerMode', to: '/', icon: Swords, end: true },
  { label: 'nav.manager', to: '/manager/start', icon: Crown },
  { label: 'nav.pvp', to: '/pvp', icon: Radio, end: true },
  { label: 'pvp.nav.collection', short: 'pvp.navShort.collection', to: '/pvp/collection', icon: Layers },
  { label: 'pvp.nav.market', to: '/pvp/market', icon: ShoppingBag },
  { label: 'pvp.nav.store', short: 'pvp.navShort.store', to: '/pvp/store', icon: Store },
  { label: 'pvp.nav.squad', short: 'pvp.navShort.squad', to: '/pvp/squad', icon: Shirt },
  { label: 'pvp.nav.rankings', to: '/pvp/rankings', icon: Trophy },
  { label: 'pvp.nav.friends', to: '/pvp/friends', icon: Users },
];

const MOBILE_PRIMARY = ['/pvp', '/pvp/collection', '/pvp/store', '/pvp/squad'];

function NavList({ compact, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  const t = useT();
  return (
    <ul className="flex flex-col gap-0.5">
      {PVP_NAV.map((item) => (
        <li key={item.to}>
          <NavLink
            to={item.to}
            end={item.end}
            title={compact ? t(item.label) : undefined}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'relative flex items-center rounded-xl text-[13px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:outline-none',
                compact ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2',
                isActive && item.to.startsWith('/pvp') ? 'bg-brand-blue-soft text-brand-blue' : 'text-ink-muted hover:bg-page hover:text-ink',
              )
            }
          >
            <item.icon className="size-[18px] shrink-0" strokeWidth={1.8} aria-hidden />
            {compact ? <span className="sr-only">{t(item.label)}</span> : <span>{t(item.label)}</span>}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

export function ModeBadge({ className }: { className?: string }) {
  const mode = usePvpStore((s) => s.mode);
  const status = usePvpStore((s) => s.status);
  const label = usePvpStore((s) => s.label);
  const t = useT();
  const online = mode === 'ONLINE';
  return (
    <span
      title={backendLabel(t, label, mode)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase',
        online ? (status === 'ready' ? 'bg-brand-green/15 text-brand-green' : 'bg-brand-orange/15 text-brand-orange') : 'bg-brand-orange/15 text-[#a16207]',
        className,
      )}
    >
      {online ? <Wifi className="size-3.5" aria-hidden /> : <WifiOff className="size-3.5" aria-hidden />}
      {t(online ? (status === 'ready' ? 'pvp.badge.online' : 'pvp.badge.connecting') : 'pvp.badge.offline')}
    </span>
  );
}

function Wallet() {
  const profile = usePvpStore((s) => s.profile);
  const t = useT();
  if (!profile) return null;
  return (
    <div className="flex items-center gap-2 text-[13px] font-semibold">
      <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 shadow-card" title={t('pvp.wallet.coins')}>
        <Coins className="size-4 text-brand-gold" aria-hidden />
        {formatNumber(profile.coins)}
      </span>
      <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 shadow-card" title={t('pvp.wallet.gems')}>
        <Gem className="size-4 text-violet-500" aria-hidden />
        {formatNumber(profile.gems)}
      </span>
    </div>
  );
}

export function PvpShell({ children }: { children: ReactNode }) {
  const [more, setMore] = useState(false);
  const profile = usePvpStore((s) => s.profile);
  const t = useT();
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#eef4ff] via-page to-page">
      <a href="#pvp-main" className="skip-link">{t('nav.skip')}</a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[72px] flex-col border-r border-line/70 bg-surface/70 backdrop-blur md:flex lg:w-[210px]">
        <div className="shrink-0 px-2 pt-5 pb-2 lg:px-4">
          <div className="hidden lg:block">
            <Logo showTagline />
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-brand-blue-soft px-2 py-1 text-[11px] font-bold tracking-wide text-brand-blue uppercase">
              <Radio className="size-3.5" aria-hidden />
              {t('nav.pvp')}
            </p>
          </div>
          <div className="flex justify-center lg:hidden">
            <Boxes className="size-6 text-brand-blue" aria-hidden />
          </div>
        </div>
        <nav aria-label={t('nav.pvp')} className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pb-3 lg:px-3">
          <div className="lg:hidden">
            <NavList compact />
          </div>
          <div className="hidden lg:block">
            <NavList />
          </div>
        </nav>
      </aside>

      <div className="md:pl-[72px] lg:pl-[210px]">
        <div className="px-4 pb-28 sm:px-5 md:pb-10 lg:px-6">
          <header className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-4 pb-4">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="grid size-9 place-items-center rounded-full bg-brand-navy text-[13px] font-bold text-white" aria-hidden>
                {(profile?.displayName ?? 'P').slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-ink">{profile?.displayName ?? t('pvp.player')}</p>
                <ModeBadge />
              </div>
            </div>
            <Wallet />
          </header>
          <main id="pvp-main" tabIndex={-1} className="outline-none">
            {children}
          </main>
        </div>
      </div>

      {/* Phone tab bar */}
      <nav aria-label={t('nav.pvp')} className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-2 pt-1.5 backdrop-blur md:hidden">
        <ul className="grid grid-cols-5">
          {PVP_NAV.filter((i) => MOBILE_PRIMARY.includes(i.to)).map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) => cn('flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10.5px] font-medium', isActive ? 'text-brand-blue' : 'text-ink-muted')}
              >
                <item.icon className="size-5" aria-hidden />
                {t(item.short ?? item.label)}
              </NavLink>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => setMore(true)} className="flex w-full flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10.5px] font-medium text-ink-muted">
              <MoreHorizontal className="size-5" aria-hidden />
              {t('nav.more')}
            </button>
          </li>
        </ul>
      </nav>
      {more ? (
        <div className="fixed inset-0 z-50 bg-brand-navy/40 md:hidden" onClick={() => setMore(false)}>
          <div className="safe-bottom absolute inset-x-0 bottom-0 rounded-t-3xl bg-surface p-4" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t('nav.more')}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[15px] font-semibold">{t('nav.pvp')}</p>
              <button type="button" onClick={() => setMore(false)} aria-label={t('common.close')} className="rounded-full p-2 hover:bg-page">
                <X className="size-5" />
              </button>
            </div>
            <NavList onNavigate={() => setMore(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
