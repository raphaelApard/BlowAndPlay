import { defineGame, type LevelBase } from '../types';
import { Game } from './Game';
import { simulate } from './simulate';
import { Thumbnail } from './Thumbnail';

/**
 * Souffle-Fusée — souffler fait monter la fusée jusqu'à la Lune.
 * Importé du design « Souffle-Fusée.dc.html » + « Blast Off - Screens ».
 * La difficulté globale (réglage parents) fixe la distance (×1 → ×2) et
 * la gravité (0,05 → 0,15) ; le niveau fixe la distance de base.
 */
export interface SouffleFuseeLevel extends LevelBase {
  /** Altitude de base (unités de jeu) à atteindre, avant multiplication par la difficulté. */
  maxAltitude: number;
  /** Temps de référence pour 3 étoiles (ms). 2 étoiles jusqu'à 1,6×, sinon 1. */
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
