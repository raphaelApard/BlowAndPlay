import { useEffect, useRef } from 'react';
import { play } from '../../audio/sfx';
import { canvasDpr } from '../_shared/canvas';
import { gameUnit } from '../_shared/math';
import { starsForTime } from '../_shared/stars';
import type { GameProps } from '../types';
import { BODY_COLORS, clamp01, drawBlower, drawCheer, drawDancer, drawGround, drawSky, drawSun } from './draw';
import type { BonhommeLevel } from './index';
import styles from './bonhomme.module.css';
import { JOIN_MS, PARTY_MS, deflatePerFrame, inflatePerFrame, tuning } from './rules';

interface Cheer {
  x: number;
  y: number;
  at: number;
}

interface Sim {
  /** Figures already dancing. */
  standing: number;
  /** How far the current figure has unfolded, 0..1. */
  h: number;
  /** Time spent fully up, towards `holdMs`. */
  hold: number;
  power: number;
  elapsed: number;
  cheers: Cheer[];
  /** While >= 0, a friend is joining the dance. */
  joinAt: number;
  partyAt: number;
  done: boolean;
}

/**
 * Bonhomme gonflable. Canvas 2D driven by a rAF loop, state in a ref.
 * The figure unfolds while the child blows and sags as soon as they stop;
 * holding it fully up brings a friend into the dance.
 */
export function Game({ level, breath, width, height, paused, difficulty, onProgress, onComplete }: GameProps<BonhommeLevel>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sim = useRef<Sim>({
    standing: 0,
    h: 0,
    hold: 0,
    power: 0,
    elapsed: 0,
    cheers: [],
    joinAt: -1,
    partyAt: -1,
    done: false,
  });

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
    const { blow, sag } = tuning(difficulty);
    const rise = inflatePerFrame(level.blowMs, blow);
    const fall = deflatePerFrame(level.blowMs, blow, sag);
    const total = level.figures;
    const groundY = height * 0.82;
    const dancerS = unit * 1.15;
    /** The troupe is spread across the forecourt, the active one in front. */
    const slotX = (i: number) => width * (0.5 + (i - (total - 1) / 2) * 0.17);

    let raf = 0;
    let last = performance.now();

    const paint = (t: number) => {
      drawSky(ctx, width, height);
      drawSun(ctx, width * 0.86, height * 0.15, 42 * unit);
      drawGround(ctx, width, height, groundY, unit);

      // Friends already dancing, waving away in the background.
      for (let i = 0; i < s.standing; i++) {
        drawDancer(ctx, slotX(i), groundY, dancerS * 0.75, BODY_COLORS[i % BODY_COLORS.length], 1, t + i * 400);
      }

      if (s.partyAt >= 0) return;

      // The one being blown up, in front.
      const x = width * 0.5;
      const joining = s.joinAt >= 0 && t - s.joinAt < JOIN_MS;
      if (!joining) {
        drawDancer(ctx, x, groundY, dancerS, BODY_COLORS[s.standing % BODY_COLORS.length], s.h, t);
        drawBlower(ctx, x, groundY + 4 * unit, unit, s.power);
      }

      for (const c of s.cheers) {
        const u = clamp01((t - c.at) / 700);
        if (u < 1) drawCheer(ctx, c.x, c.y, unit, u);
      }
    };

    const frame = (t: number) => {
      const dt = Math.min(50, t - last);
      last = t;
      const k = dt / 16.67;
      const raw = breath.getState().intensity;
      s.power += (raw - s.power) * Math.min(1, 0.25 * k);

      if (s.partyAt >= 0) {
        paint(t);
        if (t - s.partyAt >= PARTY_MS && !s.done) {
          s.done = true;
          onComplete({ stars: starsForTime(s.elapsed, level.parMs), score: s.standing });
          return;
        }
        raf = requestAnimationFrame(frame);
        return;
      }

      s.elapsed += dt;

      const joining = s.joinAt >= 0 && t - s.joinAt < JOIN_MS;
      if (s.joinAt >= 0 && !joining) s.joinAt = -1;

      if (!joining) {
        const blowing = breath.getState().isBlowing;
        if (blowing && s.power > 0.08) {
          s.h = Math.min(1, s.h + rise * (0.5 + s.power) * k);
        } else {
          s.h = Math.max(0, s.h - fall * k);
        }

        if (s.h >= 1) {
          s.hold += dt;
          if (s.hold >= level.holdMs) {
            s.standing += 1;
            s.hold = 0;
            s.h = 0;
            s.cheers.push({ x: width * 0.5, y: groundY - 210 * dancerS, at: t });
            play('step');
            if (s.standing >= total) {
              s.partyAt = t;
              play('fanfare');
            } else {
              s.joinAt = t;
            }
          }
        } else {
          s.hold = 0;
        }
      }

      s.cheers = s.cheers.filter((c) => t - c.at < 700);

      onProgress?.(clamp01((s.standing + s.h) / total));
      paint(t);
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [breath, level, width, height, paused, difficulty, onProgress, onComplete]);

  return (
    <div className={styles.root}>
      <canvas ref={canvasRef} className={styles.canvas} style={{ width, height }} />
    </div>
  );
}
