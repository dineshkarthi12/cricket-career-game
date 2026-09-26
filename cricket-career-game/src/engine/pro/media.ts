/**
 * The press and the public. Every senior match moves the player's following
 * and the mood around them; failures in big matches build pressure (which
 * costs a little confidence and, when it gets loud, the selectors' patience)
 * and good days ease it. Notable days become stories - the Community feed
 * on the dashboard reads them.
 */
import { MEDIA } from '../config';
import { TOURNAMENTS_BY_ID } from '@/data/tournaments';
import { newId } from '../id';
import { clamp } from './common';
import { rngFor } from './world';
import type { GameState, Match, MediaStory } from '@/types';

const OUTLETS = ['The Cricket Chronicle', 'Long Room Desk', 'Sports Daily', 'The Morning Post', 'Cover Drive Podcast', 'Stumps Live', 'The Southern Herald', 'Fan Zone'];

export function addStory(state: GameState, date: string, headline: string, body: string, tone: MediaStory['tone'], outlet?: string): GameState {
  const fans = state.pro.fans;
  const rng = rngFor(state, `story-${headline}-${date}`);
  const story: MediaStory = {
    id: newId('story'),
    date,
    outlet: outlet ?? rng.pick(OUTLETS),
    headline,
    body,
    tone,
    likes: Math.round(fans.followers * (0.02 + rng.next() * 0.05) * (tone === 'CRITICAL' ? 0.6 : 1)),
  };
  return { ...state, pro: { ...state.pro, fans: { ...fans, stories: [story, ...fans.stories].slice(0, MEDIA.storiesKept) } } };
}

/** How big a stage a match is, 0-1. */
function spotlight(match: Match): number {
  const prestige = TOURNAMENTS_BY_ID[match.tournamentId]?.prestige ?? 20;
  const knockout = ['QUARTER_FINAL', 'SEMI_FINAL', 'FINAL', 'QUALIFIER_1', 'QUALIFIER_2', 'ELIMINATOR'].includes(match.stage) ? 0.15 : 0;
  return clamp((prestige - 40) / 60 + knockout, 0, 1);
}

/** After one of the player's matches: following, sentiment, pressure and maybe a story. */
export function mediaAfterMatch(state: GameState, match: Match): GameState {
  const p = match.userPerformance;
  if (!p || state.player.age < 17) return state;
  const light = spotlight(match);
  if (light <= 0) return state;
  const fans = state.pro.fans;
  const good = p.rating - 5.5;
  const growth = Math.max(0, fans.followers * MEDIA.followRate * light * (1 + Math.max(0, good) * 0.6) + MEDIA.followFloor * light * Math.max(0, good + 1));
  const sentiment = clamp(fans.sentiment + good * MEDIA.sentimentPerPoint * (0.5 + light), 0, 100);
  // Pressure builds after failures on big stages, eases after good days.
  const fail = p.rating < MEDIA.failRating ? (MEDIA.failRating - p.rating) * MEDIA.pressurePerFail * light : 0;
  const ease = p.rating >= 6.5 ? (p.rating - 6) * MEDIA.pressureEase : 0;
  const pressure = clamp(fans.pressure + fail - ease, 0, 100);
  let next: GameState = { ...state, pro: { ...state.pro, fans: { ...fans, followers: Math.round(fans.followers + growth), sentiment: Math.round(sentiment), pressure: Math.round(pressure) } } };

  // Pressure is felt.
  if (pressure >= MEDIA.pressureHurts) {
    const c = next.player.condition;
    next = { ...next, player: { ...next.player, condition: { ...c, confidence: clamp(c.confidence - 1.5, 0, 100), selectorTrust: clamp(c.selectorTrust - (pressure >= 85 ? 1 : 0), 0, 100) } } };
  }

  const name = TOURNAMENTS_BY_ID[match.tournamentId]?.shortName ?? 'the match';
  const who = next.player.lastName || next.player.firstName;
  const big = light >= 0.45;
  if (p.runs >= 100) {
    next = addStory(next, match.date, `${who} ${p.runs >= 150 ? 'bats all day' : 'hits a hundred'} in the ${name}`, `${p.runs}${p.notOut ? '*' : ''} off ${p.ballsFaced}. ${big ? 'The kind of innings that changes how selectors talk about a player.' : 'Another brick in a growing reputation.'}`, 'PRAISE');
  } else if (p.wickets >= 5) {
    next = addStory(next, match.date, `${p.wickets}-for! ${who} runs through the ${name} line-up`, `Figures of ${p.wickets}/${p.runsConceded}. ${big ? 'A spell people will remember.' : 'The scouts have noticed.'}`, 'PRAISE');
  } else if (big && p.manOfTheMatch) {
    next = addStory(next, match.date, `Player of the match: ${who}`, `${p.runs} runs${p.wickets ? ` and ${p.wickets} wickets` : ''} to swing it in the ${name}.`, 'PRAISE');
  } else if (big && p.runs === 0 && !p.notOut && p.ballsFaced > 0) {
    next = addStory(next, match.date, `Duck for ${who} in the ${name}`, pressure >= 60 ? 'The questions are getting louder. Is the place at risk?' : 'One bad day. The next innings matters.', 'CRITICAL');
  } else if (big && fail > 4 && pressure >= 55) {
    next = addStory(next, match.date, `Pressure mounts on ${who}`, 'Another quiet game on a big stage. The critics are circling.', 'CRITICAL');
  }
  return next;
}

/** The mood cools over a season; the following stays. */
export function mediaNewSeason(state: GameState): GameState {
  const fans = state.pro.fans;
  return { ...state, pro: { ...state.pro, fans: { ...fans, pressure: Math.round(fans.pressure * 0.5), sentiment: Math.round(fans.sentiment + (55 - fans.sentiment) * 0.3) } } };
}

/** A following bump for a headline moment (a cap, an award, a contract). */
export function spotlightMoment(state: GameState, followers: number, sentiment = 2): GameState {
  const fans = state.pro.fans;
  return { ...state, pro: { ...state.pro, fans: { ...fans, followers: fans.followers + followers, sentiment: clamp(fans.sentiment + sentiment, 0, 100) } } };
}
