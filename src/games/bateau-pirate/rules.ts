import { clamp01 } from './draw';

/** Règles du jeu partagées entre le composant et la simulation d'équilibrage. */

/** Pause à chaque île (drapeau planté, le bateau se balance). */
export const DOCK_MS = 900;
/** Fête au trésor : le coffre s'ouvre, les pièces jaillissent. */
export const PARTY_MS = 4200;
export const CHEST_OPEN_MS = 900;
/** Poussée d'un souffle à intensité 1 (avant `unit` et difficulté). */
export const PUSH = 0.28;
export const MAX_VEL = 3.8;

/**
 * Difficulté globale (0 → 1) → navigation :
 *  - poussée de chaque souffle : ÷1 (facile) → ÷1,8 (difficile) ;
 *  - freinage par frame : 0,975 → 0,955 (le bateau glisse moins loin).
 */
export function tuning(difficulty: number) {
  const d = clamp01(difficulty);
  return { pushDiv: 1 + d * 0.8, friction: 0.975 - d * 0.02 };
}
