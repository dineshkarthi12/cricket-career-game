import { useT } from '@/i18n/react';
import { Search } from 'lucide-react';
import { NotificationsPanel } from './NotificationsPanel';
import { Link } from 'react-router-dom';
import { Avatar, ProgressBar } from '@/components';

interface TopBarProps {
  playerName: string;
  /** Sub-label under the name, e.g. "Aspiring Cricketer". */
  title: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
}

export function TopBar({
  playerName,
  title,
  level,
  xp,
  xpToNextLevel,
}: TopBarProps) {
  const pct = xpToNextLevel > 0 ? (xp / xpToNextLevel) * 100 : 0;
  const t = useT();

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-3 pt-4 pb-3">
      <label className="relative min-w-0 flex-1 md:max-w-[400px]">
        <span className="sr-only">{t('top.search')}</span>
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-soft" />
        <input
          type="search"
          placeholder={t('top.searchPlaceholder')}
          className="h-10 w-full rounded-xl border border-line bg-surface pr-3 pl-10 text-[13.5px] text-ink placeholder:text-ink-soft focus:border-brand-blue/50 focus:ring-2 focus:ring-brand-blue/15 focus:outline-none"
        />
      </label>

      <div className="ml-auto flex items-center gap-3 sm:gap-4">
        <NotificationsPanel />

        <Link
          to="/start"
          title={t('top.switchCareer')}
          className="flex items-center gap-2.5 rounded-xl p-1 transition-colors hover:bg-surface"
        >
          <Avatar name={playerName} size={38} ring />
          <div className="hidden leading-tight sm:block">
            <p className="text-[14px] font-semibold text-ink">{playerName}</p>
            <p className="text-[12px] text-ink-muted">{title}</p>
          </div>
          <span className="sr-only">{t('top.switchCareer')}</span>
        </Link>

        <div className="hidden h-8 w-px bg-line lg:block" aria-hidden />

        <div className="hidden min-w-[230px] lg:block">
          <div className="mb-1.5 flex items-baseline justify-between gap-4">
            <span className="text-[14px] font-bold text-ink">{t('top.level', { n: level })}</span>
            <span className="text-[12px] font-medium text-ink-muted">
              {xp} / {xpToNextLevel} XP
            </span>
          </div>
          <ProgressBar value={pct} height={7} className="w-full" label={t('top.levelProgress', { n: level })} />
        </div>
      </div>
    </header>
  );
}
