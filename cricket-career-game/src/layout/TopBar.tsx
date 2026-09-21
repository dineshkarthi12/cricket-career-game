import { Bell, Search } from 'lucide-react';
import { Avatar, ProgressBar } from '@/components';

interface TopBarProps {
  playerName: string;
  /** Sub-label under the name, e.g. "Aspiring Cricketer". */
  title: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  notifications: number;
}

export function TopBar({
  playerName,
  title,
  level,
  xp,
  xpToNextLevel,
  notifications,
}: TopBarProps) {
  const pct = xpToNextLevel > 0 ? (xp / xpToNextLevel) * 100 : 0;

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-3 pt-4 pb-3">
      <label className="relative min-w-0 flex-1 md:max-w-[400px]">
        <span className="sr-only">Search players, teams, tournaments</span>
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-soft" />
        <input
          type="search"
          placeholder="Search players, teams, tournaments..."
          className="h-10 w-full rounded-xl border border-line bg-surface pr-3 pl-10 text-[13.5px] text-ink placeholder:text-ink-soft focus:border-brand-blue/50 focus:ring-2 focus:ring-brand-blue/15 focus:outline-none"
        />
      </label>

      <div className="ml-auto flex items-center gap-3 sm:gap-4">
        <button
          type="button"
          className="relative grid size-9 place-items-center rounded-xl text-ink transition-colors hover:bg-surface"
          aria-label={`Notifications (${notifications} unread)`}
        >
          <Bell className="size-[19px]" strokeWidth={1.8} />
          {notifications > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 grid size-[18px] place-items-center rounded-full bg-brand-red text-[10px] font-bold text-white">
              {notifications > 9 ? '9+' : notifications}
            </span>
          ) : null}
        </button>

        <div className="flex items-center gap-2.5">
          <Avatar name={playerName} size={38} ring />
          <div className="hidden leading-tight sm:block">
            <p className="text-[14px] font-semibold text-ink">{playerName}</p>
            <p className="text-[12px] text-ink-muted">{title}</p>
          </div>
        </div>

        <div className="hidden h-8 w-px bg-line lg:block" aria-hidden />

        <div className="hidden min-w-[230px] lg:block">
          <div className="mb-1.5 flex items-baseline justify-between gap-4">
            <span className="text-[14px] font-bold text-ink">Lv {level}</span>
            <span className="text-[12px] font-medium text-ink-muted">
              {xp} / {xpToNextLevel} XP
            </span>
          </div>
          <ProgressBar value={pct} height={7} className="w-full" label={`Level ${level} progress`} />
        </div>
      </div>
    </header>
  );
}
