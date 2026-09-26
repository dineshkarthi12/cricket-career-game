/**
 * The empty professional career, before the first scout has heard the name.
 */
import { NATIONS } from '@/data/nations';
import type { IntlFormat, NationProgress, ProState } from '@/types';

const zeroFormats = <T>(value: () => T): Record<IntlFormat, T> => ({ T20I: value(), ODI: value(), TEST: value() });

export function initialNations(): Record<string, NationProgress> {
  return Object.fromEntries(
    NATIONS.map((n) => [n.name, { offset: n.potentialOffset, ratings: zeroFormats(() => Math.round(100 + n.potentialOffset * 4)) }]),
  );
}

export function emptyProState(seasonYear = 2026): ProState {
  return {
    scouting: { reputation: 0, notes: [], interest: {}, trials: [], contacted: [] },
    ipl: {
      status: 'NOT_SCOUTED',
      franchiseId: null,
      contract: null,
      registeredBase: null,
      auctions: [],
      seasons: [],
      purses: {},
      lastMegaSeason: seasonYear - (seasonYear % 3),
      tradeOffer: null,
      marketValue: 0,
      earnings: 0,
    },
    national: {
      watched: false,
      caps: zeroFormats(() => 0),
      debuts: [],
      contract: null,
      contractHistory: [],
      matchFees: 0,
      campInvites: 0,
      rested: [],
      benchedSeries: 0,
      drops: zeroFormats(() => 0),
      camp: null,
      iccEvents: [],
    },
    nations: initialNations(),
    wtc: { startYear: seasonYear % 2 === 1 ? seasonYear : seasonYear - 1, table: {}, finals: [], finalists: null },
    rankings: {
      players: zeroFormats(() => ({})),
      userHistory: [],
      best: zeroFormats(() => ({ batting: null, bowling: null, allRounder: null })),
    },
    awards: [],
    fans: { followers: 40, sentiment: 55, pressure: 0, stories: [] },
    leadership: { posts: [], offer: null, declined: 0, records: {}, cooldown: {} },
    retirement: { retiredFrom: [], retiredOn: {}, complete: false, overlooked: [], nudgedSeason: null },
    records: { entries: {} },
    timeline: [],
    openSeries: {},
  };
}
