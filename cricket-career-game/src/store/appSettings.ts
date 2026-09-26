/**
 * Settings that belong to this device rather than to a career: how fast
 * animations run, the sim speed a match starts at, reduced motion, and which
 * tutorial tips have been seen. Kept in localStorage; a blocked localStorage
 * just means the defaults every visit.
 */
import { create } from 'zustand';

export type AnimationSpeed = 'SLOW' | 'NORMAL' | 'FAST';

/** Multiplier on ball-flight and other animation durations. */
export const ANIMATION_FACTOR: Record<AnimationSpeed, number> = { SLOW: 1.4, NORMAL: 1, FAST: 0.6 };

export interface AppSettings {
  animationSpeed: AnimationSpeed;
  /** Index into BALL_SPEEDS a new match starts at. */
  defaultSimSpeed: number;
  /** Cut animation to the minimum, on top of the system setting. */
  reduceMotion: boolean;
  /** Tutorial tips already dismissed, by id. */
  tipsSeen: string[];
}

const KEY = 'cc.appSettings';

export const DEFAULT_APP_SETTINGS: AppSettings = { animationSpeed: 'NORMAL', defaultSimSpeed: 1, reduceMotion: false, tipsSeen: [] };

function load(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_APP_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      animationSpeed: parsed.animationSpeed === 'SLOW' || parsed.animationSpeed === 'FAST' ? parsed.animationSpeed : 'NORMAL',
      defaultSimSpeed: typeof parsed.defaultSimSpeed === 'number' ? Math.max(0, Math.min(3, Math.round(parsed.defaultSimSpeed))) : 1,
      reduceMotion: parsed.reduceMotion === true,
      tipsSeen: Array.isArray(parsed.tipsSeen) ? parsed.tipsSeen.filter((x): x is string => typeof x === 'string') : [],
    };
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

function save(settings: AppSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Remembered for this visit only.
  }
}

interface AppSettingsStore extends AppSettings {
  set: (patch: Partial<AppSettings>) => void;
  seeTip: (id: string) => void;
  resetTutorial: () => void;
}

export const useAppSettings = create<AppSettingsStore>((set, get) => {
  const commit = (patch: Partial<AppSettings>) => {
    set(patch);
    const { animationSpeed, defaultSimSpeed, reduceMotion, tipsSeen } = get();
    save({ animationSpeed, defaultSimSpeed, reduceMotion, tipsSeen });
  };
  return {
    ...load(),
    set: commit,
    seeTip: (id) => {
      if (!get().tipsSeen.includes(id)) commit({ tipsSeen: [...get().tipsSeen, id] });
    },
    resetTutorial: () => commit({ tipsSeen: [] }),
  };
});

/** The system's reduced-motion preference. */
export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  } catch {
    return false;
  }
}

/** Reduced motion from any source: this device, the career setting, or the system. */
export function useReducedMotion(careerSetting = false): boolean {
  const mine = useAppSettings((s) => s.reduceMotion);
  return mine || careerSetting || prefersReducedMotion();
}
