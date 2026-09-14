import { defineGame, type LevelBase } from '../types';
import { Game } from './Game';
import { simulate } from './simulate';
import { Thumbnail } from './Thumbnail';

/**
 * Bateau Pirate — blowing into the sail moves the boat from island to island
 * on a treasure map. Each blow pushes the boat, which glides then slows down;
 * one good blow per step is enough, several small ones do the same.
 * The global difficulty reduces the thrust (÷1 → ÷1.8) and brakes harder.
 */
export interface BateauPirateLevel extends LevelBase {
  /** Number of islands to visit (the start is not one of them). */
  islands: number;
  /** Reference time for 3 stars (ms). 2 stars up to 1.6×, otherwise 1. */
  parMs: number;
}

export default defineGame<BateauPirateLevel>({
  id: 'bateau-pirate',
  title: { fr: 'Bateau Pirate', en: 'Pirate Ship' },
  description: {
    fr: 'Souffles courts et répétés : chaque souffle gonfle la voile et pousse le bateau vers l’île suivante, jusqu’au trésor. Difficulté : chaque souffle pousse 1× → 1,8× moins loin et le bateau s’arrête plus vite.',
    en: 'Short, repeated blows: each blow fills the sail and pushes the ship to the next island, all the way to the treasure. Difficulty: each blow pushes 1× → 1.8× less far and the ship stops sooner.',
  },
  instruction: {
    fr: 'Souffle plusieurs fois pour pousser le bateau jusqu’au trésor !',
    en: 'Blow again and again to push the ship to the treasure!',
  },
  pattern: 'bursts',
  accent: '#3f8fd6',
  order: 30,
  levels: [
    { id: '1', islands: 3, parMs: 25000 },
    { id: '2', islands: 4, parMs: 35000 },
    { id: '3', islands: 6, parMs: 45000 },
  ],
  Game,
  simulate,
  Thumbnail,
});
