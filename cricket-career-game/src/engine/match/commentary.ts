/**
 * Ball-by-ball commentary. Deterministic: the same delivery always produces
 * the same line, so a replayed match reads identically.
 */
import type { DeliveryContext } from './types';
import type { DismissalType, ShotType } from '@/types';

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

const SHOT_WORDS: Record<ShotType, string> = {
  DEFEND: 'pushes it back',
  LEAVE: 'shoulders arms',
  BLOCK: 'blocks it out',
  DRIVE: 'drives',
  CUT: 'cuts',
  PULL: 'pulls',
  HOOK: 'hooks',
  SWEEP: 'sweeps',
  REVERSE_SWEEP: 'reverse-sweeps',
  FLICK: 'clips it away',
  LOFT: 'lofts it',
  RAMP: 'ramps it',
};

const LENGTH_WORDS: Record<string, string> = {
  FULL_TOSS: 'a full toss',
  YORKER: 'a yorker',
  FULL: 'full',
  GOOD: 'on a good length',
  SHORT_OF_GOOD: 'back of a length',
  SHORT: 'short',
};

const LINE_WORDS: Record<string, string> = {
  WIDE_OFF: 'well wide of off',
  OUTSIDE_OFF: 'outside off',
  OFF_STUMP: 'at off stump',
  MIDDLE: 'at the stumps',
  LEG_STUMP: 'on leg stump',
  DOWN_LEG: 'down the leg side',
};

/** A tiny deterministic hash, so phrasing varies without needing the rng. */
function pickBy(seed: string, options: string[]): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return options[hash % options.length];
}

export function describeBall(input: CommentaryInput): string {
  const { context, kind } = input;
  const bowler = context.bowler.name;
  const batter = context.striker.name;
  const key = `${bowler}${batter}${context.oversBowled}${context.strikerBallsFaced}${kind}`;
  const length = LENGTH_WORDS[context.plan.length] ?? 'on a length';
  const line = LINE_WORDS[context.plan.line] ?? '';
  const variation = context.plan.variation ? `, the ${context.plan.variation},` : '';

  switch (kind) {
    case 'WIDE':
      return pickBy(key, [
        `${bowler} sprays it down the leg side. Wide.`,
        `Too far across ${batter}, and the umpire signals a wide.`,
        `${bowler} loses his radar there — wide called.`,
      ]);

    case 'NO_BALL':
      return pickBy(key, [
        `${bowler} oversteps. No ball.`,
        `Front foot over the line from ${bowler} — no ball, and a free hit to come.`,
      ]);

    case 'BYE':
      return `Beats everyone${input.runs === 4 ? ' and races away to the rope' : ''}. ${input.runs} bye${input.runs === 1 ? '' : 's'}.`;

    case 'LEG_BYE':
      return `Off the pad and away. ${input.runs} leg bye${input.runs === 1 ? '' : 's'}.`;

    case 'FOUR': {
      const shot = input.shot ? SHOT_WORDS[input.shot] : 'drives';
      return pickBy(key, [
        `${length}${variation} and ${batter} ${shot} it beautifully — four runs.`,
        `Short of the mark from ${bowler}. ${batter} ${shot} through the gap for four.`,
        `${batter} ${shot} it, and that has beaten the sweeper. Four.`,
      ]);
    }

    case 'SIX': {
      const shot = input.shot ? SHOT_WORDS[input.shot] : 'lofts it';
      return pickBy(key, [
        `${batter} ${shot} — and that is out of the middle. Six!`,
        `Into the stands! ${batter} ${shot} ${bowler} for six.`,
        `${batter} gets under it and ${shot} it all the way. Six runs.`,
      ]);
    }

    case 'WICKET': {
      const who = input.dismissedName ?? batter;
      switch (input.dismissal) {
        case 'BOWLED':
          return `${length}${variation} — through the gate and ${who} is BOWLED! ${bowler} has his man.`;
        case 'LBW':
          return `${length} ${line}, it thuds into the pad, and the finger goes up. ${who} lbw ${bowler}.`;
        case 'CAUGHT':
          return input.onTheRope
            ? `${who} goes big — but ${input.fielderName} takes it on the rope! Caught.`
            : `${who} finds ${input.fielderName} in the field. Caught, and ${bowler} has the wicket.`;
        case 'CAUGHT_BEHIND':
          return `A thin edge through to ${input.fielderName}, and ${who} has to go. Caught behind off ${bowler}.`;
        case 'CAUGHT_AND_BOWLED':
          return `Straight back at ${bowler}, who takes it himself. ${who} caught and bowled.`;
        case 'STUMPED':
          return `${who} comes down the track, misses, and ${input.fielderName} does the rest. Stumped off ${bowler}.`;
        case 'RUN_OUT':
          return `Called through for a tight one, ${input.fielderName} swoops, direct hit — ${who} is run out!`;
        case 'HIT_WICKET':
          return `${who} loses his balance and dislodges the bail. Hit wicket off ${bowler}.`;
        default:
          return `${who} is out off ${bowler}.`;
      }
    }

    case 'RUNS':
    default: {
      const runs = input.runs ?? 0;
      const shot = input.shot ? SHOT_WORDS[input.shot] : 'plays it';
      if (runs === 0) {
        return pickBy(key, [
          `${length}${variation} ${line}. ${batter} ${shot}. No run.`,
          `${bowler} gets it ${length}. ${batter} is watchful. Dot ball.`,
          `Tight from ${bowler}, ${batter} ${shot} to the fielder.`,
        ]);
      }
      if (runs === 1) {
        return pickBy(key, [
          `${batter} ${shot} into the gap and takes a single.`,
          `Worked away off the hip for one.`,
          `${batter} ${shot} to ${input.fielderName ?? 'the fielder'} and they scamper through for one.`,
        ]);
      }
      if (runs === 2) return `${batter} ${shot} into the outfield and comes back for the second.`;
      return `Into the gap, ${input.fielderName ?? 'the sweeper'} chases, and they run three.`;
    }
  }
}
