import { run } from '../balance/harness';
import { starsForTime } from '../_shared/stars';
import { clamp01, type Simulate } from '../balance/types';
import type { OiseauLevel } from './index';
import {
  CRUISE,
  ESCAPE_MS,
  FOLLOW,
  LANDING_MS,
  LIFT_NEUTRAL,
  LOWER_BOUND,
  PARTY_MS,
  PERCH_MS,
  SPEED,
  SPLASH_MS,
  TAKEOFF_MS,
  TAKEOFF_THRESHOLD,
  UPPER_BOUND,
  targetAltitude,
  tuning,
} from './rules';

/**
 * Oiseau voyageur: the child blows to lift the bird off the pole, then holds
 * that breath all the way across. The intent is `hold` at the intensity that
 * keeps the bird level — the child aims for the middle of the corridor, and
 * the wobble of a held blow is what makes a long crossing hard.
 */
export const simulate: Simulate<OiseauLevel> = (level, difficulty, child) => {
  const { span } = tuning(difficulty);
  let phase: 'perch' | 'flight' | 'landing' | 'splash' | 'escape' = 'perch';
  let from = 0;
  let hop = 0;
  let alt = CRUISE;
  let blowMs = 0;
  let phaseAt = 0;
  let elapsed = 0;
  let partyDue = -1;

  return run(child, (f, finish) => {
    if (partyDue < 0) elapsed += f.dt;
    if (partyDue >= 0) {
      if (f.t >= partyDue) finish(elapsed, starsForTime(elapsed, level.parMs));
      return { kind: 'rest' };
    }

    switch (phase) {
      case 'perch': {
        // The bird settles on the perch first: a breath back for the child
        // between two crossings, and the pole does not launch on a stray puff.
        if (f.t - phaseAt < PERCH_MS) return { kind: 'rest' };
        blowMs = f.st.intensity > TAKEOFF_THRESHOLD ? blowMs + f.dt : Math.max(0, blowMs - f.dt * 2);
        if (blowMs >= TAKEOFF_MS) {
          phase = 'flight';
          phaseAt = f.t;
        }
        break;
      }
      case 'flight': {
        alt += (targetAltitude(f.power) - alt) * Math.min(1, FOLLOW * f.k);
        hop += (SPEED / span) * f.k;
        // Leaving the flyable band loses the bird — the water below, the sky above.
        if (alt <= LOWER_BOUND || alt >= UPPER_BOUND) {
          phase = alt <= CRUISE ? 'splash' : 'escape';
          phaseAt = f.t;
          hop = 0;
        } else if (hop >= 1) {
          hop = 1;
          phase = 'landing';
          phaseAt = f.t;
        }
        break;
      }
      case 'landing': {
        if (f.t - phaseAt >= LANDING_MS) {
          from += 1;
          if (from >= level.poles) {
            partyDue = f.t + PARTY_MS;
            return { kind: 'rest' };
          }
          hop = 0;
          alt = CRUISE;
          blowMs = 0;
          phase = 'perch';
          phaseAt = f.t;
        }
        return { kind: 'rest' };
      }
      case 'splash':
      case 'escape': {
        if (f.t - phaseAt >= (phase === 'splash' ? SPLASH_MS : ESCAPE_MS)) {
          phase = 'perch';
          alt = CRUISE;
          blowMs = 0;
          phaseAt = f.t;
        }
        return { kind: 'rest' };
      }
    }

    // The child aims for the intensity that holds the bird level — which is
    // `LIFT_NEUTRAL` by construction, since `targetAltitude` is centred on it.
    return { kind: 'hold', level: clamp01(LIFT_NEUTRAL) };
  });
};
