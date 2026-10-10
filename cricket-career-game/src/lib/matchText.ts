import { currentLang, isKey, t, tr, type Key, type Lang } from '@/i18n/core';
import type { LiveAlert } from '@/engine/match/live';
import type { Match } from '@/types';

/** The engine's result summaries, as patterns, and the key each reads as. */
const SUMMARIES: [RegExp, Key, Key?][] = [
  [/^Won by an innings and (\d+) runs?/, 'res.innings', 'res.innings1'],
  [/^Won by (\d+) wickets?/, 'res.wickets', 'res.wicket'],
  [/^Won by (\d+) runs?/, 'res.runs', 'res.run'],
  [/^Won in a super over/, 'res.superOverWon'],
  [/^Tied after a super over/, 'res.superOverTied'],
  [/^Match tied/, 'res.tied'],
  [/^Match drawn/, 'res.drawn'],
  [/^No result - rain/, 'res.rain'],
];
const SUFFIXES: [string, Key][] = [
  [' - through on first-innings lead', 'res.throughLead'],
  [' - won the super over', 'res.wonSuperOver'],
];

/**
 * A result summary in the app's language. Saves keep the engine's English
 * ("Won by 8 wickets"); the known shapes are read back into the language the
 * app is in, and anything else is shown as it was written.
 */
export function summaryText(summary: string, lang: Lang = currentLang()): string {
  if (lang === 'en') return summary;
  for (const [pattern, key, one] of SUMMARIES) {
    const m = pattern.exec(summary);
    if (!m) continue;
    const n = m[1] !== undefined ? Number(m[1]) : undefined;
    let text = t(lang, n === 1 && one ? one : key, n !== undefined ? { n } : undefined);
    let rest = summary.slice(m[0].length);
    for (const [suffix, suffixKey] of SUFFIXES) {
      if (rest.startsWith(suffix)) {
        text += t(lang, suffixKey);
        rest = rest.slice(suffix.length);
      }
    }
    return text + rest;
  }
  return summary;
}

/**
 * The result as a headline. The engine's summary ("Won by 8 wickets") does
 * not say who won, which reads wrongly next to "You lost".
 */
export function resultHeadline(match: Match, teamNameOf: (id: string) => string): string {
  const result = match.result;
  if (!result) return tr('res.none');
  if (result.type === 'WIN' && result.winningTeamId) {
    const text = summaryText(result.summary);
    const summary = currentLang() === 'en' ? text.charAt(0).toLowerCase() + text.slice(1) : text;
    return tr('res.headline', { team: teamNameOf(result.winningTeamId), summary });
  }
  return summaryText(result.summary);
}

/** A live alert in a language: from its key when it has one, the result read back from English. */
export function alertText(alert: Pick<LiveAlert, 'kind' | 'text' | 'code'>, lang: Lang = currentLang()): string {
  if (lang === 'en') return alert.text;
  if (alert.code && isKey(alert.code.k)) return t(lang, alert.code.k, alert.code.v);
  return alert.kind === 'RESULT' ? summaryText(alert.text, lang) : alert.text;
}
