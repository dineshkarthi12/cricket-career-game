/**
 * தமிழ், Live PvP. Typed against `enPvp`, so a key missing here is a compile
 * error. Spread into `../ta.ts`.
 */
import type { enPvp } from '../en/pvp';

export const taPvp: { [K in keyof typeof enPvp]: string } = {
};
