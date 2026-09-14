/**
 * Couche « souffle » : une source fournit un niveau brut, le moteur le
 * normalise (calibrage), le lisse et en déduit des événements de souffle.
 */

export type BreathSourceKind = 'mic' | 'keyboard';

export interface Calibration {
  /** Niveau brut au repos (bruit ambiant). */
  noiseFloor: number;
  /** Niveau brut atteint quand l'enfant souffle fort. */
  peak: number;
}

export interface BreathSource {
  readonly kind: BreathSourceKind;
  /** Calibrage utilisé tant que l'enfant n'a pas calibré. */
  readonly defaultCalibration: Calibration;
  start(): Promise<void>;
  stop(): void;
  /** Reçoit le niveau brut à chaque frame. Renvoie la fonction de désabonnement. */
  onLevel(cb: (level: number) => void): () => void;
}

export interface BreathState {
  /** Niveau brut (dépend de la source). */
  raw: number;
  /** Intensité normalisée et lissée, 0 = rien, 1 = souffle max calibré. */
  intensity: number;
  /** Vrai entre blowStart et blowEnd (avec hystérésis). */
  isBlowing: boolean;
  /** Durée du souffle en cours, en ms (0 sinon). */
  blowDurationMs: number;
  /** performance.now() du dernier échantillon. */
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

/** Statistiques agrégées sur une partie (calculées par le GameShell). */
export interface BreathSessionStats {
  blows: number;
  totalBlowMs: number;
  longestBlowMs: number;
  meanIntensity: number;
}
