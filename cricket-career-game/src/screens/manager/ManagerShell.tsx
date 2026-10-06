/**
 * The IPL Manager frame: the same Cricket Career 26 layout as the player
 * career - sidebar on desktop, icon rail on tablets, bottom tabs on phones -
 * with the manager's own navigation and top bar.
 */
import { loadRealData } from '@/data/real';
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Navigate, Link, useLocation } from 'react-router-dom';
import {
  Award,
  BarChart3,
  Briefcase,
  CalendarDays,
  ClipboardList,
  Crown,
  Dumbbell,
  FileSignature,
  Gavel,
  Home,
  Landmark,
  MoreHorizontal,
  Newspaper,
  Radar,
  Repeat,
  Search,
  Shirt,
  Table2,
  Target,
  UserCog,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Avatar, ProgressBar, ScreenLoading } from '@/components';
import { MANAGER, PHASE_LABEL, formatMoney } from '@/engine/manager';
import { cn } from '@/lib/cn';
import { Logo } from '@/layout/Logo';
import { useManagerStore } from '@/store/managerStore';
import { FranchiseCrest } from './ui';
import { PhaseBar } from './PhaseFlow';

interface Item {
  label: string;
  to: string;
  icon: LucideIcon;
}

export const MANAGER_NAV: Item[] = [
  { label: 'Home', to: '/manager', icon: Home },
  { label: 'Career', to: '/manager/profile', icon: Briefcase },
  { label: 'Scouting', to: '/manager/scouting', icon: Radar },
  { label: 'Players', to: '/manager/players', icon: Search },
  { label: 'Trials', to: '/manager/trials', icon: ClipboardList },
  { label: 'Auction Prep', to: '/manager/auction-prep', icon: Target },
  { label: 'Live Auction', to: '/manager/auction', icon: Gavel },
  { label: 'Squad', to: '/manager/squad', icon: Users },
  { label: 'Playing XI', to: '/manager/xi', icon: Shirt },
  { label: 'Tactics', to: '/manager/tactics', icon: BarChart3 },
  { label: 'Fixtures', to: '/manager/fixtures', icon: CalendarDays },
  { label: 'Points Table', to: '/manager/table', icon: Table2 },
  { label: 'Development', to: '/manager/development', icon: Dumbbell },
  { label: 'Staff', to: '/manager/staff', icon: UserCog },
  { label: 'Contracts', to: '/manager/contracts', icon: FileSignature },
  { label: 'Finances', to: '/manager/finances', icon: Wallet },
  { label: 'News', to: '/manager/news', icon: Newspaper },
  { label: 'Awards', to: '/manager/awards', icon: Award },
  { label: 'Legacy', to: '/manager/legacy', icon: Landmark },
];

const MOBILE_PRIMARY = ['/manager', '/manager/squad', '/manager/fixtures', '/manager/auction'];

function NavList({ compact, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  return (
    <ul className="flex flex-col gap-0.5">
      {MANAGER_NAV.map((item) => (
        <li key={item.to}>
          <NavLink
            to={item.to}
            end={item.to === '/manager'}
            title={compact ? item.label : undefined}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'relative flex items-center rounded-xl text-[13px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:outline-none',
                compact ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2',
                isActive ? 'bg-brand-blue-soft text-brand-blue' : 'text-ink-muted hover:bg-page hover:text-ink',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && !compact ? <span className="absolute top-1.5 -left-2 h-[calc(100%-12px)] w-1 rounded-full bg-brand-blue" aria-hidden /> : null}
                <item.icon className="size-[18px] shrink-0" strokeWidth={1.8} aria-hidden />
                {compact ? <span className="sr-only">{item.label}</span> : <span>{item.label}</span>}
              </>
            )}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

function ManagerSidebar({ compact = false }: { compact?: boolean }) {
  return (
    <aside className={cn('fixed inset-y-0 left-0 z-30 flex flex-col border-r border-line/70 bg-surface/60', compact ? 'w-[72px]' : 'w-[200px]')}>
      <div className={cn('shrink-0 pt-5 pb-2', compact ? 'px-2' : 'px-4')}>
        {compact ? <Logo className="flex justify-center [&_p]:hidden" /> : <Logo showTagline />}
        {compact ? null : (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-brand-gold/20 px-2 py-1 text-[11px] font-bold tracking-wide text-[#8a6a00] uppercase">
            <Crown className="size-3.5 fill-brand-gold text-brand-gold" aria-hidden />
            IPL Manager
          </p>
        )}
      </div>
      <nav aria-label="IPL Manager" className={cn('no-scrollbar min-h-0 flex-1 overflow-y-auto pb-3', compact ? 'px-2' : 'px-3')}>
        <NavList compact={compact} />
      </nav>
      <div className={cn('shrink-0 border-t border-line/70 py-2', compact ? 'px-2' : 'px-3')}>
        <Link
          to="/start"
          title="Player Career mode"
          className={cn('flex items-center rounded-xl text-[12.5px] font-semibold text-ink-muted hover:bg-page hover:text-ink', compact ? 'justify-center py-2.5' : 'gap-3 px-3 py-2')}
        >
          <Repeat className="size-[17px]" aria-hidden />
          {compact ? <span className="sr-only">Player Career mode</span> : 'Player Career mode'}
        </Link>
      </div>
    </aside>
  );
}

function ManagerTopBar() {
  const state = useManagerStore((s) => s.state)!;
  const saving = useManagerStore((s) => s.saving);
  const f = state.franchises[state.franchiseId];
  const unread = state.news.filter((n) => !n.read).length;
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-3 pt-4 pb-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <FranchiseCrest franchise={f} size={34} />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-ink">{f.name}</p>
          <p className="text-[12px] text-ink-muted">
            Season {state.season.year} · {PHASE_LABEL[state.season.phase]}
            {state.season.phase === 'LEAGUE' ? ` · Round ${state.season.round}` : ''}
            <span className="sr-only" aria-live="polite">{saving ? 'Saving' : ''}</span>
          </p>
        </div>
      </div>
      <div className="ml-auto flex items-center gap-3 sm:gap-4">
        <Link to="/manager/news" className="relative grid size-10 place-items-center rounded-xl border border-line bg-surface text-ink-muted hover:text-brand-blue" aria-label={`News, ${unread} unread`}>
          <Newspaper className="size-[18px]" aria-hidden />
          {unread > 0 ? <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-brand-red px-1 text-[10.5px] font-bold text-white">{unread > 9 ? '9+' : unread}</span> : null}
        </Link>
        <Link to="/manager/profile" className="flex items-center gap-2.5 rounded-xl p-1 hover:bg-surface">
          <Avatar name={state.profile.name} size={38} ring />
          <div className="hidden leading-tight sm:block">
            <p className="text-[14px] font-semibold text-ink">{state.profile.name}</p>
            <p className="text-[12px] text-ink-muted">{MANAGER.ranks.label[state.profile.rank]}</p>
          </div>
        </Link>
        <div className="hidden h-8 w-px bg-line lg:block" aria-hidden />
        <div className="hidden min-w-[210px] lg:block">
          <div className="mb-1.5 flex items-baseline justify-between gap-4">
            <span className="text-[13px] font-bold text-ink">Reputation {Math.round(state.profile.reputation)}</span>
            <span className="text-[12px] font-medium text-ink-muted">Purse {formatMoney(f.purse)}</span>
          </div>
          <ProgressBar value={state.profile.reputation} tone="gold" label="Manager reputation" />
        </div>
      </div>
    </header>
  );
}

function ManagerTabBar() {
  const [open, setOpen] = useState(false);
  const primary = MANAGER_NAV.filter((i) => MOBILE_PRIMARY.includes(i.to));
  const TAB = 'flex min-h-14 flex-1 flex-col items-center justify-center gap-1 py-2 text-[10.5px] font-medium';
  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="absolute inset-0 cursor-default bg-brand-navy/50" />
          <div className="absolute inset-x-0 bottom-0 max-h-[calc(var(--vh)*75)] overflow-y-auto rounded-t-card bg-surface p-4 pb-[calc(env(safe-area-inset-bottom)+76px)] shadow-card-hover">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[15px] font-semibold text-ink">IPL Manager</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="grid size-11 place-items-center rounded-lg text-ink-muted hover:bg-page">
                <X className="size-4" />
              </button>
            </div>
            <NavList onNavigate={() => setOpen(false)} />
            <Link to="/start" className="mt-2 flex min-h-11 items-center gap-3 rounded-xl bg-page px-3 text-[13px] font-semibold text-ink">
              <Repeat className="size-4" aria-hidden /> Player Career mode
            </Link>
          </div>
        </div>
      ) : null}
      <nav aria-label="IPL Manager" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {primary.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/manager'} className={({ isActive }) => cn(TAB, isActive ? 'text-brand-blue' : 'text-ink-soft')}>
            <item.icon className="size-5" strokeWidth={1.8} aria-hidden />
            {item.label.replace('Live ', '')}
          </NavLink>
        ))}
        <button type="button" onClick={() => setOpen(true)} aria-expanded={open} className={cn(TAB, open ? 'text-brand-blue' : 'text-ink-soft')}>
          <MoreHorizontal className="size-5" aria-hidden />
          More
        </button>
      </nav>
    </>
  );
}

export function ManagerShell({ children }: { children: ReactNode }) {
  const booted = useManagerStore((s) => s.booted);
  const boot = useManagerStore((s) => s.boot);
  const state = useManagerStore((s) => s.state);
  const saveNow = useManagerStore((s) => s.saveNow);
  const { pathname } = useLocation();
  // Home has its own Next-up card; a live match runs its own flow.
  const showPhaseBar = pathname !== '/manager' && pathname !== '/manager/' && !/^\/manager\/match\/[^/]+\/?$/.test(pathname);

  useEffect(() => {
    void boot();
    // Today's real players (a career begun in the past may have been using its own season's).
    void loadRealData();
  }, [boot]);

  // Never lose the last change: save on tab hide and before unload.
  useEffect(() => {
    const flush = () => void saveNow();
    const onHide = () => document.visibilityState === 'hidden' && flush();
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [saveNow]);

  if (!booted) return <ScreenLoading />;
  if (!state) return <Navigate to="/manager/start" replace />;

  return (
    <div className="min-h-screen bg-page">
      <a href="#manager-main" className="skip-link">Skip to content</a>
      <div className="hidden md:block lg:hidden">
        <ManagerSidebar compact />
      </div>
      <div className="hidden lg:block">
        <ManagerSidebar />
      </div>
      <div className="md:pl-[72px] lg:pl-[200px]">
        <div className="px-4 pb-24 sm:px-5 md:pb-8 lg:px-3">
          <ManagerTopBar />
          <main id="manager-main" tabIndex={-1} className="outline-none">
            {showPhaseBar ? <PhaseBar /> : null}
            {children}
          </main>
        </div>
      </div>
      <ManagerTabBar />
    </div>
  );
}
