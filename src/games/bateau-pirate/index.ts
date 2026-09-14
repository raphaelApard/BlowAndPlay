import { defineGame, type LevelBase } from '../types';
import { Game } from './Game';
import { simulate } from './simulate';
import { Thumbnail } from './Thumbnail';

/**
 * Bateau Pirate — souffler dans la voile fait avancer le bateau d'île en île
 * sur une carte au trésor. Chaque souffle pousse le bateau, qui glisse puis
 * ralentit ; un bon souffle par étape suffit, plusieurs petits font pareil.
 * La difficulté globale réduit la poussée (÷1 → ÷1,8) et freine davantage.
 */
export interface BateauPirateLevel extends LevelBase {
  /** Nombre d'îles à visiter (le départ n'en fait pas partie). */
  islands: number;
  /** Temps de référence pour 3 étoiles (ms). 2 étoiles jusqu'à 1,6×, sinon 1. */
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
