/**
 * Match checkpoints: a live match that survives a page reload.
 *
 * The engine is deterministic - the same seed and the same calls, in the same
 * order, give the same match ball for ball (see `live.ts`). So a checkpoint is
 * not a dump of the engine's insides (closures, Maps, the innings state) but
 * the match's setup plus a log of every call that changed it: the toss, each
 * ball with the player's choices, answers to questions, a peeked delivery,
 * the impact substitute, declarations. Restoring replays the log into a fresh
 * engine. That rebuilds everything exactly - the random numbers, the planned
 * next delivery, an open question, DLS targets, the impact sub - because it is
 * the same computation run again.
 *
 * Anti-cheat follows from it: a reload replays the same calls, so the next
 * ball comes out as it would have. A peeked delivery is in the log, so it is
 * the same delivery after a reload.
 *
 * A fingerprint of the score is stored alongside; a log that replays to a
 * different score (a corrupted or tampered checkpoint, or an engine change)
 * is rejected and the caller starts the fixture again.
 *
 * Pure TypeScript, no storage: `src/save/matchCheckpoint.ts` writes them.
 */
import { createLiveMatch, type LiveMatch, type LiveMatchSetup, type LiveSnapshot } from './live';
import type { BallOverrides } from './innings';
import { t, type Key, type Lang } from '@/i18n/core';

export const CHECKPOINT_VERSION = 1;

/** One call into the match. `o` is an index into the checkpoint's override table. */
export type LiveAction =
  | { k: 'toss'; decision?: 'BAT' | 'BOWL' }
  | { k: 'ball' | 'over' | 'wicket' | 'involved' | 'innings' | 'end' | 'prepare'; o: number }
  | { k: 'answer'; timing?: number; review?: boolean }
  | { k: 'peek'; level: number }
  | { k: 'impact'; inId: string | null; outId: string | null }
  | { k: 'next' }
  | { k: 'declare' }
  | { k: 'followOn'; enforce: boolean };

/** Enough of the score to tell that a replay arrived where the original was. */
export interface MatchFingerprint {
  phase: LiveSnapshot['phase'];
  deliveries: number;
  runs: number;
  wickets: number;
  innings: number;
  question: boolean;
}

export interface LiveCheckpoint {
  version: number;
  setup: LiveMatchSetup;
  /** Distinct overrides, as JSON; most balls share one. */
  overrides: string[];
  log: LiveAction[];
  fingerprint: MatchFingerprint;
}

export interface RecordedLiveMatch extends LiveMatch {
  /** Everything needed to rebuild this match exactly. */
  checkpoint(): LiveCheckpoint;
}

export function fingerprintOf(snap: LiveSnapshot): MatchFingerprint {
  const done = snap.completed;
  return {
    phase: snap.phase,
    deliveries: done.reduce((n, i) => n + i.deliveries.length, 0) + (snap.current?.deliveries.length ?? 0),
    runs: done.reduce((n, i) => n + i.runs, 0) + (snap.current?.runs ?? 0),
    wickets: done.reduce((n, i) => n + i.wickets, 0) + (snap.current?.wickets ?? 0),
    innings: done.length + (snap.current ? 1 : 0),
    question: snap.question !== null,
  };
}

function sameFingerprint(a: MatchFingerprint, b: MatchFingerprint): boolean {
  return a.phase === b.phase && a.deliveries === b.deliveries && a.runs === b.runs && a.wickets === b.wickets && a.innings === b.innings && a.question === b.question;
}

/** Overrides as plain data: hooks (functions) never come from the player. */
function plain(overrides: BallOverrides | undefined): string {
  if (!overrides) return '{}';
  const { hooks: _hooks, ...rest } = overrides as BallOverrides & { hooks?: unknown };
  return JSON.stringify(rest);
}

/**
 * A live match that records every call, so it can be checkpointed. Behaves
 * exactly like `createLiveMatch` - the recording draws nothing from it.
 */
export function recordLiveMatch(setup: LiveMatchSetup, start?: { overrides: string[]; log: LiveAction[] }): RecordedLiveMatch {
  // A fixed match id, so the replayed match is the same match.
  // A copy taken before the first ball, as plain data: the engine may change
  // the objects it is given, and the checkpoint must describe the start.
  const fixedSetup: LiveMatchSetup = JSON.parse(JSON.stringify({ ...setup, matchId: setup.matchId ?? `match-${setup.fixtureId}-${setup.seed}` })) as LiveMatchSetup;
  const setupJson = JSON.stringify(fixedSetup);
  const inner = createLiveMatch(JSON.parse(setupJson) as LiveMatchSetup);
  const table: string[] = [...(start?.overrides ?? [])];
  const index = new Map(table.map((json, i) => [json, i]));
  const log: LiveAction[] = [];

  const ref = (overrides: BallOverrides | undefined): number => {
    const json = plain(overrides);
    let i = index.get(json);
    if (i === undefined) {
      i = table.length;
      table.push(json);
      index.set(json, i);
    }
    return i;
  };
  const read = (i: number): BallOverrides => JSON.parse(table[i] ?? '{}') as BallOverrides;

  /** Run one action against the engine (used both live and on replay). */
  const apply = (a: LiveAction): unknown => {
    switch (a.k) {
      case 'toss':
        return inner.doToss(a.decision);
      case 'ball':
        return inner.nextBall(read(a.o));
      case 'over':
        return inner.nextOver(read(a.o));
      case 'wicket':
        return inner.toNextWicket(read(a.o));
      case 'involved':
        return inner.untilInvolved(read(a.o));
      case 'innings':
        return inner.toEndOfInnings(read(a.o));
      case 'end':
        return inner.toEnd(read(a.o));
      case 'prepare':
        return inner.prepareNextOver(read(a.o));
      case 'answer':
        return inner.answer({ timing: a.timing, review: a.review });
      case 'peek':
        return inner.peekDelivery(a.level);
      case 'impact':
        return inner.chooseImpact(a.inId, a.outId);
      case 'next':
        return inner.startNextInnings();
      case 'declare':
        return inner.declare();
      case 'followOn':
        return inner.chooseFollowOn(a.enforce);
    }
  };
  // Live play goes through `apply` too, with the overrides read back from the
  // table: the engine sees exactly what a replay will give it.
  const doing = <T>(a: LiveAction): T => {
    log.push(a);
    return apply(a) as T;
  };

  for (const a of start?.log ?? []) {
    log.push(a);
    apply(a);
  }

  const recorded: RecordedLiveMatch = {
    snapshot: () => inner.snapshot(),
    doToss: (decision) => doing({ k: 'toss', decision }),
    nextBall: (o) => doing({ k: 'ball', o: ref(o) }),
    nextOver: (o) => doing({ k: 'over', o: ref(o) }),
    toNextWicket: (o) => doing({ k: 'wicket', o: ref(o) }),
    untilInvolved: (o) => doing({ k: 'involved', o: ref(o) }),
    toEndOfInnings: (o) => doing({ k: 'innings', o: ref(o) }),
    toEnd: (o) => doing({ k: 'end', o: ref(o) }),
    prepareNextOver: (o) => doing({ k: 'prepare', o: ref(o) }),
    answer: (r) => doing({ k: 'answer', timing: r.timing, review: r.review }),
    peekDelivery: (level) => doing({ k: 'peek', level }),
    chooseImpact: (inId, outId) => doing({ k: 'impact', inId, outId }),
    startNextInnings: () => doing({ k: 'next' }),
    declare: () => doing({ k: 'declare' }),
    chooseFollowOn: (enforce) => doing({ k: 'followOn', enforce }),
    // Reads draw nothing from the match and are not recorded.
    suggestBowler: () => inner.suggestBowler(),
    finished: () => inner.finished(),
    availableBowlers: () => inner.availableBowlers(),
    playerById: (id) => inner.playerById(id),
    riskFor: (batterId, level) => inner.riskFor(batterId, level),
    checkpoint: () => ({
      version: CHECKPOINT_VERSION,
      setup: JSON.parse(setupJson) as LiveMatchSetup,
      overrides: [...table],
      log: [...log],
      fingerprint: fingerprintOf(inner.snapshot()),
    }),
  };
  return recorded;
}

export class CheckpointError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CheckpointError';
  }
}

/** Is this, as far as can be told without replaying it, a checkpoint? */
export function isCheckpoint(value: unknown): value is LiveCheckpoint {
  const c = value as LiveCheckpoint | null;
  return Boolean(
    c &&
      typeof c === 'object' &&
      typeof c.version === 'number' &&
      c.setup &&
      typeof c.setup.seed === 'number' &&
      Array.isArray(c.setup.homeXi) &&
      Array.isArray(c.setup.awayXi) &&
      Array.isArray(c.overrides) &&
      Array.isArray(c.log) &&
      c.fingerprint &&
      typeof c.fingerprint.deliveries === 'number',
  );
}

/**
 * Rebuild a match from its checkpoint. Throws `CheckpointError` when the
 * checkpoint is not one, is from another version of the game, or replays to
 * a different score than it recorded.
 */
export function restoreLiveMatch(checkpoint: unknown): RecordedLiveMatch {
  if (!isCheckpoint(checkpoint)) throw new CheckpointError('Not a match checkpoint.');
  if (checkpoint.version !== CHECKPOINT_VERSION) throw new CheckpointError(`Checkpoint version ${checkpoint.version} is not supported.`);
  let match: RecordedLiveMatch;
  try {
    match = recordLiveMatch(checkpoint.setup, { overrides: checkpoint.overrides, log: checkpoint.log });
  } catch (error) {
    throw new CheckpointError(`The match could not be replayed: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!sameFingerprint(fingerprintOf(match.snapshot()), checkpoint.fingerprint)) {
    throw new CheckpointError('The replayed match does not match the saved score.');
  }
  return match;
}

/** "2nd innings, 14.3 overs" - where a resumed match picks up, in the game's language. */
export function describeCheckpoint(snap: LiveSnapshot, lang: Lang = 'en'): string {
  const ordinal = (n: number) => t(lang, `ord.${Math.min(4, Math.max(1, n))}` as Key);
  if (snap.phase === 'TOSS') return t(lang, 'where.toss');
  if (snap.phase === 'INNINGS_BREAK') return t(lang, 'where.break', { n: ordinal(snap.completed.length) });
  if (snap.phase === 'COMPLETE') return t(lang, 'where.complete');
  const cur = snap.current;
  if (!cur) return t(lang, 'where.playing');
  return t(lang, 'where.innings', { n: ordinal(cur.number), overs: cur.overs });
}
