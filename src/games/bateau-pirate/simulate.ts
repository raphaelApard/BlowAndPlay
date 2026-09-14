import { run } from '../balance/harness';
import { starsForTime } from '../_shared/stars';
import { UNIT, VIEW, type Simulate } from '../balance/types';
import { buildRoute, layoutIslands } from './draw';
import type { BateauPirateLevel } from './index';
import { DOCK_MS, MAX_VEL, PUSH, tuning } from './rules';

/** Bateau Pirate: repeated short blows, the boat glides from island to island. */
export const simulate: Simulate<BateauPirateLevel> = (level, difficulty, child) => {
  const unit = UNIT;
  const n = level.islands;
  const { pushDiv, friction } = tuning(difficulty);
  const anchors = layoutIslands(n, 100 + n * 17).map((p) => ({ x: p.x * VIEW.width, y: p.y * VIEW.height }));
  const moor = buildRoute(anchors).anchorDist;
  const push = (PUSH * unit) / pushDiv;
  const maxVel = MAX_VEL * unit;
  let dist = 0;
  let vel = 0;
  let elapsed = 0;
  let target = 1;
  let dockUntil = -1;

  return run(child, (f, finish) => {
    elapsed += f.dt;
    if (f.t < dockUntil) return { kind: 'rest' };
    vel += f.power * push * f.k;
    vel = Math.min(maxVel, vel * Math.pow(friction, f.k));
    if (vel < 0.02 * unit) vel = 0;
    dist += vel * f.k;
    if (dist >= moor[target]) {
      dist = moor[target];
      vel = 0;
      if (target >= n) {
        finish(elapsed, starsForTime(elapsed, level.parMs));
      } else {
        target += 1;
        dockUntil = f.t + DOCK_MS;
      }
    }
    return { kind: 'bursts' };
  });
};
