import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from './navItems';
import { Logo } from './Logo';
import { cn } from '@/lib/cn';

interface SidebarProps {
  /** Tablet rail: icons only, labels become tooltips. */
  compact?: boolean;
}

export function Sidebar({ compact = false }: SidebarProps) {
  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-30 flex flex-col border-r border-line/70 bg-surface/60',
        compact ? 'w-[72px]' : 'w-[200px]',
      )}
    >
      <div className={cn('shrink-0 pt-5 pb-4', compact ? 'px-2' : 'px-4')}>
        {compact ? (
          <Logo className="flex justify-center [&_p]:hidden" />
        ) : (
          <Logo showTagline />
        )}
      </div>

      <nav
        aria-label="Primary"
        className={cn('no-scrollbar shrink-0 overflow-y-auto pb-3', compact ? 'px-2' : 'px-3')}
      >
        <ul className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                title={compact ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    'relative flex items-center rounded-xl text-[13.5px] font-medium transition-colors',
                    compact ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5',
                    isActive
                      ? 'bg-brand-blue-soft text-brand-blue'
                      : 'text-ink-muted hover:bg-page hover:text-ink',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && !compact ? (
                      <span
                        className="absolute top-1.5 -left-2 h-[calc(100%-12px)] w-1 rounded-full bg-brand-blue"
                        aria-hidden
                      />
                    ) : null}
                    <item.icon className="size-[18px] shrink-0" strokeWidth={1.8} />
                    {compact ? <span className="sr-only">{item.label}</span> : <span>{item.label}</span>}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {compact ? null : <SidebarFooter />}
    </aside>
  );
}

/** Handwritten motto sitting over the sidebar photograph. */
function SidebarFooter() {
  return (
    <div className="relative min-h-[190px] flex-1 overflow-hidden">
      <img
        src="/assets/sidebar-player.jpg"
        alt=""
        aria-hidden
        className="absolute inset-0 size-full object-cover object-[55%_18%]"
      />
      <div
        className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-surface via-surface/85 to-transparent"
        aria-hidden
      />
      <p className="font-hand relative px-4 pt-3 text-[21px] leading-[1.15] text-brand-navy">
        Discipline today,
        <br />
        International
        <br />
        tomorrow.
      </p>
    </div>
  );
}
