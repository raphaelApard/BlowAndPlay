import { clamp01 } from '../_shared/math';

/**
 * Règles du jeu partagées entre le composant et la simulation d'équilibrage.
 * Difficulté globale (0 → 1) → paramètres de vol :
 *  - distance à la Lune : ×1 (facile) → ×2 (difficile) ;
 *  - gravité (vitesse perdue par frame sans souffle) : 0,05 → 0,15.
 */
export function tuning(difficulty: number) {
  const d = clamp01(difficulty);
  return { distance: 1 + d, gravity: 0.05 + d * 0.1 };
}

/** Poussée par frame à intensité 1. */
export const THRUST = 0.95;
/** Vitesse verticale : bornes et frottement par frame. */
export const MIN_VEL = -1.6;
export const MAX_VEL = 9;
export const DRAG = 0.985;

// Réexporté : `Game.tsx` importe tout depuis `./rules`.
export { clamp01 };
