import { play } from '../../audio/sfx';
import { gameUnit } from '../_shared/math';
import { useEffect, useMemo, useRef } from 'react';
import type { GameProps, Stars } from '../types';
import {
  BASKET_DROP,
  CORAL,
  HILL_FAR,
  HILL_NEAR,
  SUN,
  clamp01,
  drawBalloon,
  drawCloud,
  drawGround,
  drawHills,
  drawObstacle,
  drawPad,
  drawSky,
  drawWind,
  makeClouds,
  seeded,
} from './draw';
import type { MontgolfiereLevel } from './index';
import styles from './montgolfiere.module.css';
import { BUMP_COOLDOWN_MS, LANDING_MS, LIFT_BASE, LIFT_POWER, PARTY_MS, RAMP_MS, SINK, TAKEOFF_MS, TAKEOFF_THRESHOLD, makeWorld, tuning } from './rules';


interface Confetti {
  x: number;
  vx: number;
  vy: number;
  color: string;
  round: boolean;
  spin: number;
}
function makeConfetti(count: number, seed: number): Confetti[] {
  const rand = seeded(seed);
  const colors = [SUN, CORAL, '#6bcb77', '#5ec2f0', '#9d7bef'];
  return Array.from({ length: count }, (_, i) => ({
    x: rand() * 2 - 1,
    vx: (rand() - 0.5) * 6,
    vy: -(6 + rand() * 6),
    color: colors[i % colors.length],
    round: i % 3 === 0,
    spin: rand() * Math.PI * 2,
  }));
}

type Phase = 'ground' | 'flight' | 'landing' | 'party';

interface Sim {
  phase: Phase;
  /** Défilement du monde (px monde). */
  worldX: number;
  /** Centre de l'enveloppe (px écran). */
  by: number;
  vy: number;
  power: number;
  blowMs: number;
  takeoffAt: number;
  landingAt: number;
  landingFromY: number;
  partyAt: number;
  lastBumpAt: number;
  bumps: number;
  done: boolean;
}

/**
 * Montgolfière. Canvas 2D piloté par une boucle rAF, état de simulation
 * dans une ref. Le ballon reste à une abscisse fixe ; le décor défile.
 */
export function Game({ level, breath, width, height, paused, difficulty, onProgress, onComplete }: GameProps<MontgolfiereLevel>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sim = useRef<Sim>({
    phase: 'ground',
    worldX: 0,
    by: -1,
    vy: 0,
    power: 0,
    blowMs: 0,
    takeoffAt: -1,
    landingAt: -1,
    landingFromY: 0,
    partyAt: -1,
    lastBumpAt: -1e9,
    bumps: 0,
    done: false,
  });

  const world = useMemo(() => {
    const { obstacles, padX, total } = makeWorld(level.obstacles, difficulty);
    return {
      obstacles,
      padX,
      total,
      clouds: makeClouds(Math.ceil(padX / 260) + 6, 21, padX + 1200),
      confetti: makeConfetti(30, 8),
    };
  }, [level.obstacles, difficulty]);

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
    const { speed } = tuning(difficulty);
    const groundY = height * 0.86;
    const R = 44 * unit;
    const bx = width * 0.3;
    const floorY = groundY - R * BASKET_DROP - 4;
    const ceilY = R * 1.4 + 16;
    if (s.by < 0) s.by = floorY;
    const { obstacles, padX, total, clouds, confetti } = world;

    let raf = 0;
    let last = performance.now();

    const paint = (t: number) => {
      const wx = s.worldX * unit;
      drawSky(ctx, width, height);
      for (const c of clouds) {
        const x = c.x * unit - wx * 0.35;
        if (x > -120 * unit && x < width + 120 * unit) drawCloud(ctx, x, c.y * height, c.s * unit);
      }
      drawHills(ctx, width, groundY, wx * 0.25, unit, HILL_FAR, 150, 520);
      drawHills(ctx, width, groundY, wx * 0.5 + 300, unit, HILL_NEAR, 70, 300);
      drawGround(ctx, width, height, groundY, wx, unit);

      // Plateforme de départ (sous le ballon au sol) et d'arrivée
      drawPad(ctx, bx - wx, groundY, unit, false, 0, t);
      const padScreenX = bx + (padX * unit - wx);
      const flag = s.partyAt >= 0 ? clamp01((t - s.partyAt) / 700) : 0;
      if (padScreenX < width + 200 * unit) drawPad(ctx, padScreenX, groundY, unit, true, flag, t);

      for (const o of obstacles) {
        const x = bx + (o.x * unit - wx);
        if (x < -120 * unit || x > width + 120 * unit) continue;
        const age = o.hitAt >= 0 ? (t - o.hitAt) / 1000 : 99;
        const wobble = age < 1.2 ? Math.sin(age * 18) * 0.12 * (1 - age / 1.2) : 0;
        drawObstacle(ctx, o.kind, x, groundY, o.w * unit, o.h * unit, wobble);
      }

      // Ballon : petit balancement, secousse après un choc
      const sinceBump = t - s.lastBumpAt;
      const shake = sinceBump < 500 ? Math.sin(sinceBump / 30) * (1 - sinceBump / 500) * 0.12 : 0;
      const tilt = Math.sin(t / 900) * 0.03 + s.vy * 0.01 + shake;
      const flame = s.phase === 'flight' ? s.power : s.phase === 'ground' ? Math.min(1, s.blowMs / TAKEOFF_MS) * s.power : 0;
      drawWind(ctx, bx, s.by, R, s.phase === 'flight' || s.phase === 'ground' ? s.power : 0, t);
      drawBalloon(ctx, bx, s.by, R, flame, tilt, t);

      if (s.partyAt >= 0) {
        const age = (t - s.partyAt) / 1000;
        ctx.save();
        for (const c of confetti) {
          const u = age;
          const x = bx + c.x * 40 * unit + c.vx * unit * u * 30;
          const y = s.by + c.vy * unit * u * 30 + 0.5 * 9 * unit * u * u * 30;
          if (y > height) continue;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(c.spin + u * 5);
          ctx.fillStyle = c.color;
          if (c.round) {
            ctx.beginPath();
            ctx.arc(0, 0, 6 * unit, 0, Math.PI * 2);
            ctx.fill();
          } else ctx.fillRect(-5 * unit, -8 * unit, 10 * unit, 16 * unit);
          ctx.restore();
        }
        ctx.restore();
      }
    };

    const frame = (t: number) => {
      const dt = Math.min(50, t - last);
      last = t;
      const k = dt / 16.67;
      const raw = breath.getState().intensity;
      s.power += (raw - s.power) * Math.min(1, 0.25 * k);

      switch (s.phase) {
        case 'ground': {
          // Un souffle soutenu allume le brûleur : décollage.
          s.blowMs = raw > TAKEOFF_THRESHOLD ? s.blowMs + dt : Math.max(0, s.blowMs - dt * 2);
          if (s.blowMs >= TAKEOFF_MS) {
            s.phase = 'flight';
            play('whoosh');
            s.takeoffAt = t;
            s.vy = -3 * unit;
          }
          break;
        }
        case 'flight': {
          const ramp = clamp01((t - s.takeoffAt) / RAMP_MS);
          const ease = ramp * ramp * (3 - 2 * ramp);
          s.worldX += speed * ease * k;

          // Souffler fait monter ; sinon le ballon redescend doucement vers le bas de l'écran.
          const target = s.power > 0.06 ? -(LIFT_BASE + s.power * LIFT_POWER) * unit : SINK * unit;
          s.vy += (target - s.vy) * Math.min(1, 0.09 * k);
          s.by = Math.max(ceilY, Math.min(floorY, s.by + s.vy * k));
          if (s.by === floorY && s.vy > 0) s.vy = 0;

          // Chocs avec les obstacles (boîte de l'enveloppe + nacelle).
          if (t - s.lastBumpAt > BUMP_COOLDOWN_MS) {
            const left = bx - R * 0.9;
            const right = bx + R * 0.9;
            const bottom = s.by + R * BASKET_DROP;
            for (const o of obstacles) {
              const ox = bx + (o.x * unit - s.worldX * unit);
              const ow = o.w * unit * 0.42;
              if (right > ox - ow && left < ox + ow && bottom > groundY - o.h * unit) {
                s.bumps++;
                play('thud');
                s.lastBumpAt = t;
                o.hitAt = t;
                s.vy = -4 * unit;
                break;
              }
            }
          }

          if (s.worldX >= padX) {
            s.worldX = padX;
            s.phase = 'landing';
            s.landingAt = t;
            s.landingFromY = s.by;
          }
          break;
        }
        case 'landing': {
          const u = clamp01((t - s.landingAt) / LANDING_MS);
          const e = 1 - Math.pow(1 - u, 3);
          s.by = s.landingFromY + (floorY - s.landingFromY) * e;
          s.vy = 0;
          if (u >= 1) {
            s.phase = 'party';
            s.partyAt = t;
            play('fanfare');
          }
          break;
        }
        case 'party': {
          if (t - s.partyAt >= PARTY_MS && !s.done) {
            s.done = true;
            const stars: Stars = s.bumps === 0 ? 3 : s.bumps <= 2 ? 2 : 1;
            onComplete({ stars, score: s.bumps });
            paint(t);
            return;
          }
          break;
        }
      }

      onProgress?.(clamp01(s.worldX / total));
      paint(t);
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [breath, level, world, width, height, paused, difficulty, onProgress, onComplete]);

  return (
    <div className={styles.root}>
      <canvas ref={canvasRef} className={styles.canvas} style={{ width, height }} />
    </div>
  );
}
