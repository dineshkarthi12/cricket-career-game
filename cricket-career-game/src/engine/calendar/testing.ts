/** Test helper: play a fixture to the end with the AI making every call. */
import { buildMatch } from '../match/lineup';
import { createLiveMatch } from '../match/live';
import type { Fixture, GameState, Match } from '@/types';

export function quickSimFixture(state: GameState, fixture: Fixture): Match {
  const build = buildMatch(state, fixture);
  if (!build) throw new Error(`Fixture ${fixture.id} cannot be played`);
  const live = createLiveMatch(build.setup);
  live.toEnd({});
  const done = live.finished();
  if (!done) throw new Error('Match did not finish');
  return done.match;
}
