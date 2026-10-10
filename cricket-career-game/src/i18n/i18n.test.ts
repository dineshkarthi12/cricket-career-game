import { describe, expect, it } from 'vitest';
import { en } from './en';
import { ta } from './ta';
import { browserLang, t, variants, type Key } from './core';

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
    const latinOnly = (Object.keys(ta) as Key[]).filter((k) => !/[஀-௿]/.test(ta[k]) && en[k] !== ta[k]);
    // The few that may stay Latin: language names, abbreviations kept as people say them.
    expect(latinOnly.filter((k) => !['settings.languageEn'].includes(k))).toEqual([]);
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
