import { useState } from 'react';
import { Tabs, TutorialTip } from '@/components';
import { Navigate } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { nextMatchFixture } from '@/lib/selectors';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { HeroBanner } from './home/HeroBanner';
import { NextActionCard } from './home/NextActionCard';
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
import { CollapsibleCard } from './home/CollapsibleCard';
import { DecisionsCard } from './pro/DecisionsCard';
import { RoadToSelectionCard } from './home/RoadToSelectionCard';
import type { GameState } from '@/types';

/** The rest of Home on a phone, a tab at a time. */
const MOBILE_TABS = [
  { id: 'progress', label: 'Progress' },
  { id: 'stats', label: 'Stats' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'more', label: 'More' },
];

/**
 * The Home dashboard from design/dashboard.png, led by the one thing to do
 * next. On a phone: a slim hero, Next action, three compact cards (next
 * match, road to selection, inbox) and the rest behind tabs. On a tablet or
 * desktop: the grid, Next action first, with the low-priority cards foldable.
 */
export default function Home() {
  const state = useGameStore((s) => s.state);
  const booted = useGameStore((s) => s.booted);
  const wide = useMediaQuery('(min-width: 768px)');

  if (!state) {
    if (booted) return <Navigate to="/start" replace />;
    return (
      <p className="py-20 text-center text-[14px] text-ink-muted">Loading your career…</p>
    );
  }
  return wide ? <WideHome state={state} /> : <PhoneHome state={state} />;
}

function WideHome({ state }: { state: GameState }) {
  return (
    <div className="flex flex-col gap-3 pb-4">
      <TutorialTip id="dashboard" />
      {/* Hero, with the Next Match card lapping over its right-hand end. */}
      <div className="relative">
        <HeroBanner state={state} />
        <div className="mt-3 w-full wide:absolute wide:top-2.5 wide:right-2.5 wide:mt-0 wide:w-[330px]">
          <NextMatchCard state={state} fixture={nextMatchFixture(state)} />
        </div>
      </div>

      <NextActionCard state={state} />

      <DecisionsCard state={state} />

      <RoadToSelectionCard state={state} />

      <CareerJourneyCard state={state} />

      <div className="grid gap-3 md:grid-cols-2 wide:grid-cols-4">
        <UpcomingScheduleCard state={state} />
        <TrainingFocusCard state={state} />
        <PlayerStatsCard state={state} />
        <InboxCard state={state} />
      </div>

      <div className="grid gap-3 md:grid-cols-2 wide:grid-cols-4">
        <RecentMatchCard state={state} />
        <CollapsibleCard id="skills" title="Skill Development">
          <SkillDevelopmentCard state={state} />
        </CollapsibleCard>
        <CollapsibleCard id="trophies" title="Trophies & Milestones">
          <TrophiesCard state={state} />
        </CollapsibleCard>
        {hasCommunity(state) ? (
          <CollapsibleCard id="community" title="Community">
            <CommunityCard state={state} />
          </CollapsibleCard>
        ) : null}
      </div>

      <BottomBanner />
    </div>
  );
}

function PhoneHome({ state }: { state: GameState }) {
  const [tab, setTab] = useState('progress');
  return (
    <div className="flex flex-col gap-3 pb-4">
      <HeroBanner state={state} />
      <NextActionCard state={state} />
      <NextMatchCard state={state} fixture={nextMatchFixture(state)} compact />
      {/* Below the fold-line cards, so the first screen is hero, next action and next match. */}
      <TutorialTip id="dashboard" />
      <RoadToSelectionCard state={state} compact />
      <InboxCard state={state} compact />

      <Tabs tabs={MOBILE_TABS} value={tab} onChange={setTab} label="More on Home" className="grid grid-cols-4 rounded-card bg-surface p-1 shadow-card [&>button]:py-2 [&>button]:text-[12.5px]" />
      <div role="tabpanel" aria-label={MOBILE_TABS.find((t) => t.id === tab)?.label} className="flex flex-col gap-3">
        {tab === 'progress' ? (
          <>
            <CareerJourneyCard state={state} />
          </>
        ) : null}
        {tab === 'stats' ? (
          <>
            <PlayerStatsCard state={state} />
            <RecentMatchCard state={state} />
            <SkillDevelopmentCard state={state} />
          </>
        ) : null}
        {tab === 'schedule' ? (
          <>
            <UpcomingScheduleCard state={state} />
            <TrainingFocusCard state={state} />
          </>
        ) : null}
        {tab === 'more' ? (
          <>
            <DecisionsCard state={state} />
            <TrophiesCard state={state} />
            <CommunityCard state={state} />
            <BottomBanner />
          </>
        ) : null}
      </div>
    </div>
  );
}

/** Community matters once people follow the player (see `CommunityCard`). */
function hasCommunity(state: GameState): boolean {
  return (state.pro?.fans.stories.length ?? 0) > 0 || (state.pro?.fans.followers ?? 0) >= 100;
}
