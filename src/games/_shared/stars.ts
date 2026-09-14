import type { Stars } from '../types';

/**
 * Time-based star scale, common to the games played "against the clock"
 * (rocket, boat, clouds, leaves, bubbles): 3 stars within the level's
 * reference time, 2 up to 1.6×, otherwise 1.
 *
 * Single source: `Game.tsx` and `simulate.ts` must score identically,
 * otherwise the balance table no longer describes the game actually played.
 */
export const PAR_TWO_STARS = 1.6;

export function starsForTime(elapsedMs: number, parMs: number): Stars {
  const ratio = elapsedMs / parMs;
  return ratio <= 1 ? 3 : ratio <= PAR_TWO_STARS ? 2 : 1;
}
