import { clamp01 } from './draw';

/** Game rules shared between the component and the balance simulation. */

/** Pause at each island (flag planted, the boat rocks). */
export const DOCK_MS = 900;
/** Celebration at the treasure: the chest opens, the coins burst out. */
export const PARTY_MS = 4200;
export const CHEST_OPEN_MS = 900;
/** Thrust of a blow at intensity 1 (before `unit` and difficulty). */
export const PUSH = 0.28;
export const MAX_VEL = 3.8;

/**
 * Global difficulty (0 → 1) → sailing:
 *  - thrust of each blow: ÷1 (easy) → ÷1.8 (hard);
 *  - freinage par frame : 0,975 → 0,955 (le bateau glisse moins loin).
 */
export function tuning(difficulty: number) {
  const d = clamp01(difficulty);
  return { pushDiv: 1 + d * 0.8, friction: 0.975 - d * 0.02 };
}
