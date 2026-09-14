import { play } from '../../audio/sfx';
import { gameUnit } from '../_shared/math';
import { starsForTime } from '../_shared/stars';
import { useEffect, useMemo, useRef } from 'react';
import type { GameProps } from '../types';
import {
  CORAL,
  GOLD,
  buildRoute,
  clamp01,
  drawBoat,
  drawHarbor,
  drawIsland,
  drawRouteDashes,
  drawSea,
  drawWake,
  drawWaves,
  drawWind,
  layoutIslands,
  makeIslandStyles,
  makeWaves,
  routeAt,
  seeded,
  type Route,
} from './draw';
import type { BateauPirateLevel } from './index';
import styles from './pirate.module.css';
import { CHEST_OPEN_MS, DOCK_MS, MAX_VEL, PARTY_MS, PUSH, tuning } from './rules';


interface Coin {
  ang: number;
  speed: number;
  spin: number;
  delay: number;
}
function makeCoins(count: number, seed: number): Coin[] {
  const rand = seeded(seed);
  return Array.from({ length: count }, () => ({
    ang: -Math.PI / 2 + (rand() - 0.5) * 2.2,
    speed: 4 + rand() * 6,
    spin: rand() * Math.PI * 2,
    delay: rand() * 600,
  }));
}

interface Sim {
  dist: number;
  vel: number;
  power: number;
  elapsed: number;
  /** Next island to reach (anchor index, 1..n). */
  target: number;
  visited: boolean[];
  dockUntil: number;
  partyAt: number;
  done: boolean;
}

/**
 * Bateau Pirate. Canvas 2D driven by a rAF loop; simulation state
 * dans une ref (pas de re-rendu React par frame). Chaque souffle pousse le
 * the boat along the route, it glides then slows down; it moors at each
 * island, and the celebration starts at the chest.
 */
export function Game({ level, breath, width, height, paused, difficulty, onProgress, onComplete }: GameProps<BateauPirateLevel>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sim = useRef<Sim>({
    dist: 0,
    vel: 0,
    power: 0,
    elapsed: 0,
    target: 1,
    visited: Array.from({ length: level.islands + 1 }, () => false),
    dockUntil: -1,
    partyAt: -1,
    done: false,
  });

  // Map: normalized positions, stable for this level.
  const map = useMemo(
    () => ({
      norm: layoutIslands(level.islands, 100 + level.islands * 17),
      islandStyles: makeIslandStyles(level.islands, 42 + level.islands),
      waves: makeWaves(28, 11),
      coins: makeCoins(22, 5),
    }),
    [level.islands],
  );

  // Geometry in px (follows resizing). Progress is stored as a fraction of
  // the route so as to survive a change of size.
  const fracRef = useRef(0);
  const geo = useMemo(() => {
    const unit = gameUnit(width, height);
    // The route (and the boat) passes just below each island: the boat moors
    // in front of the island without ever crossing it.
    const anchors = map.norm.map((p) => ({ x: p.x * width, y: p.y * height }));
    const islandPos = anchors.map((a, i) => (i === 0 ? a : { x: a.x, y: a.y - 62 * unit * map.islandStyles[i - 1].s }));
    const route: Route = buildRoute(anchors);
    return { unit, anchors, islandPos, route, moor: route.anchorDist };
  }, [map, width, height]);

  useEffect(() => {
    if (paused) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const s = sim.current;
    const { unit, anchors, islandPos, route, moor } = geo;
    const n = level.islands;
    const { pushDiv, friction } = tuning(difficulty);
    const push = (PUSH * unit) / pushDiv;
    const maxVel = MAX_VEL * unit;
    const total = moor[n];
    s.dist = fracRef.current * total;

    let raf = 0;
    let last = performance.now();

    const paint = (t: number) => {
      drawSea(ctx, width, height);
      drawWaves(ctx, map.waves, width, height, t, unit);

      // Dashes: completed segments in pale white, the current one in gold.
      for (let i = 0; i < n; i++) {
        const current = i + 1 === s.target;
        drawRouteDashes(ctx, route, i, i + 1, unit, current ? GOLD : '#fff', current ? 0.9 : 0.4);
      }

      const boat = routeAt(route, s.dist);
      const boatScale = unit * 0.95;

      // Painting order: what is higher up goes behind.
      const items: { y: number; draw: () => void }[] = [];
      items.push({ y: anchors[0].y, draw: () => drawHarbor(ctx, anchors[0].x, anchors[0].y, unit) });
      for (let i = 1; i <= n; i++) {
        const st = s.visited[i] ? 'done' : i === s.target ? 'next' : 'todo';
        const treasure = i === n;
        const open = treasure && s.partyAt >= 0 ? clamp01((t - s.partyAt) / CHEST_OPEN_MS) : 0;
        items.push({ y: islandPos[i].y, draw: () => drawIsland(ctx, islandPos[i].x, islandPos[i].y, map.islandStyles[i - 1], unit, st, t, treasure, open) });
      }
      items.push({
        y: boat.y + 1,
        draw: () => {
          drawWake(ctx, route, s.dist, s.vel / unit, unit, t);
          drawWind(ctx, boat.x, boat.y, boat.dx, boat.dy, boatScale, s.power, t);
          drawBoat(ctx, boat.x, boat.y, boatScale, boat.dx, boat.dy, s.power, t);
        },
      });
      items.sort((a, b) => a.y - b.y).forEach((it) => it.draw());

      // Celebration: gold coins bursting from the chest, rings.
      if (s.partyAt >= 0) {
        const chest = islandPos[n];
        const age = t - s.partyAt;
        ctx.save();
        for (let r = 0; r < 3; r++) {
          const u = ((age / 1000 + r * 0.33) % 1);
          ctx.globalAlpha = (1 - u) * 0.6;
          ctx.strokeStyle = r % 2 ? GOLD : CORAL;
          ctx.lineWidth = 6 * unit;
          ctx.beginPath();
          ctx.ellipse(chest.x, chest.y, (40 + u * 180) * unit, (24 + u * 110) * unit, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        for (const c of map.coins) {
          const a = age - CHEST_OPEN_MS * 0.5 - c.delay;
          if (a < 0) continue;
          const u = a / 1000;
          const g = 9 * unit;
          const x = chest.x + Math.cos(c.ang) * c.speed * unit * u * 60 * 0.4;
          const y = chest.y - 10 * unit + Math.sin(c.ang) * c.speed * unit * u * 60 * 0.4 + 0.5 * g * u * u * 60 * 0.4;
          if (y > height + 20) continue;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(c.spin + u * 6);
          ctx.scale(Math.abs(Math.cos(c.spin + u * 8)) * 0.7 + 0.3, 1);
          ctx.fillStyle = 'rgba(35,50,74,0.22)';
          ctx.beginPath();
          ctx.arc(3, 3, 7 * unit, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = GOLD;
          ctx.beginPath();
          ctx.arc(0, 0, 7 * unit, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        ctx.restore();
      }
    };

    const frame = (t: number) => {
      const dt = Math.min(50, t - last);
      last = t;
      const k = dt / 16.67;

      if (s.partyAt >= 0) {
        paint(t);
        if (t - s.partyAt >= PARTY_MS) {
          if (!s.done) {
            s.done = true;
            const stars = starsForTime(s.elapsed, level.parMs);
            onComplete({ stars, score: Math.round(s.elapsed / 100) });
          }
          return;
        }
        raf = requestAnimationFrame(frame);
        return;
      }

      s.elapsed += dt;
      const raw = breath.getState().intensity;
      s.power += (raw - s.power) * Math.min(1, 0.25 * k);

      const docked = t < s.dockUntil;
      if (!docked) {
        s.vel += s.power * push * k;
        s.vel = Math.min(maxVel, s.vel * Math.pow(friction, k));
        if (s.vel < 0.02 * unit) s.vel = 0;
        s.dist += s.vel * k;

        const goal = moor[s.target];
        if (s.dist >= goal) {
          s.dist = goal;
          s.vel = 0;
          s.visited[s.target] = true;
          if (s.target >= n) {
            s.partyAt = t;
            play('fanfare');
          } else {
            play('step');
            s.target += 1;
            s.dockUntil = t + DOCK_MS;
          }
        }
      }

      fracRef.current = s.dist / total;
      onProgress?.(fracRef.current);
      paint(t);
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [breath, level, geo, map, width, height, paused, difficulty, onProgress, onComplete]);

  return (
    <div className={styles.root}>
      <canvas ref={canvasRef} className={styles.canvas} style={{ width, height }} />
    </div>
  );
}
