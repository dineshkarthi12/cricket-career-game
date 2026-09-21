import { SAVE } from '@/engine/config';
import type { SaveSlotId } from '@/types';

export const slotKey = (slot: SaveSlotId): string => `${SAVE.keyPrefix}:slot:${slot}`;
export const metaKey = (slot: SaveSlotId): string => `${SAVE.keyPrefix}:meta:${slot}`;
/** Which slot the player is currently in, so the app can resume on reload. */
export const activeSlotKey = `${SAVE.keyPrefix}:active-slot`;
