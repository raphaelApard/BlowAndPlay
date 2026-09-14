/**
 * Cut-paper drawing of Bulles de savon: garden, bubble wand, iridescent
 * bubbles. Pure functions on a 2D canvas, shared between the game
 * et la vignette.
 */

import { cut } from '../_shared/canvas';

// Re-exported so that the game, its simulation and its thumbnail keep a
// single entry point: `./draw`.
export { clamp01, seeded } from '../_shared/math';
export { INK, cut } from '../_shared/canvas';

export const INK_SOLID = '#23324a';
export const SKY_TOP = '#5ec2f0';
export const SKY_BOT = '#d7f0fb';
export const HILL = '#8fd07a';
export const HILL_DARK = '#5cb95f';
export const SUN = '#ffd93d';
export const CORAL = '#ff6b6b';
export const WAND = '#ff9a4d';
export const WAND_RING = '#9d7bef';
export const SKIN = '#ffb08a';
export const SHIRT = '#6bcb77';
export const RAINBOW = ['#ff6b6b', '#ff9a4d', '#ffd93d', '#6bcb77', '#5ec2f0', '#9d7bef'];
export const PETALS = ['#ff6b6b', '#ff9a4d', '#9d7bef', '#ff7fb1', '#5ec2f0'];

// ─── Scenery ─────────────────────────────────────────────────────────

export function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, SKY_TOP);
  g.addColorStop(1, SKY_BOT);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export function drawSun(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  cut(ctx, () => ctx.arc(x, y, r, 0, Math.PI * 2), SUN, 6);
}

export function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  cut(
    ctx,
    () => {
      ctx.moveTo(x - 60 * s, y);
      ctx.arc(x - 30 * s, y, 26 * s, Math.PI, 0);
      ctx.arc(x + 8 * s, y - 6 * s, 34 * s, Math.PI, 0);
      ctx.arc(x + 46 * s, y, 22 * s, Math.PI, 0);
      ctx.lineTo(x + 68 * s, y + 12 * s);
      ctx.lineTo(x - 60 * s, y + 12 * s);
      ctx.closePath();
    },
    '#fff',
    3,
  );
}

/** Jardin : deux collines et une bordure de fleurs. */
export function drawGarden(ctx: CanvasRenderingContext2D, w: number, h: number, groundY: number, unit: number, time: number) {
  cut(ctx, () => ctx.ellipse(w * 0.8, h * 1.08, w * 0.6, h * 0.3, 0, 0, Math.PI * 2), HILL, 5);
  cut(ctx, () => ctx.ellipse(w * 0.2, groundY + h * 0.2, w * 0.55, h * 0.22, 0, 0, Math.PI * 2), HILL_DARK, 5);
  ctx.fillStyle = HILL_DARK;
  ctx.fillRect(0, h * 0.94, w, h * 0.06);
  for (let i = 0; i < 8; i++) {
    const x = w * (0.3 + i * 0.09);
    const y = groundY + h * 0.03 + Math.sin(i * 1.7) * h * 0.015;
    drawFlower(ctx, x, y, (9 + (i % 3) * 2) * unit, PETALS[i % PETALS.length], time);
  }
}

export function drawFlower(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, time: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(time / 800 + x) * 0.05);
  ctx.strokeStyle = '#3f9f57';
  ctx.lineWidth = Math.max(2, s * 0.14);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -s * 1.5);
  ctx.stroke();
  ctx.translate(0, -s * 1.5);
  cut(
    ctx,
    () => {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.moveTo(Math.cos(a) * s * 0.45, Math.sin(a) * s * 0.45);
        ctx.arc(Math.cos(a) * s * 0.45, Math.sin(a) * s * 0.45, s * 0.3, 0, Math.PI * 2);
      }
    },
    color,
    3,
  );
  ctx.fillStyle = SUN;
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.26, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ─── Enfant et baguette ──────────────────────────────────────────────

/**
 * The child in profile, at the bottom left, holding the wand in front of
 * bouche. Origine = pieds. Renvoie le centre de l'anneau de la baguette.
 */
export function drawKid(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, blowing: number, time: number): { x: number; y: number; r: number } {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const bob = Math.sin(time / 700) * 1.5;
  cut(ctx, () => ctx.roundRect(-14, -34, 11, 34, 4), INK_SOLID, 3);
  cut(ctx, () => ctx.roundRect(3, -34, 11, 34, 4), INK_SOLID, 3);
  cut(ctx, () => ctx.roundRect(-18, -78 + bob, 36, 48, 10), SHIRT);
  cut(ctx, () => ctx.arc(0, -98 + bob, 22, 0, Math.PI * 2), SKIN);
  cut(
    ctx,
    () => {
      ctx.arc(0, -104 + bob, 22, Math.PI * 1.05, Math.PI * 1.95);
      ctx.closePath();
    },
    '#5c3a21',
    2,
  );
  ctx.fillStyle = INK_SOLID;
  ctx.beginPath();
  ctx.arc(10, -100 + bob, 2.6, 0, Math.PI * 2);
  ctx.fill();
  // Bouche : ronde quand il souffle
  ctx.strokeStyle = INK_SOLID;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  if (blowing > 0.15) ctx.arc(18, -91 + bob, 2 + blowing * 2.5, 0, Math.PI * 2);
  else ctx.arc(11, -92 + bob, 5, 0.2, Math.PI * 0.8);
  ctx.stroke();
  // Bras + baguette : le bras tient le manche, l'anneau est devant la bouche
  ctx.save();
  ctx.translate(14, -66 + bob);
  ctx.rotate(-0.55);
  cut(ctx, () => ctx.roundRect(0, -6, 30, 12, 6), SHIRT, 3);
  cut(ctx, () => ctx.arc(32, 0, 8, 0, Math.PI * 2), SKIN, 2);
  ctx.restore();
  ctx.restore();
  // Wand (in screen coordinates)
  const hx = x + (14 + Math.cos(-0.55) * 32) * s;
  const hy = y + (-66 + bob + Math.sin(-0.55) * 32) * s;
  const ringX = x + 62 * s;
  const ringY = y + (-91 + bob) * s;
  ctx.save();
  ctx.strokeStyle = WAND;
  ctx.lineWidth = 5 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(ringX - 12 * s, ringY);
  ctx.stroke();
  ctx.strokeStyle = WAND_RING;
  ctx.lineWidth = 4.5 * s;
  ctx.beginPath();
  ctx.ellipse(ringX, ringY, 6 * s, 14 * s, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  return { x: ringX, y: ringY, r: 14 * s };
}

// ─── Bulles ──────────────────────────────────────────────────────────

/**
 * Iridescent bubble: translucent disc, rainbow rim, highlight.
 * `wobble` (0..1) deforms it; `face` draws a small happy face.
 */
export function drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, wobble: number, time: number, face = false) {
  if (r <= 2) return;
  ctx.save();
  ctx.translate(x, y);
  const wob = wobble * 0.18;
  ctx.scale(1 + Math.sin(time / 90) * wob, 1 - Math.sin(time / 90) * wob);
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  g.addColorStop(0, 'rgba(255,255,255,0.35)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0.3)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  const rim = ctx.createLinearGradient(-r, -r, r, r);
  RAINBOW.forEach((c, i) => rim.addColorStop(i / (RAINBOW.length - 1), c));
  ctx.strokeStyle = rim;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = Math.max(2, r * 0.07);
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(1, r - ctx.lineWidth / 2), 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.4, -r * 0.42, r * 0.2, r * 0.11, -0.7, 0, Math.PI * 2);
  ctx.fill();
  if (face) {
    ctx.fillStyle = INK_SOLID;
    ctx.beginPath();
    ctx.arc(-r * 0.22, -r * 0.05, r * 0.07, 0, Math.PI * 2);
    ctx.arc(r * 0.22, -r * 0.05, r * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK_SOLID;
    ctx.lineWidth = Math.max(2, r * 0.07);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, r * 0.1, r * 0.22, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }
  ctx.restore();
}

/** Target: dashed circle of the size to reach. */
export function drawTarget(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, reached: number, time: number) {
  ctx.save();
  ctx.setLineDash([8, 10]);
  ctx.lineDashOffset = -time / 30;
  ctx.strokeStyle = reached >= 1 ? SUN : 'rgba(255,255,255,0.85)';
  ctx.lineWidth = reached >= 1 ? 5 : 3;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Pop: widening ring + droplets. */
export function drawPop(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, u: number) {
  ctx.save();
  ctx.globalAlpha = 1 - u;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, r * (1 + u * 0.6), 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const d = r * (1 + u * 1.4);
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d + u * u * 40, 5 * (1 - u) + 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Souffle visible : traits de vent de la bouche vers la bulle. */
export function drawWind(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, power: number, time: number) {
  if (power < 0.08) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2, s * 0.2);
  ctx.globalAlpha = Math.min(1, power * 1.5);
  for (let i = 0; i < 3; i++) {
    const phase = ((time / 220 + i * 0.33) % 1) * s * 2;
    const yy = y + (i - 1) * s * 0.6;
    const xx = x + phase;
    ctx.beginPath();
    ctx.moveTo(xx, yy);
    ctx.lineTo(xx + s * 0.8, yy);
    ctx.stroke();
  }
  ctx.restore();
}
