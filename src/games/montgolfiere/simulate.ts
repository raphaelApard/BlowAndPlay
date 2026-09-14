import { run } from '../balance/harness';
import { UNIT, VIEW, clamp01, type Simulate } from '../balance/types';
import { BASKET_DROP } from './draw';
import type { MontgolfiereLevel } from './index';
import { BUMP_COOLDOWN_MS, LIFT_BASE, LIFT_POWER, RAMP_MS, SINK, TAKEOFF_MS, TAKEOFF_THRESHOLD, makeWorld, tuning } from './rules';

/** The child's anticipation: they blow when an obstacle approaches (screen px). */
const LOOKAHEAD = 260;
/** Safety margin they aim for above the obstacle (screen px). */
const MARGIN = 30;

/**
 * Montgolfière: the child blows to take off, then at each obstacle that
 * approche s'il est trop bas ; sinon il se repose et le ballon redescend.
 */
export const simulate: Simulate<MontgolfiereLevel> = (level, difficulty, child) => {
  const unit = UNIT;
  const { speed } = tuning(difficulty);
  const { obstacles, padX } = makeWorld(level.obstacles, difficulty);
  const groundY = VIEW.height * 0.86;
  const R = 44 * unit;
  const bx = VIEW.width * 0.3;
  const floorY = groundY - R * BASKET_DROP - 4;
  const ceilY = R * 1.4 + 16;
  let phase: 'ground' | 'flight' = 'ground';
  let worldX = 0;
  let by = floorY;
  let vy = 0;
  let blowMs = 0;
  let takeoffAt = -1;
  let lastBumpAt = -1e9;
  let bumps = 0;
  const hit = obstacles.map(() => false);

  return run(child, (f, finish) => {
    const raw = f.st.intensity;
    if (phase === 'ground') {
      blowMs = raw > TAKEOFF_THRESHOLD ? blowMs + f.dt : Math.max(0, blowMs - f.dt * 2);
      if (blowMs >= TAKEOFF_MS) {
        phase = 'flight';
        takeoffAt = f.t;
        vy = -3 * unit;
      }
      return { kind: 'long' };
    }
    const ramp = clamp01((f.t - takeoffAt) / RAMP_MS);
    const ease = ramp * ramp * (3 - 2 * ramp);
    worldX += speed * ease * f.k;
    const target = f.power > 0.06 ? -(LIFT_BASE + f.power * LIFT_POWER) * unit : SINK * unit;
    vy += (target - vy) * Math.min(1, 0.09 * f.k);
    by = Math.max(ceilY, Math.min(floorY, by + vy * f.k));
    if (by === floorY && vy > 0) vy = 0;

    const left = bx - R * 0.9;
    const right = bx + R * 0.9;
    const bottom = by + R * BASKET_DROP;
    let want: 'long' | 'rest' = 'rest';
    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i];
      const ox = bx + (o.x * unit - worldX * unit);
      const ow = o.w * unit * 0.42;
      const top = groundY - o.h * unit;
      if (f.t - lastBumpAt > BUMP_COOLDOWN_MS && right > ox - ow && left < ox + ow && bottom > top) {
        bumps++;
        hit[i] = true;
        lastBumpAt = f.t;
        vy = -4 * unit;
        break;
      }
      // Obstacle ahead, not yet cleared: blow if we need to climb.
      if (ox + ow > left && ox - ow - right < LOOKAHEAD * unit && bottom > top - MARGIN * unit) want = 'long';
    }

    if (worldX >= padX) finish(f.t, bumps === 0 ? 3 : bumps <= 2 ? 2 : 1);
    return { kind: want };
  });
};
