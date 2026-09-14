/**
 * "Typical child": the breath model used to compare the difficulty of the
 * games against each other. It is not a real child, it is a yardstick: the
 * same one for every game, which is what makes the results comparable.
 */

export interface ChildProfile {
  /** Intensity (0..1, calibrated) of a sustained long blow. */
  longPeak: number;
  /** Intensity of a short, sharp blow. */
  burstPeak: number;
  /** Maximum duration of a long blow before catching their breath. */
  longMaxMs: number;
  longRestMs: number;
  burstMs: number;
  burstRestMs: number;
  /** "Measured" blow (holding an intensity): max duration, then a pause. */
  holdMaxMs: number;
  holdRestMs: number;
  /** Amplitude of the wobble when they try to hold an intensity. */
  wobble: number;
  /** Reaction time to adjust their blow (ms). */
  lagMs: number;
  /** Rise / fall of a blow (ms). */
  attackMs: number;
  /** Catching their breath after a deliberate stop (the game no longer needed it). */
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

/** What the game is asking of the child at this instant. */
export type Intent =
  | { kind: 'long' }
  | { kind: 'bursts' }
  /** Hold a given intensity (cerf-volant). */
  | { kind: 'hold'; level: number }
  /** Do not blow (the game does not need it for now). */
  | { kind: 'rest' };

/** What the breath engine would provide to the game. */
export interface BreathSample {
  intensity: number;
  isBlowing: boolean;
  blowDurationMs: number;
}

const BLOWING_THRESHOLD = 0.05;

export class Child {
  private phase: 'blow' | 'rest' = 'rest';
  private phaseMs = 0;
  /** Rest to observe before the next blow. */
  private restNeeded = 0;
  private intensity = 0;
  private t = 0;
  private blowingMs = 0;
  /** Totals: actual effort and number of blows. */
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

    // Rise/fall of a blow, slower when it has to be measured.
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
