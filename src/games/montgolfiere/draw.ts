/**
 * Cut-paper drawing of Montgolfière: sky, hills, ground, obstacles, balloon,
 * arrival platform. Pure functions on a 2D canvas, shared between the game
 * and the thumbnail.
 */

import { seeded } from '../_shared/math';
import { INK, cut } from '../_shared/canvas';

// Re-exported so that the game, its simulation and its thumbnail keep a
// single entry point: `./draw`.
export { clamp01, seeded } from '../_shared/math';
export { INK, cut } from '../_shared/canvas';

export const SKY_TOP = '#5ec2f0';
export const SKY_BOT = '#c9ecfb';
export const HILL_FAR = '#a9dcf4';
export const HILL_NEAR = '#8fd07a';
export const GRASS = '#5cb95f';
export const GRASS_DARK = '#3f9f57';
export const SUN = '#ffd93d';
export const CORAL = '#ff6b6b';
export const INK_SOLID = '#23324a';
export const WOOD = '#a8703f';
export const WOOD_DARK = '#8b5a2b';
export const ROCK = '#8fa3b8';
export const ROCK_DARK = '#6d819a';
export const WALL = '#f6dfa4';
export const ROOF = '#ff8a65';
export const FLAME = '#ff9a4d';
export const FLAME_CORE = '#fff1a8';

// ─── Scenery ─────────────────────────────────────────────────────────

export function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, SKY_TOP);
  g.addColorStop(1, SKY_BOT);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export interface Cloud {
  x: number;
  y: number;
  s: number;
}
export function makeClouds(count: number, seed: number, spanPx: number): Cloud[] {
  const rand = seeded(seed);
  return Array.from({ length: count }, () => ({ x: rand() * spanPx, y: 0.08 + rand() * 0.35, s: 0.7 + rand() * 0.8 }));
}

/** Nuage en papier : trois bosses sur une base. */
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

/** Distant hills: repeated humps, scrolling in parallax. */
export function drawHills(ctx: CanvasRenderingContext2D, w: number, groundY: number, offset: number, unit: number, color: string, amp: number, period: number) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, groundY + 4);
  const step = 12;
  for (let x = 0; x <= w + step; x += step) {
    const u = (x + offset) / (period * unit);
    const y = groundY - amp * unit * (0.55 + 0.45 * Math.sin(u * Math.PI * 2) * Math.cos(u * 1.3));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, groundY + 4);
  ctx.closePath();
  ctx.fill();
}

/** Sol : bande d'herbe avec touffes. */
export function drawGround(ctx: CanvasRenderingContext2D, w: number, h: number, groundY: number, offset: number, unit: number) {
  ctx.fillStyle = INK;
  ctx.fillRect(0, groundY + 4, w, h - groundY);
  ctx.fillStyle = GRASS;
  ctx.fillRect(0, groundY, w, h - groundY);
  ctx.fillStyle = GRASS_DARK;
  const step = 90 * unit;
  const start = -((offset % step) + step) % step;
  for (let x = start; x < w + step; x += step) {
    ctx.beginPath();
    ctx.ellipse(x, groundY + 22 * unit, 26 * unit, 8 * unit, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Obstacles ───────────────────────────────────────────────────────

export type ObstacleKind = 'tree' | 'rock' | 'house' | 'tower';
export const OBSTACLE_KINDS: ObstacleKind[] = ['tree', 'rock', 'house', 'tower'];

/**
 * An obstacle standing on the ground, drawn in a frame whose origin is its
 * foot (bottom centre). `w` and `h` in px; `wobble` in radians (shaken after
 * an impact).
 */
export function drawObstacle(ctx: CanvasRenderingContext2D, kind: ObstacleKind, x: number, groundY: number, w: number, h: number, wobble: number) {
  ctx.save();
  ctx.translate(x, groundY);
  ctx.rotate(wobble);
  const hw = w / 2;
  switch (kind) {
    case 'tree': {
      cut(ctx, () => ctx.rect(-hw * 0.18, -h * 0.55, hw * 0.36, h * 0.55), WOOD);
      const r = hw * 0.62;
      cut(ctx, () => ctx.arc(-hw * 0.4, -h * 0.5, r, 0, Math.PI * 2), GRASS_DARK);
      cut(ctx, () => ctx.arc(hw * 0.4, -h * 0.55, r, 0, Math.PI * 2), GRASS);
      cut(ctx, () => ctx.arc(0, -h + r, r * 1.05, 0, Math.PI * 2), HILL_NEAR);
      break;
    }
    case 'rock': {
      cut(
        ctx,
        () => {
          ctx.moveTo(-hw, 0);
          ctx.lineTo(-hw * 0.7, -h * 0.45);
          ctx.lineTo(-hw * 0.25, -h);
          ctx.lineTo(hw * 0.3, -h * 0.7);
          ctx.lineTo(hw * 0.75, -h * 0.5);
          ctx.lineTo(hw, 0);
          ctx.closePath();
        },
        ROCK,
      );
      ctx.fillStyle = ROCK_DARK;
      ctx.beginPath();
      ctx.moveTo(-hw * 0.25, -h);
      ctx.lineTo(hw * 0.3, -h * 0.7);
      ctx.lineTo(hw * 0.75, -h * 0.5);
      ctx.lineTo(hw * 0.2, -h * 0.35);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'house': {
      const body = h * 0.6;
      cut(ctx, () => ctx.rect(-hw * 0.8, -body, hw * 1.6, body), WALL);
      cut(
        ctx,
        () => {
          ctx.moveTo(-hw, -body);
          ctx.lineTo(0, -h);
          ctx.lineTo(hw, -body);
          ctx.closePath();
        },
        ROOF,
      );
      cut(ctx, () => ctx.rect(hw * 0.35, -h * 0.92, hw * 0.22, h * 0.2), WOOD_DARK, 2);
      ctx.fillStyle = INK_SOLID;
      ctx.fillRect(-hw * 0.18, -body * 0.55, hw * 0.36, body * 0.55);
      ctx.fillStyle = SUN;
      ctx.fillRect(-hw * 0.65, -body * 0.85, hw * 0.3, body * 0.3);
      break;
    }
    case 'tower': {
      cut(ctx, () => ctx.rect(-hw * 0.6, -h * 0.88, hw * 1.2, h * 0.88), ROCK);
      // Battlements
      for (let i = -1; i <= 1; i++) cut(ctx, () => ctx.rect(i * hw * 0.42 - hw * 0.14, -h, hw * 0.28, h * 0.14), ROCK, 2);
      ctx.fillStyle = INK_SOLID;
      ctx.beginPath();
      ctx.arc(0, -h * 0.5, hw * 0.18, Math.PI, 0);
      ctx.rect(-hw * 0.18, -h * 0.5, hw * 0.36, h * 0.18);
      ctx.fill();
      // Fanion
      ctx.fillStyle = CORAL;
      ctx.beginPath();
      ctx.moveTo(0, -h - hw * 0.5);
      ctx.lineTo(hw * 0.4, -h - hw * 0.32);
      ctx.lineTo(0, -h - hw * 0.14);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = INK_SOLID;
      ctx.fillRect(-1.5, -h - hw * 0.5, 3, hw * 0.5);
      break;
    }
  }
  ctx.restore();
}

// ─── Arrival platform ────────────────────────────────────────────────

/** Wooden jetty; with `pole`, a mast whose flag is raised by `flag` (0..1). */
export function drawPad(ctx: CanvasRenderingContext2D, x: number, groundY: number, unit: number, pole: boolean, flag: number, time: number) {
  ctx.save();
  ctx.translate(x, groundY);
  ctx.scale(unit, unit);
  cut(ctx, () => ctx.roundRect(-70, -12, 140, 16, 5), WOOD);
  ctx.fillStyle = WOOD_DARK;
  for (let i = -2; i <= 2; i++) ctx.fillRect(i * 28 - 2, -12, 4, 16);
  // Mast and flag
  if (!pole) {
    ctx.restore();
    return;
  }
  ctx.fillStyle = INK_SOLID;
  ctx.fillRect(58, -110, 4, 98);
  if (flag > 0) {
    const fy = -108 + (1 - flag) * 60;
    const wave = Math.sin(time / 180) * 3;
    cut(
      ctx,
      () => {
        ctx.moveTo(62, fy);
        ctx.quadraticCurveTo(80, fy - 4 + wave, 98, fy + 6);
        ctx.lineTo(62, fy + 22);
        ctx.closePath();
      },
      CORAL,
      2,
    );
  }
  ctx.restore();
}

// ─── Ballon ──────────────────────────────────────────────────────────

/** Rayon de l'enveloppe → distance du centre au bas de la nacelle. */
export const BASKET_DROP = 2.4;

/**
 * The hot-air balloon: striped yellow envelope, ropes, basket, flame.
 * Origine = centre de l'enveloppe. `r` = rayon ; `power` (0..1) = flamme ;
 * `tilt` = inclinaison (radians).
 */
export function drawBalloon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, power: number, tilt: number, time: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);

  const envelope = () => {
    ctx.moveTo(0, -r * 1.15);
    ctx.bezierCurveTo(r * 1.35, -r * 1.15, r * 1.1, r * 0.75, r * 0.32, r * 1.55);
    ctx.lineTo(-r * 0.32, r * 1.55);
    ctx.bezierCurveTo(-r * 1.1, r * 0.75, -r * 1.35, -r * 1.15, 0, -r * 1.15);
    ctx.closePath();
  };

  // Ropes (behind the basket)
  ctx.strokeStyle = INK_SOLID;
  ctx.lineWidth = Math.max(1.5, r * 0.06);
  ctx.beginPath();
  ctx.moveTo(-r * 0.3, r * 1.5);
  ctx.lineTo(-r * 0.38, r * 2.05);
  ctx.moveTo(r * 0.3, r * 1.5);
  ctx.lineTo(r * 0.38, r * 2.05);
  ctx.stroke();

  // Envelope + cut-out stripes
  cut(ctx, envelope, SUN, Math.max(3, r * 0.1));
  ctx.save();
  ctx.beginPath();
  envelope();
  ctx.clip();
  ctx.fillStyle = CORAL;
  ctx.fillRect(-r * 0.22, -r * 1.3, r * 0.44, r * 3);
  ctx.fillRect(-r * 1.4, -r * 1.3, r * 0.5, r * 3);
  ctx.fillRect(r * 0.9, -r * 1.3, r * 0.5, r * 3);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.5, -r * 0.6, r * 0.22, r * 0.4, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Flamme (entre enveloppe et nacelle)
  if (power > 0.04) {
    const fl = r * (0.22 + power * 0.5);
    const flick = 1 + Math.sin(time / 45) * 0.12;
    ctx.save();
    ctx.translate(0, r * 2.02);
    ctx.scale(1, -1);
    ctx.fillStyle = FLAME;
    ctx.beginPath();
    ctx.moveTo(-r * 0.22, 0);
    ctx.quadraticCurveTo(-r * 0.2, fl * 0.7 * flick, 0, fl * flick);
    ctx.quadraticCurveTo(r * 0.2, fl * 0.7 * flick, r * 0.22, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = FLAME_CORE;
    ctx.beginPath();
    ctx.moveTo(-r * 0.1, 0);
    ctx.quadraticCurveTo(-r * 0.1, fl * 0.4, 0, fl * 0.55 * flick);
    ctx.quadraticCurveTo(r * 0.1, fl * 0.4, r * 0.1, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Nacelle
  cut(ctx, () => ctx.roundRect(-r * 0.42, r * 2.02, r * 0.84, r * 0.38, r * 0.08), WOOD_DARK, 3);
  ctx.fillStyle = WOOD;
  ctx.fillRect(-r * 0.42, r * 2.12, r * 0.84, r * 0.06);
  ctx.restore();
}

/** Souffle visible : traits de vent sous la nacelle quand on souffle. */
export function drawWind(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, power: number, time: number) {
  if (power < 0.08) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2, r * 0.07);
  ctx.globalAlpha = Math.min(1, power * 1.5);
  for (let i = 0; i < 3; i++) {
    const phase = ((time / 260 + i * 0.33) % 1) * r * 0.9;
    const yy = y + r * 2.5 + phase;
    const xx = x + (i - 1) * r * 0.5;
    ctx.beginPath();
    ctx.moveTo(xx, yy);
    ctx.lineTo(xx, yy + r * 0.45);
    ctx.stroke();
  }
  ctx.restore();
}
