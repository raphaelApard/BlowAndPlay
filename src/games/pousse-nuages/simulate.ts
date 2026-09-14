import { run } from '../balance/harness';
import { starsForTime } from '../_shared/stars';
import { UNIT, VIEW, clamp01, type Simulate } from '../balance/types';
import type { PousseNuagesLevel } from './index';
import { CLOUD_S, ENTER_MS, MAX_VX, PUSH, blowEfficiency, tuning } from './rules';

/** Pousse-nuages: repeated short blows as soon as the cloud is in place. */
export const simulate: Simulate<PousseNuagesLevel> = (level, difficulty, child) => {
  const unit = UNIT;
  const { pushDiv, pull } = tuning(difficulty);
  const n = level.clouds;
  const sunX = VIEW.width * 0.5;
  const cloudHalf = CLOUD_S * unit * 0.95;
  const enterFrom = -cloudHalf - 20;
  const push = (PUSH * unit) / pushDiv;
  const maxVx = MAX_VX * unit;
  let index = 0;
  let x = 0;
  let vx = 0;
  let enteredAt = -1;
  let elapsed = 0;

  return run(child, (f, finish) => {
    elapsed += f.dt;
    if (enteredAt < 0) {
      enteredAt = f.t;
      x = enterFrom;
      vx = 0;
    }
    const enter = clamp01((f.t - enteredAt) / ENTER_MS);
    if (enter < 1) {
      x = enterFrom + (sunX - enterFrom) * (1 - Math.pow(1 - enter, 3));
      return { kind: 'rest' };
    }
    if (f.st.isBlowing) vx += f.power * blowEfficiency(f.st.blowDurationMs) * push * f.k;
    else if (x > sunX && vx < 0.5 * unit) vx -= pull * unit * f.k;
    vx = Math.max(-2 * unit, Math.min(maxVx, vx * Math.pow(0.96, f.k)));
    x += vx * f.k;
    if (x < sunX) {
      x = sunX;
      vx = Math.max(0, vx);
    }
    if (x - cloudHalf > VIEW.width + 10) {
      index += 1;
      enteredAt = -1;
      if (index >= n) {
        finish(elapsed, starsForTime(elapsed, level.parMs));
      }
    }
    return { kind: 'bursts' };
  });
};
