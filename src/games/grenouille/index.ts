import { defineGame, type LevelBase } from '../types';
import { Game } from './Game';
import { simulate } from './simulate';
import { Thumbnail } from './Thumbnail';

/**
 * Grenouille — the strength of the blow arms a jump: a dotted arc shows where
 * the frog would land, and releasing the breath sends it off. It has to land
 * *on* the lily pad, not past it. Missing costs nothing but time: the frog
 * splashes and climbs back on the pad it came from.
 * The global difficulty narrows the landing window and makes the spacing of
 * the pads irregular, so the same blow no longer works twice.
 */
export interface GrenouilleLevel extends LevelBase {
  /** Number of lily pads to reach (the starting one is not one of them). */
  pads: number;
  /** Reference time for 3 stars (ms). 2 stars up to 1.6×, otherwise 1. */
  parMs: number;
}

export default defineGame<GrenouilleLevel>({
  id: 'grenouille',
  title: { fr: 'Grenouille', en: 'Frog' },
  description: {
    fr: 'Souffle dosé : la force du souffle règle la longueur du saut, montrée par un arc de points ; relâcher fait sauter la grenouille, qui doit se poser sur le nénuphar. Difficulté : zone d’arrivée ×1 → ×0,55 et écarts entre nénuphars irréguliers. Étoiles selon le temps.',
    en: 'Measured blow: how hard you blow sets how far the frog jumps, shown by a dotted arc; letting go sends it off, and it must land on the lily pad. Difficulty: landing window ×1 → ×0.55 and irregular gaps between pads. Stars depend on time.',
  },
  instruction: {
    fr: 'Souffle plus ou moins fort pour viser, puis arrête de souffler pour sauter !',
    en: 'Blow harder or softer to aim, then stop blowing to jump!',
  },
  pattern: 'modulated',
  accent: '#7ed957',
  order: 80,
  levels: [
    { id: '1', pads: 6, parMs: 14000 },
    { id: '2', pads: 9, parMs: 21000 },
    { id: '3', pads: 11, parMs: 27000 },
  ],
  Game,
  simulate,
  Thumbnail,
});
