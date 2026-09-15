import { play } from '../../audio/sfx';
import { gameUnit } from '../_shared/math';
import { starsForTime } from '../_shared/stars';
import { useEffect, useMemo, useRef } from 'react';
import type { GameProps } from '../types';
import { PETALS, clamp01, drawCloud, drawFlower, drawHills, drawSky, drawSun, drawWind, makeCloudShape, seeded, type CloudShape } from './draw';
import type { PousseNuagesLevel } from './index';
import styles from './nuages.module.css';
import { CLOUD_S, ENTER_MS, MAX_VX, PARTY_MS, PUSH, blowEfficiency, tuning } from './rules';


interface Petal {
  ang: number;
  speed: number;
  color: string;
  spin: number;
}
function makePetals(count: number, seed: number): Petal[] {
  const rand = seeded(seed);
  return Array.from({ length: count }, (_, i) => ({ ang: rand() * Math.PI * 2, speed: 2 + rand() * 4, color: PETALS[i % PETALS.length], spin: rand() * 6 }));
}

interface Sim {
  /** Index of the current cloud (0..n-1); n = all chased away. */
  index: number;
  /** Centre of the current cloud (screen px). */
  x: number;
  vx: number;
  enteredAt: number;
  power: number;
  squash: number;
  elapsed: number;
  clearedAt: number[];
  partyAt: number;
  done: boolean;
}

/**
 * Pousse-nuages. Canvas 2D driven by a rAF loop, state in a ref.
 * The current cloud covers the sun; the blows push it to the right.
 */
export function Game({ level, breath, width, height, paused, difficulty, onProgress, onComplete }: GameProps<PousseNuagesLevel>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sim = useRef<Sim>({ index: 0, x: -1e9, vx: 0, enteredAt: -1, power: 0, squash: 0, elapsed: 0, clearedAt: [], partyAt: -1, done: false });

  const scene = useMemo(() => {
    const rand = seeded(300 + level.clouds);
    const shapes: CloudShape[] = Array.from({ length: level.clouds }, (_, i) => makeCloudShape(50 + i * 7 + level.clouds, i));
    // One flower per cloud, on evenly spaced slots along the hills (so the big
    // heads never overlap), blooming in a shuffled order. Colour by slot:
    // two neighbours are never the same.
    const slots = Array.from({ length: level.clouds }, (_, i) => i);
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    const flowers = slots.map((slot) => ({
      x: 0.05 + ((slot + 0.5) / level.clouds) * 0.9,
      y: 0.86 + (slot % 2) * 0.05,
      s: 0.9 + rand() * 0.2,
      color: PETALS[slot % PETALS.length],
    }));
    return { shapes, flowers, petals: makePetals(28, 4) };
  }, [level.clouds]);

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
    const unit = gameUnit(width, height);
    const { pushDiv, pull } = tuning(difficulty);
    const n = level.clouds;
    const sunX = width * 0.5;
    const sunY = height * 0.4;
    const sunR = 88 * unit;
    const cloudS = CLOUD_S * unit;
    const cloudY = sunY + 14 * unit;
    const cloudHalf = cloudS * 0.95;
    const enterFrom = -cloudHalf - 20;
    const push = (PUSH * unit) / pushDiv;
    const maxVx = MAX_VX * unit;
    let raf = 0;
    let last = performance.now();

    const paint = (t: number) => {
      // Brightness: clouds chased away + how far the current cloud has moved.
      const away = s.index < n ? clamp01((s.x - sunX) / (cloudHalf + sunR)) : 1;
      const bright = clamp01((s.index + away) / n);
      drawSky(ctx, width, height, bright);
      const spin = t / (s.partyAt >= 0 ? 1600 : 9000);
      const partyU = s.partyAt >= 0 ? clamp01((t - s.partyAt) / 900) : 0;
      drawSun(ctx, sunX, sunY, sunR * (1 + partyU * 0.25), bright, spin, t);
      drawHills(ctx, width, height, unit);
      scene.flowers.forEach((f, i) => {
        const at = s.clearedAt[i];
        const bloom = at === undefined ? 0 : clamp01((t - at) / 900);
        drawFlower(ctx, f.x * width, f.y * height, 44 * unit * f.s, f.color, bloom, t);
      });

      if (s.index < n) {
        const mood = s.vx > 1.5 * unit ? clamp01(s.vx / (6 * unit)) : -1;
        drawWind(ctx, s.x - cloudHalf * 0.2, cloudY, cloudS, s.power, t);
        drawCloud(ctx, scene.shapes[s.index], s.x, cloudY, cloudS, s.squash, mood, t);
      }

      if (s.partyAt >= 0) {
        const age = (t - s.partyAt) / 1000;
        for (const p of scene.petals) {
          const d = p.speed * unit * age * 60 * 0.5;
          const x = sunX + Math.cos(p.ang) * d;
          const y = sunY + Math.sin(p.ang) * d + 0.5 * 4 * unit * age * age * 30;
          if (y > height + 20) continue;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(p.spin + age * 4);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.ellipse(0, 0, 9 * unit, 5 * unit, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    };

    const frame = (t: number) => {
      const dt = Math.min(50, t - last);
      last = t;
      const k = dt / 16.67;
      const st = breath.getState();
      s.power += (st.intensity - s.power) * Math.min(1, 0.25 * k);

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

      s.elapsed += dt;
      if (s.enteredAt < 0) {
        // Nouveau nuage : il arrive de la gauche.
        s.enteredAt = t;
        s.x = enterFrom;
        s.vx = 0;
      }
      const enter = clamp01((t - s.enteredAt) / ENTER_MS);
      if (enter < 1) {
        const e = 1 - Math.pow(1 - enter, 3);
        s.x = enterFrom + (sunX - enterFrom) * e;
      } else {
        if (st.isBlowing) {
          s.vx += s.power * blowEfficiency(st.blowDurationMs) * push * k;
        } else if (s.x > sunX && s.vx < 0.5 * unit) {
          // Sans souffle, le nuage revient doucement cacher le soleil.
          s.vx -= pull * unit * k;
        }
        s.vx = Math.max(-2 * unit, Math.min(maxVx, s.vx * Math.pow(0.96, k)));
        s.x += s.vx * k;
        if (s.x < sunX) {
          s.x = sunX;
          s.vx = Math.max(0, s.vx);
        }
        if (s.x - cloudHalf > width + 10) {
          // Chased away: a flower blooms, the next one arrives.
          s.clearedAt[s.index] = t;
          s.index += 1;
          s.enteredAt = -1;
          if (s.index >= n) {
            s.partyAt = t;
            play('fanfare');
          } else {
            play('step');
          }
        }
      }
      s.squash += (Math.min(1, Math.max(0, s.vx) / (8 * unit)) - s.squash) * Math.min(1, 0.2 * k);

      const away = s.index < n ? clamp01((s.x - sunX) / (width + cloudHalf - sunX)) : 1;
      onProgress?.(clamp01((s.index + away) / n));
      paint(t);
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [breath, level, scene, width, height, paused, difficulty, onProgress, onComplete]);

  return (
    <div className={styles.root}>
      <canvas ref={canvasRef} className={styles.canvas} style={{ width, height }} />
    </div>
  );
}
