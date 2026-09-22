import { useEffect, useRef } from 'react';
import { play } from '../../audio/sfx';
import { setupCanvas } from '../_shared/canvas';
import { gameUnit } from '../_shared/math';
import { starsForTime } from '../_shared/stars';
import type { GameProps } from '../types';
import {
  HILL_FAR,
  HILL_NEAR,
  clamp01,
  drawBird,
  drawCheer,
  drawCloud,
  drawCorridor,
  drawHills,
  drawPole,
  drawPuff,
  drawSky,
  drawSplash,
  drawWater,
  drawWind,
} from './draw';
import type { OiseauLevel } from './index';
import styles from './oiseau.module.css';
import {
  CRUISE,
  ESCAPE_MS,
  FOLLOW,
  LANDING_MS,
  LOWER_BOUND,
  PARTY_MS,
  PERCH_MS,
  SKY,
  SPEED,
  SPLASH_MS,
  TAKEOFF_MS,
  TAKEOFF_THRESHOLD,
  UPPER_BOUND,
  targetAltitude,
  tuning,
} from './rules';

type Phase = 'perch' | 'flight' | 'landing' | 'splash' | 'escape' | 'party';

interface Sim {
  phase: Phase;
  /** Pole the bird is standing on / flying from (0 = the start). */
  from: number;
  /** Progress of the current hop, 0 → 1. */
  hop: number;
  /** Altitude, 0 = water, 1 = top of the sky. */
  alt: number;
  power: number;
  blowMs: number;
  phaseAt: number;
  /** Altitude the bird fell/rose from, for the splash and escape animations. */
  lostAt: number;
  flap: number;
  falls: number;
  elapsed: number;
  done: boolean;
}

/**
 * Oiseau voyageur. Canvas 2D driven by a rAF loop, simulation state in a ref.
 * The camera stays on the hop in progress: the pole left behind sits on the
 * left of the screen, the one being aimed for on the right.
 */
export function Game({ level, breath, width, height, paused, difficulty, onProgress, onComplete }: GameProps<OiseauLevel>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sim = useRef<Sim>({
    phase: 'perch',
    from: 0,
    hop: 0,
    alt: CRUISE,
    power: 0,
    blowMs: 0,
    phaseAt: -1,
    lostAt: CRUISE,
    flap: 0,
    falls: 0,
    elapsed: 0,
    done: false,
  });

  useEffect(() => {
    if (paused) return;
    const canvas = canvasRef.current;
    const ctx = canvas && setupCanvas(canvas, width, height);
    if (!canvas || !ctx) return;

    const s = sim.current;
    const unit = gameUnit(width, height);
    // The corridor is the level's own, untouched by the difficulty: only the
    // distance between the poles changes with it.
    const half = level.corridor / 2;

    // Layout: the lake fills the bottom, the poles stand in it, and the sky
    // above is where the bird can fly. Altitude 0..1 maps onto `skyBot..skyTop`.
    // `skyBot` sits below the waterline so that altitude 0 really is the water:
    // a bird that sinks out of the corridor ends up in the lake, not above it.
    // The flyable band is deliberately shorter than the sky: the corridor has
    // to stay wide in *altitude* (a child's breath wobbles, and a narrower one
    // would be unwinnable — the balance suite checks this), so it is the sky
    // that shrinks to make that band read as a lane rather than as open air.
    const waterY = height * 0.72;
    const skyBot = waterY;
    const skyTop = height * 0.26;
    const altY = (a: number) => skyBot + (skyTop - skyBot) * a;
    // The poles are drawn at the cruising altitude, so the bird takes off and
    // lands without having to correct its height.
    const poleTopY = altY(CRUISE);
    const leftX = width * 0.2;
    const rightX = width * 0.82;

    // Clouds drift by; they scroll with the hop so the flight reads as travel.
    const clouds = Array.from({ length: 5 }, (_, i) => ({
      x: (i * 0.27 + 0.1) % 1,
      y: 0.08 + ((i * 37) % 26) / 100,
      s: 0.42 + ((i * 53) % 30) / 100,
    }));

    let raf = 0;
    let last = performance.now();

    const paint = (t: number) => {
      const scroll = (s.from + s.hop) * width * 0.55;
      drawSky(ctx, width, height);
      for (const c of clouds) {
        const x = ((c.x * width * 2 - scroll * 0.35) % (width + 260 * unit) + width + 260 * unit) % (width + 260 * unit) - 130 * unit;
        drawCloud(ctx, x, c.y * height, c.s * unit);
      }
      drawHills(ctx, width, waterY, scroll * 0.2, unit, HILL_FAR, 120, 460);
      drawHills(ctx, width, waterY, scroll * 0.4 + 260, unit, HILL_NEAR, 66, 280);
      drawWater(ctx, width, height, waterY, unit, t);

      // The level's own corridor is a lighter guide, always visible so the
      // child can see the lane even before taking off. The lines that
      // actually cost the bird the crossing are the fixed bounds below.
      const guideTopY = altY(CRUISE + half);
      const guideBotY = altY(CRUISE - half);
      drawCorridor(ctx, width, guideTopY, guideBotY, unit, t, 0, 0.35);

      // The corridor's danger tint and wind are only shown while it matters —
      // in flight — and follow the real, fixed fall boundaries.
      const flying = s.phase === 'flight';
      const topY = altY(UPPER_BOUND);
      const botY = altY(LOWER_BOUND);
      if (flying) {
        // Coral edges bite as the bird nears them: the warning before the
        // fall. The bounds sit off-centre from CRUISE, so each side is
        // judged against its own distance rather than a shared half-width.
        const belowFrac = s.alt < CRUISE ? (CRUISE - s.alt) / (CRUISE - LOWER_BOUND) : 0;
        const aboveFrac = s.alt > CRUISE ? (s.alt - CRUISE) / (UPPER_BOUND - CRUISE) : 0;
        const danger = clamp01((Math.max(belowFrac, aboveFrac) - 0.55) / 0.45);
        drawWind(ctx, width, topY, botY, unit, t, s.power);
        drawCorridor(ctx, width, topY, botY, unit, t, danger, 1);
      }

      // Poles: the one left behind, and the one being aimed for. The bird
      // stays at a fixed x and the poles slide past it, so the corridor is
      // always read at the same place on the screen.
      const hopX = leftX;
      const glow = s.phase === 'flight' ? 0.35 + Math.sin(t / 320) * 0.15 : 0;
      // Both slide left as the hop advances, so the bird stays roughly centred.
      const slide = s.hop * (rightX - leftX);
      drawPole(ctx, leftX - slide, poleTopY, waterY, unit, 0, t);
      drawPole(ctx, rightX - slide, poleTopY, waterY, unit, glow, t);

      // Bird
      const age = s.phaseAt >= 0 ? t - s.phaseAt : 0;
      if (s.phase === 'splash') {
        const u = clamp01(age / SPLASH_MS);
        drawSplash(ctx, hopX, waterY, unit, u);
      } else if (s.phase === 'escape') {
        const u = clamp01(age / ESCAPE_MS);
        drawPuff(ctx, hopX, altY(SKY), unit, u);
      } else {
        // Banks nose-up when climbing, nose-down when sinking: the bird's
        // posture repeats what the corridor is already saying.
        const tilt = s.phase === 'flight'
          ? clamp01((CRUISE - s.alt) / (CRUISE - LOWER_BOUND)) * 0.3 - clamp01((s.alt - CRUISE) / (UPPER_BOUND - CRUISE)) * 0.3
          : 0;
        const flapSpeed = s.phase === 'flight' ? 0.22 + s.power * 0.3 : 0.1;
        s.flap += flapSpeed;
        const y = s.phase === 'perch' ? poleTopY - 8 * unit : altY(s.alt);
        drawBird(ctx, hopX, y, 0.62 * unit, s.flap, tilt, t);
        if (s.phase === 'landing' || s.phase === 'party') {
          const u = clamp01(age / (s.phase === 'party' ? PARTY_MS : LANDING_MS));
          if (u < 1) drawCheer(ctx, hopX, y - 50 * unit, unit, u);
        }
      }
    };

    /** The bird is back on the pole it left: start the crossing again. */
    const backToPole = () => {
      s.phase = 'perch';
      s.hop = 0;
      s.alt = CRUISE;
      s.blowMs = 0;
      s.phaseAt = -1;
    };

    const frame = (t: number) => {
      const dt = Math.min(50, t - last);
      last = t;
      const k = dt / 16.67;
      const raw = breath.getState().intensity;
      s.power += (raw - s.power) * Math.min(1, 0.25 * k);
      if (s.phase !== 'party') s.elapsed += dt;

      switch (s.phase) {
        case 'perch': {
          // The bird settles first: a breath back for the child between two
          // crossings, and the pole does not launch on a stray puff.
          if (s.phaseAt >= 0 && t - s.phaseAt < PERCH_MS) break;
          // A sustained blow lifts the bird off the pole.
          s.blowMs = raw > TAKEOFF_THRESHOLD ? s.blowMs + dt : Math.max(0, s.blowMs - dt * 2);
          if (s.blowMs >= TAKEOFF_MS) {
            s.phase = 'flight';
            s.phaseAt = t;
            play('whoosh');
          }
          break;
        }
        case 'flight': {
          // Altitude follows the breath; the hop advances on its own.
          s.alt += (targetAltitude(s.power) - s.alt) * Math.min(1, FOLLOW * k);
          // A wider span is crossed at the same speed, so it simply takes
          // longer: that is what the difficulty buys — a longer unbroken blow.
          s.hop += (SPEED / tuning(difficulty).span) * k;

          // Leaving the flyable band loses the bird — the water below, the sky above.
          if (s.alt <= LOWER_BOUND) {
            s.phase = 'splash';
            s.phaseAt = t;
            s.lostAt = s.alt;
            s.falls++;
            play('thud');
          } else if (s.alt >= UPPER_BOUND) {
            s.phase = 'escape';
            s.phaseAt = t;
            s.lostAt = s.alt;
            s.falls++;
            play('thud');
          } else if (s.hop >= 1) {
            s.hop = 1;
            s.phase = 'landing';
            s.phaseAt = t;
            play('step');
          }
          break;
        }
        case 'landing': {
          // Settle onto the perch, then either the next hop or the party.
          const u = clamp01((t - s.phaseAt) / LANDING_MS);
          s.alt = CRUISE + (s.alt - CRUISE) * (1 - u);
          if (u >= 1) {
            s.from += 1;
            if (s.from >= level.poles) {
              s.phase = 'party';
              s.phaseAt = t;
              play('fanfare');
            } else {
              s.hop = 0;
              s.alt = CRUISE;
              s.blowMs = 0;
              s.phase = 'perch';
              s.phaseAt = t;
            }
          }
          break;
        }
        case 'splash':
        case 'escape': {
          if (t - s.phaseAt >= (s.phase === 'splash' ? SPLASH_MS : ESCAPE_MS)) backToPole();
          break;
        }
        case 'party': {
          if (t - s.phaseAt >= PARTY_MS && !s.done) {
            s.done = true;
            onComplete({ stars: starsForTime(s.elapsed, level.parMs), score: s.falls });
            paint(t);
            return;
          }
          break;
        }
      }

      onProgress?.(clamp01((s.from + s.hop) / level.poles));
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
