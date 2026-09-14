import type {
  BlowSummary,
  BreathEvent,
  BreathSource,
  BreathState,
  Calibration,
} from './types';

export interface BreathEngineOptions {
  /** Vitesse de montée du lissage (0..1 par frame). */
  attack: number;
  /** Vitesse de descente du lissage (0..1 par frame). */
  release: number;
  /** Intensité normalisée au-dessus de laquelle un souffle commence. */
  onThreshold: number;
  /** Intensité en dessous de laquelle un souffle se termine (hystérésis). */
  offThreshold: number;
  /** Souffles plus courts que ceci sont ignorés (ms). */
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
 * Moteur de souffle : normalise le niveau brut d'une source selon le
 * calibrage, le lisse, et émet des événements blowStart / blowEnd.
 *
 * Les jeux consomment le moteur de deux façons :
 *  - `subscribe(cb)` : état à chaque frame (boucles canvas / rAF) ;
 *  - `on(cb)`        : événements discrets (souffles courts, comptage).
 * Le hook `useBreathState()` (BreathProvider) l'expose aussi en React.
 */
export class BreathEngine {
  private readonly options: BreathEngineOptions;
  private source: BreathSource | null = null;
  private unsubSource: (() => void) | null = null;
  private calibration: Calibration | null = null;
  private running = false;

  private smooth = 0;
  /** Vrai tant qu'on attend que le souffle oublié soit réellement relâché. */
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

  /** Remplace la source (arrête l'ancienne, démarre la nouvelle si le moteur tourne). */
  async setSource(source: BreathSource): Promise<void> {
    const wasRunning = this.running;
    this.stop();
    this.source = source;
    // Le calibrage est propre à une source : on repart du défaut.
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

  // ─── Calibrage ────────────────────────────────────────────────────────

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
   * Collecte les niveaux bruts jusqu'à l'appel de `stop()`.
   * Utilisé par l'écran de calibrage (phase silence, phase souffle).
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

  // ─── Abonnements ──────────────────────────────────────────────────────

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
   * Oublie le souffle en cours sans arrêter la source : le souffle qui a lancé
   * le jeu depuis la carte ne doit pas faire décoller la fusée à la première
   * frame. Aucun `blowEnd` n'est émis pour celui-ci.
   *
   * Remettre le lissage à zéro ne suffit pas : l'enfant souffle encore, et le
   * niveau brut repasse le seuil en deux ou trois frames, ce qui relancerait
   * aussitôt un `blowStart`. On ignore donc tout souffle jusqu'à ce que le
   * niveau redescende réellement sous le seuil de relâchement.
   */
  resetBlow(): void {
    this.resetEnvelope();
    this.ignoringBlow = true;
  }

  // ─── Traitement ──────────────────────────────────────────────────────

  private readonly handleLevel = (raw: number) => {
    const t = performance.now();
    const { noiseFloor, peak } = this.getCalibration();
    const normalized = clamp01((raw - noiseFloor) / Math.max(peak - noiseFloor, 1e-4));

    const k = normalized > this.smooth ? this.options.attack : this.options.release;
    this.smooth += (normalized - this.smooth) * k;
    if (this.smooth < 0.001) this.smooth = 0;

    // Souffle oublié (`resetBlow`) : on reste muet tant qu'il dure, et on ne
    // réarme qu'une fois le niveau retombé sous le seuil de relâchement.
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
 * Déduit un calibrage de deux séries d'échantillons bruts :
 * une phase de silence et une phase de souffle.
 */
export function computeCalibration(
  silence: number[],
  blow: number[],
  fallback: Calibration,
): Calibration {
  if (!silence.length || !blow.length) return fallback;
  const noiseFloor = percentile(silence, 0.9) * 1.25;
  let peak = percentile(blow, 0.85);
  // Si l'enfant n'a pas soufflé assez fort, on garde une plage exploitable.
  const minRange = Math.max(fallback.peak - fallback.noiseFloor, 1e-3) * 0.3;
  if (peak - noiseFloor < minRange) peak = noiseFloor + minRange;
  return { noiseFloor, peak };
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[idx];
}
