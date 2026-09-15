/**
 * Cut-paper drawing of Pousse-nuages: sky, sun with a face,
 * nuages boudeurs, collines fleuries. Fonctions pures sur un canvas 2D,
 * shared between the game and the thumbnail.
 */

import { clamp01, seeded, mixHex } from '../_shared/math';
import { INK, cut } from '../_shared/canvas';

// Re-exported so that the game, its simulation and its thumbnail keep a
// single entry point: `./draw`.
export { clamp01, seeded, lerp, mixHex } from '../_shared/math';
export { INK, cut } from '../_shared/canvas';

export const INK_SOLID = '#23324a';
export const SKY_TOP = '#5ec2f0';
export const SKY_BOT = '#bfe7fb';
export const SUN = '#ffd93d';
export const SUN_RAY = '#ffb03a';
export const SUN_PALE = '#e9d98f';
export const HILL_FAR = '#8fd07a';
export const HILL_NEAR = '#5cb95f';
export const CORAL = '#ff6b6b';
export const PETALS = ['#ff6b6b', '#ff9a4d', '#9d7bef', '#5ec2f0', '#ff7fb1'];

// ─── Ciel et soleil ──────────────────────────────────────────────────

/** The sky brightens with `bright` (0 = overcast, 1 = bright sun). */
export function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number, bright: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, mixHex('#4aa3d8', SKY_TOP, bright));
  g.addColorStop(1, mixHex('#a9d3ea', SKY_BOT, bright));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/**
 * Sun with a face. `bright` (0..1): pale and sulky behind the clouds,
 * radiant and smiling at the end. `spin`: rotation of the rays.
 */
export function drawSun(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, bright: number, spin: number, time: number) {
  ctx.save();
  ctx.translate(x, y);
  const body = mixHex(SUN_PALE, SUN, bright);
  const ray = mixHex('#e0c98a', SUN_RAY, bright);

  // Halo
  if (bright > 0.05) {
    const g = ctx.createRadialGradient(0, 0, r, 0, 0, r * (2.2 + bright * 0.8));
    g.addColorStop(0, `rgba(255, 217, 61, ${0.35 * bright})`);
    g.addColorStop(1, 'rgba(255, 217, 61, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r * 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Rayons (triangles), longueur qui respire
  ctx.save();
  ctx.rotate(spin);
  const n = 12;
  const len = r * (0.45 + bright * 0.35) * (1 + Math.sin(time / 500) * 0.05);
  cut(
    ctx,
    () => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const a1 = a - 0.16;
        const a2 = a + 0.16;
        ctx.moveTo(Math.cos(a1) * r * 0.95, Math.sin(a1) * r * 0.95);
        ctx.lineTo(Math.cos(a) * (r + len), Math.sin(a) * (r + len));
        ctx.lineTo(Math.cos(a2) * r * 0.95, Math.sin(a2) * r * 0.95);
        ctx.closePath();
      }
    },
    ray,
    5,
  );
  ctx.restore();

  cut(ctx, () => ctx.arc(0, 0, r, 0, Math.PI * 2), body, 6);

  // Visage : yeux + bouche (moue → sourire)
  ctx.fillStyle = INK_SOLID;
  const blink = Math.abs(Math.sin(time / 1900)) > 0.985 ? 0.15 : 1;
  for (const ex of [-0.32, 0.32]) {
    ctx.beginPath();
    ctx.ellipse(ex * r, -r * 0.12, r * 0.09, r * 0.11 * blink, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = INK_SOLID;
  ctx.lineWidth = Math.max(2, r * 0.07);
  ctx.lineCap = 'round';
  ctx.beginPath();
  const smile = bright * 2 - 1; // -1 moue, +1 sourire
  ctx.moveTo(-r * 0.3, r * 0.3);
  ctx.quadraticCurveTo(0, r * 0.3 + smile * r * 0.35, r * 0.3, r * 0.3);
  ctx.stroke();
  // Joues quand il est content
  if (bright > 0.6) {
    ctx.fillStyle = `rgba(255, 107, 107, ${(bright - 0.6) * 1.5})`;
    for (const cx of [-0.5, 0.5]) {
      ctx.beginPath();
      ctx.arc(cx * r, r * 0.18, r * 0.11, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ─── Nuages ──────────────────────────────────────────────────────────

/** Cloud silhouettes: chubby, elongated, tall, stormy (jagged). */
export type CloudKind = 'puffy' | 'long' | 'tall' | 'storm';
const CLOUD_KINDS: CloudKind[] = ['puffy', 'long', 'tall', 'storm'];

/** Couleurs de nuages : [corps, ombre du bas]. */
export const CLOUD_COLORS: [string, string][] = [
  ['#ffffff', '#dfe9f2'], // blanc
  ['#b9c6d4', '#94a5b8'], // gris orage
  ['#ffd6e0', '#f5b3c4'], // rose
  ['#e4d9ff', '#c7b8f5'], // lavande
  ['#d6f0ff', '#b1dcf5'], // pale blue
  ['#fff3c4', '#f5df95'], // cream
];

/** A cloud's humps (relative positions, radii) — fixed for a given shape. */
export interface CloudShape {
  kind: CloudKind;
  bumps: { x: number; y: number; r: number }[];
  /** Total relative width (for off-screen handling). */
  w: number;
  h: number;
  color: string;
  shade: string;
}

/**
 * Forme et couleur du nuage n° `index` : silhouette et teinte tournent
 * so that two consecutive clouds are always different.
 */
export function makeCloudShape(seed: number, index = 0): CloudShape {
  const rand = seeded(seed);
  const kind = CLOUD_KINDS[index % CLOUD_KINDS.length];
  const [color, shade] = CLOUD_COLORS[index % CLOUD_COLORS.length];
  const bump = (t: number, w: number, lift: number, r0: number, r1: number) => ({
    x: (t - 0.5) * w,
    y: -0.02 - Math.sin(t * Math.PI) * lift - rand() * 0.08,
    r: r0 + Math.sin(t * Math.PI) * r1 + rand() * 0.06,
  });
  const series = (n: number, f: (t: number) => { x: number; y: number; r: number }) =>
    Array.from({ length: n }, (_, i) => f(n > 1 ? i / (n - 1) : 0.5));
  switch (kind) {
    case 'long':
      return { kind, bumps: series(7, (t) => bump(t, 2.3, 0.12, 0.3, 0.14)), w: 3, h: 0.9, color, shade };
    case 'tall':
      return { kind, bumps: series(3, (t) => bump(t, 1, 0.5, 0.42, 0.34)), w: 1.7, h: 1.5, color, shade };
    case 'storm':
      return {
        kind,
        bumps: series(6, (t) => {
          const b = bump(t, 1.8, 0.22, 0.24, 0.2);
          // Jagged: every other hump is taller and smaller
          return t * 5 % 2 >= 1 ? { ...b, y: b.y - 0.18, r: b.r * 0.75 } : b;
        }),
        w: 2.3,
        h: 1.1,
        color,
        shade,
      };
    default:
      return { kind, bumps: series(4 + Math.floor(rand() * 2), (t) => bump(t, 1.45, 0.22, 0.4, 0.22)), w: 2.2, h: 1.1, color, shade };
  }
}

/**
 * Sulky cloud. `s` = scale (px per 1 shape unit), `squash` (0..1) squashes
 * it horizontally when pushed, `mood`: -1 grumpy → +1 surprised.
 */
export function drawCloud(ctx: CanvasRenderingContext2D, shape: CloudShape, x: number, y: number, s: number, squash: number, mood: number, time: number) {
  ctx.save();
  ctx.translate(x, y + Math.sin(time / 800) * 4);
  ctx.scale(1 - squash * 0.15, 1 + squash * 0.1);
  const body = () => {
    ctx.moveTo(-shape.w * 0.5 * s, 0.3 * s);
    for (const b of shape.bumps) ctx.arc(b.x * s, b.y * s, b.r * s, Math.PI, 0);
    ctx.lineTo(shape.w * 0.5 * s, 0.3 * s);
    // Base plate et douce
    ctx.ellipse(0, 0.3 * s, shape.w * 0.5 * s, 0.22 * s, 0, 0, Math.PI, false);
    ctx.closePath();
  };
  cut(ctx, body, shape.color, 6);
  // Ombre du bas
  ctx.save();
  ctx.beginPath();
  body();
  ctx.clip();
  ctx.fillStyle = shape.shade;
  ctx.fillRect(-shape.w * s, 0.32 * s, shape.w * 2 * s, s);
  ctx.restore();

  // Visage
  ctx.fillStyle = INK_SOLID;
  for (const ex of [-0.22, 0.22]) {
    ctx.beginPath();
    ctx.arc(ex * s, 0.02 * s, 0.05 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = INK_SOLID;
  ctx.lineWidth = Math.max(2, s * 0.035);
  ctx.lineCap = 'round';
  if (mood > 0.3) {
    // Surpris : bouche ronde
    ctx.beginPath();
    ctx.arc(0, 0.26 * s, 0.06 * s * mood, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // Grumpy: furrowed brows + pout
    ctx.beginPath();
    ctx.moveTo(-0.3 * s, -0.12 * s);
    ctx.lineTo(-0.14 * s, -0.06 * s);
    ctx.moveTo(0.3 * s, -0.12 * s);
    ctx.lineTo(0.14 * s, -0.06 * s);
    ctx.moveTo(-0.14 * s, 0.3 * s);
    ctx.quadraticCurveTo(0, 0.2 * s, 0.14 * s, 0.3 * s);
    ctx.stroke();
  }
  ctx.restore();
}

// ─── Sol et fleurs ───────────────────────────────────────────────────

export function drawHills(ctx: CanvasRenderingContext2D, w: number, h: number, unit: number) {
  cut(ctx, () => ctx.ellipse(w * 0.22, h * 1.02, w * 0.5, h * 0.22, 0, 0, Math.PI * 2), HILL_FAR, 5);
  cut(ctx, () => ctx.ellipse(w * 0.8, h * 1.04, w * 0.55, h * 0.2, 0, 0, Math.PI * 2), HILL_NEAR, 5);
  ctx.fillStyle = HILL_NEAR;
  ctx.fillRect(0, h * 0.93, w, h * 0.07);
  void unit;
}

/** Stem and leaf greens: darker than the near hill, so the flower stands out. */
const STEM = '#3f9f57';
const LEAF = '#2e8b4a';

/** Ease with a small overshoot: the flower head pops open. */
function backOut(u: number) {
  const c = 1.9;
  const v = u - 1;
  return 1 + (c + 1) * v * v * v + c * v * v;
}

/** A ring of `count` almond petals around the centre, rotated by `turn`. */
function petalRing(ctx: CanvasRenderingContext2D, count: number, dist: number, rx: number, ry: number, turn: number) {
  for (let i = 0; i < count; i++) {
    const a = turn + (i / count) * Math.PI * 2;
    const cx = Math.cos(a) * dist;
    const cy = Math.sin(a) * dist;
    // Separate sub-path per petal, so no connecting line fills a wedge.
    ctx.moveTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * rx);
    ctx.ellipse(cx, cy, rx, ry, a, 0, Math.PI * 2);
  }
}

/**
 * Paper flower: curved stem with two leaves, two rings of petals and a
 * smiling heart. `s` = head radius (px). `bloom` (0..1): the stem grows
 * first, then the head pops open while its petals unfold.
 */
export function drawFlower(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, bloom: number, time: number) {
  if (bloom <= 0) return;
  const grow = 1 - Math.pow(1 - clamp01(bloom / 0.45), 3);
  const open = clamp01((bloom - 0.35) / 0.65);
  const stemH = s * 2.1 * grow;
  const bend = s * 0.18;
  const shadow = Math.max(2, s * 0.08);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(time / 700 + x * 0.013) * 0.06);

  // Leaves, fastened to the stem (point of the stem's curve at `at`).
  const leaf = (side: 1 | -1, at: number, size: number) => {
    const len = s * size * grow;
    const lx = 2 * (1 - at) * at * bend;
    const ly = -stemH * at;
    cut(
      ctx,
      () => {
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(side === 1 ? -0.5 : Math.PI + 0.5);
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(len * 0.5, -len * 0.42, len, 0);
        ctx.quadraticCurveTo(len * 0.5, len * 0.42, 0, 0);
        ctx.restore();
      },
      LEAF,
      shadow,
    );
  };
  leaf(-1, 0.28, 0.9);
  leaf(1, 0.5, 0.75);

  // Stem, with its paper shadow.
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2, s * 0.14);
  const stem = () => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(bend * 2, -stemH * 0.5, 0, -stemH);
    ctx.stroke();
  };
  ctx.save();
  ctx.translate(shadow, shadow);
  ctx.strokeStyle = INK;
  stem();
  ctx.restore();
  ctx.strokeStyle = STEM;
  stem();

  ctx.translate(0, -stemH);
  if (open <= 0) {
    // Green bud while the stem grows.
    cut(ctx, () => ctx.arc(0, 0, s * 0.26 * grow, 0, Math.PI * 2), STEM, shadow * 0.6);
    ctx.restore();
    return;
  }
  ctx.rotate(Math.sin(time / 900 + x) * 0.08);
  const pop = backOut(open);
  ctx.scale(pop, pop);
  const twist = (1 - open) * 1.2;

  cut(ctx, () => petalRing(ctx, 8, s * 0.58, s * 0.42, s * 0.25, twist), color, shadow);
  ctx.fillStyle = mixHex(color, '#ffffff', 0.4);
  ctx.beginPath();
  petalRing(ctx, 8, s * 0.36, s * 0.26, s * 0.15, twist + Math.PI / 8);
  ctx.fill();

  // Heart with a little face, like the sun's.
  cut(ctx, () => ctx.arc(0, 0, s * 0.3, 0, Math.PI * 2), SUN, shadow * 0.6);
  if (s >= 14) {
    ctx.fillStyle = INK_SOLID;
    for (const ex of [-0.11, 0.11]) {
      ctx.beginPath();
      ctx.arc(ex * s, -s * 0.05, s * 0.038, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = INK_SOLID;
    ctx.lineWidth = Math.max(1.5, s * 0.035);
    ctx.beginPath();
    ctx.arc(0, s * 0.03, s * 0.1, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 107, 107, 0.55)';
    for (const cx of [-0.19, 0.19]) {
      ctx.beginPath();
      ctx.arc(cx * s, s * 0.07, s * 0.045, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Souffle visible : traits de vent qui poussent le nuage depuis la gauche. */
export function drawWind(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, power: number, time: number) {
  if (power < 0.08) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(3, s * 0.04);
  ctx.globalAlpha = Math.min(1, power * 1.5);
  for (let i = 0; i < 3; i++) {
    const phase = ((time / 220 + i * 0.33) % 1) * s * 0.5;
    const yy = y + (i - 1) * s * 0.28;
    const xx = x - s * 1.5 + phase;
    ctx.beginPath();
    ctx.moveTo(xx, yy);
    ctx.lineTo(xx + s * 0.35, yy);
    ctx.stroke();
  }
  ctx.restore();
}
