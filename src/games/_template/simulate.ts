import { run } from '../balance/harness';
import type { Simulate } from '../balance/types';
import type { TemplateLevel } from './index';

/**
 * Headless simulation of the level, played by the "typical child" (see
 * `src/games/balance/`). It must reproduce the equations of `Game.tsx`
 * (mettre les constantes en commun dans un `rules.ts`), et renvoyer un
 * `Intent`: what the game asks of the child at this instant.
 *
 * The `src/games/balance/balance.test.ts` test uses it to check that this
 * game demands the same effort as the others at equal difficulty.
 */
export const simulate: Simulate<TemplateLevel> = (level, difficulty, child) => {
  // Same formula as Game.tsx ("speed" parents setting at its default value).
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
