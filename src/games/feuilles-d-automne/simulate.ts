import { run } from '../balance/harness';
import { starsForTime } from '../_shared/stars';
import { UNIT, VIEW, type Simulate } from '../balance/types';
import { buildRoute, layoutPath } from './draw';
import type { FeuillesLevel } from './index';
import { BLOW_RATE, END_BEFORE, STOP_BEFORE, WALK_SPEED, leavesPerPile } from './rules';

/** Feuilles d'automne : souffle libre (longs souffles) devant chaque tas. */
export const simulate: Simulate<FeuillesLevel> = (level, difficulty, child) => {
  const unit = UNIT;
  const n = level.piles;
  const perPile = leavesPerPile(level.leaves, difficulty);
  const anchors = layoutPath(n, 40 + n).map((p) => ({ x: p.x * VIEW.width, y: p.y * VIEW.height }));
  const route = buildRoute(anchors);
  const walkSpeed = WALK_SPEED * unit;
  const left = Array.from({ length: n }, () => perPile);
  const removal = Array.from({ length: n }, () => 0);
  let dist = 0;
  let target = 1;
  let elapsed = 0;

  return run(child, (f, finish) => {
    elapsed += f.dt;
    if (target <= n) {
      const i = target - 1;
      const stopAt = route.anchorDist[target] - STOP_BEFORE * unit;
      if (left[i] > 0) {
        if (dist < stopAt) {
          dist = Math.min(stopAt, dist + walkSpeed * f.k);
          return { kind: 'rest' };
        }
        removal[i] += f.power * BLOW_RATE * f.k;
        while (removal[i] >= 1 && left[i] > 0) {
          removal[i] -= 1;
          left[i] -= 1;
        }
        if (left[i] === 0) target += 1;
        return { kind: 'long' };
      }
      target += 1;
      return { kind: 'rest' };
    }
    const endAt = route.total - END_BEFORE * unit;
    if (dist < endAt) dist = Math.min(endAt, dist + walkSpeed * f.k);
    else {
      finish(elapsed, starsForTime(elapsed, level.parMs));
    }
    return { kind: 'rest' };
  });
};
