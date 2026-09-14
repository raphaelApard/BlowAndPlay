import { clamp01 } from './draw';

/** Règles du jeu partagées entre le composant et la simulation d'équilibrage. */

/** Le hérisson entre chez lui : porte qui s'ouvre, il rétrécit dans l'embrasure. */
export const ENTER_MS = 1400;
/** Fête : fenêtre allumée, cœurs, feuilles qui tombent. */
export const PARTY_MS = 3000;
/** Feuilles envolées par frame à intensité 1. */
export const BLOW_RATE = 0.28;
/** Distance d'arrêt avant le tas (unités). */
export const STOP_BEFORE = 82;
/** Vitesse de marche du hérisson (px/frame, avant `unit`). */
export const WALK_SPEED = 1.7;
/** Distance d'arrêt avant le terrier (unités). */
export const END_BEFORE = 30;

/** Difficulté globale (0 → 1) → feuilles par tas ×1 → ×2,2. */
export function tuning(difficulty: number) {
  return { leaves: 1 + clamp01(difficulty) * 1.2 };
}

export function leavesPerPile(baseLeaves: number, difficulty: number) {
  return Math.round(baseLeaves * tuning(difficulty).leaves);
}
