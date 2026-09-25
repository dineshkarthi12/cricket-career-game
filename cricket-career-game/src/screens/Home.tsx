import { Navigate } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { nextMatchFixture } from '@/lib/selectors';
import { HeroBanner } from './home/HeroBanner';
import { NextMatchCard } from './home/NextMatchCard';
import { CareerJourneyCard } from './home/CareerJourneyCard';
import { UpcomingScheduleCard } from './home/UpcomingScheduleCard';
import { TrainingFocusCard } from './home/TrainingFocusCard';
import { PlayerStatsCard } from './home/PlayerStatsCard';
import { InboxCard } from './home/InboxCard';
import { RecentMatchCard } from './home/RecentMatchCard';
import { SkillDevelopmentCard } from './home/SkillDevelopmentCard';
import { TrophiesCard } from './home/TrophiesCard';
import { CommunityCard } from './home/CommunityCard';
import { BottomBanner } from './home/BottomBanner';

/** The Home dashboard from design/dashboard.png. */
export default function Home() {
  const state = useGameStore((s) => s.state);
  const booted = useGameStore((s) => s.booted);

  if (!state) {
    if (booted) return <Navigate to="/slots" replace />;
    return (
      <p className="py-20 text-center text-[14px] text-ink-muted">Loading your career…</p>
    );
  }

  return (
    <div className="flex flex-col gap-3 pb-4">
      {/* Hero, with the Next Match card lapping over its right-hand end. */}
      <div className="relative">
        <HeroBanner state={state} />
        <div className="mt-3 w-full max-w-md 2xl:absolute 2xl:top-2.5 2xl:right-2.5 2xl:mt-0 2xl:max-w-none 2xl:w-[338px]">
          <NextMatchCard state={state} fixture={nextMatchFixture(state)} />
        </div>
      </div>

      <CareerJourneyCard state={state} />

      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        <UpcomingScheduleCard state={state} />
        <TrainingFocusCard state={state} />
        <PlayerStatsCard state={state} />
        <InboxCard state={state} />
      </div>

      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        <RecentMatchCard state={state} />
        <SkillDevelopmentCard state={state} />
        <TrophiesCard state={state} />
        <CommunityCard />
      </div>

      <BottomBanner />
    </div>
  );
}
