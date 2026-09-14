import { clamp01 } from './draw';

/** Règles du jeu partagées entre le composant et la simulation d'équilibrage. */

/** Fête finale : les bulles rangées éclatent l'une après l'autre. */
export const PARTY_MS = 3200;
/** Trajet d'une bulle réussie vers son rangement en haut. */
export const PARK_MS = 1600;
/** Rayon cible à la difficulté maximale (avant `unit`). */
export const TARGET_R = 78;
/** Intensité moyenne de référence pour `blowMs` (voir `growPerFrame`). */
export const REF_POWER = 0.7;
/** Nombre de bulles à réussir, identique à tous les niveaux. */
export const BUBBLES = 3;

/**
 * Difficulté globale (0 → 1) → bulles :
 *  - souffle nécessaire : ×1 (facile) → ×2 ;
 *  - taille de la bulle : ×0,6 (facile, petite bulle) → ×1.
 *
 * La bulle n'éclate jamais : souffler fort ne casse rien, seul le temps
 * passé départage les étoiles. La taille ne change que l'aspect : la
 * croissance étant proportionnelle à la cible, elle ne modifie pas l'effort.
 */
export function tuning(difficulty: number) {
  const d = clamp01(difficulty);
  return { blow: 1 + d, size: 0.6 + d * 0.4 };
}

/** Rayon cible à cette difficulté (avant `unit`). */
export function targetR(difficulty: number) {
  return TARGET_R * tuning(difficulty).size;
}

/** Croissance par frame : taille cible atteinte en `blowMs × blow` à intensité `REF_POWER`. */
export function growPerFrame(targetR: number, blowMs: number, blow: number) {
  return targetR / ((blowMs * blow) / 16.67) / (0.5 + REF_POWER);
}
