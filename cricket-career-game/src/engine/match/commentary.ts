/**
 * Ball-by-ball commentary. Deterministic: the same delivery always produces
 * the same line, so a replayed match reads identically.
 *
 * A line is kept two ways on the ball: `commentary`, the English text (what
 * older saves have, and what the engine's own tests read), and
 * `commentaryCode`, the dictionary keys and variables it was made from, so a
 * screen can read it in the app's language (`commentaryFor`). Each event has
 * several numbered variants in the dictionaries (`cv.four.0` ...); the
 * variant is picked from the delivery, not the rng.
 */
import { isKey, t, variants, type Key, type Lang, type Vars } from '@/i18n/core';
import type { DeliveryContext } from './types';
import type { CommentaryPart, DismissalType, ShotType } from '@/types';

export type { CommentaryPart } from '@/types';

export interface CommentaryInput {
  context: DeliveryContext;
  kind: 'WICKET' | 'FOUR' | 'SIX' | 'RUNS' | 'WIDE' | 'NO_BALL' | 'BYE' | 'LEG_BYE';
  runs?: number;
  shot?: ShotType | null;
  dismissal?: DismissalType;
  fielderName?: string | null;
  dismissedName?: string;
  onTheRope?: boolean;
}

/** What a delivery outcome carries: the English line and how it was made. */
export interface Commentary {
  commentary: string;
  commentaryCode: CommentaryPart[];
}

/** Every sentence starts with a capital ("A full toss outside off", not "a full toss"). */
function sentences(text: string): string {
  return text.replace(/(^|[.!?]\s+)([a-z])/g, (_, lead: string, ch: string) => lead + ch.toUpperCase());
}

/** The parts, read in a language. */
export function renderCommentary(code: CommentaryPart[], lang: Lang): string {
  const text = code
    .filter((part) => isKey(part.k))
    .map((part) => t(lang, part.k as Key, part.v))
    .join(' ');
  return lang === 'en' ? sentences(text) : text;
}

/** A ball's commentary in a language; a ball saved before the codes existed keeps its English. */
export function commentaryFor(ball: { commentary: string; commentaryCode?: CommentaryPart[] }, lang: Lang): string {
  if (lang === 'en' || !ball.commentaryCode?.length) return ball.commentary;
  return renderCommentary(ball.commentaryCode, lang);
}

/** A line from its parts: the English text and the code, together. */
export function say(...parts: CommentaryPart[]): Commentary {
  return { commentary: renderCommentary(parts, 'en'), commentaryCode: parts };
}

/** Put a part in front of a line (the timing of the player's tap). */
export function prefixed(part: CommentaryPart, line: Commentary): Commentary {
  return say(part, ...line.commentaryCode);
}

/** A tiny deterministic hash, so phrasing varies without needing the rng. */
function hashOf(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return hash;
}

/** One of an event's numbered variants, chosen by the seed. */
function pick(seed: string, family: string, v: Vars): CommentaryPart {
  const n = variants(family);
  return { k: n > 0 ? `${family}.${hashOf(seed) % n}` : family, v };
}

/** A one-off line by a seed: drops, reviews and fumbles outside `describeBall`. */
export function sayVariant(seed: string, family: string, v: Vars): Commentary {
  return say(pick(seed, family, v));
}

const ref = (key: string): string => `@${key}`;

/** The English line only (kept for callers that want text). */
export function describeBall(input: CommentaryInput): string {
  return commentate(input).commentary;
}

export function commentate(input: CommentaryInput): Commentary {
  return say(describe(input));
}

function describe(input: CommentaryInput): CommentaryPart {
  const { context, kind } = input;
  const bowler = context.bowler.name;
  const batter = context.striker.name;
  const seed = `${bowler}${batter}${context.oversBowled}${context.strikerBallsFaced}${kind}`;
  const length = isKey(`cv.len.${context.plan.length}`) ? ref(`cv.len.${context.plan.length}`) : ref('cv.len.default');
  const line = isKey(`cv.line.${context.plan.line}`) ? ref(`cv.line.${context.plan.line}`) : '';
  const variationName = context.plan.variation;
  const variation = variationName ? ref('cv.withVar') : '';
  const vname = variationName ? (isKey(`var.${variationName}`) ? ref(`var.${variationName}`) : variationName) : '';
  const delivery = { bowler, batter, length, line, variation, vname };
  const hit = (fallback: string) => (input.shot ? ref(`cv.hit.${input.shot}`) : ref(fallback));

  switch (kind) {
    case 'WIDE':
      return pick(seed, 'cv.wide', { bowler, batter });

    case 'NO_BALL':
      return pick(seed, 'cv.noBall', { bowler });

    case 'BYE': {
      const n = input.runs ?? 1;
      return pick(seed, 'cv.bye', { n, byes: ref(n === 1 ? 'cv.byes.one' : 'cv.byes.many'), rope: n === 4 ? ref('cv.byes.rope') : '' });
    }

    case 'LEG_BYE': {
      const n = input.runs ?? 1;
      return pick(seed, 'cv.legBye', { n, lb: ref(n === 1 ? 'cv.legByes.one' : 'cv.legByes.many') });
    }

    case 'FOUR':
      return pick(seed, 'cv.four', { ...delivery, hit: hit('cv.hit.DRIVE') });

    case 'SIX':
      return pick(seed, 'cv.six', { bowler, batter, hit: hit('cv.hit.LOFT') });

    case 'WICKET': {
      const who = input.dismissedName ?? batter;
      const fielder = input.fielderName ?? ref('cv.theFielder');
      const v = { ...delivery, who, fielder };
      switch (input.dismissal) {
        case 'BOWLED':
          return pick(seed, 'cv.bowled', v);
        case 'LBW':
          return pick(seed, 'cv.lbw', v);
        case 'CAUGHT':
          return pick(seed, input.onTheRope ? 'cv.rope' : 'cv.caught', v);
        case 'CAUGHT_BEHIND':
          return pick(seed, 'cv.behind', v);
        case 'CAUGHT_AND_BOWLED':
          return pick(seed, 'cv.cab', v);
        case 'STUMPED':
          return pick(seed, 'cv.stumped', v);
        case 'RUN_OUT':
          return pick(seed, 'cv.runOut', v);
        case 'HIT_WICKET':
          return pick(seed, 'cv.hitWicket', v);
        default:
          return { k: 'cv.outOther', v: { who, bowler } };
      }
    }

    case 'RUNS':
    default: {
      const runs = input.runs ?? 0;
      if (runs === 0) {
        return pick(seed, 'cv.dot', { ...delivery, play: input.shot ? ref(`cv.play.${input.shot}`) : ref('cv.play.default') });
      }
      const v = { batter, hit: hit('cv.hit.work') };
      if (runs === 1) return pick(seed, 'cv.one', { ...v, fielder: input.fielderName ?? ref('cv.theFielder') });
      if (runs === 2) return pick(seed, 'cv.two', { ...v, fielder: input.fielderName ?? ref('cv.theFielder') });
      return pick(seed, 'cv.three', { ...v, fielder: input.fielderName ?? ref('cv.theSweeper') });
    }
  }
}
