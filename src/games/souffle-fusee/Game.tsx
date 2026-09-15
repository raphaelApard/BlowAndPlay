import { play } from '../../audio/sfx';
import { mixHex, seeded } from '../_shared/math';
import { starsForTime } from '../_shared/stars';
import { getLang, t } from '../../i18n';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameProps } from '../types';
import { Rocket } from './Rocket';
import type { SouffleFuseeLevel } from './index';
import styles from './fusee.module.css';
import { DRAG, MAX_VEL, MIN_VEL, THRUST, clamp01, tuning } from './rules';

/** Sky gradient according to altitude (0 = ground, 1 = Moon). */
const SKY_STOPS = [
  { p: 0, top: '#8fd4f7', mid: '#cdeeff', bot: '#e9f8ff' },
  { p: 0.35, top: '#4d9fdd', mid: '#8fd4f7', bot: '#cdeeff' },
  { p: 0.62, top: '#1d3f8f', mid: '#3a6fc0', bot: '#79b6e8' },
  { p: 0.82, top: '#0a1230', mid: '#111f4d', bot: '#26407e' },
  { p: 1, top: '#04060f', mid: '#070c1d', bot: '#0b1330' },
];

const LANDING_MS = 2200;
/** Celebration after landing: a lap around the Moon, rings. */
const PARTY_MS = 5200;
/** Moon diameter at the end of the flight (220px × scale 2.2), cf. fusee.module.css. */
const MOON_BASE = 220;
const MOON_SCALE = 2.2;
/** Hauteur de la flamme sous le corps (0.9em − 0.06em de chevauchement), cf. .flame. */
const ROCKET_FLAME_EM = 0.9 - 0.06;
const ROCKET_EM = 64;

function skyGradient(p: number) {
  let a = SKY_STOPS[0];
  let b = SKY_STOPS[SKY_STOPS.length - 1];
  for (let i = 0; i < SKY_STOPS.length - 1; i++) {
    if (p >= SKY_STOPS[i].p && p <= SKY_STOPS[i + 1].p) {
      a = SKY_STOPS[i];
      b = SKY_STOPS[i + 1];
    }
  }
  const t = (p - a.p) / Math.max(0.0001, b.p - a.p);
  return `linear-gradient(${mixHex(a.top, b.top, t)} 0%, ${mixHex(a.mid, b.mid, t)} 55%, ${mixHex(a.bot, b.bot, t)} 100%)`;
}

interface Star {
  left: number;
  top: number;
  size: number;
  dur: number;
  delay: number;
}

function makeStars(count: number, seed: number): Star[] {
  const rand = seeded(seed);
  return Array.from({ length: count }, () => ({
    left: +(rand() * 100).toFixed(2),
    top: +(rand() * 110).toFixed(2),
    size: +(1.5 + rand() * 3).toFixed(1),
    dur: +(1.2 + rand() * 2.4).toFixed(2),
    delay: +(rand() * 2).toFixed(2),
  }));
}

/** Trail of the lap around the Moon: increasingly pale dots, lagging behind the rocket. */
const TRAIL = [0.55, 0.45, 0.36, 0.28, 0.2, 0.13, 0.08].map((opacity, i) => ({ opacity, delay: -(0.12 * (i + 1)) }));

/**
 * Souffle-Fusée. DOM rendering driven by refs in a rAF loop (no React
 * re-render per frame). The breath comes from the engine (already calibrated
 * and smoothed); the keyboard/finger source provides the prototype's "assist".
 */
export function Game({ level, breath, height, paused, difficulty, onProgress, onComplete }: GameProps<SouffleFuseeLevel>) {
  const skyRef = useRef<HTMLDivElement>(null);
  const starsRef = useRef<HTMLDivElement>(null);
  const moonRef = useRef<HTMLDivElement>(null);
  const cloudsRef = useRef<HTMLDivElement>(null);
  const groundRef = useRef<HTMLDivElement>(null);
  const rocketRef = useRef<HTMLDivElement>(null);
  const flameRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef<HTMLDivElement>(null);

  // Simulation state, outside React.
  const sim = useRef({ alt: 0, vel: 0, power: 0, elapsed: 0, landingAt: -1, done: false });
  const [phase, setPhase] = useState<'flight' | 'landing' | 'party'>('flight');

  const stars = useMemo(() => makeStars(70, 1234), []);

  useEffect(() => {
    if (paused) return;
    let raf = 0;
    let last = performance.now();
    const s = sim.current;
    const { distance, gravity } = tuning(difficulty);
    const MAX = level.maxAltitude * distance;

    // Landing geometry: the Moon comes down to show its top, and the rocket
    // settles on it (base of the body on the top edge of the disc).
    const moonRadius = (MOON_BASE * MOON_SCALE) / 2;
    const moonCenterFlight = height * 0.08 + MOON_BASE / 2;
    const moonCenterLanded = height * 0.62;
    const moonDy = moonCenterLanded - moonCenterFlight;
    const bodyBottomFlight = height * 0.96 - ROCKET_FLAME_EM * ROCKET_EM - height * 0.14;
    const rocketDy = moonCenterLanded - moonRadius - bodyBottomFlight;

    const paint = (p: number) => {
      const scroll = s.alt * 3.2;
      if (skyRef.current) skyRef.current.style.background = skyGradient(p);
      if (starsRef.current) starsRef.current.style.opacity = String(clamp01((p - 0.4) / 0.3));
      if (cloudsRef.current) {
        cloudsRef.current.style.transform = `translateY(${scroll * 0.62}px)`;
        cloudsRef.current.style.opacity = String(clamp01(1 - Math.max(0, (p - 0.4) / 0.25)));
      }
      if (groundRef.current) groundRef.current.style.transform = `translateY(${Math.min(scroll * 0.9, height * 1.4)}px)`;
      if (moonRef.current) {
        const m = clamp01((p - 0.5) / 0.5);
        moonRef.current.style.opacity = String(m);
        moonRef.current.style.transform = `translateX(-50%) scale(${0.3 + m * m * 1.9}) translateY(${(1 - m) * -120}px)`;
      }
      if (rocketRef.current && s.landingAt < 0) {
        const lift = Math.min(1, s.alt / 160);
        rocketRef.current.style.transform = `translateX(-50%) translateY(${-lift * height * 0.14}px) rotate(${s.power * 2 - 1}deg)`;
      }
      if (flameRef.current) {
        flameRef.current.style.transform = `scaleY(${0.12 + s.power * 1.25}) scaleX(${0.85 + s.power * 0.3})`;
      }
      if (phaseRef.current) {
        phaseRef.current.textContent =
          t(getLang(), p < 0.08 ? 'fusee.ground' : p < 0.4 ? 'fusee.sky' : p < 0.72 ? 'fusee.high' : p < 0.95 ? 'fusee.space' : 'fusee.moon');
      }
    };

    const frame = (t: number) => {
      const dt = Math.min(50, t - last);
      last = t;
      const k = dt / 16.67;

      if (s.landingAt >= 0) {
        // Landing on the round Moon: it comes down, the rocket rises to settle
        // on it (a slight bounce), the flame goes out.
        const u = clamp01((t - s.landingAt) / LANDING_MS);
        const ease = 1 - Math.pow(1 - u, 3);
        const settle = 1 + Math.sin(u * Math.PI) * 0.06;
        if (moonRef.current) {
          moonRef.current.style.transform = `translateX(-50%) translateY(${moonDy * ease}px) scale(${MOON_SCALE})`;
        }
        if (rocketRef.current) {
          const y = -height * 0.14 + (rocketDy + height * 0.14) * ease;
          rocketRef.current.style.transform = `translateX(-50%) translateY(${y}px) rotate(${(1 - ease) * 2}deg) scale(${settle})`;
        }
        if (flameRef.current) flameRef.current.style.transform = `scaleY(${(0.12 + s.power) * (1 - ease)})`;
        if (u >= 1) {
          // Landed: time for the celebration (handled by CSS + a timer).
          setPhase('party');
          play('fanfare');
          return;
        }
        raf = requestAnimationFrame(frame);
        return;
      }

      s.elapsed += dt;
      const raw = breath.getState().intensity;
      s.power += (raw - s.power) * Math.min(1, 0.25 * k);
      s.vel += (s.power * THRUST - gravity) * k;
      s.vel = Math.max(MIN_VEL, Math.min(MAX_VEL, s.vel * Math.pow(DRAG, k)));
      s.alt = Math.max(0, s.alt + s.vel * k);

      const p = Math.min(1, s.alt / MAX);
      onProgress?.(p);
      paint(p);

      if (s.alt >= MAX) {
        s.alt = MAX;
        s.landingAt = t;
        setPhase('landing');
        play('whoosh');
      }
      raf = requestAnimationFrame(frame);
    };
    if (phase === 'party') return;
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [breath, level, height, paused, difficulty, phase, onProgress]);

  // Celebration: the Moon rises back to the centre so the whole lap stays visible.
  useEffect(() => {
    if (phase !== 'party' || !moonRef.current) return;
    const moon = moonRef.current;
    const dy = height * 0.5 - (height * 0.08 + MOON_BASE / 2);
    moon.style.transition = 'transform .9s cubic-bezier(.2,.8,.2,1)';
    moon.style.transform = `translateX(-50%) translateY(${dy}px) scale(${MOON_SCALE})`;
    return () => {
      moon.style.transition = '';
    };
  }, [phase, height]);

  // End of the celebration → result (once only).
  useEffect(() => {
    if (phase !== 'party' || paused) return;
    const t = window.setTimeout(() => {
      const s = sim.current;
      if (s.done) return;
      s.done = true;
      const stars = starsForTime(s.elapsed, level.parMs);
      onComplete({ stars, score: Math.round(s.elapsed / 100) });
    }, PARTY_MS);
    return () => window.clearTimeout(t);
  }, [phase, paused, level.parMs, onComplete]);

  const partyCenter = height * 0.5;
  const orbitRadius = (MOON_BASE * MOON_SCALE) / 2 + 70;

  return (
    <div className={styles.root}>
      <div ref={skyRef} className={styles.sky} />

      <div ref={starsRef} className={styles.stars}>
        {stars.map((st, i) => (
          <span
            key={i}
            className={styles.star}
            style={{
              left: `${st.left}%`,
              top: `${st.top}%`,
              width: st.size,
              height: st.size,
              animationDuration: `${st.dur}s`,
              animationDelay: `${st.delay}s`,
            }}
          />
        ))}
      </div>

      <div ref={moonRef} className={styles.moon}>
        <span className={styles.crater} style={{ left: '22%', top: '30%', width: '26%', height: '26%' }} />
        <span className={styles.crater} style={{ left: '58%', top: '20%', width: '14%', height: '14%' }} />
        <span className={styles.crater} style={{ left: '52%', top: '58%', width: '22%', height: '22%' }} />
      </div>

      <div ref={cloudsRef} className={styles.clouds}>
        <div className={styles.cloud} style={{ left: '8%', top: '38%', width: 170, height: 56, animationDuration: '11s' }} />
        <div className={styles.cloud} style={{ left: '62%', top: '22%', width: 130, height: 44, animationDuration: '14s', animationDirection: 'alternate-reverse' }} />
        <div className={styles.cloud} style={{ left: '26%', top: '-6%', width: 200, height: 62, animationDuration: '17s', opacity: 0.85 }} />
        <div className={styles.cloud} style={{ left: '70%', top: '-34%', width: 150, height: 50, animationDuration: '13s', animationDirection: 'alternate-reverse', opacity: 0.8 }} />
        <div className={styles.cloud} style={{ left: '12%', top: '-62%', width: 180, height: 56, animationDuration: '16s', opacity: 0.7 }} />
      </div>

      <div ref={groundRef} className={styles.ground}>
        <div className={styles.hillL} />
        <div className={styles.hillR} />
        <div className={styles.grass} />
        <div className={styles.tree} style={{ left: '14%', bottom: '26%' }}>
          <span className={styles.crown} style={{ width: 54, height: 54, background: '#3f9f57' }} />
          <span className={styles.trunk} style={{ width: 12, height: 26 }} />
        </div>
        <div className={styles.tree} style={{ right: '18%', bottom: '22%' }}>
          <span className={styles.crown} style={{ width: 40, height: 40, background: '#4aab5e' }} />
          <span className={styles.trunk} style={{ width: 10, height: 20 }} />
        </div>
        <div className={styles.pad} />
      </div>

      <div ref={rocketRef} className={styles.rocketWrap} style={{ opacity: phase === 'party' ? 0 : 1 }}>
        <Rocket size={64} flameRef={flameRef} still={phase !== 'flight'} />
      </div>

      {phase === 'party' && (
        <div className={styles.party} aria-hidden>
          {/* Rings widening out from the Moon */}
          <div className={styles.rings} style={{ top: partyCenter }}>
            <span className={styles.ring} style={{ borderColor: '#ffd166' }} />
            <span className={styles.ring} style={{ borderColor: '#ff9a4d', animationDelay: '.8s' }} />
            <span className={styles.ring} style={{ borderColor: '#8fd4f7', animationDelay: '1.6s' }} />
          </div>
          <div className={styles.glow} style={{ top: partyCenter }} />

          {/* Lap around the Moon (flattened ellipse to stay above the strip) with a glowing trail */}
          <div className={styles.orbits} style={{ top: partyCenter }}>
            {TRAIL.map((t, i) => (
              <div key={i} className={styles.orbit} style={{ width: orbitRadius * 2, height: orbitRadius * 2, animationDelay: `${t.delay}s` }}>
                <span className={styles.trailDot} style={{ opacity: t.opacity }} />
              </div>
            ))}
            <div className={styles.orbit} style={{ width: orbitRadius * 2, height: orbitRadius * 2 }}>
              <div className={styles.orbiter}>
                <Rocket size={44} still />
              </div>
            </div>
          </div>
        </div>
      )}

      <div ref={phaseRef} className={styles.phase}>
        Sur le sol
      </div>
    </div>
  );
}
