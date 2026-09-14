import { defineGame, type LevelBase } from '../types';
import { Game } from './Game';
import { simulate } from './simulate';
import { Thumbnail } from './Thumbnail';

/**
 * Bulles de savon — un souffle long et régulier gonfle une bulle. Elle
 * n'éclate jamais et garde sa taille entre deux souffles : l'enfant peut
 * reprendre sa respiration autant de fois qu'il veut. Arrivée à la taille
 * cible, elle se détache et va se ranger en haut de l'écran : il en faut
 * toujours trois. La difficulté globale allonge le souffle nécessaire et
 * grossit la bulle à atteindre.
 */
export interface BullesLevel extends LevelBase {
  /** Durée de souffle (ms, à intensité moyenne) pour atteindre la taille cible. */
  blowMs: number;
  /** Temps de référence pour 3 étoiles (ms). 2 étoiles jusqu'à 1,6×, sinon 1. */
  parMs: number;
}

export default defineGame<BullesLevel>({
  id: 'bulles-de-savon',
  title: { fr: 'Bulles de savon', en: 'Soap Bubbles' },
  description: {
    fr: 'Souffle long et régulier : la bulle grossit à chaque souffle et garde sa taille entre deux respirations — elle n’éclate jamais. Trois bulles à réussir à chaque niveau. Difficulté : souffle ×1 → ×2 plus long et bulle ×0,6 → ×1 plus grosse. Étoiles selon le temps.',
    en: 'Long, steady blow: the bubble grows with every blow and keeps its size between breaths — it never pops. Three bubbles to make at every level. Difficulty: blow ×1 → ×2 longer and bubble ×0.6 → ×1 bigger. Stars depend on time.',
  },
  instruction: {
    fr: 'Souffle doucement et longtemps pour faire une grosse bulle.',
    en: 'Blow gently and steadily to make a big bubble.',
  },
  pattern: 'long',
  accent: '#9d7bef',
  order: 60,
  // Toujours 3 bulles (voir `BUBBLES`) : c'est la longueur du souffle, et non
  // leur nombre, qui monte d'un niveau au suivant.
  levels: [
    { id: '1', blowMs: 1300, parMs: 11000 },
    { id: '2', blowMs: 2200, parMs: 17000 },
    { id: '3', blowMs: 3500, parMs: 26000 },
  ],
  Game,
  simulate,
  Thumbnail,
});
