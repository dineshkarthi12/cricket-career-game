/**
 * The translation layer: typed dictionaries (`en.ts`, `ta.ts`), `{name}`
 * interpolation, and `t(lang, key, vars)` - plain TypeScript, so the engine
 * can use it too. React screens use `useT()` (`./react.ts`).
 *
 * Why not react-i18next: two languages, all strings bundled, no plurals
 * library or namespaces needed - a typed object and a 20-line `t` do it, and
 * the compiler checks that every English key has a Tamil one (`ta.ts` is
 * typed as `Dict`).
 *
 * A variable whose value starts with `@` is itself a key, translated in the
 * same language: `{ shot: '@shot.DRIVE' }`.
 */
import { en } from './en';
import { ta } from './ta';

export type Lang = 'en' | 'ta';
export type Key = keyof typeof en;
/** Every key of the English dictionary, as a string: what `ta.ts` must provide. */
export type Dict = { [K in Key]: string };
export type Vars = Record<string, string | number>;

export const LANGS: Lang[] = ['en', 'ta'];
const DICTS: Record<Lang, Dict> = { en, ta };

export function isKey(key: string): key is Key {
  return key in en;
}

/** One string in a language, with `{name}` filled in. Falls back to English, then to the key. */
export function t(lang: Lang, key: Key, vars?: Vars): string {
  const text = DICTS[lang]?.[key] ?? en[key] ?? key;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = vars[name];
    if (value === undefined) return whole;
    if (typeof value === 'string' && value.startsWith('@') && isKey(value.slice(1))) return t(lang, value.slice(1) as Key, vars);
    return String(value);
  });
}

/** How many numbered variants a key family has (`c.six.0`, `c.six.1`, ...). */
export function variants(prefix: string): number {
  let n = 0;
  while (isKey(`${prefix}.${n}`)) n += 1;
  return n;
}

/** The language a browser asks for: Tamil when it lists Tamil first among ours. */
export function browserLang(languages: readonly string[] | undefined): Lang {
  for (const l of languages ?? []) {
    const code = l.toLowerCase();
    if (code.startsWith('ta')) return 'ta';
    if (code.startsWith('en')) return 'en';
  }
  return 'en';
}

let current: Lang = 'en';
/** The language the app is in now, for code outside React (formatting, toasts). */
export function currentLang(): Lang {
  return current;
}
export function setCurrentLang(lang: Lang): void {
  current = lang;
}
/** `t` in the current language. */
export function tr(key: Key, vars?: Vars): string {
  return t(current, key, vars);
}
