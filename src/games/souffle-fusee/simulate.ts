import { run } from '../balance/harness';
import { starsForTime } from '../_shared/stars';
import type { Simulate } from '../balance/types';
import type { SouffleFuseeLevel } from './index';
import { DRAG, MAX_VEL, MIN_VEL, THRUST, tuning } from './rules';

/** Souffle-Fusée: the child blows for a long time, the rocket climbs and falls back between blows. */
export const simulate: Simulate<SouffleFuseeLevel> = (level, difficulty, child) => {
  const { distance, gravity } = tuning(difficulty);
  const MAX = level.maxAltitude * distance;
  let alt = 0;
  let vel = 0;
  let elapsed = 0;
  return run(child, (f, finish) => {
    elapsed += f.dt;
    vel += (f.power * THRUST - gravity) * f.k;
    vel = Math.max(MIN_VEL, Math.min(MAX_VEL, vel * Math.pow(DRAG, f.k)));
    alt = Math.max(0, alt + vel * f.k);
    if (alt >= MAX) {
      finish(elapsed, starsForTime(elapsed, level.parMs));
    }
    return { kind: 'long' };
  });
};
