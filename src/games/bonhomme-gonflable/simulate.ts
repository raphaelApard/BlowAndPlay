import { run } from '../balance/harness';
import { starsForTime } from '../_shared/stars';
import { type Simulate } from '../balance/types';
import type { BonhommeLevel } from './index';
import { JOIN_MS, PARTY_MS, deflatePerFrame, inflatePerFrame, tuning } from './rules';

/**
 * Bonhomme gonflable: one sustained blow unfolds the figure; it sags as soon
 * as the breath stops. Holding it fully up for `holdMs` brings a friend into
 * the dance, until the whole troupe is standing.
 */
export const simulate: Simulate<BonhommeLevel> = (level, difficulty, child) => {
  const { blow, sag } = tuning(difficulty);
  const rise = inflatePerFrame(level.blowMs, blow);
  const fall = deflatePerFrame(level.blowMs, blow, sag);
  let standing = 0;
  /** How far the current figure has unfolded, 0..1. */
  let h = 0;
  /** Time spent fully up, towards `holdMs`. */
  let hold = 0;
  let joinUntil = -1;
  let elapsed = 0;
  let partyDue = -1;

  return run(child, (f, finish) => {
    elapsed += f.dt;

    if (partyDue >= 0) {
      if (f.t >= partyDue) finish(partyDue - PARTY_MS, starsForTime(partyDue - PARTY_MS, level.parMs));
      return { kind: 'rest' };
    }

    if (joinUntil >= 0) {
      if (f.t < joinUntil) return { kind: 'rest' };
      joinUntil = -1;
    }

    if (f.st.isBlowing && f.power > 0.08) {
      h = Math.min(1, h + rise * (0.5 + f.power) * f.k);
    } else {
      h = Math.max(0, h - fall * f.k);
    }

    // Fully up: the figure dances, and holding it there brings a friend in.
    if (h >= 1) {
      hold += f.dt;
      if (hold >= level.holdMs) {
        standing += 1;
        hold = 0;
        h = 0;
        if (standing >= level.figures) {
          partyDue = f.t + PARTY_MS;
          return { kind: 'rest' };
        }
        joinUntil = f.t + JOIN_MS;
        return { kind: 'rest' };
      }
    } else {
      hold = 0;
    }

    return { kind: 'long' };
  });
};
