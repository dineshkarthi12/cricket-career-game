/** Small helpers shared by the professional-career modules. */
import { newId } from '../id';
import type { CareerEvent, CareerStageId, GameState, InboxAction, InboxCategory, InboxMessage, InboxSender } from '@/types';

export const INBOX_LIMIT = 80;

export function message(
  date: string,
  sender: InboxSender,
  senderName: string,
  subject: string,
  body: string,
  category: InboxCategory,
  important = false,
  actions: InboxAction[] = [],
  relatedId: string | null = null,
): InboxMessage {
  return { id: newId('msg'), date, sender, senderName, subject, body, category, read: false, important, actions, relatedId };
}

export function withInbox(state: GameState, messages: InboxMessage | InboxMessage[]): GameState {
  const list = Array.isArray(messages) ? messages : [messages];
  if (list.length === 0) return state;
  return { ...state, inbox: [...list, ...state.inbox].slice(0, INBOX_LIMIT) };
}

export function withEvent(state: GameState, date: string, kind: CareerEvent['kind'], title: string, detail: string, stageId?: CareerStageId): GameState {
  const event: CareerEvent = { id: newId('evt'), date, stageId: stageId ?? state.career.currentStageId, kind, title, detail };
  return { ...state, career: { ...state.career, events: [...state.career.events, event].slice(-160) } };
}

export function navigate(label: string, route: string): InboxAction {
  return { id: `nav-${route}`, label, kind: 'NAVIGATE', route, taken: false };
}

export function decision(id: string, label: string, kind: 'ACCEPT' | 'DECLINE'): InboxAction {
  return { id, label, kind, route: null, taken: false };
}

/** Lakh rupees as the game shows them: "₹75 L", "₹2.4 Cr". */
export function formatLakh(lakh: number): string {
  if (lakh >= 100) return `₹${(lakh / 100).toFixed(lakh % 100 === 0 ? 0 : 2).replace(/\.?0+$/, '')} Cr`;
  return `₹${Math.round(lakh)} L`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function saltOf(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function userName(state: GameState): string {
  return `${state.player.firstName} ${state.player.lastName}`.trim();
}
