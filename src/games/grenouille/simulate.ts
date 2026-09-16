import { run } from '../balance/harness';
import { starsForTime } from '../_shared/stars';
import { type Simulate } from '../balance/types';
import type { GrenouilleLevel } from './index';
import { AIM_MS, JUMP_MS, MIN_CHARGE, SETTLE_MS, SPLASH_MS, chargeFor, landingHalf, padGaps, reachFor } from './rules';

/**
 * How closely the typical child can match the aim they are going for before
 * they let go — their own imprecision, measured on a held blow (the wobble of
 * `TYPICAL_CHILD` sits around 0.04). It belongs to this simulation rather
 * than to the shared child model: it is how *this* game is read, and the
 * child model must stay the same yardstick for every game.
 */
const AIM_PRECISION = 0.13;

/**
 * Grenouille: the child holds the intensity that aims at the next pad, then
 * lets go to jump. Modelled with a `hold` intent — the only one where the
 * child aims at a given intensity — so the wobble of their breath is what
 * scatters the landings, exactly as it does in the game.
 *
 * The charge is the intensity *at the moment of release*, like in the game:
 * the arc shows where the jump is pointing, and stopping sends it there.
 */
export const simulate: Simulate<GrenouilleLevel> = (level, difficulty, child) => {
  const gaps = padGaps(level.pads, difficulty, 4100 + level.pads * 37);
  const half = landingHalf(difficulty);
  let index = 0;
  /** Position of the frog, in gaps from the start. */
  let at = 0;
  /** How long the current blow has lasted (ms). */
  let chargeMs = 0;
  /** While >= 0, a jump or a splash is playing out: the child rests. */
  let busyUntil = -1;
  let elapsed = 0;

  /** Resolves a jump at charge `charge` and returns the pause it costs. */
  const jump = (charge: number) => {
    const reach = reachFor(charge, difficulty);
    const wanted = gaps[index] - at;
    if (Math.abs(reach - wanted) <= half) {
      at = gaps[index];
      index += 1;
      return JUMP_MS + SETTLE_MS;
    }
    // Missed: the frog splashes and climbs back on the pad it came from.
    return JUMP_MS + SPLASH_MS;
  };

  return run(child, (f, finish) => {
    elapsed += f.dt;

    if (busyUntil >= 0) {
      if (f.t < busyUntil) return { kind: 'rest' };
      busyUntil = -1;
      if (index >= gaps.length) {
        finish(elapsed, starsForTime(elapsed, level.parMs));
        return { kind: 'rest' };
      }
    }

    // `chargeFor` clamps: the aim is a gap, not a 0..1 level.
    const aim = chargeFor(gaps[index] - at, difficulty);

    if (f.st.isBlowing) {
      chargeMs += f.dt;
      // The child lets go once the arc *looks* right to them. Their reading
      // of it is only so good (`AIM_PRECISION`) — that imprecision is a
      // property of the child, not of the level, so a narrower landing
      // window (higher difficulty) turns more of those releases into misses.
      const settled = chargeMs >= AIM_MS && Math.abs(f.power - aim) <= AIM_PRECISION;
      if (settled || chargeMs >= AIM_MS * 3) {
        chargeMs = 0;
        if (f.power >= MIN_CHARGE) {
          busyUntil = f.t + jump(f.power);
          return { kind: 'rest' };
        }
      }
      return { kind: 'hold', level: aim };
    }

    // The blow ended on its own before the aim settled: the jump still goes,
    // with whatever charge was there — a weak blow is a short jump.
    if (chargeMs > 0) {
      chargeMs = 0;
      if (f.power >= MIN_CHARGE) {
        busyUntil = f.t + jump(f.power);
        return { kind: 'rest' };
      }
    }

    return { kind: 'hold', level: aim };
  });
};
