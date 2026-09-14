/**
 * The "breath" layer: a source provides a raw level, the engine normalizes it
 * (calibration), smooths it and derives breath events from it.
 */

export type BreathSourceKind = 'mic' | 'keyboard';

export interface Calibration {
  /** Raw level at rest (ambient noise). */
  noiseFloor: number;
  /** Raw level reached when the child blows hard. */
  peak: number;
}

export interface BreathSource {
  readonly kind: BreathSourceKind;
  /** Calibration used until the child has calibrated. */
  readonly defaultCalibration: Calibration;
  start(): Promise<void>;
  stop(): void;
  /** Receives the raw level on each frame. Returns the unsubscribe function. */
  onLevel(cb: (level: number) => void): () => void;
}

export interface BreathState {
  /** Raw level (depends on the source). */
  raw: number;
  /** Normalized and smoothed intensity, 0 = nothing, 1 = calibrated max breath. */
  intensity: number;
  /** True between blowStart and blowEnd (with hysteresis). */
  isBlowing: boolean;
  /** Duration of the current blow, in ms (0 otherwise). */
  blowDurationMs: number;
  /** performance.now() of the last sample. */
  t: number;
}

export interface BlowSummary {
  durationMs: number;
  peak: number;
  mean: number;
  startedAt: number;
}

export type BreathEvent =
  | { type: 'blowStart'; t: number }
  | { type: 'blowEnd'; blow: BlowSummary };

/** Aggregated statistics for one game (computed by the GameShell). */
export interface BreathSessionStats {
  blows: number;
  totalBlowMs: number;
  longestBlowMs: number;
  meanIntensity: number;
}
