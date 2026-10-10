/**
 * Translation in React: `useT()` gives `t(key, vars)` in the language set in
 * Settings, and re-renders the screen when it changes. `useLang()` is the
 * language itself.
 */
import { useCallback, useEffect } from 'react';
import { useAppSettings } from '@/store/appSettings';
import { setCurrentLang, t, type Key, type Lang, type Vars } from './core';

export function useLang(): Lang {
  return useAppSettings((s) => s.language);
}

export function useT(): (key: Key, vars?: Vars) => string {
  const lang = useLang();
  return useCallback((key: Key, vars?: Vars) => t(lang, key, vars), [lang]);
}

let tamilFont: Promise<unknown> | null = null;
/** Noto Sans Tamil: bundled (so it works offline) but loaded only for Tamil. */
export function loadTamilFont(): Promise<unknown> {
  tamilFont ??= Promise.all([
    import('@fontsource/noto-sans-tamil/tamil-400.css'),
    import('@fontsource/noto-sans-tamil/tamil-500.css'),
    import('@fontsource/noto-sans-tamil/tamil-600.css'),
    import('@fontsource/noto-sans-tamil/tamil-700.css'),
    import('@fontsource/noto-sans-tamil/tamil-800.css'),
  ]).catch(() => undefined);
  return tamilFont;
}

/**
 * Keep the page in step with the language: `<html lang>` (the CSS switches
 * fonts on it), the language code outside React uses, and the Tamil font.
 */
export function useLanguageEffect(): Lang {
  const lang = useLang();
  setCurrentLang(lang);
  useEffect(() => {
    document.documentElement.lang = lang;
    if (lang === 'ta') void loadTamilFont();
  }, [lang]);
  return lang;
}
