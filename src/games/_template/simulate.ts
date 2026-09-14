import { run } from '../balance/harness';
import type { Simulate } from '../balance/types';
import type { TemplateLevel } from './index';

/**
 * Simulation sans écran du niveau, jouée par « l'enfant type » (voir
 * `src/games/balance/`). Elle doit reproduire les équations de `Game.tsx`
 * (mettre les constantes en commun dans un `rules.ts`), et renvoyer un
 * `Intent` : ce que le jeu demande à l'enfant à cet instant.
 *
 * Le test `src/games/balance/balance.test.ts` s'en sert pour vérifier que
 * ce jeu demande le même effort que les autres à difficulté égale.
 */
export const simulate: Simulate<TemplateLevel> = (level, difficulty, child) => {
  // Même formule que Game.tsx (réglage parents « vitesse » à sa valeur par défaut).
  const targetMs = level.targetMs * (0.7 + difficulty * 0.8);
  let accumulated = 0;
  let elapsed = 0;
  return run(child, (f, finish) => {
    elapsed += f.dt;
    if (f.st.isBlowing) accumulated += f.dt * f.st.intensity;
    if (accumulated >= targetMs) finish(elapsed, 3);
    return { kind: 'long' };
  });
};
