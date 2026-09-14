import { run } from '../balance/harness';
import { starsForTime } from '../_shared/stars';
import { UNIT, clamp01, type Simulate } from '../balance/types';
import type { BullesLevel } from './index';
import { BUBBLES, PARK_MS, growPerFrame, targetR as targetRadius, tuning } from './rules';

/**
 * Bulles de savon: the child blows for a long time; at the end of each blow
 * the bubble detaches, successful if it has reached the target size. It
 * cannot pop: the stars depend on the time taken.
 */
export const simulate: Simulate<BullesLevel> = (level, difficulty, child) => {
  const { blow } = tuning(difficulty);
  const targetR = targetRadius(difficulty) * UNIT;
  const grow = growPerFrame(targetR, level.blowMs, blow);
  let r = 0;
  let prevPower = 0;
  let wobble = 0;
  let success = 0;
  let partyDue = -1;

  return run(child, (f, finish) => {
    const jitter = Math.abs(f.power - prevPower) / Math.max(0.5, f.k);
    prevPower = f.power;
    wobble += (clamp01(jitter * 25) - wobble) * Math.min(1, 0.15 * f.k);
    if (partyDue >= 0) {
      if (f.t >= partyDue) {
        finish(partyDue, starsForTime(partyDue, level.parMs));
      }
      return { kind: 'rest' };
    }
    if (f.st.isBlowing && f.power > 0.08) {
      r = Math.min(targetR * 1.25, r + grow * (0.5 + f.power) * (1 - wobble * 0.6) * f.k);
    }
    // La bulle garde sa taille entre deux souffles : plusieurs respirations.
    if (r >= targetR) {
      success += 1;
      r = 0;
      if (success >= BUBBLES) partyDue = f.t + PARK_MS;
    }
    // The target ring is full: the child stops blowing, the bubble detaches.
    return { kind: r >= targetR ? 'rest' : 'long' };
  });
};
