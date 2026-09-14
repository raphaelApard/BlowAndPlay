import type { LevelBase, Stars } from '../types';
import type { Child } from './child';
import { gameUnit } from '../_shared/math';

/** Result of a game simulated by the "typical child". */
export interface Outcome {
  /** False if the level was not finished within the allotted time. */
  finished: boolean;
  /** Duration of the game (ms), excluding the final celebration. */
  elapsedMs: number;
  /** Total time spent blowing (ms): the child's actual effort. */
  blowMs: number;
  /** Number of blows. */
  blows: number;
  stars: Stars;
}

/**
 * Headless simulation of a level: the same equations as the game (the
 * constants come from the game's `rules.ts`), breath provided by `child`.
 * `difficulty`: 0 (easy) → 1 (hard), like `GameProps.difficulty`.
 */
export type Simulate<L extends LevelBase = LevelBase> = (level: L, difficulty: number, child: Child) => Outcome;

/** Reference screen for the simulations (landscape tablet). */
export const VIEW = { width: 1180, height: 820 } as const;
/** Same formula as the games: scenery scale factor. */
export const UNIT = gameUnit(VIEW.width, VIEW.height);
/** Simulation step: one frame at 60 Hz. */
export const FRAME_MS = 1000 / 60;
/** Beyond this, we consider that the child cannot manage it. */
export const MAX_MS = 240_000;
/** Intensity smoothing used by every game (`power += (raw - power) * 0.25`). */
export const SMOOTH = 0.25;

export function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
