/**
 * Cut-paper drawing of Grenouille: the pond, the lily pads, the frog and the
 * aim gauge. Pure functions on a 2D canvas, shared between the game and the
 * thumbnail.
 */

import { cut } from '../_shared/canvas';

// Re-exported so that the game, its simulation and its thumbnail keep a
// single entry point: `./draw`.
export { clamp01, lerp, seeded } from '../_shared/math';
export { INK, cut } from '../_shared/canvas';

export const INK_SOLID = '#23324a';
export const SKY_TOP = '#8fd6f7';
export const SKY_BOT = '#d8f2e4';
export const WATER_TOP = '#5ec2f0';
export const WATER_BOT = '#2f9bd4';
export const PAD = '#6bcb77';
export const PAD_DARK = '#4aa85c';
export const FROG = '#7ed957';
export const FROG_DARK = '#57b93c';
export const BELLY = '#e8f8d8';
export const CORAL = '#ff6b6b';
export const SUN = '#ffd93d';
export const REED = '#3f9f57';
export const BLOSSOM = ['#ff9ec4', '#ffd93d', '#fff1f6'];

// ─── Scenery ─────────────────────────────────────────────────────────

export function drawSky(ctx: CanvasRenderingContext2D, w: number, horizon: number) {
  const g = ctx.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, SKY_TOP);
  g.addColorStop(1, SKY_BOT);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, horizon);
}

export function drawSun(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  cut(ctx, () => ctx.arc(x, y, r, 0, Math.PI * 2), SUN, 6);
}

/** The pond: water below the horizon, with a few drifting ripples. */
export function drawWater(ctx: CanvasRenderingContext2D, w: number, h: number, horizon: number, unit: number, time: number) {
  const g = ctx.createLinearGradient(0, horizon, 0, h);
  g.addColorStop(0, WATER_TOP);
  g.addColorStop(1, WATER_BOT);
  ctx.fillStyle = g;
  ctx.fillRect(0, horizon, w, h - horizon);

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineCap = 'round';
  ctx.lineWidth = 3 * unit;
  for (let i = 0; i < 7; i++) {
    const y = horizon + ((i + 1) / 8) * (h - horizon);
    const drift = Math.sin(time / 1400 + i) * 22 * unit;
    ctx.beginPath();
    for (let x = -30; x <= w + 30; x += 16) {
      const yy = y + Math.sin((x + drift) / 90 + i * 1.3) * 4 * unit;
      if (x === -30) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Far bank: a green strip with reeds, drawn on the horizon line. */
export function drawBank(ctx: CanvasRenderingContext2D, w: number, horizon: number, unit: number) {
  // Two overlapping mounds rather than one flat strip, so the far bank has
  // the same cut-paper relief as the hills in the other games.
  cut(ctx, () => ctx.ellipse(w * 0.28, horizon - 10 * unit, w * 0.5, 54 * unit, 0, 0, Math.PI * 2), '#8fd07a', 5);
  cut(ctx, () => ctx.ellipse(w * 0.78, horizon - 4 * unit, w * 0.45, 42 * unit, 0, 0, Math.PI * 2), PAD, 5);

  ctx.save();
  ctx.strokeStyle = REED;
  ctx.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    const x = w * (0.03 + i * 0.064);
    const y = horizon - (24 + Math.sin(i * 2.7) * 10) * unit;
    const h = (30 + Math.sin(i * 1.7) * 14) * unit;
    ctx.lineWidth = 4 * unit;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 5 * unit, y - h * 0.6, x + 11 * unit, y - h);
    ctx.stroke();
    // Quenouille au bout d'un roseau sur trois.
    if (i % 3 === 0) {
      cut(ctx, () => ctx.ellipse(x + 11 * unit, y - h, 4 * unit, 9 * unit, 0.2, 0, Math.PI * 2), '#8b5a2b', 2);
    }
  }
  ctx.restore();
}

// ─── Nénuphars ───────────────────────────────────────────────────────

/**
 * A lily pad seen slightly from above: a notched disc, a flower when it is
 * the goal. `bob` animates its float, `glow` (0..1) lights the pad the frog
 * is aiming at.
 */
export function drawPad(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, time: number, glow: number, flower: boolean) {
  const bob = Math.sin(time / 900 + x / 120) * r * 0.05;
  ctx.save();
  ctx.translate(x, y + bob);

  if (glow > 0) {
    const g = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 1.9);
    g.addColorStop(0, `rgba(255, 217, 61, ${0.5 * glow})`);
    g.addColorStop(1, 'rgba(255, 217, 61, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.9, 0, Math.PI * 2);
    ctx.fill();
  }

  // The pad: a flattened disc with a wedge cut out, like a real lily pad.
  cut(
    ctx,
    () => {
      ctx.ellipse(0, 0, r, r * 0.62, 0, 0.42, Math.PI * 2 - 0.42);
      ctx.lineTo(0, 0);
      ctx.closePath();
    },
    PAD,
    5,
  );
  // Nervures
  ctx.save();
  ctx.strokeStyle = PAD_DARK;
  ctx.lineWidth = Math.max(1.5, r * 0.045);
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const a = 0.7 + (i / 5) * (Math.PI * 2 - 1.4);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.52);
    ctx.stroke();
  }
  ctx.restore();

  if (flower) drawBlossom(ctx, -r * 0.3, -r * 0.34, r * 0.34);
  ctx.restore();
}

/** Nénuphar en fleur : pétales roses et cœur jaune. */
export function drawBlossom(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.save();
  ctx.translate(x, y);
  for (let ring = 0; ring < 2; ring++) {
    const rr = r * (ring === 0 ? 1 : 0.62);
    const color = BLOSSOM[ring];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + ring * 0.5;
      cut(ctx, () => ctx.ellipse(Math.cos(a) * rr * 0.55, Math.sin(a) * rr * 0.55, rr * 0.5, rr * 0.3, a, 0, Math.PI * 2), color, 2);
    }
  }
  cut(ctx, () => ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2), SUN, 2);
  ctx.restore();
}

// ─── Grenouille ──────────────────────────────────────────────────────

/**
 * The frog, seen from the front, sitting or in flight. Origin = the point
 * where it touches the pad. `squash` (0..1) crouches it while aiming,
 * `airborne` stretches its legs during a jump.
 */
export function drawFrog(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, squash: number, airborne: number, time: number) {
  ctx.save();
  ctx.translate(x, y);
  const sy = 1 - squash * 0.25 + airborne * 0.12;
  const sx = 1 + squash * 0.18 - airborne * 0.08;
  ctx.scale(s * sx, s * sy);

  // Back legs: folded when crouching, stretched out in flight.
  const stretch = airborne;
  for (const dir of [-1, 1]) {
    ctx.save();
    ctx.scale(dir, 1);
    cut(
      ctx,
      () => {
        ctx.moveTo(14, -14);
        ctx.quadraticCurveTo(30 + stretch * 16, -6 + stretch * 6, 24 + stretch * 22, 6 + stretch * 10);
        ctx.quadraticCurveTo(18 + stretch * 10, 10, 12, 0);
        ctx.closePath();
      },
      FROG_DARK,
      3,
    );
    ctx.restore();
  }

  // Corps
  cut(ctx, () => ctx.ellipse(0, -22, 26, 22, 0, 0, Math.PI * 2), FROG, 4);
  // Ventre
  cut(ctx, () => ctx.ellipse(0, -14, 16, 12, 0, 0, Math.PI * 2), BELLY, 0);

  // Front legs
  for (const dir of [-1, 1]) {
    ctx.save();
    ctx.scale(dir, 1);
    cut(ctx, () => ctx.roundRect(12, -12, 9, 14, 4), FROG_DARK, 2);
    ctx.restore();
  }

  // Head and eyes: two bumps on top of the body.
  cut(ctx, () => ctx.ellipse(0, -40, 22, 17, 0, 0, Math.PI * 2), FROG, 4);
  const blink = Math.sin(time / 1600) > 0.96 ? 0.15 : 1;
  for (const dir of [-1, 1]) {
    ctx.save();
    ctx.scale(dir, 1);
    cut(ctx, () => ctx.arc(11, -52, 9, 0, Math.PI * 2), FROG, 2);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(11, -52, 6, 6 * blink, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK_SOLID;
    ctx.beginPath();
    ctx.ellipse(11, -52, 3, 3 * blink, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Sourire
  ctx.strokeStyle = INK_SOLID;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, -38, 11, 0.25, Math.PI - 0.25);
  ctx.stroke();

  ctx.restore();
}

// ─── Visée ───────────────────────────────────────────────────────────

/**
 * The aim arc: a dotted parabola from the frog to where the current charge
 * would land. This is the whole feedback of the game — the child sees where
 * their blow is pointing before letting go.
 */
export function drawAim(ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, unit: number, time: number) {
  const dx = toX - fromX;
  if (Math.abs(dx) < 4) return;
  // A flat arc reads better than a tall one: the child is looking at *where*
  // it lands, and a high lob hides the landing point behind the curve.
  const peak = Math.min(78 * unit, Math.abs(dx) * 0.3);
  ctx.save();
  const dots = 14;
  for (let i = 1; i <= dots; i++) {
    const u = i / (dots + 1);
    const x = fromX + dx * u;
    const y = fromY - 34 * unit - Math.sin(u * Math.PI) * peak;
    const r = (4 + u * 3) * unit * (0.85 + Math.sin(time / 180 - i * 0.5) * 0.15);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + u * 0.45})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Landing marker: a bright ring on the water, pulsing so it reads as the
  // thing that moves with the breath.
  const pulse = 1 + Math.sin(time / 220) * 0.12;
  cut(ctx, () => ctx.ellipse(toX, fromY, 26 * unit * pulse, 11 * unit * pulse, 0, 0, Math.PI * 2), 'rgba(255, 217, 61, 0.55)', 0);
  ctx.strokeStyle = SUN;
  ctx.lineWidth = 3.5 * unit;
  ctx.beginPath();
  ctx.ellipse(toX, fromY, 26 * unit * pulse, 11 * unit * pulse, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Éclaboussure quand la grenouille rate le nénuphar. */
export function drawSplash(ctx: CanvasRenderingContext2D, x: number, y: number, unit: number, progress: number) {
  ctx.save();
  ctx.globalAlpha = 1 - progress;
  ctx.strokeStyle = '#fff';
  ctx.lineCap = 'round';
  ctx.lineWidth = 4 * unit;
  const r = (14 + progress * 46) * unit;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.4, 0, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const d = r * 0.9;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.4 - progress * 20 * unit, 3 * unit, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** Petites notes de joie quand la grenouille se pose bien. */
export function drawHop(ctx: CanvasRenderingContext2D, x: number, y: number, unit: number, progress: number) {
  ctx.save();
  ctx.globalAlpha = 1 - progress;
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.4;
    const d = progress * 60 * unit;
    cut(ctx, () => ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 5 * unit, 0, Math.PI * 2), BLOSSOM[i % BLOSSOM.length], 0);
  }
  ctx.restore();
}
