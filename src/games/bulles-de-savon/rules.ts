import { clamp01 } from './draw';

/** Game rules shared between the component and the balance simulation. */

/** Final celebration: the stored bubbles pop one after another. */
export const PARTY_MS = 3200;
/** Path of a successful bubble towards its slot at the top. */
export const PARK_MS = 1600;
/** Target radius at maximum difficulty (before `unit`). */
export const TARGET_R = 78;
/** Reference average intensity for `blowMs` (see `growPerFrame`). */
export const REF_POWER = 0.7;
/** Number of bubbles to complete, the same at every level. */
export const BUBBLES = 3;

/**
 * Global difficulty (0 → 1) → bubbles:
 *  - breath required: ×1 (easy) → ×2;
 *  - taille de la bulle : ×0,6 (facile, petite bulle) → ×1.
 *
 * The bubble never pops: blowing hard breaks nothing, only the time taken
 * decides the stars. The size only changes the look: since growth is
 * proportional to the target, it does not change the effort.
 */
export function tuning(difficulty: number) {
  const d = clamp01(difficulty);
  return { blow: 1 + d, size: 0.6 + d * 0.4 };
}

/** Target radius at this difficulty (before `unit`). */
export function targetR(difficulty: number) {
  return TARGET_R * tuning(difficulty).size;
}

/** Growth per frame: target size reached in `blowMs × blow` at intensity `REF_POWER`. */
export function growPerFrame(targetR: number, blowMs: number, blow: number) {
  return targetR / ((blowMs * blow) / 16.67) / (0.5 + REF_POWER);
}
