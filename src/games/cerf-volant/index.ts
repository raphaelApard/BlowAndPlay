import { defineGame, type LevelBase } from '../types';
import { Game } from './Game';
import { simulate } from './simulate';
import { Thumbnail } from './Thumbnail';

/**
 * Cerf-volant — l'altitude du cerf-volant suit la force du souffle : doux,
 * il vole bas ; fort, il monte. Une bande de vent arc-en-ciel montre la zone
 * to hold; when the kite stays in it long enough, the band changes altitude.
 * The global difficulty narrows the band and lengthens the hold.
 */
export interface CerfVolantLevel extends LevelBase {
  /** Height of the target zone (0..1 of the intensity). Smaller = harder. */
  targetWidth: number;
  /** Cumulative time to hold inside the zone, per target (ms). */
  holdMs: number;
  /** Number of targets (altitudes) to complete. */
  targets: number;
}

export default defineGame<CerfVolantLevel>({
  id: 'cerf-volant',
  title: { fr: 'Cerf-volant', en: 'Kite' },
  description: {
    fr: 'Contrôle de l’intensité : souffler doux ou fort pour garder le cerf-volant dans la bande de vent, qui change d’altitude à chaque réussite. Difficulté : bande ×1 → ×0,6 et tenue ×1 → ×1,5. Étoiles selon le temps passé dans la zone.',
    en: 'Intensity control: blow softly or hard to keep the kite inside the wind band, which changes altitude after each success. Difficulty: band ×1 → ×0.6 and hold ×1 → ×1.5. Stars depend on time spent in the band.',
  },
  instruction: {
    fr: 'Souffle doucement ou fort pour garder le cerf-volant dans le vent.',
    en: 'Blow softly or hard to keep the kite in the wind band.',
  },
  pattern: 'modulated',
  accent: '#ff6b6b',
  order: 70,
  levels: [
    { id: '1', targetWidth: 0.5, holdMs: 1200, targets: 3 },
    { id: '2', targetWidth: 0.36, holdMs: 1500, targets: 4 },
    { id: '3', targetWidth: 0.28, holdMs: 1800, targets: 5 },
  ],
  Game,
  simulate,
  Thumbnail,
});
