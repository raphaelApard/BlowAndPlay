/**
 * Dessin « papier découpé » de la carte au trésor : mer, îles, bateau.
 * Fonctions pures sur un CanvasRenderingContext2D, partagées entre le jeu
 * et la vignette.
 */

import { clamp01, seeded } from '../_shared/math';
import { cut } from '../_shared/canvas';

// Réexportés pour que le jeu, sa simulation et sa vignette gardent
// un seul point d'entrée : `./draw`.
export { clamp01, seeded } from '../_shared/math';
export { INK, cut } from '../_shared/canvas';

export interface Pt {
  x: number;
  y: number;
}

export const SEA_TOP = '#5fb3ea';
export const SEA_BOT = '#3f8fd6';
export const SAND = '#f6dfa4';
export const SAND_DARK = '#e8c777';
export const LEAF = '#5cb95f';
export const LEAF_DARK = '#3f9f57';
export const TRUNK = '#a8703f';
export const HULL = '#8b5a2b';
export const HULL_STRIPE = '#c47a3a';
export const SAIL = '#fffaf0';
export const FLAG = '#23324a';
export const GOLD = '#ffd93d';
export const CORAL = '#ff6b6b';

// ─── Chemin ──────────────────────────────────────────────────────────

/** Positions (0..1) du port puis des points d'amarrage : zigzag de gauche à droite. */
export function layoutIslands(count: number, seed: number): Pt[] {
  const rand = seeded(seed);
  const pts: Pt[] = [{ x: 0.09, y: 0.56 }];
  for (let i = 1; i <= count; i++) {
    const x = 0.09 + (0.82 * i) / count + (rand() - 0.5) * 0.05;
    const base = i % 2 === 1 ? 0.34 : 0.7;
    pts.push({ x, y: base + (rand() - 0.5) * 0.12 });
  }
  return pts;
}

export interface Route {
  /** Points échantillonnés (px). */
  samples: Pt[];
  /** Longueur cumulée à chaque échantillon. */
  cum: number[];
  /** Longueur totale. */
  total: number;
  /** Distance (le long du chemin) de chaque point d'ancrage (port + îles). */
  anchorDist: number[];
}

/** Courbe de Catmull-Rom passant par les ancres, échantillonnée. */
export function buildRoute(anchors: Pt[], perSegment = 48): Route {
  const P = (i: number) => anchors[Math.max(0, Math.min(anchors.length - 1, i))];
  const samples: Pt[] = [];
  const anchorIndex: number[] = [];
  for (let i = 0; i < anchors.length - 1; i++) {
    const p0 = P(i - 1);
    const p1 = P(i);
    const p2 = P(i + 1);
    const p3 = P(i + 2);
    anchorIndex.push(samples.length);
    for (let s = 0; s < perSegment; s++) {
      const t = s / perSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      samples.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  anchorIndex.push(samples.length);
  samples.push({ ...anchors[anchors.length - 1] });

  const cum: number[] = [0];
  for (let i = 1; i < samples.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y));
  }
  return { samples, cum, total: cum[cum.length - 1], anchorDist: anchorIndex.map((i) => cum[i]) };
}

/** Position et direction (unitaire) à une distance donnée le long du chemin. */
export function routeAt(route: Route, d: number): { x: number; y: number; dx: number; dy: number } {
  const { samples, cum } = route;
  const dist = Math.max(0, Math.min(route.total, d));
  let lo = 0;
  let hi = cum.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= dist) lo = mid;
    else hi = mid;
  }
  const a = samples[lo];
  const b = samples[Math.min(samples.length - 1, lo + 1)];
  const seg = Math.max(1e-6, cum[lo + 1] - cum[lo]);
  const t = clamp01((dist - cum[lo]) / seg);
  const ddx = b.x - a.x;
  const ddy = b.y - a.y;
  const len = Math.hypot(ddx, ddy) || 1;
  return { x: a.x + ddx * t, y: a.y + ddy * t, dx: ddx / len, dy: ddy / len };
}

// ─── Décor ───────────────────────────────────────────────────────────

export function drawSea(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, SEA_TOP);
  g.addColorStop(1, SEA_BOT);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export interface Wave {
  x: number;
  y: number;
  s: number;
  phase: number;
}

export function makeWaves(count: number, seed: number): Wave[] {
  const rand = seeded(seed);
  return Array.from({ length: count }, () => ({ x: rand(), y: rand(), s: 0.6 + rand() * 0.8, phase: rand() * Math.PI * 2 }));
}

/** Petites vagues « ﹏ » qui ondulent doucement. */
export function drawWaves(ctx: CanvasRenderingContext2D, waves: Wave[], w: number, h: number, time: number, unit: number) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineCap = 'round';
  ctx.lineWidth = 3 * unit;
  for (const wv of waves) {
    const x = wv.x * w + Math.sin(time / 1400 + wv.phase) * 6 * unit;
    const y = wv.y * h + Math.cos(time / 1900 + wv.phase) * 3 * unit;
    const r = 9 * wv.s * unit;
    ctx.beginPath();
    ctx.arc(x - r, y, r, Math.PI, 0);
    ctx.arc(x + r, y, r, Math.PI, 0);
    ctx.stroke();
  }
  ctx.restore();
}

/** Pointillés de carte au trésor entre deux ancres (segment du chemin). */
export function drawRouteDashes(ctx: CanvasRenderingContext2D, route: Route, from: number, to: number, unit: number, color: string, alpha: number) {
  const { samples, cum } = route;
  const a = route.anchorDist[from];
  const b = route.anchorDist[to];
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 4 * unit;
  ctx.lineCap = 'round';
  ctx.setLineDash([2 * unit, 14 * unit]);
  ctx.beginPath();
  let started = false;
  for (let i = 0; i < samples.length; i++) {
    if (cum[i] < a || cum[i] > b) continue;
    if (!started) {
      ctx.moveTo(samples[i].x, samples[i].y);
      started = true;
    } else ctx.lineTo(samples[i].x, samples[i].y);
  }
  ctx.stroke();
  ctx.restore();
}

function palm(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, lean: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // Tronc courbé
  ctx.strokeStyle = TRUNK;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(lean * 10, -22, lean * 18, -40);
  ctx.stroke();
  // Palmes
  const tx = lean * 18;
  const ty = -40;
  for (let i = 0; i < 5; i++) {
    const ang = -Math.PI * 0.95 + (i / 4) * Math.PI * 0.9;
    cut(
      ctx,
      () => {
        ctx.ellipse(tx + Math.cos(ang) * 14, ty + Math.sin(ang) * 8 + 2, 17, 6, ang, 0, Math.PI * 2);
      },
      i % 2 ? LEAF : LEAF_DARK,
      2,
    );
  }
  // Noix de coco
  ctx.fillStyle = HULL;
  ctx.beginPath();
  ctx.arc(tx - 3, ty + 4, 3.5, 0, Math.PI * 2);
  ctx.arc(tx + 4, ty + 5, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Coffre au trésor (fermé ou ouvert, avec pièces). */
export function drawChest(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, open: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  cut(ctx, () => ctx.roundRect(-18, -10, 36, 22, 4), HULL, 3);
  ctx.fillStyle = HULL_STRIPE;
  ctx.fillRect(-18, -2, 36, 4);
  if (open > 0) {
    // Or qui déborde
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.ellipse(0, -10, 16, 6 * open, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Couvercle
  ctx.save();
  ctx.translate(0, -10);
  ctx.rotate(-open * 1.1);
  cut(ctx, () => ctx.roundRect(-18, -12, 36, 12, [8, 8, 2, 2]), HULL, 3);
  ctx.fillStyle = GOLD;
  ctx.fillRect(-4, -8, 8, 8);
  ctx.restore();
  ctx.restore();
}

export interface IslandStyle {
  /** Échelle de base (1 = ~90px de large). */
  s: number;
  /** Nombre de palmiers (1..2). */
  palms: number;
  seed: number;
}

export function makeIslandStyles(count: number, seed: number): IslandStyle[] {
  const rand = seeded(seed);
  return Array.from({ length: count }, (_, i) => ({ s: 0.9 + rand() * 0.3, palms: i % 2 === 0 ? 2 : 1, seed: Math.floor(rand() * 1e6) }));
}

export type IslandState = 'todo' | 'next' | 'done';

/** Une île : sable, herbe, palmiers ; drapeau une fois visitée ; halo si c'est la prochaine. */
export function drawIsland(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  style: IslandStyle,
  unit: number,
  state: IslandState,
  time: number,
  treasure = false,
  treasureOpen = 0,
) {
  const s = style.s * unit;
  ctx.save();
  ctx.translate(x, y);
  if (state === 'next') {
    const pulse = 0.5 + Math.sin(time / 380) * 0.5;
    ctx.save();
    ctx.globalAlpha = 0.35 + pulse * 0.35;
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 5 * unit;
    ctx.beginPath();
    ctx.ellipse(0, 4 * s, (58 + pulse * 8) * s, (34 + pulse * 5) * s, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.scale(s, s);
  // Écume autour de l'île
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.ellipse(0, 6, 54, 30, 0, 0, Math.PI * 2);
  ctx.fill();
  cut(ctx, () => ctx.ellipse(0, 4, 46, 26, 0, 0, Math.PI * 2), SAND);
  ctx.fillStyle = SAND_DARK;
  ctx.beginPath();
  ctx.ellipse(0, 10, 40, 14, 0, 0, Math.PI);
  ctx.fill();
  cut(ctx, () => ctx.ellipse(-4, -2, 30, 15, -0.2, 0, Math.PI * 2), LEAF, 3);

  if (treasure) {
    drawChest(ctx, 8, 2, 0.8, treasureOpen);
    palm(ctx, -22, 4, 0.9, -1);
  } else {
    palm(ctx, 10, 4, 1, 1);
    if (style.palms > 1) palm(ctx, -16, 6, 0.8, -1);
  }

  if (state === 'done') {
    // Drapeau planté : l'île est conquise
    ctx.strokeStyle = FLAG;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-30, 0);
    ctx.lineTo(-30, -36);
    ctx.stroke();
    cut(
      ctx,
      () => {
        ctx.moveTo(-30, -36);
        ctx.lineTo(-8, -29);
        ctx.lineTo(-30, -22);
        ctx.closePath();
      },
      CORAL,
      2,
    );
  }
  ctx.restore();
}

/** Port de départ : îlot et ponton en bois, à gauche du bateau (ancre = position du bateau). */
export function drawHarbor(ctx: CanvasRenderingContext2D, x: number, y: number, unit: number) {
  ctx.save();
  ctx.translate(x - 46 * unit, y);
  ctx.scale(unit, unit);
  cut(ctx, () => ctx.ellipse(-30, 6, 50, 30, 0, 0, Math.PI * 2), SAND);
  cut(ctx, () => ctx.ellipse(-34, -2, 34, 16, 0, 0, Math.PI * 2), LEAF, 3);
  palm(ctx, -40, 2, 0.8, -1);
  // Ponton jusqu'au bateau
  cut(ctx, () => ctx.rect(-6, 4, 56, 10), HULL_STRIPE, 3);
  ctx.fillStyle = HULL;
  for (let i = 0; i < 5; i++) ctx.fillRect(0 + i * 12, 2, 3, 16);
  ctx.restore();
}

/**
 * Le bateau pirate. `power` (0..1) gonfle la voile ; `dx` donne le sens
 * (miroir si le bateau va vers la gauche), `tilt` un léger roulis.
 */
export function drawBoat(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, dx: number, dy: number, power: number, time: number) {
  ctx.save();
  ctx.translate(x, y);
  const facingLeft = dx < -0.05;
  ctx.scale(facingLeft ? -s : s, s);
  const tilt = Math.max(-0.35, Math.min(0.35, (facingLeft ? -dy : dy) * 0.45)) + Math.sin(time / 600) * 0.03;
  ctx.rotate(tilt);
  ctx.translate(0, Math.sin(time / 700) * 1.5);

  // Mât
  cut(ctx, () => ctx.rect(-2, -52, 4, 52), FLAG, 2);

  // Voile, gonflée vers l'avant
  const bulge = 8 + power * 22;
  cut(
    ctx,
    () => {
      ctx.moveTo(3, -46);
      ctx.quadraticCurveTo(14 + bulge, -32, 3, -8);
      ctx.closePath();
    },
    SAIL,
    3,
  );
  // Bande rouge, découpée dans la voile
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(3, -46);
  ctx.quadraticCurveTo(14 + bulge, -32, 3, -8);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = CORAL;
  ctx.fillRect(0, -33, 60, 6);
  ctx.restore();

  // Pavillon noir à tête de mort
  cut(
    ctx,
    () => {
      ctx.moveTo(-2, -60);
      ctx.lineTo(20, -55);
      ctx.lineTo(-2, -50);
      ctx.closePath();
    },
    FLAG,
    2,
  );
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(6, -55, 2.6, 0, Math.PI * 2);
  ctx.fill();

  // Coque
  cut(
    ctx,
    () => {
      ctx.moveTo(-34, -4);
      ctx.lineTo(36, -4);
      ctx.lineTo(24, 14);
      ctx.quadraticCurveTo(0, 22, -24, 14);
      ctx.closePath();
    },
    HULL,
  );
  ctx.fillStyle = HULL_STRIPE;
  ctx.beginPath();
  ctx.moveTo(-32, 0);
  ctx.lineTo(34, 0);
  ctx.lineTo(31, 5);
  ctx.lineTo(-29, 5);
  ctx.closePath();
  ctx.fill();
  // Hublots
  ctx.fillStyle = GOLD;
  for (const hx of [-14, 0, 14]) {
    ctx.beginPath();
    ctx.arc(hx, 9, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Sillage : petites bulles blanches derrière le bateau. */
export function drawWake(ctx: CanvasRenderingContext2D, route: Route, dist: number, vel: number, unit: number, time: number) {
  if (vel < 0.15) return;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  const n = 6;
  for (let i = 1; i <= n; i++) {
    const p = routeAt(route, dist - i * 12 * unit);
    const wob = Math.sin(time / 120 + i) * 4 * unit;
    const r = (5 - i * 0.6) * unit * Math.min(1, vel / 3);
    if (r <= 0) continue;
    ctx.beginPath();
    ctx.arc(p.x - p.dy * wob, p.y + p.dx * wob, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Souffle visible : petites lignes de vent qui poussent la voile, derrière le bateau. */
export function drawWind(ctx: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number, s: number, power: number, time: number) {
  if (power < 0.08) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineCap = 'round';
  ctx.lineWidth = 3 * s;
  ctx.globalAlpha = Math.min(1, power * 1.5);
  // Repère local : (dx, dy) = avant, (nx, ny) = travers.
  const nx = -dy;
  const ny = dx;
  const mastTop = 36 * s;
  for (let i = 0; i < 3; i++) {
    const off = (i - 1) * 12 * s;
    const phase = ((time / 240 + i * 0.33) % 1) * 30 * s;
    const back = 60 * s - phase;
    const bx = x - dx * back + nx * off;
    const by = y - dy * back + ny * off - mastTop;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + dx * 18 * s, by + dy * 18 * s);
    ctx.stroke();
  }
  ctx.restore();
}
