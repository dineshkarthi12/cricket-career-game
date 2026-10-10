/**
 * தமிழ், IPL Manager mode. Typed against `enManager`, so a key missing here is a compile
 * error. Spread into `../ta.ts`.
 */
import type { enManager } from '../en/manager';

export const taManager: { [K in keyof typeof enManager]: string } = {
};
