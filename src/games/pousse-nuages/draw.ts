/**
 * Dessin « papier découpé » de Pousse-nuages : ciel, soleil à visage,
 * nuages boudeurs, collines fleuries. Fonctions pures sur un canvas 2D,
 * partagées entre le jeu et la vignette.
 */

import { seeded, mixHex } from '../_shared/math';
import { cut } from '../_shared/canvas';

// Réexportés pour que le jeu, sa simulation et sa vignette gardent
// un seul point d'entrée : `./draw`.
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

/** Le ciel s'éclaircit avec `bright` (0 = couvert, 1 = grand soleil). */
export function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number, bright: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, mixHex('#4aa3d8', SKY_TOP, bright));
  g.addColorStop(1, mixHex('#a9d3ea', SKY_BOT, bright));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/**
 * Soleil à visage. `bright` (0..1) : pâle et boudeur derrière les nuages,
 * éclatant et souriant à la fin. `spin` : rotation des rayons.
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

/** Silhouettes de nuages : joufflu, allongé, haut, orageux (dentelé). */
export type CloudKind = 'puffy' | 'long' | 'tall' | 'storm';
const CLOUD_KINDS: CloudKind[] = ['puffy', 'long', 'tall', 'storm'];

/** Couleurs de nuages : [corps, ombre du bas]. */
export const CLOUD_COLORS: [string, string][] = [
  ['#ffffff', '#dfe9f2'], // blanc
  ['#b9c6d4', '#94a5b8'], // gris orage
  ['#ffd6e0', '#f5b3c4'], // rose
  ['#e4d9ff', '#c7b8f5'], // lavande
  ['#d6f0ff', '#b1dcf5'], // bleu pâle
  ['#fff3c4', '#f5df95'], // crème
];

/** Bosses d'un nuage (positions relatives, rayons) — fixes pour une forme donnée. */
export interface CloudShape {
  kind: CloudKind;
  bumps: { x: number; y: number; r: number }[];
  /** Largeur totale relative (pour le hors-écran). */
  w: number;
  h: number;
  color: string;
  shade: string;
}

/**
 * Forme et couleur du nuage n° `index` : silhouette et teinte tournent
 * pour que deux nuages qui se suivent soient toujours différents.
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
          // Dentelé : une bosse sur deux est plus haute et plus petite
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
 * Nuage boudeur. `s` = échelle (px pour 1 unité de forme), `squash` (0..1)
 * l'écrase horizontalement quand on le pousse, `mood` : -1 grognon → +1 surpris.
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
    // Grognon : sourcils froncés + moue
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

/** Fleur en papier : tige, pétales, cœur. `bloom` (0..1) = éclosion. */
export function drawFlower(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, bloom: number, time: number) {
  if (bloom <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  const sway = Math.sin(time / 700 + x) * 0.05;
  ctx.rotate(sway);
  ctx.strokeStyle = '#3f9f57';
  ctx.lineWidth = Math.max(2, s * 0.12);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -s * 1.4 * bloom);
  ctx.stroke();
  ctx.translate(0, -s * 1.4 * bloom);
  const pop = bloom < 1 ? 1.2 * bloom : 1;
  ctx.scale(pop, pop);
  cut(
    ctx,
    () => {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.moveTo(Math.cos(a) * s * 0.45, Math.sin(a) * s * 0.45);
        ctx.arc(Math.cos(a) * s * 0.45, Math.sin(a) * s * 0.45, s * 0.32, 0, Math.PI * 2);
      }
    },
    color,
    3,
  );
  ctx.fillStyle = SUN;
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.28, 0, Math.PI * 2);
  ctx.fill();
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
