import { play } from '../../audio/sfx';
import { gameUnit } from '../_shared/math';
import { useEffect, useMemo, useRef } from 'react';
import type { GameProps, Stars } from '../types';
import {
  RAINBOW,
  clamp01,
  drawCloud,
  drawHill,
  drawHoldRing,
  drawKid,
  drawKite,
  drawSky,
  drawStar,
  drawString,
  drawSun,
  drawWind,
  drawWindBand,
  makeClouds,
  seeded,
} from './draw';
import type { CerfVolantLevel } from './index';
import styles from './cerf.module.css';
import { FOLLOW, HOLD_DECAY, PARTY_MS, STAR_EVERY_MS, SWITCH_MS, makeCourse, tuning } from './rules';


interface Star {
  x: number;
  y: number;
  r: number;
  color: string;
  rot: number;
  spin: number;
}
interface Pop {
  x: number;
  y: number;
  at: number;
  color: string;
}
interface Confetti {
  x: number;
  vx: number;
  vy: number;
  color: string;
  spin: number;
}
function makeConfetti(count: number, seed: number): Confetti[] {
  const rand = seeded(seed);
  return Array.from({ length: count }, (_, i) => ({
    x: rand() * 2 - 1,
    vx: (rand() - 0.5) * 7,
    vy: -(5 + rand() * 7),
    color: RAINBOW[i % RAINBOW.length],
    spin: rand() * Math.PI * 2,
  }));
}

interface Sim {
  alt: number;
  vAlt: number;
  power: number;
  stage: number;
  hold: number;
  switchAt: number;
  elapsed: number;
  inZoneMs: number;
  lastStarAt: number;
  stars: Star[];
  pops: Pop[];
  partyAt: number;
  done: boolean;
}

/**
 * Cerf-volant. Canvas 2D piloté par une boucle rAF, état dans une ref.
 * L'altitude suit l'intensité du souffle (avec l'inertie du cerf-volant) ;
 * la bande de vent est la zone à tenir.
 */
export function Game({ level, breath, width, height, paused, difficulty, onProgress, onComplete }: GameProps<CerfVolantLevel>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sim = useRef<Sim>({
    alt: 0,
    vAlt: 0,
    power: 0,
    stage: 0,
    hold: 0,
    switchAt: -1e9,
    elapsed: 0,
    inZoneMs: 0,
    lastStarAt: 0,
    stars: [],
    pops: [],
    partyAt: -1,
    done: false,
  });

  const scene = useMemo(() => {
    return {
      ...makeCourse(level, difficulty),
      clouds: makeClouds(6, 17),
      confetti: makeConfetti(34, 9),
    };
  }, [level, difficulty]);

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
    const { hold: holdFactor } = tuning(difficulty);
    const holdNeeded = level.holdMs * holdFactor;
    const { half, targets, clouds, confetti } = scene;
    const n = targets.length;
    const groundY = height * 0.84;
    const kidX = width * 0.17;
    const kidS = unit * 0.95;
    const kiteX = width * 0.6;
    const kiteS = 34 * unit;
    const lowY = groundY - 70 * unit;
    const highY = 70 * unit;
    const altToY = (a: number) => lowY - a * (lowY - highY);
    let raf = 0;
    let last = performance.now();
    const rand = seeded(1234);

    const paint = (t: number) => {
      drawSky(ctx, width, height);
      drawSun(ctx, width * 0.88, height * 0.12, 46 * unit);
      for (const c of clouds) {
        const x = ((c.x * width - (t / 40) * c.speed * unit) % (width + 200 * unit)) + width + 200 * unit;
        drawCloud(ctx, (x % (width + 200 * unit)) - 100 * unit, c.y * height, c.s * unit);
      }

      // Bande cible (fondu au changement)
      const since = t - s.switchAt;
      const bandAlpha = s.partyAt >= 0 ? 0 : since < SWITCH_MS ? clamp01((since - SWITCH_MS * 0.45) / (SWITCH_MS * 0.55)) : 1;
      if (s.stage < n) {
        const a = targets[s.stage];
        drawWindBand(ctx, width, altToY(a + half), altToY(a - half), t / 6, bandAlpha, t);
      }

      // Étoiles dans la bande
      for (const st of s.stars) drawStar(ctx, st.x, st.y, st.r, st.color, st.rot);
      for (const p of s.pops) {
        const u = clamp01((t - p.at) / 500);
        ctx.save();
        ctx.globalAlpha = 1 - u;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 4 * unit;
        ctx.beginPath();
        ctx.arc(p.x, p.y, (10 + u * 40) * unit, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      drawHill(ctx, width, height, groundY, unit);

      const ky = altToY(s.alt);
      const kx = kiteX + Math.sin(t / 1100) * 8 * unit + s.power * 10 * unit;
      const shoulderX = kidX + 14 * kidS;
      const shoulderY = groundY - 70 * kidS;
      const arm = Math.max(-1.35, Math.min(-0.1, Math.atan2(ky - shoulderY, kx - shoulderX)));
      const hand = drawKid(ctx, kidX, groundY + 4 * unit, kidS, arm, t);
      drawString(ctx, hand.x, hand.y, kx, ky + kiteS * 0.2, (1 - s.alt) * 50 * unit + 10 * unit);

      const inZone = s.stage < n && Math.abs(s.alt - targets[s.stage]) <= half;
      drawWind(ctx, kx, ky, kiteS, s.power, t);
      const tilt = 0.3 + s.vAlt * 6 + Math.sin(t / 700) * 0.04;
      drawKite(ctx, kx, ky, kiteS, tilt, t, inZone ? 1 : 0);
      if (s.stage < n && s.partyAt < 0) drawHoldRing(ctx, kx, ky, kiteS * 1.7, s.hold / holdNeeded);

      if (s.partyAt >= 0) {
        const age = (t - s.partyAt) / 1000;
        for (const c of confetti) {
          const x = kx + c.x * 30 * unit + c.vx * unit * age * 30;
          const y = ky + c.vy * unit * age * 30 + 0.5 * 9 * unit * age * age * 30;
          if (y > height) continue;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(c.spin + age * 5);
          ctx.fillStyle = c.color;
          ctx.fillRect(-5 * unit, -8 * unit, 10 * unit, 16 * unit);
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

      if (s.partyAt >= 0) {
        // Fête : le cerf-volant monte tout en haut.
        s.vAlt = 0;
        s.alt += (1 - s.alt) * Math.min(1, 0.05 * k);
        paint(t);
        if (t - s.partyAt >= PARTY_MS && !s.done) {
          s.done = true;
          const efficiency = (n * holdNeeded) / Math.max(1, s.elapsed);
          const stars: Stars = efficiency >= 0.55 ? 3 : efficiency >= 0.35 ? 2 : 1;
          onComplete({ stars, score: Math.round(s.inZoneMs / 100) });
          return;
        }
        raf = requestAnimationFrame(frame);
        return;
      }

      s.elapsed += dt;
      // Inertie du cerf-volant : il suit la force du souffle avec un peu de retard.
      const targetAlt = clamp01(s.power);
      const prevAlt = s.alt;
      s.alt += (targetAlt - s.alt) * Math.min(1, FOLLOW * k);
      s.vAlt = (s.alt - prevAlt) / Math.max(0.5, k);

      const kx = kiteX;
      const ky = altToY(s.alt);
      const switching = t - s.switchAt < SWITCH_MS;
      const a = targets[s.stage];
      const inZone = !switching && Math.abs(s.alt - a) <= half;

      if (inZone) {
        s.hold = Math.min(holdNeeded, s.hold + dt);
        s.inZoneMs += dt;
      } else if (!switching) {
        s.hold = Math.max(0, s.hold - dt * HOLD_DECAY);
      }

      // Étoiles qui filent dans la bande ; attrapées si le cerf-volant y est.
      if (!switching && t - s.lastStarAt > STAR_EVERY_MS) {
        s.lastStarAt = t;
        const y = altToY(a + (rand() * 2 - 1) * half * 0.8);
        s.stars.push({ x: width + 40 * unit, y, r: (9 + rand() * 5) * unit, color: RAINBOW[Math.floor(rand() * RAINBOW.length)], rot: rand() * 6, spin: (rand() - 0.5) * 0.08 });
      }
      const starSpeed = 3.2 * unit;
      s.stars = s.stars.filter((st) => {
        st.x -= starSpeed * k;
        st.rot += st.spin * k;
        if (Math.abs(st.x - kx) < kiteS * 0.9 && Math.abs(st.y - ky) < kiteS * 1.2) {
          s.pops.push({ x: st.x, y: st.y, at: t, color: st.color });
          return false;
        }
        return st.x > -40 * unit;
      });
      s.pops = s.pops.filter((p) => t - p.at < 500);

      if (s.hold >= holdNeeded) {
        // Cible réussie : pluie d'anneaux, bande suivante.
        for (let i = 0; i < 6; i++) s.pops.push({ x: kx + (rand() - 0.5) * 120 * unit, y: ky + (rand() - 0.5) * 120 * unit, at: t + i * 60, color: RAINBOW[i] });
        s.stage += 1;
        s.hold = 0;
        s.stars = [];
        s.switchAt = t;
        if (s.stage >= n) {
          s.partyAt = t;
          play('fanfare');
        } else {
          play('step');
        }
      }

      onProgress?.(clamp01((s.stage + s.hold / holdNeeded) / n));
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
