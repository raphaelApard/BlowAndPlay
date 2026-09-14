import { defineGame, type LevelBase } from '../types';
import { Game } from './Game';
import { simulate } from './simulate';
import { Thumbnail } from './Thumbnail';

/**
 * Souffle-Fusée — blowing makes the rocket climb to the Moon.
 * Ported from the "Souffle-Fusée.dc.html" + "Blast Off - Screens" designs.
 * The global difficulty (parents setting) sets the distance (×1 → ×2) and
 * the gravity (0.05 → 0.15); the level sets the base distance.
 */
export interface SouffleFuseeLevel extends LevelBase {
  /** Base altitude (game units) to reach, before multiplication by the difficulty. */
  maxAltitude: number;
  /** Reference time for 3 stars (ms). 2 stars up to 1.6×, otherwise 1. */
  parMs: number;
}

export default defineGame<SouffleFuseeLevel>({
  id: 'souffle-fusee',
  title: { fr: 'Souffle-Fusée', en: 'Breath Rocket' },
  description: {
    fr: 'Souffle long et soutenu : la fusée monte tant que l’enfant souffle et retombe sinon. Difficulté : distance ×1 → ×2, gravité 0,05 → 0,15.',
    en: 'Long, sustained blow: the rocket climbs as long as the child blows and falls back otherwise. Difficulty: distance ×1 → ×2, gravity 0.05 → 0.15.',
  },
  instruction: {
    fr: 'Souffle longtemps pour faire monter la fusée jusqu’à la Lune !',
    en: 'Blow long and steady to fly the rocket up to the Moon!',
  },
  pattern: 'long',
  accent: '#ff6b5e',
  order: 10,
  levels: [
    { id: '1', maxAltitude: 2900, parMs: 20000 },
    { id: '2', maxAltitude: 4350, parMs: 30000 },
    { id: '3', maxAltitude: 5800, parMs: 40000 },
  ],
  Game,
  simulate,
  Thumbnail,
});
