import { clamp01 } from './draw';

/** Game rules shared between the component and the balance simulation. */

/** Take-off: the bird leaves the pole once the breath has been held this long. */
export const TAKEOFF_MS = 260;
export const TAKEOFF_THRESHOLD = 0.12;
/** Landing on the next pole (ms). */
export const LANDING_MS = 520;
/** Pause on a pole before the next hop can start (ms). */
export const PERCH_MS = 1100;
/** Fall into the water, then the bird shakes itself off and climbs back (ms). */
export const SPLASH_MS = 1400;
/** Lost in the sky: the bird circles back down to the pole it left (ms). */
export const ESCAPE_MS = 1400;
/** Final celebration once the last pole is reached. */
export const PARTY_MS = 3000;

/**
 * Flight altitude, 0 = the water, 1 = the top of the sky. The bird sits at
 * `CRUISE` on a pole and the corridor is centred there, so the child starts
 * the hop already in the safe band and only has to *keep* it.
 */
export const CRUISE = 0.5;

/**
 * The actual altitudes that lose the bird: the water's surface below, and
 * just short of the top of the sky above — the child has almost the whole
 * sky to work with, and only truly loses the bird by touching the water or
 * flying off the top. The level's `corridor` is a narrower visual guide
 * inside this range; it no longer decides the fall.
 */
export const LOWER_BOUND = 0;
export const UPPER_BOUND = 0.95;

/**
 * Altitude follows the breath directly rather than through a velocity: a
 * 3-year-old has to see their blow move the bird now, not two seconds later.
 * `FOLLOW` is the share of the way covered per frame at 60 Hz.
 */
export const FOLLOW = 0.055;

/**
 * The intensity that holds the bird at cruising altitude. Below it the bird
 * sinks, above it it climbs — this is the whole game.
 *
 * Set just under the typical child's sustained long blow (0.65) so that a
 * comfortable blow is the *right* blow, and drifting off it in either
 * direction is what costs.
 */
export const LIFT_NEUTRAL = 0.58;

/**
 * How far the altitude swings for a full unit of intensity off `LIFT_NEUTRAL`.
 *
 * Kept low on purpose: a stronger coupling pins the bird to the ceiling or the
 * water on the smallest change of breath, and the child never sees it travel.
 * At 0.9 a blow well off neutral still only drifts the bird part of the way to
 * the edge, so there is visible room to climb and sink before anything is lost.
 */
export const LIFT_RANGE = 0.9;

/**
 * Altitude at which the escape puff is drawn: the top of the sky, where the
 * bird vanishes. The *boundary* that loses the bird is `UPPER_BOUND`, not
 * this — this is only where the animation is placed.
 */
export const SKY = 0.98;

/**
 * Horizontal speed of a hop, in span-units per frame at 60 Hz: a nominal
 * span is crossed in about 1.9 s.
 *
 * The ceiling on this is the child, not the screen: a typical child holds a
 * measured blow for about 4 s before needing air, so even the widest span
 * (×2.1) has to stay under that or the bird would always be dropped
 * mid-crossing through no fault of the child's.
 */
export const SPEED = 1 / (1.9 * 60);

/**
 * Global difficulty (0 → 1) → the flight: the distance between two poles,
 * ×1 (easy) → ×2.05. That is the *only* thing difficulty changes — a harder
 * setting asks the child to hold one blow for longer, never to hold it more
 * precisely. The flyable band (`LOWER_BOUND`..`UPPER_BOUND`) keeps the same
 * height whatever the setting, so the room the bird has above and below it
 * never shrinks.
 *
 * The top of the range is bounded by how long a child can hold one blow
 * (~4 s): past that, the hardest levels would fail on lung capacity rather
 * than on control.
 */
export function tuning(difficulty: number) {
  const d = clamp01(difficulty);
  return { span: 1 + d * 1.05 };
}

/**
 * Altitude the bird tends towards for a given breath intensity. Linear around
 * `LIFT_NEUTRAL`: blowing harder always means higher, which is the rule the
 * child has to discover.
 *
 * Deliberately *not* clamped to `0..1`: `alt` only follows this target by a
 * fraction each frame (`FOLLOW`), so a target sitting exactly on `LOWER_BOUND`
 * would only ever be approached, never reached — the bird would hover just
 * above the water forever instead of splashing when the child stops blowing.
 * Letting the target go past the bound means `alt` actually crosses it.
 */
export function targetAltitude(power: number) {
  return CRUISE + (power - LIFT_NEUTRAL) * LIFT_RANGE;
}

/**
 * Duration of a hop (ms) at `difficulty`: the unbroken blow the level is
 * really asking for. The levels are written in terms of poles, so this is
 * what turns "one more pole" into "this much more breath".
 */
export function hopMs(difficulty: number) {
  return tuning(difficulty).span / SPEED / 60 * 1000;
}
