import { Child, type BreathSample, type Intent } from './child';
import { FRAME_MS, MAX_MS, SMOOTH, type Outcome } from './types';
import type { Stars } from '../types';

/**
 * Boucle d'images d'une simulation : avance le temps, interroge l'enfant,
 * lisse l'intensité comme les jeux (`power`). Chaque `simulate` écrit sa
 * physique dans `step`, et renvoie la fin de partie via `finish`.
 */
export interface Frame {
  /** Temps écoulé depuis le début (ms), comme `performance.now()` relatif. */
  t: number;
  dt: number;
  /** Facteur « images à 60 Hz » (`dt / 16.67`), toujours 1 ici. */
  k: number;
  /** Souffle brut fourni par l'enfant. */
  st: BreathSample;
  /** Intensité lissée (comme `s.power` dans les jeux). */
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
