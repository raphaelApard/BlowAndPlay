/**
 * « Enfant type » : modèle de souffle utilisé pour comparer la difficulté
 * des jeux entre eux. Ce n'est pas un enfant réel, c'est un étalon : le même
 * pour tous les jeux, ce qui rend les résultats comparables.
 */

export interface ChildProfile {
  /** Intensité (0..1, calibrée) d'un souffle long tenu. */
  longPeak: number;
  /** Intensité d'un souffle court et vif. */
  burstPeak: number;
  /** Durée maximale d'un souffle long avant de reprendre son souffle. */
  longMaxMs: number;
  longRestMs: number;
  burstMs: number;
  burstRestMs: number;
  /** Souffle « dosé » (tenir une intensité) : durée max puis pause. */
  holdMaxMs: number;
  holdRestMs: number;
  /** Amplitude des oscillations quand il essaie de tenir une intensité. */
  wobble: number;
  /** Temps de réaction pour ajuster son souffle (ms). */
  lagMs: number;
  /** Montée / descente d'un souffle (ms). */
  attackMs: number;
  /** Reprise de souffle après un arrêt volontaire (le jeu n'en avait plus besoin). */
  recoverMs: number;
}

export const TYPICAL_CHILD: ChildProfile = {
  longPeak: 0.65,
  burstPeak: 0.8,
  longMaxMs: 3500,
  longRestMs: 1500,
  burstMs: 500,
  burstRestMs: 700,
  holdMaxMs: 4000,
  holdRestMs: 1200,
  wobble: 0.06,
  lagMs: 350,
  attackMs: 150,
  recoverMs: 700,
};

/** Ce que le jeu demande à l'enfant à cet instant. */
export type Intent =
  | { kind: 'long' }
  | { kind: 'bursts' }
  /** Tenir une intensité donnée (cerf-volant). */
  | { kind: 'hold'; level: number }
  /** Ne pas souffler (le jeu n'en a pas besoin pour l'instant). */
  | { kind: 'rest' };

/** Ce que le moteur de souffle fournirait au jeu. */
export interface BreathSample {
  intensity: number;
  isBlowing: boolean;
  blowDurationMs: number;
}

const BLOWING_THRESHOLD = 0.05;

export class Child {
  private phase: 'blow' | 'rest' = 'rest';
  private phaseMs = 0;
  /** Repos à respecter avant le prochain souffle. */
  private restNeeded = 0;
  private intensity = 0;
  private t = 0;
  private blowingMs = 0;
  /** Cumul : effort réel et nombre de souffles. */
  blowMs = 0;
  blows = 0;
  private wasBlowing = false;

  readonly profile: ChildProfile;

  constructor(profile: ChildProfile = TYPICAL_CHILD) {
    this.profile = profile;
  }

  next(dt: number, intent: Intent): BreathSample {
    const p = this.profile;
    this.t += dt;
    this.phaseMs += dt;

    let target = 0;
    if (intent.kind === 'rest') {
      if (this.phase === 'blow') {
        this.phase = 'rest';
        this.phaseMs = 0;
        this.restNeeded = p.recoverMs;
      }
    } else {
      const [maxMs, restMs] = intent.kind === 'long' ? [p.longMaxMs, p.longRestMs] : intent.kind === 'bursts' ? [p.burstMs, p.burstRestMs] : [p.holdMaxMs, p.holdRestMs];
      if (this.phase === 'blow' && this.phaseMs >= maxMs) {
        this.phase = 'rest';
        this.phaseMs = 0;
        this.restNeeded = restMs;
      } else if (this.phase === 'rest' && this.phaseMs >= this.restNeeded) {
        this.phase = 'blow';
        this.phaseMs = 0;
      }
      if (this.phase === 'blow') {
        target =
          intent.kind === 'long' ? p.longPeak : intent.kind === 'bursts' ? p.burstPeak : Math.max(0.08, intent.level + Math.sin(this.t / 650) * p.wobble);
      }
    }

    // Montée/descente d'un souffle, plus lente quand il faut doser.
    const tau = intent.kind === 'hold' ? p.lagMs : p.attackMs;
    this.intensity += (target - this.intensity) * Math.min(1, dt / tau);
    if (this.intensity < 0.005) this.intensity = 0;

    const isBlowing = this.intensity > BLOWING_THRESHOLD;
    this.blowingMs = isBlowing ? this.blowingMs + dt : 0;
    if (isBlowing) this.blowMs += dt;
    if (isBlowing && !this.wasBlowing) this.blows += 1;
    this.wasBlowing = isBlowing;
    return { intensity: this.intensity, isBlowing, blowDurationMs: this.blowingMs };
  }
}
