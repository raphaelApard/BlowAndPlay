import { useEffect, useMemo, useRef } from 'react';
import { play } from '../../audio/sfx';
import { canvasDpr } from '../_shared/canvas';
import { gameUnit } from '../_shared/math';
import { starsForTime } from '../_shared/stars';
import type { GameProps } from '../types';
import {
  clamp01,
  drawAim,
  drawBank,
  drawFrog,
  drawHop,
  drawPad,
  drawSky,
  drawSplash,
  drawSun,
  drawWater,
} from './draw';
import type { GrenouilleLevel } from './index';
import styles from './grenouille.module.css';
import { AIM_MS, GAP, JUMP_MS, MIN_CHARGE, PAD_R, PARTY_MS, SETTLE_MS, SPLASH_MS, landingHalf, padGaps, reachFor } from './rules';

type Phase =
  /** Waiting: the child charges a blow, the arc follows it. */
  | { kind: 'aim' }
  /** In flight, from `fromGap` to `toGap`, landing on a pad or in the water. */
  | { kind: 'jump'; at: number; fromGap: number; toGap: number; hit: boolean }
  /** Splashed: the frog climbs back on the pad it came from. */
  | { kind: 'splash'; at: number; gap: number }
  /** Landed: a short settle before the next aim. */
  | { kind: 'settle'; at: number }
  /** Arrived on the last pad: the pond celebrates. */
  | { kind: 'party'; at: number };

interface Hop {
  x: number;
  y: number;
  at: number;
}

interface Sim {
  /** Position of the frog, in gaps from the start. */
  at: number;
  /** Where the view is centred, trailing `at` so the pond slides. */
  camera: number;
  index: number;
  phase: Phase;
  /** Smoothed breath (like `s.power` in the other games). */
  power: number;
  /** How long the current blow has lasted (ms); 0 when not blowing. */
  chargeMs: number;
  /**
   * Strongest `power` reached during the current blow. The aim is this, not
   * the live `power`: the engine only calls the blow over once the intensity
   * has fallen back under its release threshold, so reading `power` at that
   * point would arm the jump with the tail of the breath instead of the aim
   * the child was holding.
   */
  peak: number;
  elapsed: number;
  hops: Hop[];
  splashes: Hop[];
  done: boolean;
}

/**
 * Grenouille. Canvas 2D driven by a rAF loop, state in a ref.
 * The strength of the blow arms the jump (the dotted arc shows where it would
 * land); releasing the breath sends the frog off. Missing costs time, never
 * the level: the frog climbs back on the pad it came from.
 */
export function Game({ level, breath, width, height, paused, difficulty, onProgress, onComplete }: GameProps<GrenouilleLevel>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sim = useRef<Sim>({
    at: 0,
    camera: 0,
    index: 0,
    phase: { kind: 'aim' },
    power: 0,
    chargeMs: 0,
    peak: 0,
    elapsed: 0,
    hops: [],
    splashes: [],
    done: false,
  });

  const gaps = useMemo(() => padGaps(level.pads, difficulty, 4100 + level.pads * 37), [level, difficulty]);

  useEffect(() => {
    if (paused) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = canvasDpr();
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const s = sim.current;
    const unit = gameUnit(width, height);
    const half = landingHalf(difficulty);
    const n = gaps.length;
    const horizon = height * 0.42;
    const padY = height * 0.72;
    const gapPx = GAP * unit;
    const padR = PAD_R * unit;
    const frogS = unit * 0.85;
    /** The frog stays put on screen; the pond scrolls behind it. */
    const frogX = width * 0.3;
    // The camera trails `s.at` instead of snapping to it, so landing on a pad
    // slides the pond along rather than jumping it.
    const gapToX = (gap: number) => frogX + (gap - s.camera) * gapPx;

    let raf = 0;
    let last = performance.now();

    const paint = (t: number) => {
      drawSky(ctx, width, horizon);
      drawSun(ctx, width * 0.84, height * 0.14, 42 * unit);
      drawBank(ctx, width, horizon, unit);
      drawWater(ctx, width, height, horizon, unit, t);

      // The starting bank, behind the frog.
      const startX = gapToX(0);
      if (startX > -200 * unit) {
        ctx.save();
        ctx.globalAlpha = 0.9;
        drawPad(ctx, startX, padY, padR, t, 0, false);
        ctx.restore();
      }

      for (const [i, gap] of gaps.entries()) {
        const x = gapToX(gap);
        if (x < -padR * 3 || x > width + padR * 3) continue;
        const next = i === s.index;
        drawPad(ctx, x, padY, padR, t, next && s.phase.kind === 'aim' ? 1 : 0, i === n - 1);
      }

      for (const sp of s.splashes) {
        const u = clamp01((t - sp.at) / 600);
        if (u < 1) drawSplash(ctx, gapToX(sp.x), sp.y, unit, u);
      }
      for (const h of s.hops) {
        const u = clamp01((t - h.at) / 600);
        if (u < 1) drawHop(ctx, gapToX(h.x), h.y, unit, u);
      }

      // The frog, and the aim arc while charging. It is drawn at its real
      // place in the pond (`gapToX(s.at)`), not at `frogX`: the camera trails
      // `s.at`, so pinning it to `frogX` would snap it forward on landing and
      // let it drift while the pond caught up.
      const p = s.phase;
      const restX = gapToX(s.at);
      let fx = restX;
      let fy = padY;
      let squash = 0;
      let airborne = 0;
      if (p.kind === 'jump') {
        const u = clamp01((t - p.at) / JUMP_MS);
        const x0 = gapToX(p.fromGap);
        const x1 = gapToX(p.toGap);
        fx = x0 + (x1 - x0) * u;
        fy = padY - Math.sin(u * Math.PI) * Math.min(170 * unit, Math.abs(x1 - x0) * 0.55);
        airborne = Math.sin(u * Math.PI);
        if (!p.hit && u > 0.85) fy = padY + (u - 0.85) * 60 * unit;
      } else if (p.kind === 'splash') {
        const u = clamp01((t - p.at) / SPLASH_MS);
        // Sinks where it fell, then swims back to the pad it came from —
        // without this return leg the frog would sit on open water and then
        // snap onto its pad when the next aim started.
        const swim = clamp01((u - 0.35) / 0.65);
        fx = gapToX(p.gap + (s.at - p.gap) * swim);
        fy = padY + Math.sin(Math.min(1, u * 2.4) * Math.PI) * 26 * unit * (1 - swim * 0.6);
      } else if (p.kind === 'aim') {
        // The arc holds at the peak of the blow: it is a sight the child sets
        // and reads, so it must not shrink back while they stop to let go.
        const charge = s.chargeMs > 0 ? s.peak : s.power;
        squash = clamp01(charge);
        const reach = reachFor(charge, difficulty);
        if (charge >= MIN_CHARGE) drawAim(ctx, restX, padY, restX + reach * gapPx, unit, t);
      } else if (p.kind === 'party') {
        const u = clamp01((t - p.at) / PARTY_MS);
        fy = padY - Math.abs(Math.sin(u * Math.PI * 3)) * 40 * unit;
      }
      drawFrog(ctx, fx, fy, frogS, squash, airborne, t);
    };

    /** Fires the jump with the charge the child released at. */
    const jump = (t: number, charge: number) => {
      const reach = reachFor(charge, difficulty);
      const wanted = gaps[s.index] - s.at;
      const hit = Math.abs(reach - wanted) <= half;
      const toGap = hit ? gaps[s.index] : s.at + reach;
      s.phase = { kind: 'jump', at: t, fromGap: s.at, toGap, hit };
      play('whoosh');
    };

    const frame = (t: number) => {
      const dt = Math.min(50, t - last);
      last = t;
      const k = dt / 16.67;
      const raw = breath.getState().intensity;
      s.power += (raw - s.power) * Math.min(1, 0.25 * k);
      const p = s.phase;

      if (p.kind === 'party') {
        s.camera += (s.at - s.camera) * Math.min(1, 0.16 * k);
        paint(t);
        if (t - p.at >= PARTY_MS && !s.done) {
          s.done = true;
          onComplete({ stars: starsForTime(s.elapsed, level.parMs), score: s.index });
          return;
        }
        raf = requestAnimationFrame(frame);
        return;
      }

      s.elapsed += dt;

      if (p.kind === 'aim') {
        const blowing = breath.getState().isBlowing;
        if (blowing) {
          s.chargeMs += dt;
          s.peak = Math.max(s.peak, s.power);
        } else if (s.chargeMs > 0) {
          // Released: the jump goes off with the charge the arc was showing.
          const charge = s.peak;
          s.chargeMs = 0;
          s.peak = 0;
          if (charge >= MIN_CHARGE) jump(t, charge);
        }
        // A blow held far too long springs on its own, so the frog never
        // gets stuck waiting for a child who keeps blowing.
        if (s.chargeMs >= AIM_MS * 4) {
          const charge = s.peak;
          s.chargeMs = 0;
          s.peak = 0;
          jump(t, charge);
        }
      } else if (p.kind === 'jump') {
        if (t - p.at >= JUMP_MS) {
          if (p.hit) {
            s.at = p.toGap;
            s.index += 1;
            s.hops.push({ x: s.at, y: padY - 30 * unit, at: t });
            play('step');
            if (s.index >= n) {
              s.phase = { kind: 'party', at: t };
              play('fanfare');
            } else {
              s.phase = { kind: 'settle', at: t };
            }
          } else {
            s.splashes.push({ x: p.toGap, y: padY, at: t });
            s.phase = { kind: 'splash', at: t, gap: p.toGap };
            play('thud');
          }
        }
      } else if (p.kind === 'splash') {
        if (t - p.at >= SPLASH_MS) s.phase = { kind: 'aim' };
      } else if (p.kind === 'settle') {
        if (t - p.at >= SETTLE_MS) s.phase = { kind: 'aim' };
      }

      s.camera += (s.at - s.camera) * Math.min(1, 0.16 * k);
      s.hops = s.hops.filter((h) => t - h.at < 600);
      s.splashes = s.splashes.filter((sp) => t - sp.at < 600);

      onProgress?.(clamp01(s.index / n));
      paint(t);
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [breath, level, gaps, width, height, paused, difficulty, onProgress, onComplete]);

  return (
    <div className={styles.root}>
      <canvas ref={canvasRef} className={styles.canvas} style={{ width, height }} />
    </div>
  );
}
