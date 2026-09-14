import { defineGame, type LevelBase } from '../types';
import { Game } from './Game';
import { simulate } from './simulate';
import { Thumbnail } from './Thumbnail';

/**
 * Montgolfière — un souffle pour décoller, puis le ballon avance tout seul
 * près du sol : chaque souffle le fait monter pour passer par-dessus les
 * obstacles (arbres, rochers, maisons, tours). À l'arrivée, il se pose sur
 * la plateforme. Les chocs ne font pas perdre : ils coûtent des étoiles.
 * La difficulté globale ajoute des obstacles, plus hauts et plus serrés.
 */
export interface MontgolfiereLevel extends LevelBase {
  /** Nombre d'obstacles à survoler (avant multiplication par la difficulté). */
  obstacles: number;
}

export default defineGame<MontgolfiereLevel>({
  id: 'montgolfiere',
  title: { fr: 'Montgolfière', en: 'Hot-Air Balloon' },
  description: {
    fr: 'Souffles longs et dosés : un souffle fait décoller le ballon, puis il avance seul et chaque souffle le fait monter pour survoler les obstacles. Difficulté : obstacles ×1 → ×2,5 plus nombreux et ×1,15 → ×1,85 plus hauts. Étoiles : 3 sans choc, 2 jusqu’à deux chocs, sinon 1.',
    en: 'Long, measured blows: one blow lifts the balloon off, then it drifts on its own and each blow makes it climb over the obstacles. Difficulty: obstacles ×1 → ×2.5 more numerous and ×1.15 → ×1.85 taller. Stars: 3 with no bump, 2 up to two bumps, otherwise 1.',
  },
  instruction: {
    fr: 'Souffle pour faire monter le ballon et passer au-dessus des obstacles !',
    en: 'Blow to lift the balloon over the obstacles!',
  },
  pattern: 'long',
  accent: '#ffd93d',
  order: 50,
  levels: [
    { id: '1', obstacles: 7 },
    { id: '2', obstacles: 12 },
    { id: '3', obstacles: 17 },
  ],
  Game,
  simulate,
  Thumbnail,
});
