/**
 * Cut-paper drawing of Bonhomme gonflable: the forecourt, the air dancer and
 * its friends. Pure functions on a 2D canvas, shared between the game and the
 * thumbnail.
 */

import { cut } from '../_shared/canvas';

// Re-exported so that the game, its simulation and its thumbnail keep a
// single entry point: `./draw`.
export { clamp01, lerp, seeded } from '../_shared/math';
export { INK, cut } from '../_shared/canvas';

export const INK_SOLID = '#23324a';
export const SKY_TOP = '#5ec2f0';
export const SKY_BOT = '#ffe6c7';
export const GROUND = '#8fd07a';
export const GROUND_DARK = '#5cb95f';
export const SUN = '#ffd93d';
export const BODY_COLORS = ['#ff6b6b', '#ffd93d', '#6bcb77', '#9d7bef', '#5ec2f0'];
export const BASE = '#7a8aa0';

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

export function drawGround(ctx: CanvasRenderingContext2D, w: number, h: number, groundY: number, unit: number) {
  cut(ctx, () => ctx.ellipse(w * 0.5, groundY + h * 0.3, w * 0.8, h * 0.32, 0, 0, Math.PI * 2), GROUND, 5);
  ctx.fillStyle = GROUND_DARK;
  ctx.fillRect(0, h * 0.93, w, h * 0.07);
  ctx.save();
  ctx.strokeStyle = GROUND_DARK;
  ctx.lineWidth = 3 * unit;
  ctx.lineCap = 'round';
  for (let i = 0; i < 11; i++) {
    const x = w * (0.03 + i * 0.09);
    const y = groundY + 26 * unit + Math.sin(i * 1.9) * 10 * unit;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 5 * unit, y - 13 * unit);
    ctx.moveTo(x, y);
    ctx.lineTo(x + 6 * unit, y - 11 * unit);
    ctx.stroke();
  }
  ctx.restore();
}

// ─── Bonhomme ────────────────────────────────────────────────────────

/**
 * The air dancer. Origin = its base on the ground. `height` (0..1) is how
 * far it has unfolded; below ~0.2 it is a puddle of fabric, at 1 it stands
 * tall and waves. `t` animates the wobble, which only reads once it is up.
 */
export function drawDancer(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, height: number, t: number) {
  const h = Math.max(0.04, height);
  const tall = 210 * s * h;
  // The wobble grows with the height: a flopped figure barely stirs.
  const sway = Math.sin(t / 240) * 0.3 * h;
  const lean = Math.sin(t / 380) * 0.12 * h;

  ctx.save();
  ctx.translate(x, y);

  // Socle
  cut(ctx, () => ctx.ellipse(0, 0, 44 * s, 15 * s, 0, 0, Math.PI * 2), BASE, 4);

  ctx.save();
  ctx.translate(0, -10 * s);
  ctx.rotate(lean);

  // Tube body: a tapering ribbon that bends as it rises.
  const segs = 7;
  const wBase = 40 * s;
  ctx.beginPath();
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const yy = -tall * u;
    const bend = Math.sin(t / 240 + u * 3) * 26 * s * h * u;
    const ww = wBase * (1 - u * 0.35);
    left.push([bend - ww / 2, yy]);
    right.push([bend + ww / 2, yy]);
  }
  cut(
    ctx,
    () => {
      ctx.moveTo(left[0][0], left[0][1]);
      for (const [lx, ly] of left) ctx.lineTo(lx, ly);
      for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
      ctx.closePath();
    },
    color,
    5,
  );

  // Arms: they only fly out once the figure is up.
  const armUp = Math.max(0, h - 0.35) / 0.65;
  if (armUp > 0.02) {
    const shoulder = Math.max(0, segs - 2);
    const [hx, hy] = left[shoulder];
    const [rx, ry] = right[shoulder];
    for (const [ax, ay, dir] of [
      [hx, hy, -1],
      [rx, ry, 1],
    ] as [number, number, number][]) {
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(dir * (0.5 + sway * dir) * armUp);
      cut(ctx, () => ctx.roundRect(dir < 0 ? -58 * s * armUp : 0, -9 * s, 58 * s * armUp, 18 * s, 9 * s), color, 3);
      ctx.restore();
    }
  }

  // Face at the top, once there is a head to put it on.
  if (h > 0.45) {
    const [tx, ty] = [(left[segs][0] + right[segs][0]) / 2, left[segs][1]];
    const fade = Math.min(1, (h - 0.45) / 0.25);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = INK_SOLID;
    ctx.beginPath();
    ctx.arc(tx - 9 * s, ty + 30 * s, 4 * s, 0, Math.PI * 2);
    ctx.arc(tx + 9 * s, ty + 30 * s, 4 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK_SOLID;
    ctx.lineWidth = 3 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(tx, ty + 38 * s, 9 * s, 0.15, Math.PI - 0.15);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
  ctx.restore();
}

/** Jauge d'air : le tuyau qui souffle dans le bonhomme. */
export function drawBlower(ctx: CanvasRenderingContext2D, x: number, y: number, unit: number, power: number) {
  if (power < 0.06) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(3, 5 * unit);
  ctx.globalAlpha = Math.min(1, power * 1.6);
  for (let i = 0; i < 3; i++) {
    const r = (22 + i * 16) * unit;
    ctx.beginPath();
    ctx.arc(x, y, r, -2.4, -0.7);
    ctx.stroke();
  }
  ctx.restore();
}

/** Petites notes de joie quand un bonhomme tient debout. */
export function drawCheer(ctx: CanvasRenderingContext2D, x: number, y: number, unit: number, progress: number) {
  ctx.save();
  ctx.globalAlpha = 1 - progress;
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.4;
    const d = progress * 80 * unit;
    cut(ctx, () => ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 6 * unit, 0, Math.PI * 2), BODY_COLORS[i % BODY_COLORS.length], 0);
  }
  ctx.restore();
}
