import { clamp01, seeded } from './draw';

/** Game rules shared between the component and the balance simulation. */

/** Flight of a jump, from take-off to landing (ms). */
export const JUMP_MS = 700;
/** Splash, then the frog climbs back on the pad it came from (ms). */
export const SPLASH_MS = 1100;
/** Final celebration: the frog on the flowered bank. */
export const PARTY_MS = 3000;
/** Pause after a landing, before the aim gauge accepts a new blow (ms). */
export const SETTLE_MS = 350;
/**
 * Time the aim has to be held before the frog springs (ms). Short enough that
 * a 3-year-old does not have to sustain a blow, long enough that the charge
 * is an aim and not a reflex.
 */
export const AIM_MS = 900;

/**
 * Aiming: the charge (0..1) is the intensity of the blow at the moment it is
 * released, and it maps to a distance between `MIN_REACH` and `maxReach()`
 * pad-gaps. A gap of 1 is the nominal spacing between two pads.
 */
export const MIN_REACH = 0.35;

/**
 * How far past the widest possible step a full blow carries. Kept just above
 * 1 so the aim arc stops a little beyond the pad the child is aiming at,
 * instead of sailing on towards the one after it: reaching a pad has to cost
 * a real blow, not a wisp of air.
 */
export const REACH_MARGIN = 1.08;

/** Below this, a blow is a hesitation, not an aim: the frog does not jump. */
export const MIN_CHARGE = 0.08;

/** Nominal gap between two pads (units, before `unit`). */
export const GAP = 205;
/** Radius of a pad (units, before `unit`). */
export const PAD_R = 62;

/**
 * Global difficulty (0 → 1) → pads:
 *  - spacing: ×1 (easy, a real hop) → ×1.62, so a harder pond asks for
 *    stronger blows as well as more accurate ones;
 *  - landing tolerance: ×1 (easy, a wide pad) → ×0.48;
 *  - spacing irregularity: 0 → ±0.3 gap, so the same blow no longer works
 *    twice in a row.
 *
 * The tolerance is set against the wobble of a held blow (~0.04 of charge
 * for the typical child): at ×1 a jump lands as long as the aim is roughly
 * right, at ×0.48 the breath has to be steady or the frog falls in.
 *
 * `maxReach` is derived from these, so every pad stays reachable on a full
 * blow whatever the spacing — the pond can never dead-end.
 */
export function tuning(difficulty: number) {
  const d = clamp01(difficulty);
  return { spacing: 1 + d * 0.62, tolerance: 1 - d * 0.52, spread: d * 0.3 };
}

/**
 * Reach of a full blow, in gaps. It follows the pond rather than being a
 * constant: a wider pond needs stronger jumps, but a full blow must always
 * land near the next pad rather than well past it.
 */
export function maxReach(difficulty: number) {
  const { spacing, spread } = tuning(difficulty);
  return (spacing + spread) * REACH_MARGIN;
}

/**
 * Distance reached (in gaps) by a blow charged to `charge` (0..1).
 * Linear so that the child can feel the relationship: twice as hard is not
 * twice as far, but stronger is always further.
 */
export function reachFor(charge: number, difficulty: number) {
  const max = maxReach(difficulty);
  return MIN_REACH + clamp01(charge) * (max - MIN_REACH);
}

/**
 * The charge that lands exactly on a pad `gap` gaps away — what the child is
 * aiming for. Used by the simulation to play the "typical child" aim.
 */
export function chargeFor(gap: number, difficulty: number) {
  const max = maxReach(difficulty);
  return clamp01((gap - MIN_REACH) / (max - MIN_REACH));
}

/**
 * Half-width of the landing window, in gaps. The frog lands on the pad if
 * `|reach - gap| <= landingHalf(difficulty)`.
 *
 * Expressed in gaps rather than in px so that the rule is the same in the
 * game and in the simulation, whatever the screen size.
 */
export function landingHalf(difficulty: number) {
  return (PAD_R / GAP) * tuning(difficulty).tolerance;
}

/**
 * The same landing window expressed as a charge (0..1) rather than in gaps:
 * how precisely the breath has to be aimed. `reachFor` is linear, so the
 * conversion is a single ratio.
 */
export function chargeHalf(difficulty: number) {
  return landingHalf(difficulty) / (maxReach(difficulty) - MIN_REACH);
}

/**
 * Spacing of the pads, in gaps, from the frog's start. Pad `i` sits at
 * `gaps[i]` gaps; the spacing wobbles with the difficulty so the child has to
 * re-aim at every jump instead of repeating one blow.
 */
export function padGaps(count: number, difficulty: number, seed: number): number[] {
  const { spacing, spread } = tuning(difficulty);
  // Deterministic wobble: same level and difficulty, same pond.
  const rand = seeded(seed);
  const out: number[] = [];
  let at = 0;
  for (let i = 0; i < count; i++) {
    at += spacing + (rand() * 2 - 1) * spread;
    out.push(at);
  }
  return out;
}
