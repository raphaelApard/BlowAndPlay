/**
 * Cut-paper drawing of Oiseau voyageur: the lake, the poles, the bird and the
 * wind corridor it has to stay inside. Pure functions on a 2D canvas, shared
 * between the game and the thumbnail.
 */

import { cut } from '../_shared/canvas';

// Re-exported so that the game, its simulation and its thumbnail keep a
// single entry point: `./draw`.
export { clamp01, lerp, seeded } from '../_shared/math';
export { INK, cut } from '../_shared/canvas';

export const INK_SOLID = '#23324a';
export const SKY_TOP = '#7fd0f5';
export const SKY_BOT = '#e3f4fb';
export const WATER_TOP = '#4bb4e8';
export const WATER_BOT = '#2477b8';
export const HILL_FAR = '#9fd9a8';
export const HILL_NEAR = '#6bcb77';
export const POLE = '#b5793f';
export const POLE_DARK = '#8d5a2b';
export const BIRD = '#ff9a4d';
export const BIRD_DARK = '#e8762a';
export const WING = '#ffd93d';
export const BEAK = '#ff6b6b';
export const CORRIDOR = '#ffffff';
export const CLOUD = '#ffffff';

// ─── Scenery ─────────────────────────────────────────────────────────

export function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, SKY_TOP);
  g.addColorStop(1, SKY_BOT);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  cut(
    ctx,
    () => {
      ctx.ellipse(x, y, 46 * s, 24 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(x - 34 * s, y + 6 * s, 28 * s, 17 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 34 * s, y + 7 * s, 31 * s, 18 * s, 0, 0, Math.PI * 2);
    },
    CLOUD,
    5,
  );
}

/** Rolling hills behind the lake, scrolled by `offset` with a parallax. */
export function drawHills(ctx: CanvasRenderingContext2D, w: number, horizon: number, offset: number, unit: number, color: string, amp: number, period: number) {
  cut(
    ctx,
    () => {
      ctx.moveTo(-10, horizon + 40 * unit);
      for (let x = -10; x <= w + 10; x += 12) {
        const y = horizon - (Math.sin((x + offset) / period) * 0.5 + 0.5) * amp * unit;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w + 10, horizon + 40 * unit);
      ctx.closePath();
    },
    color,
    5,
  );
}

/** The lake below the horizon, with slow ripples. */
export function drawWater(ctx: CanvasRenderingContext2D, w: number, h: number, horizon: number, unit: number, time: number) {
  const g = ctx.createLinearGradient(0, horizon, 0, h);
  g.addColorStop(0, WATER_TOP);
  g.addColorStop(1, WATER_BOT);
  ctx.fillStyle = g;
  ctx.fillRect(0, horizon, w, h - horizon);

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineCap = 'round';
  ctx.lineWidth = 3 * unit;
  for (let i = 0; i < 6; i++) {
    const y = horizon + ((i + 1) / 7) * (h - horizon);
    const drift = Math.sin(time / 1500 + i) * 26 * unit;
    ctx.beginPath();
    for (let x = -30; x <= w + 30; x += 18) {
      const yy = y + Math.sin((x + drift) / 95 + i * 1.4) * 4 * unit;
      if (x === -30) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// ─── Poteaux ─────────────────────────────────────────────────────────

/**
 * A pole standing in the lake: the post, its reflection and a little perch
 * board on top. `glow` (0..1) lights the pole the bird is heading for.
 */
export function drawPole(ctx: CanvasRenderingContext2D, x: number, topY: number, waterY: number, unit: number, glow: number, time: number) {
  const wdt = 17 * unit;

  if (glow > 0) {
    const g = ctx.createRadialGradient(x, topY, wdt, x, topY, 90 * unit);
    g.addColorStop(0, `rgba(255, 217, 61, ${0.5 * glow})`);
    g.addColorStop(1, 'rgba(255, 217, 61, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, topY, 90 * unit, 0, Math.PI * 2);
    ctx.fill();
  }

  // Reflection in the water, wobbling with the ripples.
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = INK_SOLID;
  const wob = Math.sin(time / 700 + x / 90) * 3 * unit;
  ctx.fillRect(x - wdt / 2 + wob, waterY, wdt, 46 * unit);
  ctx.restore();

  // Post, from the perch down into the water.
  cut(ctx, () => ctx.rect(x - wdt / 2, topY, wdt, waterY - topY + 8 * unit), POLE, 4);
  // Grain: two darker bands so the post is not a flat rectangle.
  ctx.save();
  ctx.fillStyle = POLE_DARK;
  ctx.globalAlpha = 0.5;
  ctx.fillRect(x + wdt * 0.12, topY, wdt * 0.28, waterY - topY + 8 * unit);
  ctx.restore();

  // Perch board on top.
  cut(ctx, () => ctx.roundRect(x - 27 * unit, topY - 9 * unit, 54 * unit, 13 * unit, 5 * unit), POLE_DARK, 4);
}

// ─── Couloir de vent ─────────────────────────────────────────────────

/**
 * The safe corridor, drawn as two soft banks of wind closing in from the
 * water and from the sky. This is the whole instruction of the game, given
 * without a word: stay in the clear lane, blow harder to rise, softer to
 * sink. `alpha` fades the whole thing — used to keep a level's own guide
 * lane visible but faint outside of flight, next to the real, fixed bounds.
 */
export function drawCorridor(ctx: CanvasRenderingContext2D, w: number, topY: number, botY: number, unit: number, time: number, danger: number, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  // Danger tints the edges coral as the bird nears them.
  const edge = `rgba(255, 107, 107, ${0.15 + danger * 0.45})`;

  for (const [y, dir] of [[topY, -1], [botY, 1]] as const) {
    const g = ctx.createLinearGradient(0, y, 0, y + dir * 70 * unit);
    g.addColorStop(0, edge);
    g.addColorStop(1, 'rgba(255, 107, 107, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, dir < 0 ? y - 70 * unit : y, w, 70 * unit);

    ctx.strokeStyle = `rgba(255, 255, 255, ${0.55 + danger * 0.35})`;
    ctx.lineWidth = 4 * unit;
    ctx.setLineDash([16 * unit, 13 * unit]);
    ctx.lineDashOffset = -time / 26;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();
}

/** Wind streaks inside the corridor: they show the bird is being carried on. */
export function drawWind(ctx: CanvasRenderingContext2D, w: number, topY: number, botY: number, unit: number, time: number, strength: number) {
  if (strength <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = 0.3 * strength;
  ctx.strokeStyle = CORRIDOR;
  ctx.lineCap = 'round';
  ctx.lineWidth = 4 * unit;
  for (let i = 0; i < 7; i++) {
    const y = topY + ((i + 0.5) / 7) * (botY - topY);
    const len = (60 + ((i * 37) % 50)) * unit;
    const x = ((time / 2.2 + i * 260) % (w + 300 * unit)) - 150 * unit;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.stroke();
  }
  ctx.restore();
}

// ─── Oiseau ──────────────────────────────────────────────────────────

/**
 * The bird, seen from the side. Origin = its feet. `flap` drives the wing
 * beat, `tilt` banks it with its climb or dive.
 */
export function drawBird(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, flap: number, tilt: number, time: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(s, s);

  // Tail
  cut(
    ctx,
    () => {
      ctx.moveTo(-16, -18);
      ctx.lineTo(-34, -26);
      ctx.lineTo(-33, -12);
      ctx.closePath();
    },
    BIRD_DARK,
    3,
  );

  // Corps
  cut(ctx, () => ctx.ellipse(0, -20, 20, 15, 0, 0, Math.PI * 2), BIRD, 4);

  // Far wing, then the near one: the beat reads better with two.
  const beat = Math.sin(flap) * 0.9;
  for (const [dir, color] of [[0.6, BIRD_DARK], [1, WING]] as const) {
    ctx.save();
    ctx.translate(-2, -24);
    ctx.rotate(beat * dir - 0.25);
    cut(ctx, () => ctx.ellipse(-4, 0, 17 * dir, 8 * dir, 0.2, 0, Math.PI * 2), color, 3);
    ctx.restore();
  }

  // Head
  cut(ctx, () => ctx.arc(16, -30, 11, 0, Math.PI * 2), BIRD, 3);
  // Bec
  cut(
    ctx,
    () => {
      ctx.moveTo(25, -32);
      ctx.lineTo(38, -28);
      ctx.lineTo(25, -25);
      ctx.closePath();
    },
    BEAK,
    2,
  );
  // Œil
  const blink = Math.sin(time / 1700) > 0.95 ? 0.15 : 1;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(19, -33, 4.5, 4.5 * blink, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK_SOLID;
  ctx.beginPath();
  ctx.ellipse(20, -33, 2.2, 2.2 * blink, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ─── Retours ─────────────────────────────────────────────────────────

/** Splash when the bird drops into the lake. */
export function drawSplash(ctx: CanvasRenderingContext2D, x: number, y: number, unit: number, progress: number) {
  ctx.save();
  ctx.globalAlpha = 1 - progress;
  ctx.strokeStyle = '#fff';
  ctx.lineCap = 'round';
  ctx.lineWidth = 4 * unit;
  const r = (12 + progress * 50) * unit;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.38, 0, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const d = r * 0.85;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.38 - progress * 22 * unit, 3 * unit, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** Puff of cloud where the bird disappeared into the sky. */
export function drawPuff(ctx: CanvasRenderingContext2D, x: number, y: number, unit: number, progress: number) {
  ctx.save();
  ctx.globalAlpha = 1 - progress;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const d = progress * 46 * unit;
    cut(ctx, () => ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, (10 - progress * 4) * unit, 0, Math.PI * 2), CLOUD, 0);
  }
  ctx.restore();
}

/** Little notes of joy when the bird lands on a pole. */
export function drawCheer(ctx: CanvasRenderingContext2D, x: number, y: number, unit: number, progress: number) {
  ctx.save();
  ctx.globalAlpha = 1 - progress;
  const colors = [WING, BEAK, CLOUD];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.42;
    const d = progress * 58 * unit;
    cut(ctx, () => ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 5 * unit, 0, Math.PI * 2), colors[i % colors.length], 0);
  }
  ctx.restore();
}
