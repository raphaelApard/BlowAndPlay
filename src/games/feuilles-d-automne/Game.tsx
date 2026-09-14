import { play } from '../../audio/sfx';
import { gameUnit } from '../_shared/math';
import { starsForTime } from '../_shared/stars';
import { useEffect, useMemo, useRef } from 'react';
import type { GameProps } from '../types';
import {
  FOLIAGE,
  LEAF_COLORS,
  buildRoute,
  clamp01,
  drawGround,
  drawHedgehog,
  drawHome,
  drawLeaf,
  drawPath,
  drawSky,
  drawTree,
  drawWind,
  layoutPath,
  routeAt,
  seeded,
  type Route,
} from './draw';
import type { FeuillesLevel } from './index';
import styles from './feuilles.module.css';
import { BLOW_RATE, END_BEFORE, ENTER_MS, PARTY_MS, STOP_BEFORE, WALK_SPEED, leavesPerPile } from './rules';


interface Leaf {
  /** Position relative au centre du tas (unités). */
  dx: number;
  dy: number;
  s: number;
  rot: number;
  color: string;
}
interface Flying {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  s: number;
  color: string;
  bornAt: number;
}
interface Pile {
  leaves: Leaf[];
  removal: number;
}

interface Sim {
  dist: number;
  /** Position en fraction du chemin, pour survivre à un redimensionnement. */
  frac: number;
  walk: number;
  power: number;
  piles: Pile[];
  target: number;
  flying: Flying[];
  elapsed: number;
  enterAt: number;
  partyAt: number;
  done: boolean;
}

/**
 * Feuilles d'automne. Canvas 2D piloté par une boucle rAF, état dans une
 * ref. Le hérisson avance le long du chemin et s'arrête devant chaque tas ;
 * le souffle envoie les feuilles voler.
 */
export function Game({ level, breath, width, height, paused, difficulty, onProgress, onComplete }: GameProps<FeuillesLevel>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sim = useRef<Sim | null>(null);

  // En portrait (mobile) le chemin monte du bas vers le haut : voir `layoutPath`.
  const portrait = height > width;

  const map = useMemo(() => {
    const rand = seeded(400 + level.piles * 11);
    const perPile = leavesPerPile(level.leaves, difficulty);
    const piles: Pile[] = Array.from({ length: level.piles }, () => ({
      removal: 0,
      leaves: Array.from({ length: perPile }, (_, i) => ({
        dx: (rand() - 0.5) * 70,
        dy: -rand() * 26 - (i / perPile) * 10,
        s: 9 + rand() * 5,
        rot: rand() * Math.PI * 2,
        color: LEAF_COLORS[Math.floor(rand() * LEAF_COLORS.length)],
      })),
    }));
    const falling = Array.from({ length: 10 }, () => ({ x: rand(), y: rand(), s: 0.6 + rand() * 0.6, speed: 0.3 + rand() * 0.5, color: LEAF_COLORS[Math.floor(rand() * LEAF_COLORS.length)] }));
    // En portrait le chemin occupe le centre : les arbres se rangent sur les bords.
    const trees = Array.from({ length: 5 }, (_, i) => ({
      x: portrait ? (i % 2 ? 0.88 : 0.12) + (rand() - 0.5) * 0.08 : 0.06 + i * 0.21 + (rand() - 0.5) * 0.06,
      s: 0.7 + rand() * 0.4,
      color: FOLIAGE[i % FOLIAGE.length],
    }));
    return { norm: layoutPath(level.piles, 40 + level.piles, portrait), piles, falling, trees };
  }, [level, difficulty, portrait]);

  useEffect(() => {
    if (paused) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (!sim.current) {
      sim.current = { dist: 0, frac: 0, walk: 0, power: 0, piles: map.piles.map((p) => ({ removal: 0, leaves: [...p.leaves] })), target: 1, flying: [], elapsed: 0, enterAt: -1, partyAt: -1, done: false };
    }
    const s = sim.current;
    const unit = gameUnit(width, height);
    const n = level.piles;
    const anchors = map.norm.map((p) => ({ x: p.x * width, y: p.y * height }));
    const route: Route = buildRoute(anchors);
    // Le terrier est au bout du chemin : en portrait il monte, l'horizon aussi.
    const horizon = height * (portrait ? 0.12 : 0.42);
    const homeAnchor = anchors[anchors.length - 1];
    const walkSpeed = WALK_SPEED * unit;
    s.dist = s.frac * route.total;
    let raf = 0;
    let last = performance.now();
    const rand = seeded(9);

    const paint = (t: number) => {
      drawSky(ctx, width, height);
      drawGround(ctx, width, height, horizon);
      for (const tr of map.trees) drawTree(ctx, tr.x * width, horizon + 10 * unit, tr.s * unit, tr.color);
      drawPath(ctx, route, 30 * unit);
      // Feuilles qui tombent doucement en fond
      for (const f of map.falling) {
        const y = ((f.y * height + (t / 30) * f.speed * unit) % (height + 40 * unit)) - 20 * unit;
        const x = f.x * width + Math.sin(t / 900 + f.y * 10) * 30 * unit;
        drawLeaf(ctx, x, y, 7 * f.s * unit, t / 700 + f.x * 5, f.color);
      }

      const hh = routeAt(route, s.dist);
      const items: { y: number; draw: () => void }[] = [];
      // Tas restants
      for (let i = 1; i <= n; i++) {
        const pile = s.piles[i - 1];
        if (!pile.leaves.length) continue;
        const p = routeAt(route, route.anchorDist[i]);
        const shake = i === s.target && s.power > 0.1 ? s.power * 3 * unit : 0;
        items.push({
          y: p.y,
          draw: () => {
            for (const lf of pile.leaves) {
              const jx = shake ? (rand() - 0.5) * shake : 0;
              drawLeaf(ctx, p.x + lf.dx * unit + jx, p.y + lf.dy * unit, lf.s * unit, lf.rot, lf.color);
            }
          },
        });
      }
      // Terrier
      const light = s.partyAt >= 0 ? clamp01((t - s.partyAt) / 500) : 0;
      const door = s.enterAt >= 0 ? clamp01((t - s.enterAt) / (ENTER_MS * 0.4)) : 0;
      items.push({ y: homeAnchor.y, draw: () => drawHome(ctx, homeAnchor.x, homeAnchor.y, unit * 0.9, light, s.partyAt >= 0 ? 0 : door) });
      // Hérisson
      if (s.partyAt < 0) {
        let scale = unit * 0.9;
        let hx = hh.x;
        let hy = hh.y + 4 * unit;
        if (s.enterAt >= 0) {
          const u = clamp01((t - s.enterAt) / ENTER_MS);
          scale *= 1 - u * 0.75;
          hx = hh.x + (homeAnchor.x - hh.x) * u;
          hy = hh.y + 4 * unit + (homeAnchor.y - hh.y - 4 * unit) * u;
        }
        const waiting = s.target <= n && s.piles[s.target - 1].leaves.length > 0 && s.dist >= route.anchorDist[s.target] - STOP_BEFORE * unit - 1;
        const sniff = waiting ? Math.sin(t / 120) : 0;
        items.push({ y: hy + 1, draw: () => drawHedgehog(ctx, hx, hy, scale, s.walk, sniff, t) });
        if (waiting) {
          const p = routeAt(route, route.anchorDist[s.target]);
          drawWind(ctx, p.x, p.y, unit, s.power, t);
        }
      }
      items.sort((a, b) => a.y - b.y).forEach((it) => it.draw());

      for (const f of s.flying) drawLeaf(ctx, f.x, f.y, f.s * unit, f.rot, f.color);

      if (s.partyAt >= 0) {
        // Cœurs qui montent de la maison
        for (let i = 0; i < 3; i++) {
          const a = ((t - s.partyAt) / 1400 + i * 0.33) % 1;
          ctx.save();
          ctx.globalAlpha = 1 - a;
          ctx.translate(homeAnchor.x + (i - 1) * 24 * unit, homeAnchor.y - 60 * unit - a * 90 * unit);
          ctx.fillStyle = '#ff6b6b';
          const r = 7 * unit;
          ctx.beginPath();
          ctx.arc(-r * 0.6, -r * 0.3, r * 0.7, 0, Math.PI * 2);
          ctx.arc(r * 0.6, -r * 0.3, r * 0.7, 0, Math.PI * 2);
          ctx.moveTo(-r * 1.25, 0);
          ctx.lineTo(0, r * 1.4);
          ctx.lineTo(r * 1.25, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }
    };

    const frame = (t: number) => {
      const dt = Math.min(50, t - last);
      last = t;
      const k = dt / 16.67;
      const raw = breath.getState().intensity;
      s.power += (raw - s.power) * Math.min(1, 0.25 * k);

      // Feuilles en vol
      s.flying = s.flying.filter((f) => {
        f.vy += 0.05 * unit * k;
        f.vx *= Math.pow(0.99, k);
        f.x += (f.vx + Math.sin(t / 150 + f.bornAt) * 0.8 * unit) * k;
        f.y += f.vy * k;
        f.rot += f.spin * k;
        return f.x < width + 40 * unit && f.y < height + 40 * unit;
      });

      if (s.partyAt >= 0) {
        paint(t);
        if (t - s.partyAt >= PARTY_MS && !s.done) {
          s.done = true;
          const stars = starsForTime(s.elapsed, level.parMs);
          onComplete({ stars, score: Math.round(s.elapsed / 100) });
          return;
        }
        raf = requestAnimationFrame(frame);
        return;
      }
      if (s.enterAt >= 0) {
        paint(t);
        if (t - s.enterAt >= ENTER_MS) s.partyAt = t;
        raf = requestAnimationFrame(frame);
        return;
      }

      s.elapsed += dt;
      if (s.target <= n) {
        const pile = s.piles[s.target - 1];
        const stopAt = route.anchorDist[s.target] - STOP_BEFORE * unit;
        if (pile.leaves.length > 0) {
          if (s.dist < stopAt) {
            s.dist = Math.min(stopAt, s.dist + walkSpeed * k);
            s.walk = (s.walk + 0.03 * k) % 1;
          } else {
            // Devant le tas : le souffle envoie les feuilles voler.
            pile.removal += s.power * BLOW_RATE * k;
            const p = routeAt(route, route.anchorDist[s.target]);
            while (pile.removal >= 1 && pile.leaves.length) {
              pile.removal -= 1;
              const lf = pile.leaves.pop()!;
              s.flying.push({
                x: p.x + lf.dx * unit,
                y: p.y + lf.dy * unit,
                vx: (2 + rand() * 3 + s.power * 3) * unit,
                vy: -(3 + rand() * 4) * unit,
                rot: lf.rot,
                spin: (rand() - 0.5) * 0.4,
                s: lf.s,
                color: lf.color,
                bornAt: t,
              });
            }
            if (!pile.leaves.length) {
              s.target += 1;
              play('step');
            }
          }
        } else s.target += 1;
      } else {
        // Plus de tas : le hérisson rentre.
        const endAt = route.total - END_BEFORE * unit;
        if (s.dist < endAt) {
          s.dist = Math.min(endAt, s.dist + walkSpeed * k);
          s.walk = (s.walk + 0.03 * k) % 1;
        } else {
          s.enterAt = t;
          play('fanfare');
        }
      }

      s.frac = s.dist / route.total;
      onProgress?.(clamp01(s.frac));
      paint(t);
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [breath, level, map, portrait, width, height, paused, difficulty, onProgress, onComplete]);

  return (
    <div className={styles.root}>
      <canvas ref={canvasRef} className={styles.canvas} style={{ width, height }} />
    </div>
  );
}
