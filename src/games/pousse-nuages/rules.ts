import { clamp01 } from './draw';

/** Règles du jeu partagées entre le composant et la simulation d'équilibrage. */

/** Arrivée d'un nuage depuis la gauche jusqu'au soleil. */
export const ENTER_MS = 1300;
/** Fête finale : grand soleil, rayons qui tournent, pétales. */
export const PARTY_MS = 3200;
/** Poussée d'un souffle à intensité 1 (avant `unit` et difficulté). */
export const PUSH = 0.85;
export const MAX_VX = 14;
export const CLOUD_S = 118;

/**
 * Un souffle long s'essouffle : pleine poussée jusqu'à 700 ms, puis elle
 * décroît jusqu'à 25 % à 1,6 s. Les souffles courts répétés poussent mieux.
 */
export function blowEfficiency(blowMs: number) {
  return Math.max(0.25, 1 - Math.max(0, blowMs - 700) / 900);
}

/**
 * Difficulté globale (0 → 1) → nuages :
 *  - poids : poussée ÷1 (facile) → ÷2 ;
 *  - retour vers le soleil quand on ne souffle plus : 0 → 0,1 px/frame.
 */
export function tuning(difficulty: number) {
  const d = clamp01(difficulty);
  return { pushDiv: 1 + d, pull: d * 0.1 };
}
