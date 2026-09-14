/**
 * Dessin « papier découpé » des Feuilles d'automne : ciel doré, arbres roux,
 * chemin, feuilles, hérisson et son terrier. Fonctions pures sur un canvas
 * 2D, partagées entre le jeu et la vignette.
 */

import { clamp01, seeded } from '../_shared/math';
import { INK, cut } from '../_shared/canvas';

// Réexportés pour que le jeu, sa simulation et sa vignette gardent
// un seul point d'entrée : `./draw`.
export { clamp01, seeded } from '../_shared/math';
export { INK, cut } from '../_shared/canvas';

export interface Pt {
  x: number;
  y: number;
}

export const INK_SOLID = '#23324a';
export const SKY_TOP = '#ffd9a8';
export const SKY_BOT = '#fff3dc';
export const GROUND = '#9ccc6b';
export const GROUND_DARK = '#7fb35a';
export const PATH = '#f0d8a8';
export const PATH_EDGE = '#d9b985';
export const TRUNK = '#8b5a2b';
export const TRUNK_DARK = '#6e4321';
export const FOLIAGE = ['#ff9a4d', '#ff6b5e', '#ffc13d', '#e0743a'];
export const LEAF_COLORS = ['#ff9a4d', '#ff6b5e', '#ffd93d', '#d9822b', '#c94f3a'];
export const HEDGE_BODY = '#a8703f';
export const HEDGE_SPIKES = '#6e4321';
export const HEDGE_FACE = '#f3c9b1';
export const DOOR = '#c94f3a';
export const WINDOW = '#ffd93d';

// ─── Chemin ──────────────────────────────────────────────────────────

export interface Route {
  samples: Pt[];
  cum: number[];
  total: number;
  anchorDist: number[];
}

/** Courbe de Catmull-Rom passant par les ancres, échantillonnée. */
export function buildRoute(anchors: Pt[], perSegment = 40): Route {
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
  const cum = [0];
  for (let i = 1; i < samples.length; i++) cum.push(cum[i - 1] + Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y));
  return { samples, cum, total: cum[cum.length - 1], anchorDist: anchorIndex.map((i) => cum[i]) };
}

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

/**
 * Positions (0..1) des ancres du chemin : départ, un point par tas, terrier.
 *
 * En paysage le chemin va de la gauche vers la droite ; en portrait (mobile)
 * il monte du bas vers le haut, sinon les tas se tasseraient sur une largeur
 * trop étroite. Le hérisson reste dessiné de profil dans les deux cas.
 */
export function layoutPath(piles: number, seed: number, portrait = false): Pt[] {
  const rand = seeded(seed);
  if (portrait) {
    const pts: Pt[] = [{ x: 0.5, y: 0.9 }];
    for (let i = 1; i <= piles; i++) {
      const t = i / (piles + 1);
      pts.push({ x: 0.5 + Math.sin(i * 1.9) * 0.2 + (rand() - 0.5) * 0.06, y: 0.9 - t * 0.66 + (rand() - 0.5) * 0.03 });
    }
    pts.push({ x: 0.5, y: 0.2 });
    return pts;
  }
  const pts: Pt[] = [{ x: 0.08, y: 0.72 }];
  for (let i = 1; i <= piles; i++) {
    const t = i / (piles + 1);
    pts.push({ x: 0.08 + t * 0.78 + (rand() - 0.5) * 0.04, y: 0.6 + Math.sin(i * 1.9) * 0.12 + (rand() - 0.5) * 0.06 });
  }
  pts.push({ x: 0.88, y: 0.66 });
  return pts;
}

// ─── Décor ───────────────────────────────────────────────────────────

export function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, SKY_TOP);
  g.addColorStop(1, SKY_BOT);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export function drawGround(ctx: CanvasRenderingContext2D, w: number, h: number, horizon: number) {
  cut(ctx, () => ctx.ellipse(w * 0.3, horizon + h * 0.3, w * 0.7, h * 0.36, 0, 0, Math.PI * 2), GROUND_DARK, 5);
  cut(ctx, () => ctx.ellipse(w * 0.75, horizon + h * 0.34, w * 0.6, h * 0.36, 0, 0, Math.PI * 2), GROUND, 5);
  ctx.fillStyle = GROUND;
  ctx.fillRect(0, horizon + h * 0.2, w, h);
}

/** Le chemin de terre le long de la route. */
export function drawPath(ctx: CanvasRenderingContext2D, route: Route, width: number) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const trace = () => {
    ctx.beginPath();
    route.samples.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  };
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.translate(4, 4);
  trace();
  ctx.stroke();
  ctx.translate(-4, -4);
  ctx.strokeStyle = PATH_EDGE;
  ctx.lineWidth = width;
  trace();
  ctx.stroke();
  ctx.strokeStyle = PATH;
  ctx.lineWidth = width * 0.7;
  trace();
  ctx.stroke();
  ctx.restore();
}

/** Arbre d'automne : tronc et trois boules de feuillage. */
export function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  cut(ctx, () => ctx.roundRect(x - 9 * s, y - 70 * s, 18 * s, 70 * s, 5 * s), TRUNK);
  cut(ctx, () => ctx.arc(x - 26 * s, y - 70 * s, 26 * s, 0, Math.PI * 2), color);
  cut(ctx, () => ctx.arc(x + 26 * s, y - 74 * s, 26 * s, 0, Math.PI * 2), color);
  cut(ctx, () => ctx.arc(x, y - 96 * s, 30 * s, 0, Math.PI * 2), color);
}

/** Le terrier : gros arbre avec une porte ronde et une fenêtre. `light` (0..1) allume la fenêtre, `door` (0..1) ouvre la porte. */
export function drawHome(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, light: number, door: number) {
  cut(ctx, () => ctx.roundRect(x - 40 * s, y - 150 * s, 80 * s, 150 * s, 18 * s), TRUNK);
  ctx.fillStyle = TRUNK_DARK;
  ctx.fillRect(x - 6 * s, y - 130 * s, 4 * s, 90 * s);
  ctx.fillRect(x + 18 * s, y - 120 * s, 4 * s, 60 * s);
  cut(ctx, () => ctx.arc(x - 44 * s, y - 150 * s, 40 * s, 0, Math.PI * 2), FOLIAGE[0]);
  cut(ctx, () => ctx.arc(x + 46 * s, y - 156 * s, 40 * s, 0, Math.PI * 2), FOLIAGE[2]);
  cut(ctx, () => ctx.arc(x, y - 190 * s, 46 * s, 0, Math.PI * 2), FOLIAGE[1]);
  // Fenêtre
  cut(ctx, () => ctx.arc(x, y - 96 * s, 12 * s, 0, Math.PI * 2), light > 0 ? WINDOW : '#5c3a21', 2);
  if (light > 0) {
    ctx.save();
    ctx.globalAlpha = light * 0.5;
    ctx.fillStyle = WINDOW;
    ctx.beginPath();
    ctx.arc(x, y - 96 * s, 26 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Porte ronde (s'ouvre vers l'intérieur : elle s'assombrit)
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y - 22 * s, 24 * s, Math.PI, 0);
  ctx.lineTo(x + 24 * s, y);
  ctx.lineTo(x - 24 * s, y);
  ctx.closePath();
  ctx.fillStyle = '#3a2414';
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = DOOR;
  ctx.fillRect(x - 24 * s, y - 50 * s, 48 * s * (1 - door), 60 * s);
  ctx.fillStyle = WINDOW;
  if (door < 0.5) {
    ctx.beginPath();
    ctx.arc(x + 14 * s, y - 22 * s, 3 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ─── Feuilles ────────────────────────────────────────────────────────

/** Feuille en papier : ovale pointu avec nervure. Origine = centre. */
export function drawLeaf(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  cut(
    ctx,
    () => {
      ctx.moveTo(-s, 0);
      ctx.quadraticCurveTo(0, -s * 0.9, s, 0);
      ctx.quadraticCurveTo(0, s * 0.9, -s, 0);
      ctx.closePath();
    },
    color,
    2,
  );
  ctx.strokeStyle = 'rgba(35,50,74,0.35)';
  ctx.lineWidth = Math.max(1, s * 0.08);
  ctx.beginPath();
  ctx.moveTo(-s * 0.8, 0);
  ctx.lineTo(s * 0.8, 0);
  ctx.stroke();
  ctx.restore();
}

// ─── Hérisson ────────────────────────────────────────────────────────

/**
 * Hérisson de profil (regarde à droite). Origine = pieds (centre).
 * `walk` (phase 0..1) anime les pattes ; `sniff` fait remuer le museau.
 */
export function drawHedgehog(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, walk: number, sniff: number, time: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const bob = Math.abs(Math.sin(walk * Math.PI * 2)) * 2;
  ctx.translate(0, -bob);
  // Piquants (triangles sur le dos)
  cut(
    ctx,
    () => {
      ctx.moveTo(-30, -6);
      for (let i = 0; i < 8; i++) {
        const u = i / 7;
        const bx = -30 + u * 44;
        const by = -6 - Math.sin(u * Math.PI) * 26;
        ctx.lineTo(bx - 4, by);
        ctx.lineTo(bx + 1, by - 12 - Math.sin(time / 300 + i) * 1.5);
      }
      ctx.lineTo(18, -6);
      ctx.closePath();
    },
    HEDGE_SPIKES,
  );
  // Corps
  cut(ctx, () => ctx.ellipse(-4, -12, 30, 16, 0, 0, Math.PI * 2), HEDGE_BODY, 3);
  // Tête / museau
  cut(
    ctx,
    () => {
      ctx.moveTo(14, -24);
      ctx.quadraticCurveTo(34, -22 + sniff * 2, 40, -10);
      ctx.quadraticCurveTo(30, -2, 14, -2);
      ctx.closePath();
    },
    HEDGE_FACE,
    2,
  );
  ctx.fillStyle = INK_SOLID;
  ctx.beginPath();
  ctx.arc(40, -10 + sniff * 1.5, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(24, -16, 2.4, 0, Math.PI * 2);
  ctx.fill();
  // Pattes
  const legA = Math.sin(walk * Math.PI * 2) * 5;
  ctx.fillStyle = HEDGE_SPIKES;
  ctx.fillRect(-16 + legA, -4, 8, 6);
  ctx.fillRect(8 - legA, -4, 8, 6);
  ctx.restore();
}

/** Souffle visible : traits de vent vers le tas de feuilles. */
export function drawWind(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, power: number, time: number) {
  if (power < 0.08) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(3, s * 4);
  ctx.globalAlpha = Math.min(1, power * 1.5);
  for (let i = 0; i < 3; i++) {
    const phase = ((time / 220 + i * 0.33) % 1) * 50 * s;
    const yy = y - 20 * s + (i - 1) * 14 * s;
    const xx = x - 90 * s + phase;
    ctx.beginPath();
    ctx.moveTo(xx, yy);
    ctx.lineTo(xx + (20 + power * 24) * s, yy);
    ctx.stroke();
  }
  ctx.restore();
}
