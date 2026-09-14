import type { Stars } from '../types';

/**
 * Barème d'étoiles au temps, commun aux jeux qui se jouent « à la montre »
 * (fusée, bateau, nuages, feuilles, bulles) : 3 étoiles dans le temps de
 * référence du niveau, 2 jusqu'à 1,6×, sinon 1.
 *
 * Source unique : `Game.tsx` et `simulate.ts` doivent noter à l'identique,
 * sinon le tableau d'équilibrage ne décrit plus le jeu réellement joué.
 */
export const PAR_TWO_STARS = 1.6;

export function starsForTime(elapsedMs: number, parMs: number): Stars {
  const ratio = elapsedMs / parMs;
  return ratio <= 1 ? 3 : ratio <= PAR_TWO_STARS ? 2 : 1;
}
