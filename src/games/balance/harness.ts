import { Child, type BreathSample, type Intent } from './child';
import { FRAME_MS, MAX_MS, SMOOTH, type Outcome } from './types';
import type { Stars } from '../types';

/**
 * Frame loop of a simulation: advances time, queries the child, smooths the
 * intensity like the games do (`power`). Each `simulate` writes its physics
 * in `step`, and reports the end of the game via `finish`.
 */
export interface Frame {
  /** Time elapsed since the start (ms), like a relative `performance.now()`. */
  t: number;
  dt: number;
  /** The "frames at 60 Hz" factor (`dt / 16.67`), always 1 here. */
  k: number;
  /** Raw breath provided by the child. */
  st: BreathSample;
  /** Smoothed intensity (like `s.power` in the games). */
  power: number;
}

export function run(child: Child, step: (f: Frame, finish: (elapsedMs: number, stars: Stars) => void) => Intent): Outcome {
  const f: Frame = { t: 0, dt: FRAME_MS, k: 1, st: { intensity: 0, isBlowing: false, blowDurationMs: 0 }, power: 0 };
  let intent: Intent = { kind: 'rest' };
  let result: { elapsedMs: number; stars: Stars } | null = null;
  const finish = (elapsedMs: number, stars: Stars) => {
    if (!result) result = { elapsedMs, stars };
  };
  while (!result && f.t < MAX_MS) {
    f.st = child.next(f.dt, intent);
    f.power += (f.st.intensity - f.power) * Math.min(1, SMOOTH * f.k);
    intent = step(f, finish);
    f.t += f.dt;
  }
  const r = result as { elapsedMs: number; stars: Stars } | null;
  return {
    finished: r !== null,
    elapsedMs: r ? r.elapsedMs : Infinity,
    blowMs: child.blowMs,
    blows: child.blows,
    stars: r ? r.stars : 0,
  };
}
