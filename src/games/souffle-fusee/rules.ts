import { clamp01 } from '../_shared/math';

/**
 * Game rules shared between the component and the balance simulation.
 * Global difficulty (0 → 1) → flight parameters:
 *  - distance to the Moon: ×1 (easy) → ×2 (hard);
 *  - gravity (speed lost per frame without breath): 0.05 → 0.15.
 */
export function tuning(difficulty: number) {
  const d = clamp01(difficulty);
  return { distance: 1 + d, gravity: 0.05 + d * 0.1 };
}

/** Thrust per frame at intensity 1. */
export const THRUST = 0.95;
/** Vitesse verticale : bornes et frottement par frame. */
export const MIN_VEL = -1.6;
export const MAX_VEL = 9;
export const DRAG = 0.985;

// Re-exported: `Game.tsx` imports everything from `./rules`.
export { clamp01 };
