import { defineGame, type LevelBase } from '../types';
import { Game } from './Game';
import { simulate } from './simulate';
import { Thumbnail } from './Thumbnail';

/**
 * Feuilles d'automne — un hérisson rentre chez lui par un petit chemin, mais
 * des tas de feuilles le bloquent. Souffler, n'importe comment, envoie les
 * feuilles voler ; tas dégagé, le hérisson repart. Aucune contrainte de
 * pattern : idéal en fin de séance. La difficulté globale grossit les tas.
 */
export interface FeuillesLevel extends LevelBase {
  /** Nombre de tas de feuilles sur le chemin. */
  piles: number;
  /** Feuilles par tas (avant multiplication par la difficulté). */
  leaves: number;
  /** Temps de référence pour 3 étoiles (ms). 2 étoiles jusqu'à 1,6×, sinon 1. */
  parMs: number;
}

export default defineGame<FeuillesLevel>({
  id: 'feuilles-d-automne',
  title: { fr: 'Feuilles d’automne', en: 'Autumn Leaves' },
  description: {
    fr: 'Souffle libre : chaque souffle, court ou long, doux ou fort, envoie voler les feuilles qui bloquent le chemin du hérisson. Difficulté : tas ×1 → ×2,2. Étoiles selon le temps.',
    en: 'Free blowing: every blow, short or long, soft or strong, scatters the leaves blocking the hedgehog’s path. Difficulty: piles ×1 → ×2.2. Stars depend on time.',
  },
  instruction: {
    fr: 'Souffle comme tu veux pour envoyer voler les feuilles !',
    en: 'Blow any way you like to scatter the leaves!',
  },
  pattern: 'free',
  accent: '#ff9a4d',
  order: 20,
  levels: [
    { id: '1', piles: 3, leaves: 14, parMs: 22000 },
    { id: '2', piles: 5, leaves: 15, parMs: 35000 },
    { id: '3', piles: 7, leaves: 16, parMs: 50000 },
  ],
  Game,
  simulate,
  Thumbnail,
});
