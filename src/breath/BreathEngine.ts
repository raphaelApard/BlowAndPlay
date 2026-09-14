import type {
  BlowSummary,
  BreathEvent,
  BreathSource,
  BreathState,
  Calibration,
} from './types';

export interface BreathEngineOptions {
  /** Rise speed of the smoothing (0..1 per frame). */
  attack: number;
  /** Fall speed of the smoothing (0..1 per frame). */
  release: number;
  /** Normalized intensity above which a blow starts. */
  onThreshold: number;
  /** Intensity below which a blow ends (hysteresis). */
  offThreshold: number;
  /** Blows shorter than this are ignored (ms). */
  minBlowMs: number;
}

const DEFAULT_OPTIONS: BreathEngineOptions = {
  attack: 0.35,
  release: 0.12,
  onThreshold: 0.18,
  offThreshold: 0.1,
  minBlowMs: 80,
};

type StateListener = (state: BreathState) => void;
type EventListener = (event: BreathEvent) => void;

/**
 * Breath engine: normalizes a source's raw level against the calibration,
 * smooths it, and emits blowStart / blowEnd events.
 *
 * Games consume the engine in two ways:
 *  - `subscribe(cb)`: state on every frame (canvas / rAF loops);
 *  - `on(cb)`       : discrete events (short blows, counting).
 * The `useBreathState()` hook (BreathProvider) also exposes it in React.
 */
export class BreathEngine {
  private readonly options: BreathEngineOptions;
  private source: BreathSource | null = null;
  private unsubSource: (() => void) | null = null;
  private calibration: Calibration | null = null;
  private running = false;

  private smooth = 0;
  /** True while we wait for the forgotten blow to actually be released. */
  private ignoringBlow = false;
  private blowStartedAt: number | null = null;
  private blowPeak = 0;
  private blowSum = 0;
  private blowSamples = 0;

  private state: BreathState = {
    raw: 0,
    intensity: 0,
    isBlowing: false,
    blowDurationMs: 0,
    t: 0,
  };

  private readonly stateListeners = new Set<StateListener>();
  private readonly eventListeners = new Set<EventListener>();

  constructor(options: Partial<BreathEngineOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  // ─── Source ────────────────────────────────────────────────────────────

  getSource(): BreathSource | null {
    return this.source;
  }

  /** Replaces the source (stops the old one, starts the new one if the engine is running). */
  async setSource(source: BreathSource): Promise<void> {
    const wasRunning = this.running;
    this.stop();
    this.source = source;
    // The calibration is specific to a source: we start again from the default.
    this.calibration = null;
    if (wasRunning) await this.start();
  }

  async start(): Promise<void> {
    if (this.running || !this.source) return;
    await this.source.start();
    this.unsubSource = this.source.onLevel(this.handleLevel);
    this.running = true;
  }

  stop(): void {
    this.unsubSource?.();
    this.unsubSource = null;
    this.source?.stop();
    this.running = false;
    this.resetEnvelope();
  }

  isRunning(): boolean {
    return this.running;
  }

  // ─── Calibration ──────────────────────────────────────────────────────

  isCalibrated(): boolean {
    return this.calibration !== null;
  }

  getCalibration(): Calibration {
    return this.calibration ?? this.source?.defaultCalibration ?? { noiseFloor: 0, peak: 1 };
  }

  setCalibration(calibration: Calibration | null): void {
    this.calibration = calibration;
  }

  /**
   * Collects raw levels until `stop()` is called.
   * Used by the calibration screen (silence phase, blow phase).
   */
  sampleRaw(): { stop: () => number[] } {
    const samples: number[] = [];
    const unsub = this.source?.onLevel((l) => samples.push(l)) ?? (() => undefined);
    return {
      stop: () => {
        unsub();
        return samples;
      },
    };
  }

  // ─── Subscriptions ────────────────────────────────────────────────────

  getState(): BreathState {
    return this.state;
  }

  subscribe(cb: StateListener): () => void {
    this.stateListeners.add(cb);
    return () => this.stateListeners.delete(cb);
  }

  on(cb: EventListener): () => void {
    this.eventListeners.add(cb);
    return () => this.eventListeners.delete(cb);
  }

  /**
   * Forgets the current blow without stopping the source: the blow that
   * launched the game from the map must not make the rocket take off on the
   * first frame. No `blowEnd` is emitted for that one.
   *
   * Resetting the smoothing to zero is not enough: the child is still blowing,
   * and the raw level crosses the threshold again within two or three frames,
   * which would immediately trigger another `blowStart`. So we ignore any blow
   * until the level actually falls back below the release threshold.
   */
  resetBlow(): void {
    this.resetEnvelope();
    this.ignoringBlow = true;
  }

  // ─── Processing ───────────────────────────────────────────────────────

  private readonly handleLevel = (raw: number) => {
    const t = performance.now();
    const { noiseFloor, peak } = this.getCalibration();
    const normalized = clamp01((raw - noiseFloor) / Math.max(peak - noiseFloor, 1e-4));

    const k = normalized > this.smooth ? this.options.attack : this.options.release;
    this.smooth += (normalized - this.smooth) * k;
    if (this.smooth < 0.001) this.smooth = 0;

    // Forgotten blow (`resetBlow`): we stay silent for as long as it lasts, and
    // only re-arm once the level has fallen back below the release threshold.
    if (this.ignoringBlow) {
      if (this.smooth < this.options.offThreshold) {
        this.ignoringBlow = false;
      } else {
        this.state = { raw, intensity: this.smooth, isBlowing: false, blowDurationMs: 0, t };
        for (const cb of this.stateListeners) cb(this.state);
        return;
      }
    }

    let isBlowing = this.blowStartedAt !== null;
    if (!isBlowing && this.smooth >= this.options.onThreshold) {
      isBlowing = true;
      this.blowStartedAt = t;
      this.blowPeak = 0;
      this.blowSum = 0;
      this.blowSamples = 0;
      this.emit({ type: 'blowStart', t });
    } else if (isBlowing && this.smooth < this.options.offThreshold) {
      isBlowing = false;
      const startedAt = this.blowStartedAt as number;
      const durationMs = t - startedAt;
      this.blowStartedAt = null;
      if (durationMs >= this.options.minBlowMs) {
        const blow: BlowSummary = {
          durationMs,
          peak: this.blowPeak,
          mean: this.blowSamples ? this.blowSum / this.blowSamples : 0,
          startedAt,
        };
        this.emit({ type: 'blowEnd', blow });
      }
    }

    if (isBlowing) {
      this.blowPeak = Math.max(this.blowPeak, this.smooth);
      this.blowSum += this.smooth;
      this.blowSamples++;
    }

    this.state = {
      raw,
      intensity: this.smooth,
      isBlowing,
      blowDurationMs: this.blowStartedAt === null ? 0 : t - this.blowStartedAt,
      t,
    };
    for (const cb of this.stateListeners) cb(this.state);
  };

  private emit(event: BreathEvent) {
    for (const cb of this.eventListeners) cb(event);
  }

  private resetEnvelope() {
    this.smooth = 0;
    this.ignoringBlow = false;
    this.blowStartedAt = null;
    this.state = { raw: 0, intensity: 0, isBlowing: false, blowDurationMs: 0, t: performance.now() };
    for (const cb of this.stateListeners) cb(this.state);
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Derives a calibration from two series of raw samples:
 * a silence phase and a blow phase.
 */
export function computeCalibration(
  silence: number[],
  blow: number[],
  fallback: Calibration,
): Calibration {
  if (!silence.length || !blow.length) return fallback;
  const noiseFloor = percentile(silence, 0.9) * 1.25;
  let peak = percentile(blow, 0.85);
  // If the child did not blow hard enough, we keep a usable range.
  const minRange = Math.max(fallback.peak - fallback.noiseFloor, 1e-3) * 0.3;
  if (peak - noiseFloor < minRange) peak = noiseFloor + minRange;
  return { noiseFloor, peak };
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[idx];
}
