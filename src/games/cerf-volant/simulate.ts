import { run } from '../balance/harness';
import { clamp01, type Simulate } from '../balance/types';
import type { CerfVolantLevel } from './index';
import { FOLLOW, HOLD_DECAY, SWITCH_MS, makeCourse, tuning } from './rules';

/** Cerf-volant: the child aims for the middle of the band with a measured blow. */
export const simulate: Simulate<CerfVolantLevel> = (level, difficulty, child) => {
  const { hold: holdFactor } = tuning(difficulty);
  const holdNeeded = level.holdMs * holdFactor;
  const { half, targets } = makeCourse(level, difficulty);
  const n = targets.length;
  let alt = 0;
  let stage = 0;
  let hold = 0;
  let switchAt = -1e9;
  let elapsed = 0;

  return run(child, (f, finish) => {
    elapsed += f.dt;
    alt += (clamp01(f.power) - alt) * Math.min(1, FOLLOW * f.k);
    const switching = f.t - switchAt < SWITCH_MS;
    const a = targets[stage];
    if (!switching && Math.abs(alt - a) <= half) hold = Math.min(holdNeeded, hold + f.dt);
    else if (!switching) hold = Math.max(0, hold - f.dt * HOLD_DECAY);
    if (hold >= holdNeeded) {
      stage += 1;
      hold = 0;
      switchAt = f.t;
      if (stage >= n) {
        const efficiency = (n * holdNeeded) / Math.max(1, elapsed);
        finish(elapsed, efficiency >= 0.55 ? 3 : efficiency >= 0.35 ? 2 : 1);
        return { kind: 'rest' };
      }
    }
    return { kind: 'hold', level: targets[stage] };
  });
};
