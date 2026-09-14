import { clamp01, seeded } from './draw';

/** Game rules shared between the component and the balance simulation. */

/** Fondu de la bande entre deux cibles. */
export const SWITCH_MS = 900;
/** Final celebration: the kite climbs, a shower of stars. */
export const PARTY_MS = 3200;
/** Interval at which stars appear in the band. */
export const STAR_EVERY_MS = 650;
/** Outside the zone, the time held erodes slowly (a fraction of real time). */
export const HOLD_DECAY = 0.25;
/** Kite inertia (share of the way towards the target altitude, per frame). */
export const FOLLOW = 0.07;

/**
 * Global difficulty (0 → 1) → target:
 *  - hauteur de la bande : ×1 (facile) → ×0,6 ;
 *  - time to hold: ×1 → ×1.5.
 */
export function tuning(difficulty: number) {
  const d = clamp01(difficulty);
  return { band: 1 - d * 0.4, hold: 1 + d * 0.5 };
}

/** Altitudes cibles (0..1) : alternance haut / bas, jamais deux proches. */
export function makeTargets(count: number, half: number, seed: number): number[] {
  const rand = seeded(seed);
  const lo = 0.06 + half;
  const hi = 0.98 - half;
  const out: number[] = [];
  let prev = -1;
  for (let i = 0; i < count; i++) {
    let a = 0;
    for (let tries = 0; tries < 20; tries++) {
      a = lo + rand() * (hi - lo);
      if (prev < 0 || Math.abs(a - prev) >= Math.min(0.3, (hi - lo) * 0.45)) break;
    }
    out.push(a);
    prev = a;
  }
  return out;
}

/** Half-height of the band and a level's targets, for a given difficulty. */
export function makeCourse(level: { targetWidth: number; targets: number }, difficulty: number) {
  const { band } = tuning(difficulty);
  const half = (level.targetWidth * band) / 2;
  return { half, targets: makeTargets(level.targets, half, 900 + level.targets * 31 + Math.round(level.targetWidth * 100)) };
}
