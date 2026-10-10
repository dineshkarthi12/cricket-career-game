/**
 * What the career clock has to say after a Continue: a one-line note for the
 * day, and the selection news the week brought (shown step by step). Shared
 * by the Continue bar and the Home screen's Next action card, which both move
 * the clock on.
 */
import { create } from 'zustand';
import type { InboxMessage } from '@/types';

export interface ClockNote {
  text: string;
  /** The in-game day it was written about. */
  date: string;
  /** The match day it is about, if any. */
  fixtureId: string | null;
}

interface ClockStore {
  note: ClockNote | null;
  news: InboxMessage[] | null;
  setNote: (note: ClockNote | null) => void;
  setNews: (news: InboxMessage[] | null) => void;
}

export const useClockStore = create<ClockStore>((set) => ({
  note: null,
  news: null,
  setNote: (note) => set({ note }),
  setNews: (news) => set({ news }),
}));
