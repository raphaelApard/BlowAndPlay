import { OBSTACLE_KINDS, clamp01, seeded, type ObstacleKind } from './draw';

/** Règles du jeu partagées entre le composant et la simulation d'équilibrage. */

/** Souffle soutenu nécessaire pour décoller (ms au-dessus du seuil). */
export const TAKEOFF_MS = 250;
export const TAKEOFF_THRESHOLD = 0.3;
/** Montée en vitesse du défilement après le décollage. */
export const RAMP_MS = 1500;
/** Descente sur la plateforme. */
export const LANDING_MS = 1600;
/** Fête après l'atterrissage : drapeau hissé, confettis. */
export const PARTY_MS = 3000;
/** Invulnérabilité après un choc. */
export const BUMP_COOLDOWN_MS = 1000;
/** Distance entre le dernier obstacle et la plateforme (px monde). */
export const PAD_AFTER = 320;
/** Vitesse verticale visée (px/frame avant `unit`) : montée à intensité 0 et 1, descente sans souffle. */
export const LIFT_BASE = 1.2;
export const LIFT_POWER = 4.2;
export const SINK = 2.4;

/**
 * Difficulté globale (0 → 1) → vol :
 *  - nombre d'obstacles : ×1 (facile) → ×2,5 ;
 *  - hauteur des obstacles : ×1,15 → ×1,85 ; espacement plus court.
 * La vitesse ne change pas : plus dur = plus d'obstacles à survoler, pas
 * moins de temps de jeu.
 */
export function tuning(difficulty: number) {
  const d = clamp01(difficulty);
  return { speed: 4.8, obstacleScale: 1.15 + d * 0.7, gap: 250 - d * 40, count: 1 + d * 1.5 };
}

export interface Obstacle {
  kind: ObstacleKind;
  /** Position dans le monde (px, avant multiplication par `unit`). */
  x: number;
  w: number;
  h: number;
  hitAt: number;
}

export function makeObstacles(count: number, seed: number, gap: number, scale: number): Obstacle[] {
  const rand = seeded(seed);
  let x = 520;
  return Array.from({ length: count }, (_, i) => {
    const kind = OBSTACLE_KINDS[Math.floor(rand() * OBSTACLE_KINDS.length)];
    // Les premiers obstacles sont bas, ça monte ensuite.
    const ease = Math.min(1, 0.55 + (i / Math.max(1, count - 1)) * 0.45);
    const h = (110 + rand() * 120) * scale * ease;
    const w = kind === 'tower' ? 70 : kind === 'house' ? 96 : 84;
    const o = { kind, x, w, h, hitAt: -1 };
    x += gap + rand() * 120;
    return o;
  });
}

/** Obstacles + plateforme d'un niveau, pour une difficulté donnée. */
export function makeWorld(baseCount: number, difficulty: number) {
  const { gap, obstacleScale, count } = tuning(difficulty);
  const obstacleCount = Math.round(baseCount * count);
  const obstacles = makeObstacles(obstacleCount, 700 + baseCount * 13, gap, obstacleScale);
  const last = obstacles[obstacles.length - 1];
  const padX = last.x + PAD_AFTER;
  return { obstacles, padX, total: padX };
}
