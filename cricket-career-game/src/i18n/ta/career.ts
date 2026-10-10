/**
 * தமிழ், the career screens: selection, trials, tournaments, season review, challenges, rivals, the career card. Typed against `enCareer`, so a key missing here is a compile
 * error. Spread into `../ta.ts`.
 */
import type { enCareer } from '../en/career';

export const taCareer: { [K in keyof typeof enCareer]: string } = {
};
