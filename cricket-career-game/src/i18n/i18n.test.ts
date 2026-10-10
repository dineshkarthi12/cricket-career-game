import { describe, expect, it } from 'vitest';
import { en } from './en';
import { ta } from './ta';
import { browserLang, setCurrentLang, t, variants, type Key } from './core';
import { summaryText } from '@/lib/matchText';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('the dictionaries', () => {
  it('every English key has a Tamil string, with the same placeholders', () => {
    const missing = (Object.keys(en) as Key[]).filter((k) => typeof ta[k] !== 'string' || ta[k].trim() === '');
    expect(missing).toEqual([]);
    const extra = Object.keys(ta).filter((k) => !(k in en));
    expect(extra).toEqual([]);
    const mismatched = (Object.keys(en) as Key[]).filter((k) => placeholders(en[k]).join() !== placeholders(ta[k]).join());
    expect(mismatched).toEqual([]);
  });

  it('Tamil strings are Tamil: every one that is not a name or a code has Tamil script', () => {
    // Words, that is: placeholders and punctuation do not count.
    const words = (text: string) => text.replace(/\{\w+\}/g, '');
    const latinOnly = (Object.keys(ta) as Key[]).filter(
      (k) => /[A-Za-z]/.test(words(ta[k])) && !/[஀-௿]/.test(ta[k]) && en[k] !== ta[k],
    );
    // The few that may stay Latin: language names, abbreviations kept as people say them.
    expect(latinOnly.filter((k) => !['settings.languageEn', 'step.XI', 'q.lbw'].includes(k))).toEqual([]);
  });
});

describe('t()', () => {
  it('fills in variables, and translates a variable that is itself a key', () => {
    expect(t('en', 'top.level', { n: 7 })).toBe('Lv 7');
    expect(t('ta', 'top.level', { n: 7 })).toBe('லெவல் 7');
    expect(t('en', 'clock.auctionLive', { name: '@clock.megaAuction' })).toBe('Mega auction: watch live');
    expect(t('ta', 'clock.auctionLive', { name: '@clock.megaAuction' })).toBe('மெகா ஏலம்: லைவ்வாகப் பார்');
    // A variable not given stays visible rather than vanishing.
    expect(t('en', 'top.level')).toBe('Lv {n}');
  });

  it('counts the numbered variants of a key family', () => {
    expect(variants('date.day')).toBe(7);
    expect(variants('date.month')).toBe(12);
    expect(variants('no.such')).toBe(0);
  });

  it('a first visit follows the browser language', () => {
    expect(browserLang(['ta-IN', 'en-GB'])).toBe('ta');
    expect(browserLang(['en-IN', 'ta'])).toBe('en');
    expect(browserLang(['fr-FR'])).toBe('en');
    expect(browserLang(undefined)).toBe('en');
  });
});

describe('results saved in English', () => {
  it('read in the language the app is in, and unchanged in English', () => {
    setCurrentLang('ta');
    try {
      expect(summaryText('Won by 8 wickets')).toBe('8 விக்கெட் வித்தியாசத்தில் வெற்றி');
      expect(summaryText('Won by 1 run - won the super over')).toBe('1 ரன் வித்தியாசத்தில் வெற்றி - சூப்பர் ஓவரில் வென்றது');
      expect(summaryText('Match drawn')).toBe('மேட்ச் டிரா');
      // Anything the patterns do not know is shown as written.
      expect(summaryText('Abandoned')).toBe('Abandoned');
    } finally {
      setCurrentLang('en');
    }
    expect(summaryText('Won by 8 wickets')).toBe('Won by 8 wickets');
  });
});
