import { Card, CardHeader } from '@/components';
import { useGameStore } from '@/store/gameStore';
import Placeholder from './Placeholder';
import SettingsPage from './settings/SettingsScreen';
import { CaptaincyCard } from './stats/CaptaincyCard';

/**
 * Every route outside Home, until its own phase builds it out. Contents come
 * straight from the screen list in GAME_SPEC.md §8.
 */

export const AuctionScreen = () => (
  <Placeholder
    route="/auction"
    phase="Phase 7"
    description="Scouting reputation, franchise interest and the auction itself."
    contents={[
      'Scouting reputation',
      'Franchise interest and trials',
      'Auction lots and bidding',
      'Contract outcomes',
    ]}
  />
);

export const StatsScreen = () => (
  <>
    <StatsCaptaincy />
    <Placeholder
      route="/stats"
      phase="Phase 8"
      description="Career and season figures, by format and by competition."
      contents={[
        'Batting, bowling and fielding records',
        'Split by format and competition',
        'Season-by-season charts',
        'Records and personal bests',
      ]}
    />
  </>
);

export const AwardsScreen = () => (
  <Placeholder
    route="/awards"
    phase="Phase 8"
    description="The trophy cabinet: what you have won and what is still locked."
    contents={[
      'Trophy cabinet',
      'Career milestones',
      'Series and tournament awards',
      'Progress towards locked trophies',
    ]}
  />
);

export const CommunityScreen = () => (
  <Placeholder
    route="/community"
    phase="Phase 8"
    description="Fan and media reaction as your name starts to travel."
    contents={[
      'Fan reaction feed',
      'Media coverage',
      'Reputation over time',
      'Replies and interactions',
    ]}
  />
);

export const SettingsScreen = () => (
  <SettingsPage devTools={import.meta.env.DEV ? <DevTools /> : null} />
);

/** The captaincy record, above the rest of the Stats placeholder. */
function StatsCaptaincy() {
  const state = useGameStore((s) => s.state);
  if (!state) return null;
  return (
    <div className="pb-4">
      <CaptaincyCard state={state} />
    </div>
  );
}

/**
 * Development only: switch captain mode on before the career reaches it.
 * Never rendered in a production build, and ignored there if set.
 */
function DevTools() {
  const state = useGameStore((s) => s.state);
  const update = useGameStore((s) => s.update);
  if (!state) return null;
  return (
    <div className="pb-4">
      <Card>
        <CardHeader title="Developer tools" subtitle="Only in development builds." />
        <label className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5 text-[13px] text-ink">
          <span>
            <span className="font-semibold">Captain mode</span>
            <span className="block text-[12px] text-ink-muted">
              Treat the player as captain of their side, to test captain controls early.
            </span>
          </span>
          <input
            type="checkbox"
            checked={state.settings.devCaptainMode}
            onChange={(event) =>
              update((s) => ({ ...s, settings: { ...s.settings, devCaptainMode: event.target.checked } }))
            }
            className="size-4 accent-brand-blue"
          />
        </label>
      </Card>
    </div>
  );
}
