/**
 * Dessin « papier découpé » du Cerf-volant : ciel, colline, enfant, cerf-volant
 * et bande de vent cible. Fonctions pures sur un canvas 2D, partagées entre
 * le jeu et la vignette.
 */

import { seeded } from '../_shared/math';
import { cut } from '../_shared/canvas';

// Réexportés pour que le jeu, sa simulation et sa vignette gardent
// un seul point d'entrée : `./draw`.
export { clamp01, seeded } from '../_shared/math';
export { INK, cut } from '../_shared/canvas';

export const INK_SOLID = '#23324a';
export const SKY_TOP = '#5ec2f0';
export const SKY_BOT = '#c9ecfb';
export const SUN = '#ffd93d';
export const CORAL = '#ff6b6b';
export const LEAF = '#6bcb77';
export const HILL = '#8fd07a';
export const HILL_DARK = '#5cb95f';
export const SKIN = '#ffb08a';
export const SHIRT = '#5ec2f0';
export const RAINBOW = ['#ff6b6b', '#ff9a4d', '#ffd93d', '#6bcb77', '#5ec2f0', '#9d7bef'];

// ─── Décor ───────────────────────────────────────────────────────────

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

export interface Cloud {
  x: number;
  y: number;
  s: number;
  speed: number;
}
export function makeClouds(count: number, seed: number): Cloud[] {
  const rand = seeded(seed);
  return Array.from({ length: count }, () => ({ x: rand(), y: 0.06 + rand() * 0.5, s: 0.6 + rand() * 0.7, speed: 0.4 + rand() * 0.6 }));
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

/** Colline au premier plan, avec quelques touffes d'herbe. */
export function drawHill(ctx: CanvasRenderingContext2D, w: number, h: number, groundY: number, unit: number) {
  cut(ctx, () => ctx.ellipse(w * 0.75, h * 1.1, w * 0.7, h * 0.32, 0, 0, Math.PI * 2), HILL, 5);
  cut(ctx, () => ctx.ellipse(w * 0.15, groundY + h * 0.22, w * 0.55, h * 0.24, 0, 0, Math.PI * 2), HILL_DARK, 5);
  ctx.fillStyle = HILL_DARK;
  ctx.fillRect(0, h * 0.94, w, h * 0.06);
  ctx.strokeStyle = '#3f9f57';
  ctx.lineWidth = 3 * unit;
  ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const x = w * (0.04 + i * 0.11);
    const y = groundY + h * 0.02 + Math.sin(i * 2.3) * h * 0.02;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 5 * unit, y - 12 * unit);
    ctx.moveTo(x, y);
    ctx.lineTo(x + 6 * unit, y - 11 * unit);
    ctx.stroke();
  }
}

// ─── Enfant ──────────────────────────────────────────────────────────

/**
 * L'enfant qui tient la ficelle, de dos-profil. Origine = pieds.
 * Renvoie la position de la main (bout du bras levé), en px.
 */
export function drawKid(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, armAngle: number, time: number): { x: number; y: number } {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const bob = Math.sin(time / 600) * 1.5;
  // Jambes
  cut(ctx, () => ctx.roundRect(-14, -34, 11, 34, 4), INK_SOLID, 3);
  cut(ctx, () => ctx.roundRect(3, -34, 11, 34, 4), INK_SOLID, 3);
  // Corps
  cut(ctx, () => ctx.roundRect(-18, -78 + bob, 36, 48, 10), SHIRT);
  // Tête
  cut(ctx, () => ctx.arc(0, -98 + bob, 22, 0, Math.PI * 2), SKIN);
  // Cheveux
  cut(
    ctx,
    () => {
      ctx.arc(0, -104 + bob, 22, Math.PI * 1.05, Math.PI * 1.95);
      ctx.closePath();
    },
    '#8b5a2b',
    2,
  );
  // Œil + sourire (profil)
  ctx.fillStyle = INK_SOLID;
  ctx.beginPath();
  ctx.arc(10, -100 + bob, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK_SOLID;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(9, -92 + bob, 6, 0.1, Math.PI * 0.8);
  ctx.stroke();
  // Bras levé vers le cerf-volant
  ctx.save();
  ctx.translate(14, -70 + bob);
  ctx.rotate(armAngle);
  cut(ctx, () => ctx.roundRect(0, -6, 40, 12, 6), SHIRT, 3);
  cut(ctx, () => ctx.arc(42, 0, 8, 0, Math.PI * 2), SKIN, 2);
  ctx.restore();
  ctx.restore();
  const hx = x + (14 + Math.cos(armAngle) * 42) * s;
  const hy = y + (-70 + bob + Math.sin(armAngle) * 42) * s;
  return { x: hx, y: hy };
}

// ─── Cerf-volant ─────────────────────────────────────────────────────

/** Ficelle : de la main au cerf-volant, avec un léger ventre. */
export function drawString(ctx: CanvasRenderingContext2D, hx: number, hy: number, kx: number, ky: number, sag: number) {
  ctx.save();
  ctx.strokeStyle = 'rgba(35, 50, 74, 0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.quadraticCurveTo((hx + kx) / 2, (hy + ky) / 2 + sag, kx, ky);
  ctx.stroke();
  ctx.restore();
}

/**
 * Cerf-volant losange à queue de nœuds. Origine = centre du losange.
 * `tilt` en radians ; `tail` (0..1) anime l'ondulation ; `glow` (0..1)
 * l'entoure d'un halo quand il est dans la zone.
 */
export function drawKite(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, tilt: number, time: number, glow: number) {
  ctx.save();
  ctx.translate(x, y);
  if (glow > 0) {
    const g = ctx.createRadialGradient(0, 0, s * 0.4, 0, 0, s * 2.2);
    g.addColorStop(0, `rgba(255, 217, 61, ${0.45 * glow})`);
    g.addColorStop(1, 'rgba(255, 217, 61, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, s * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.rotate(tilt);

  // Queue : ficelle ondulante + nœuds colorés
  ctx.strokeStyle = 'rgba(35, 50, 74, 0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, s * 1.1);
  const bows: { x: number; y: number; a: number }[] = [];
  for (let i = 1; i <= 5; i++) {
    const u = i / 5;
    const px = -Math.sin(time / 260 + u * 4) * s * 0.35 * u - s * 0.4 * u;
    const py = s * 1.1 + u * s * 1.8;
    ctx.lineTo(px, py);
    bows.push({ x: px, y: py, a: Math.cos(time / 260 + u * 4) * 0.6 });
  }
  ctx.stroke();
  bows.forEach((b, i) => {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.a);
    cut(
      ctx,
      () => {
        ctx.moveTo(-s * 0.26, -s * 0.12);
        ctx.lineTo(0, 0);
        ctx.lineTo(-s * 0.26, s * 0.12);
        ctx.closePath();
        ctx.moveTo(s * 0.26, -s * 0.12);
        ctx.lineTo(0, 0);
        ctx.lineTo(s * 0.26, s * 0.12);
        ctx.closePath();
      },
      RAINBOW[i % RAINBOW.length],
      2,
    );
    ctx.restore();
  });

  // Losange : deux moitiés (corail / soleil) + baguettes
  cut(
    ctx,
    () => {
      ctx.moveTo(0, -s * 1.1);
      ctx.lineTo(s * 0.8, 0);
      ctx.lineTo(0, s * 1.1);
      ctx.lineTo(-s * 0.8, 0);
      ctx.closePath();
    },
    CORAL,
    5,
  );
  ctx.fillStyle = SUN;
  ctx.beginPath();
  ctx.moveTo(0, -s * 1.1);
  ctx.lineTo(s * 0.8, 0);
  ctx.lineTo(0, s * 1.1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK_SOLID;
  ctx.lineWidth = Math.max(2, s * 0.06);
  ctx.beginPath();
  ctx.moveTo(0, -s * 1.1);
  ctx.lineTo(0, s * 1.1);
  ctx.moveTo(-s * 0.8, 0);
  ctx.lineTo(s * 0.8, 0);
  ctx.stroke();
  // Petit visage content
  ctx.fillStyle = INK_SOLID;
  ctx.beginPath();
  ctx.arc(-s * 0.28, -s * 0.22, s * 0.06, 0, Math.PI * 2);
  ctx.arc(s * 0.28, -s * 0.22, s * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = Math.max(2, s * 0.06);
  ctx.beginPath();
  ctx.arc(0, -s * 0.05, s * 0.2, 0.15, Math.PI - 0.15);
  ctx.stroke();
  ctx.restore();
}

// ─── Bande de vent cible ─────────────────────────────────────────────

/**
 * Bande arc-en-ciel translucide entre `top` et `bottom`, qui défile vers la
 * gauche (`offset`). `alpha` module sa présence, `pulse` (0..1) la fait
 * respirer quand le cerf-volant est dehors.
 */
export function drawWindBand(ctx: CanvasRenderingContext2D, w: number, top: number, bottom: number, offset: number, alpha: number, time: number) {
  if (alpha <= 0) return;
  const h = bottom - top;
  ctx.save();
  ctx.globalAlpha = alpha;
  // Fond doux
  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.beginPath();
  ctx.roundRect(-20, top, w + 40, h, h / 2);
  ctx.fill();
  // Rubans qui ondulent
  const n = RAINBOW.length;
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const y0 = top + (h * (i + 0.5)) / n;
    ctx.strokeStyle = RAINBOW[i];
    ctx.lineWidth = Math.max(3, (h / n) * 0.42);
    ctx.globalAlpha = alpha * 0.85;
    ctx.beginPath();
    for (let x = -20; x <= w + 20; x += 14) {
      const y = y0 + Math.sin((x + offset) / 70 + i * 0.9 + time / 900) * h * 0.06;
      if (x === -20) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Bords
  ctx.globalAlpha = alpha;
  ctx.setLineDash([10, 12]);
  ctx.lineDashOffset = -offset * 0.5;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, top);
  ctx.lineTo(w, top);
  ctx.moveTo(0, bottom);
  ctx.lineTo(w, bottom);
  ctx.stroke();
  ctx.restore();
}

/** Étoiles qui filent dans la bande ; `collected` les fait scintiller. */
export function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  cut(
    ctx,
    () => {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const rr = i % 2 === 0 ? r : r * 0.45;
        if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
    },
    color,
    2,
  );
  ctx.restore();
}

/** Anneau de progression autour du cerf-volant (temps tenu dans la zone). */
export function drawHoldRing(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, frac: number) {
  if (frac <= 0) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(4, r * 0.12);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = SUN;
  ctx.beginPath();
  ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
  ctx.stroke();
  ctx.restore();
}

/** Souffle visible : traits de vent qui poussent le cerf-volant depuis la gauche. */
export function drawWind(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, power: number, time: number) {
  if (power < 0.08) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(3, s * 0.08);
  ctx.globalAlpha = Math.min(1, power * 1.5);
  for (let i = 0; i < 3; i++) {
    const phase = ((time / 220 + i * 0.33) % 1) * s * 0.9;
    const yy = y + (i - 1) * s * 0.5;
    const xx = x - s * 2.4 + phase;
    ctx.beginPath();
    ctx.moveTo(xx, yy);
    ctx.lineTo(xx + s * 0.6 * (0.5 + power), yy);
    ctx.stroke();
  }
  ctx.restore();
}
