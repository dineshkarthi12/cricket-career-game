/**
 * Deterministic random number generator.
 *
 * The whole match engine is pure: given the same seed and the same inputs it
 * replays ball for ball. Nothing in `/src/engine` may call `Math.random`.
 */
export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Uniform float in [min, max). */
  range(min: number, max: number): number;
  /** True with probability `p`. */
  chance(p: number): boolean;
  /** Pick one item. Throws on an empty list, which is always a bug. */
  pick<T>(items: readonly T[]): T;
  /** Pick one item by weight. Weights need not sum to 1. */
  weighted<T>(items: readonly { item: T; weight: number }[]): T;
  /** Roughly normal in [-1, 1], centred on 0 - used for execution error. */
  spread(): number;
  /** The generator's current internal state, so a match can be resumed. */
  state(): number;
}

/**
 * mulberry32: small, fast, and good enough for a game. Deterministic across
 * platforms because it is pure 32-bit integer arithmetic.
 */
export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  if (s === 0) s = 0x9e3779b9;

  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rng: Rng = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    range: (min, max) => min + next() * (max - min),
    chance: (p) => next() < p,
    pick: (items) => {
      if (items.length === 0) throw new Error('rng.pick called with no items');
      return items[Math.floor(next() * items.length)];
    },
    weighted: (items) => {
      if (items.length === 0) throw new Error('rng.weighted called with no items');
      let total = 0;
      for (const entry of items) total += Math.max(0, entry.weight);
      if (total <= 0) return items[0].item;
      let roll = next() * total;
      for (const entry of items) {
        roll -= Math.max(0, entry.weight);
        if (roll <= 0) return entry.item;
      }
      return items[items.length - 1].item;
    },
    // Mean of three uniforms is a decent cheap approximation of a bell curve.
    spread: () => (next() + next() + next()) / 1.5 - 1,
    state: () => s,
  };
  return rng;
}

/** Combine a match seed with a counter so each innings gets its own stream. */
export function deriveSeed(seed: number, salt: number): number {
  return (Math.imul(seed ^ 0x85ebca6b, 0xc2b2ae35) ^ Math.imul(salt + 1, 0x27d4eb2f)) >>> 0;
}
