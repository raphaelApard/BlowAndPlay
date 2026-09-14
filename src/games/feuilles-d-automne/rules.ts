import { clamp01 } from './draw';

/** Game rules shared between the component and the balance simulation. */

/** The hedgehog goes inside: the door opens, it shrinks into the doorway. */
export const ENTER_MS = 1400;
/** Celebration: lit window, hearts, falling leaves. */
export const PARTY_MS = 3000;
/** Leaves blown away per frame at intensity 1. */
export const BLOW_RATE = 0.28;
/** Stopping distance before the pile (units). */
export const STOP_BEFORE = 82;
/** Walking speed of the hedgehog (px/frame, before `unit`). */
export const WALK_SPEED = 1.7;
/** Stopping distance before the burrow (units). */
export const END_BEFORE = 30;

/** Global difficulty (0 → 1) → leaves per pile ×1 → ×2.2. */
export function tuning(difficulty: number) {
  return { leaves: 1 + clamp01(difficulty) * 1.2 };
}

export function leavesPerPile(baseLeaves: number, difficulty: number) {
  return Math.round(baseLeaves * tuning(difficulty).leaves);
}
