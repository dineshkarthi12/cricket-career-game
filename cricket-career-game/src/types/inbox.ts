import type { Id, ISODate } from './primitives';

/** Who sent the message. Drives the avatar shown on the Inbox card. */
export type InboxSender =
  | 'SELECTOR'
  | 'COACH'
  | 'MEDIA'
  | 'FRANCHISE'
  | 'TEAM'
  | 'PHYSIO'
  | 'AGENT'
  | 'FAN'
  | 'SYSTEM';

export type InboxCategory =
  | 'SELECTION'
  | 'TRAINING'
  | 'MATCH'
  | 'INJURY'
  | 'CONTRACT'
  | 'NEWS'
  | 'AWARD'
  | 'MILESTONE';

/** An optional decision attached to a message, e.g. accept a contract. */
export interface InboxAction {
  id: string;
  label: string;
  kind: 'ACCEPT' | 'DECLINE' | 'ACKNOWLEDGE' | 'NAVIGATE';
  /** Route to open for `NAVIGATE` actions. */
  route: string | null;
  taken: boolean;
}

export interface InboxMessage {
  id: Id;
  date: ISODate;
  sender: InboxSender;
  /** Display name of the sender, e.g. "TNCA", "Coach". */
  senderName: string;
  subject: string;
  body: string;
  category: InboxCategory;
  read: boolean;
  /** Important messages are pinned to the top of the inbox. */
  important: boolean;
  actions: InboxAction[];
  /** Related entity, so the UI can deep-link to a match or fixture. */
  relatedId: Id | null;
}
