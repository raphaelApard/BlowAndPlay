import { defineGame, type LevelBase } from '../types';
import { Game } from './Game';
import { simulate } from './simulate';
import { Thumbnail } from './Thumbnail';

/**
 * Pousse-nuages — the sun sulks behind the clouds. Each short blow
 * pousse le nuage vers la droite ; il glisse, puis revient doucement si on
 * does not persist. Once chased away, the next one arrives, up to the big
 * sun. Long blows run out of steam: it is the short, repeated blows
 * qui poussent le mieux.
 */
export interface PousseNuagesLevel extends LevelBase {
  /** Number of clouds to chase away. */
  clouds: number;
  /** Reference time for 3 stars (ms). 2 stars up to 1.6×, otherwise 1. */
  parMs: number;
}

export default defineGame<PousseNuagesLevel>({
  id: 'pousse-nuages',
  title: { fr: 'Pousse-nuages', en: 'Cloud Pusher' },
  description: {
    fr: 'Souffles courts et répétés : chaque souffle pousse le nuage qui cache le soleil ; un souffle trop long s’essouffle. Difficulté : nuages ×1 → ×2 plus lourds et qui reviennent vers le soleil.',
    en: 'Short, repeated blows: each blow pushes the cloud hiding the sun; a blow that is too long runs out of steam. Difficulty: clouds ×1 → ×2 heavier and drifting back toward the sun.',
  },
  instruction: {
    fr: 'Souffle par petits coups pour chasser les nuages !',
    en: 'Blow in short puffs to chase the clouds away!',
  },
  pattern: 'bursts',
  accent: '#5ec2f0',
  order: 40,
  levels: [
    { id: '1', clouds: 3, parMs: 20000 },
    { id: '2', clouds: 5, parMs: 32000 },
    { id: '3', clouds: 8, parMs: 50000 },
  ],
  Game,
  simulate,
  Thumbnail,
});
