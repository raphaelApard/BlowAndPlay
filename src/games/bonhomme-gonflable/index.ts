import { defineGame, type LevelBase } from '../types';
import { Game } from './Game';
import { simulate } from './simulate';
import { Thumbnail } from './Thumbnail';

/**
 * Bonhomme gonflable — a flat air dancer unfolds and waves as long as the
 * child blows, and sags back down as soon as they stop. Keeping it fully up
 * for a moment brings a friend into the dance, until the whole troupe is
 * standing. Nothing is ever lost: a sagging figure is blown back up.
 */
export interface BonhommeLevel extends LevelBase {
  /** Breath duration (ms, at average intensity) to stand a figure fully up. */
  blowMs: number;
  /** How long it has to be held up for a friend to join (ms). */
  holdMs: number;
  /** Figures to get dancing. */
  figures: number;
  /** Reference time for 3 stars (ms). 2 stars up to 1.6×, otherwise 1. */
  parMs: number;
}

export default defineGame<BonhommeLevel>({
  id: 'bonhomme-gonflable',
  title: { fr: 'Bonhomme gonflable', en: 'Air Dancer' },
  description: {
    fr: 'Souffle long et soutenu : le bonhomme se déplie et danse tant que l’enfant souffle, et retombe dès qu’il s’arrête. Le tenir debout un moment fait venir un copain. Difficulté : souffle ×1 → ×1,7 plus long et dégonflage ×1 → ×2,4 plus rapide. Étoiles selon le temps.',
    en: 'Long, sustained blow: the air dancer unfolds and waves as long as the child blows, and flops back as soon as they stop. Holding it up brings a friend along. Difficulty: blow ×1 → ×1.7 longer and it sags ×1 → ×2.4 faster. Stars depend on time.',
  },
  instruction: {
    fr: 'Souffle longtemps pour faire danser le bonhomme !',
    en: 'Blow long and steady to make the air dancer dance!',
  },
  pattern: 'long',
  accent: '#6bcb77',
  order: 110,
  levels: [
    { id: '1', blowMs: 1500, holdMs: 600, figures: 3, parMs: 12000 },
    { id: '2', blowMs: 1700, holdMs: 700, figures: 4, parMs: 18000 },
    { id: '3', blowMs: 1900, holdMs: 800, figures: 5, parMs: 25000 },
  ],
  Game,
  simulate,
  Thumbnail,
});
