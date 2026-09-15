import { clamp01 } from './draw';

/** Game rules shared between the component and the balance simulation. */

/** Arrival of a cloud from the left up to the sun. */
export const ENTER_MS = 1300;
/** Final celebration: big sun, turning rays. */
export const PARTY_MS = 3200;
/** Thrust of a blow at intensity 1 (before `unit` and difficulty). */
export const PUSH = 0.85;
export const MAX_VX = 14;
export const CLOUD_S = 118;

/**
 * A long blow runs out of steam: full thrust up to 700 ms, then it decreases
 * to 25 % at 1.6 s. Repeated short blows push better.
 */
export function blowEfficiency(blowMs: number) {
  return Math.max(0.25, 1 - Math.max(0, blowMs - 700) / 900);
}

/**
 * Global difficulty (0 → 1) → clouds:
 *  - weight: thrust ÷1 (easy) → ÷2;
 *  - retour vers le soleil quand on ne souffle plus : 0 → 0,1 px/frame.
 */
export function tuning(difficulty: number) {
  const d = clamp01(difficulty);
  return { pushDiv: 1 + d, pull: d * 0.1 };
}
