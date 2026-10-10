import { hasBallByBall } from '@/lib/clips';
import { useGameStore } from '@/store/gameStore';
import { useReducedMotion } from '@/store/appSettings';
import type { Match } from '@/types';
import { HighlightsPlayer } from './HighlightsPlayer';

/**
 * The animated replay for a match from the career, or null when the match
 * no longer has its ball-by-ball (only the latest two keep it).
 */
export function ReplayFor({ match, teamNameOf }: { match: Match; teamNameOf: (id: string) => string }) {
  const state = useGameStore((s) => s.state);
  const reduceMotion = useReducedMotion(state?.settings.reduceMotion ?? false);
  if (!state || !hasBallByBall(match)) return null;
  const venue = state.venues[match.venueId] ?? Object.values(state.venues)[0];
  if (!venue) return null;
  return (
    <HighlightsPlayer
      match={match}
      venue={venue}
      teamNameOf={teamNameOf}
      userId={state.player.id}
      userName={`${state.player.firstName} ${state.player.lastName}`.trim()}
      userLeftHanded={state.player.battingStyle === 'LEFT_HAND_BAT'}
      reduceMotion={reduceMotion}
    />
  );
}
