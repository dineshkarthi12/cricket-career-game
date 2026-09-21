/** Monotonic counter so ids stay unique inside a single session. */
let counter = 0;

/** Short, readable, collision-safe-enough id: `plr-l8x2k1-7`. */
export function newId(prefix = 'id'): string {
  counter += 1;
  const stamp = Date.now().toString(36);
  return `${prefix}-${stamp}-${counter}`;
}

/** Reset the counter. Test-only. */
export function __resetIdCounter(): void {
  counter = 0;
}
