import { useSyncExternalStore } from 'react';

/**
 * Track a CSS media query. Falls back to `fallback` where `matchMedia` does not
 * exist (tests, very old browsers), so callers always get a boolean.
 */
export function useMediaQuery(query: string, fallback = true): boolean {
  return useSyncExternalStore(
    (notify) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const list = window.matchMedia(query);
      list.addEventListener('change', notify);
      return () => list.removeEventListener('change', notify);
    },
    () =>
      typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia(query).matches
        : fallback,
    () => fallback,
  );
}
