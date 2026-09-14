import { defineGame, type LevelBase } from '../types';
import { Game } from './Game';
import { simulate } from './simulate';
import { Thumbnail } from './Thumbnail';

/**
 * Pousse-nuages — le soleil boude derrière les nuages. Chaque souffle court
 * pousse le nuage vers la droite ; il glisse, puis revient doucement si on
 * n'insiste pas. Une fois chassé, le suivant arrive, jusqu'au grand soleil.
 * Les souffles longs s'essoufflent : ce sont les souffles courts et répétés
 * qui poussent le mieux.
 */
export interface PousseNuagesLevel extends LevelBase {
  /** Nombre de nuages à chasser. */
  clouds: number;
  /** Temps de référence pour 3 étoiles (ms). 2 étoiles jusqu'à 1,6×, sinon 1. */
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
