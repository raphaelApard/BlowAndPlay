import { clamp01 } from './draw';

/** Game rules shared between the component and the balance simulation. */

/** Celebration once the whole troupe is dancing. */
export const PARTY_MS = 3000;
/** A friend joins the dance (ms). */
export const JOIN_MS = 900;
/** Reference average intensity used to calibrate `inflatePerFrame`. */
export const REF_POWER = 0.7;

/**
 * Height under which the figure has flopped back down: the child has to blow
 * it up again from there. Kept low so a short pause is never punished.
 */
export const FLOP_BELOW = 0.12;

/**
 * Global difficulty (0 → 1) → the figure:
 *  - breath required to stand it up: ×1 (easy) → ×1.7;
 *  - deflation when not blowing: ×1 → ×2.4 of the base rate, so a harder
 *    figure sags much faster and the blow has to be sustained.
 */
export function tuning(difficulty: number) {
  const d = clamp01(difficulty);
  return { blow: 1 + d * 0.7, sag: 1 + d * 1.4 };
}

/**
 * Rise per frame: the figure stands fully up after `blowMs × blow` of breath
 * at `REF_POWER`. Keeping the two in step is what makes the level's `blowMs`
 * mean what it says.
 */
export function inflatePerFrame(blowMs: number, blow: number) {
  return 1 / ((blowMs * blow) / 16.67) / (0.5 + REF_POWER);
}

/** Deflation per frame when the child is not blowing. */
export function deflatePerFrame(blowMs: number, blow: number, sag: number) {
  return inflatePerFrame(blowMs, blow) * 0.34 * sag;
}
