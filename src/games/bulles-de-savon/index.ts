import { defineGame, type LevelBase } from '../types';
import { Game } from './Game';
import { simulate } from './simulate';
import { Thumbnail } from './Thumbnail';

/**
 * Bulles de savon — one long, steady blow inflates a bubble. It never pops
 * and keeps its size between blows: the child can catch their breath as many
 * times as they like. Once at the target size, it detaches and goes to line
 * up at the top of the screen: three are always needed. The global difficulty
 * lengthens the breath required and enlarges the bubble to reach.
 */
export interface BullesLevel extends LevelBase {
  /** Breath duration (ms, at average intensity) to reach the target size. */
  blowMs: number;
  /** Reference time for 3 stars (ms). 2 stars up to 1.6×, otherwise 1. */
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
