import { play } from '../../audio/sfx';
import { gameUnit } from '../_shared/math';
import { starsForTime } from '../_shared/stars';
import { useEffect, useMemo, useRef } from 'react';
import type { GameProps } from '../types';
import { PETALS, clamp01, drawBubble, drawCloud, drawGarden, drawKid, drawPop, drawSky, drawSun, drawTarget, drawWind, seeded } from './draw';
import type { BullesLevel } from './index';
import styles from './bulles.module.css';
import { BUBBLES, PARK_MS, PARTY_MS, growPerFrame as growRate, targetR as targetRadius, tuning } from './rules';


interface Floating {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  ok: boolean;
  bornAt: number;
  /** Storage slot (successful bubbles). */
  slot: number;
  fromX: number;
  fromY: number;
  poppedAt: number;
}
interface Pop {
  x: number;
  y: number;
  r: number;
  at: number;
}
interface Confetti {
  ang: number;
  speed: number;
  color: string;
}

interface Sim {
  r: number;
  power: number;
  prevPower: number;
  wobble: number;
  wasBlowing: boolean;
  floating: Floating[];
  pops: Pop[];
  success: number;
  /** Duration of the game (ms), excluding the final celebration: the basis for the stars. */
  elapsed: number;
  /** Moment when the celebration should start (last bubble stored). */
  partyDue: number;
  partyAt: number;
  done: boolean;
}

/**
 * Bulles de savon. Canvas 2D driven by a rAF loop, state in a ref.
 * The bubble being formed is attached to the wand; detached bubbles float,
 * and the successful ones go and line up at the top right.
 */
export function Game({ level, breath, width, height, paused, difficulty, onProgress, onComplete }: GameProps<BullesLevel>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sim = useRef<Sim>({ r: 0, power: 0, prevPower: 0, wobble: 0, wasBlowing: false, floating: [], pops: [], success: 0, elapsed: 0, partyDue: -1, partyAt: -1, done: false });

  const scene = useMemo(() => {
    const rand = seeded(77);
    return {
      confetti: Array.from({ length: 14 }, (_, i) => ({ ang: rand() * Math.PI * 2, speed: 2 + rand() * 4, color: PETALS[i % PETALS.length] })) as Confetti[],
    };
  }, []);

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
    const { blow } = tuning(difficulty);
    const n = BUBBLES;
    const groundY = height * 0.84;
    const kidX = width * 0.14;
    const kidS = unit * 1.05;
    const targetR = targetRadius(difficulty) * unit;
    const growPerFrame = growRate(targetR, level.blowMs, blow);
    const slotX = (i: number) => width - (60 + i * 58) * unit;
    const slotY = 56 * unit;
    let raf = 0;
    let last = performance.now();

    const paint = (t: number) => {
      drawSky(ctx, width, height);
      drawSun(ctx, width * 0.9, height * 0.16, 44 * unit);
      drawCloud(ctx, width * 0.4 + Math.sin(t / 5000) * 20 * unit, height * 0.12, unit * 0.9);
      drawCloud(ctx, width * 0.7 + Math.sin(t / 6000) * 15 * unit, height * 0.3, unit * 0.6);
      // Storage slots (empty circles), then stored bubbles.
      for (let i = 0; i < n; i++) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 7]);
        ctx.beginPath();
        ctx.arc(slotX(i), slotY, 22 * unit, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      drawGarden(ctx, width, height, groundY, unit, t);

      const ring = drawKid(ctx, kidX, groundY + 4 * unit, kidS, s.power, t);
      const bx = ring.x + Math.max(ring.r, s.r) * 0.9;
      const by = ring.y - s.r * 0.15;
      if (s.partyAt < 0) drawTarget(ctx, ring.x + targetR * 0.9, ring.y - targetR * 0.15, targetR, s.r / targetR, t);
      drawWind(ctx, ring.x - 10 * unit, ring.y, 12 * unit, s.power, t);
      if (s.r > 0) drawBubble(ctx, bx, by, s.r, s.wobble, t);

      for (const f of s.floating) {
        if (f.poppedAt >= 0) continue;
        drawBubble(ctx, f.x, f.y, f.r, 0.15, t + f.bornAt, f.ok);
      }
      for (const p of s.pops) drawPop(ctx, p.x, p.y, p.r, clamp01((t - p.at) / 500));

      if (s.partyAt >= 0) {
        for (const f of s.floating) {
          if (f.poppedAt < 0) continue;
          const age = (t - f.poppedAt) / 1000;
          for (const c of scene.confetti) {
            const d = c.speed * unit * age * 40;
            const x = f.x + Math.cos(c.ang) * d;
            const y = f.y + Math.sin(c.ang) * d + 0.5 * 6 * unit * age * age * 40;
            if (y > height) continue;
            ctx.fillStyle = c.color;
            ctx.beginPath();
            ctx.arc(x, y, 5 * unit, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    };

    const frame = (t: number) => {
      const dt = Math.min(50, t - last);
      last = t;
      const k = dt / 16.67;
      const st = breath.getState();
      s.prevPower = s.power;
      s.power += (st.intensity - s.power) * Math.min(1, 0.25 * k);
      // Instability: rapid variations in the intensity.
      const jitter = Math.abs(s.power - s.prevPower) / Math.max(0.5, k);
      s.wobble += (clamp01(jitter * 25) - s.wobble) * Math.min(1, 0.15 * k);

      // Detached bubbles: they float (or make their way to their slot).
      s.floating = s.floating.filter((f) => {
        if (f.poppedAt >= 0) return true;
        if (f.ok) {
          const u = clamp01((t - f.bornAt) / PARK_MS);
          const e = 1 - Math.pow(1 - u, 3);
          f.x = f.fromX + (slotX(f.slot) - f.fromX) * e + Math.sin(t / 300) * (1 - u) * 6 * unit;
          f.y = f.fromY + (slotY - f.fromY) * e;
          f.r = f.r + (22 * unit - f.r) * Math.min(1, 0.04 * k);
          return true;
        }
        f.vy -= 0.02 * unit * k;
        f.x += (f.vx + Math.sin(t / 400 + f.bornAt) * 0.6 * unit) * k;
        f.y += f.vy * k;
        return f.y + f.r > -10;
      });
      s.pops = s.pops.filter((p) => t - p.at < 500);
      if (s.partyAt < 0 && s.partyDue >= 0 && t >= s.partyDue) {
        s.partyAt = t;
        play('fanfare');
      }

      if (s.partyAt >= 0) {
        // Celebration: the stored bubbles pop one by one.
        const idx = Math.floor((t - s.partyAt) / 350);
        s.floating.forEach((f, i) => {
          if (f.ok && f.poppedAt < 0 && i <= idx) {
            f.poppedAt = t;
            s.pops.push({ x: f.x, y: f.y, r: f.r, at: t });
          }
        });
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
      const ringX = kidX + 62 * kidS;
      const ringY = groundY + 4 * unit - 91 * kidS;
      if (st.isBlowing) {
        // The bubble cannot pop: blowing hard only inflates it.
        if (s.power > 0.08) {
          s.r = Math.min(targetR * 1.25, s.r + growPerFrame * (0.5 + s.power) * (1 - s.wobble * 0.6) * k);
        }
      }
      // The bubble is ready: it detaches and goes to its slot. It waits
      // sinon le souffle suivant en gardant sa taille — reprendre son souffle
      // costs nothing, it just takes several breaths.
      if (s.r >= targetR) {
        const fx = ringX + s.r * 0.9;
        const fy = ringY - s.r * 0.15;
        s.floating.push({ x: fx, y: fy, r: s.r, vx: 0.8 * unit, vy: -0.6 * unit, ok: true, bornAt: t, slot: s.success, fromX: fx, fromY: fy, poppedAt: -1 });
        s.success += 1;
        play('step');
        if (s.success >= n) s.partyDue = t + PARK_MS;
        s.r = 0;
      }
      s.wasBlowing = st.isBlowing;

      onProgress?.(clamp01((s.success + Math.min(0.99, s.r / targetR)) / n));
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
