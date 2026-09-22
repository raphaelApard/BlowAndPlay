import { defineGame, type LevelBase } from '../types';
import { Game } from './Game';
import { simulate } from './simulate';
import { Thumbnail } from './Thumbnail';

/**
 * Oiseau voyageur — the bird hops from one pole to the next, carried by a
 * long, even blow. Too soft and it sinks into the lake, too hard and it is
 * lost in the sky: the child has to hold one steady breath all the way
 * across. Nothing is ever lost for good — a bird that falls climbs back onto
 * the pole it left and tries the same crossing again.
 */
export interface OiseauLevel extends LevelBase {
  /** Poles to reach after the starting one. */
  poles: number;
  /**
   * Height of the visual guide band (0..1 of the sky), centred on cruising
   * altitude. It is only a lighter guide line for the child to aim for — the
   * bird is actually lost only at the water or near the top of the sky
   * (`LOWER_BOUND`/`UPPER_BOUND` in `rules.ts`), whatever the level.
   */
  corridor: number;
  /** Reference time for 3 stars (ms). 2 stars up to 1.6×, otherwise 1. */
  parMs: number;
}

export default defineGame<OiseauLevel>({
  id: 'oiseau-voyageur',
  title: { fr: 'Oiseau voyageur', en: 'Travelling Bird' },
  description: {
    fr: 'Souffle long et régulier : l’oiseau vole d’un poteau à l’autre porté par le souffle. Trop léger, il descend vers l’eau ; trop fort, il monte se perdre dans le ciel — il faut tenir la même force jusqu’au bout. Difficulté : poteaux ×1 → ×2,05 plus éloignés, donc un souffle à tenir plus longtemps ; le couloir, lui, garde la même hauteur. Étoiles selon le temps.',
    en: 'Long, even blow: the bird flies from pole to pole carried by the breath. Too soft and it sinks towards the water, too hard and it climbs away into the sky — the same strength has to be held all the way. Difficulty: poles ×1 → ×2.05 further apart, so a blow to hold for longer; the corridor keeps the same height. Stars depend on time.',
  },
  instruction: {
    fr: 'Souffle doucement et sans t’arrêter pour poser l’oiseau sur le poteau !',
    en: 'Blow gently without stopping to land the bird on the pole!',
  },
  pattern: 'long',
  accent: '#ff9a4d',
  order: 90,
  levels: [
    { id: '1', poles: 2, corridor: 0.68, parMs: 11000 },
    { id: '2', poles: 3, corridor: 0.58, parMs: 17000 },
    { id: '3', poles: 4, corridor: 0.50, parMs: 22000 },
  ],
  Game,
  simulate,
  Thumbnail,
});
