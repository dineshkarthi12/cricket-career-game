/**
 * Settings that belong to this device rather than to a career: how fast
 * animations run, the sim speed a match starts at, reduced motion, and which
 * tutorial tips have been seen. Kept in localStorage; a blocked localStorage
 * just means the defaults every visit.
 */
import { create } from 'zustand';

export type AnimationSpeed = 'SLOW' | 'NORMAL' | 'FAST';
export type CommentaryStyle = 'FULL' | 'HIGHLIGHTS';

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
  /** Match sound: bat, stumps, crowd. */
  soundEffects: boolean;
  /** Spoken commentary (the browser's text-to-speech). */
  commentaryVoice: boolean;
  /** Every ball like a broadcast, or only the big moments. */
  commentaryStyle: CommentaryStyle;
  /** A quiet crowd murmur under a match. */
  crowdAmbience: boolean;
  /** A soft tick on buttons. */
  buttonClicks: boolean;
  /** 0-1. */
  volume: number;
}

const KEY = 'cc.appSettings';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  animationSpeed: 'NORMAL',
  defaultSimSpeed: 1,
  reduceMotion: false,
  tipsSeen: [],
  soundEffects: true,
  commentaryVoice: true,
  commentaryStyle: 'FULL',
  crowdAmbience: true,
  buttonClicks: false,
  volume: 0.8,
};

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
      soundEffects: parsed.soundEffects !== false,
      commentaryVoice: parsed.commentaryVoice !== false,
      commentaryStyle: parsed.commentaryStyle === 'HIGHLIGHTS' ? 'HIGHLIGHTS' : 'FULL',
      crowdAmbience: parsed.crowdAmbience !== false,
      buttonClicks: parsed.buttonClicks === true,
      volume: typeof parsed.volume === 'number' ? Math.max(0, Math.min(1, parsed.volume)) : 0.8,
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
    const { animationSpeed, defaultSimSpeed, reduceMotion, tipsSeen, soundEffects, commentaryVoice, commentaryStyle, crowdAmbience, buttonClicks, volume } = get();
    save({ animationSpeed, defaultSimSpeed, reduceMotion, tipsSeen, soundEffects, commentaryVoice, commentaryStyle, crowdAmbience, buttonClicks, volume });
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
