import type { LevelBase, Stars } from '../types';
import type { Child } from './child';
import { gameUnit } from '../_shared/math';

/** Résultat d'une partie simulée par « l'enfant type ». */
export interface Outcome {
  /** Faux si le niveau n'a pas été terminé dans le temps imparti. */
  finished: boolean;
  /** Durée de la partie (ms), hors fête finale. */
  elapsedMs: number;
  /** Temps total passé à souffler (ms) : l'effort réel de l'enfant. */
  blowMs: number;
  /** Nombre de souffles. */
  blows: number;
  stars: Stars;
}

/**
 * Simulation sans écran d'un niveau : mêmes équations que le jeu (les
 * constantes viennent du `rules.ts` du jeu), souffle fourni par `child`.
 * `difficulty` : 0 (facile) → 1 (difficile), comme `GameProps.difficulty`.
 */
export type Simulate<L extends LevelBase = LevelBase> = (level: L, difficulty: number, child: Child) => Outcome;

/** Écran de référence des simulations (tablette paysage). */
export const VIEW = { width: 1180, height: 820 } as const;
/** Même formule que les jeux : facteur d'échelle du décor. */
export const UNIT = gameUnit(VIEW.width, VIEW.height);
/** Pas de simulation : une image à 60 Hz. */
export const FRAME_MS = 1000 / 60;
/** Au-delà, on considère que l'enfant n'y arrive pas. */
export const MAX_MS = 240_000;
/** Lissage de l'intensité utilisé par tous les jeux (`power += (raw - power) * 0.25`). */
export const SMOOTH = 0.25;

export function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
