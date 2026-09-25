import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { MoreHorizontal, X } from 'lucide-react';
import { MOBILE_MORE_ITEMS, MOBILE_NAV_ITEMS } from './navItems';
import { cn } from '@/lib/cn';

const TAB =
  'flex flex-1 flex-col items-center gap-1 py-2 text-[10.5px] font-medium transition-colors';

/** Bottom tab bar shown instead of the sidebar on phones. */
export function MobileTabBar() {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      {moreOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
            className="absolute inset-0 cursor-default bg-brand-navy/50"
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-card bg-surface p-4 pb-[calc(env(safe-area-inset-bottom)+76px)] shadow-card-hover">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[15px] font-semibold text-ink">More</p>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Close menu"
                className="grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-page"
              >
                <X className="size-4" />
              </button>
            </div>
            <ul className="grid grid-cols-2 gap-2">
              {MOBILE_MORE_ITEMS.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={() => setMoreOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 rounded-xl px-3 py-3 text-[13px] font-medium',
                        isActive ? 'bg-brand-blue-soft text-brand-blue' : 'bg-page text-ink-muted',
                      )
                    }
                  >
                    <item.icon className="size-[18px]" strokeWidth={1.8} />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {MOBILE_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(TAB, isActive ? 'text-brand-blue' : 'text-ink-soft')
            }
          >
            <item.icon className="size-[20px]" strokeWidth={1.8} />
            {item.label === 'Career Path' ? 'Career' : item.label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={cn(TAB, moreOpen ? 'text-brand-blue' : 'text-ink-soft')}
          aria-expanded={moreOpen}
        >
          <MoreHorizontal className="size-[20px]" strokeWidth={1.8} />
          More
        </button>
      </nav>
    </>
  );
}
