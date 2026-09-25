import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileTabBar } from './MobileTabBar';
import { ContinueBar } from './ContinueBar';
import { useGameStore } from '@/store/gameStore';
import { playerTitle, unreadCount } from '@/lib/selectors';

/**
 * Sidebar + top bar + content, in one place so every screen in the game keeps
 * the same frame. Desktop gets the full sidebar, tablets an icon rail, phones
 * a bottom tab bar.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const state = useGameStore((s) => s.state);
  const player = state?.player ?? null;

  return (
    <div className="min-h-screen bg-page">
      {/* Tablet rail */}
      <div className="hidden md:block lg:hidden">
        <Sidebar compact />
      </div>
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <div className="md:pl-[72px] lg:pl-[200px]">
        <div className="px-4 pb-24 sm:px-5 md:pb-8 lg:px-3">
          <TopBar
            playerName={player ? `${player.firstName} ${player.lastName}`.trim() : 'New Player'}
            title={state ? playerTitle(state) : 'Aspiring Cricketer'}
            level={player?.level ?? 1}
            xp={player?.xp ?? 0}
            xpToNextLevel={player?.xpToNextLevel ?? 100}
            notifications={state ? unreadCount(state) : 0}
          />
          <ContinueBar />
          <main>{children}</main>
        </div>
      </div>

      <MobileTabBar />
    </div>
  );
}
