import { describe, expect, it } from 'vitest';
import { tuning as bateauTuning } from './bateau-pirate/rules';
import { buildRoute, layoutIslands } from './bateau-pirate/draw';
import { BUBBLES, growPerFrame, targetR, tuning as bullesTuning } from './bulles-de-savon/rules';
import { makeCourse, makeTargets, tuning as cerfTuning } from './cerf-volant/rules';
import { leavesPerPile, tuning as feuillesTuning } from './feuilles-d-automne/rules';
import { PAD_AFTER, makeObstacles, makeWorld, tuning as montgolfiereTuning } from './montgolfiere/rules';
import { OBSTACLE_KINDS } from './montgolfiere/draw';
import { chargeFor, landingHalf, maxReach, padGaps, reachFor, tuning as grenouilleTuning } from './grenouille/rules';
import { blowEfficiency, tuning as nuagesTuning } from './pousse-nuages/rules';
import { deflatePerFrame, inflatePerFrame, tuning as bonhommeTuning } from './bonhomme-gonflable/rules';
import { tuning as fuseeTuning } from './souffle-fusee/rules';

/**
 * The balance suite proves the games ask a comparable effort of each other;
 * it does not pin any single game's curve. These tests state each game's own
 * intent — the endpoints documented in its `index.ts` description, which the
 * parents area shows — so retuning one game cannot silently contradict it.
 */

const EASY = 0;
const HARD = 1;

describe('souffle-fusee', () => {
  it('doubles the distance and triples the gravity from easy to hard', () => {
    expect(fuseeTuning(EASY)).toEqual({ distance: 1, gravity: 0.05 });
    expect(fuseeTuning(HARD)).toEqual({ distance: 2, gravity: expect.closeTo(0.15, 10) });
  });

  it('clamps a difficulty outside 0..1', () => {
    expect(fuseeTuning(-1)).toEqual(fuseeTuning(EASY));
    expect(fuseeTuning(2)).toEqual(fuseeTuning(HARD));
  });
});

describe('montgolfiere', () => {
  it('adds taller, closer obstacles as the difficulty rises', () => {
    const easy = montgolfiereTuning(EASY);
    const hard = montgolfiereTuning(HARD);
    expect(easy.obstacleScale).toBeCloseTo(1.15);
    expect(hard.obstacleScale).toBeCloseTo(1.85);
    expect(easy.gap).toBe(250);
    expect(hard.gap).toBe(210);
    expect(hard.count).toBeGreaterThan(easy.count);
  });

  it('keeps the same scrolling speed at every difficulty', () => {
    // Documented intent: harder means more obstacles, not less playing time.
    expect(montgolfiereTuning(EASY).speed).toBe(montgolfiereTuning(HARD).speed);
  });

  it('lays out obstacles left to right, from the declared kinds', () => {
    const obstacles = makeObstacles(10, 700, 250, 1.15);
    expect(obstacles).toHaveLength(10);
    for (let i = 1; i < obstacles.length; i++) {
      expect(obstacles[i].x).toBeGreaterThan(obstacles[i - 1].x);
    }
    for (const o of obstacles) {
      expect(OBSTACLE_KINDS).toContain(o.kind);
      expect(o.h).toBeGreaterThan(0);
      expect(o.w).toBeGreaterThan(0);
    }
  });

  it('builds the same world for the same level and difficulty', () => {
    expect(makeWorld(7, 0.5)).toEqual(makeWorld(7, 0.5));
  });

  it('puts the landing pad past the last obstacle', () => {
    const world = makeWorld(7, 0.5);
    const last = world.obstacles.at(-1)!;
    expect(world.padX).toBe(last.x + PAD_AFTER);
    expect(world.total).toBe(world.padX);
  });

  it('adds obstacles with the difficulty', () => {
    expect(makeWorld(7, HARD).obstacles.length).toBeGreaterThan(makeWorld(7, EASY).obstacles.length);
  });
});

describe('cerf-volant', () => {
  it('narrows the band and lengthens the hold from easy to hard', () => {
    expect(cerfTuning(EASY)).toEqual({ band: 1, hold: 1 });
    const hard = cerfTuning(HARD);
    expect(hard.band).toBeCloseTo(0.6);
    expect(hard.hold).toBeCloseTo(1.5);
  });

  it('keeps every target inside the reachable range', () => {
    const half = 0.15;
    const targets = makeTargets(20, half, 900);
    expect(targets).toHaveLength(20);
    for (const a of targets) {
      expect(a).toBeGreaterThanOrEqual(0.06 + half);
      expect(a).toBeLessThanOrEqual(0.98 - half);
      expect(Number.isFinite(a)).toBe(true);
    }
  });

  it('usually separates consecutive targets, so the child has to move', () => {
    // The separation is best-effort: `makeTargets` retries 20 times, then
    // keeps whatever it drew. So this asserts the intent — most jumps are
    // wide — rather than an invariant the code does not guarantee.
    const half = 0.15;
    const lo = 0.06 + half;
    const hi = 0.98 - half;
    const minGap = Math.min(0.3, (hi - lo) * 0.45);
    const targets = makeTargets(60, half, 12);
    const wide = targets.filter((a, i) => i > 0 && Math.abs(a - targets[i - 1]) >= minGap);
    expect(wide.length / (targets.length - 1)).toBeGreaterThan(0.8);
  });

  it('builds the same course for the same level and difficulty', () => {
    const level = { targetWidth: 0.36, targets: 4 };
    expect(makeCourse(level, 0.5)).toEqual(makeCourse(level, 0.5));
  });

  it('narrows the band as the difficulty rises', () => {
    const level = { targetWidth: 0.36, targets: 4 };
    expect(makeCourse(level, HARD).half).toBeLessThan(makeCourse(level, EASY).half);
  });
});

describe('bulles-de-savon', () => {
  it('doubles the breath and enlarges the bubble from easy to hard', () => {
    expect(bullesTuning(EASY)).toEqual({ blow: 1, size: 0.6 });
    const hard = bullesTuning(HARD);
    expect(hard.blow).toBe(2);
    expect(hard.size).toBeCloseTo(1);
  });

  it('always asks for three bubbles', () => {
    expect(BUBBLES).toBe(3);
  });

  it('grows the target radius with the difficulty', () => {
    expect(targetR(HARD)).toBeGreaterThan(targetR(EASY));
  });

  it('reaches the target in the level’s breath time at the reference intensity', () => {
    // growPerFrame is calibrated so that `blowMs × blow` of breath at
    // REF_POWER fills the bubble: the two must stay in step.
    const r = targetR(0.5);
    const grow = growPerFrame(r, 2000, bullesTuning(0.5).blow);
    expect(grow).toBeGreaterThan(0);
    expect(Number.isFinite(grow)).toBe(true);
  });
});

describe('pousse-nuages', () => {
  it('makes the clouds heavier and pull back as the difficulty rises', () => {
    expect(nuagesTuning(EASY)).toEqual({ pushDiv: 1, pull: 0 });
    const hard = nuagesTuning(HARD);
    expect(hard.pushDiv).toBe(2);
    expect(hard.pull).toBeCloseTo(0.1);
  });

  it('gives a long blow full thrust at first, then less', () => {
    // The game's point: short repeated puffs push better than one long blow.
    expect(blowEfficiency(0)).toBe(1);
    expect(blowEfficiency(700)).toBe(1);
    expect(blowEfficiency(1200)).toBeLessThan(1);
    expect(blowEfficiency(1600)).toBeCloseTo(0.25);
  });

  it('never drops the thrust below a quarter', () => {
    expect(blowEfficiency(100_000)).toBe(0.25);
  });
});

describe('bateau-pirate', () => {
  it('weakens each blow and brakes harder as the difficulty rises', () => {
    expect(bateauTuning(EASY)).toEqual({ pushDiv: 1, friction: 0.975 });
    const hard = bateauTuning(HARD);
    expect(hard.pushDiv).toBeCloseTo(1.8);
    expect(hard.friction).toBeCloseTo(0.955);
  });

  it('lays out the islands the same way for the same seed', () => {
    expect(layoutIslands(4, 168)).toEqual(layoutIslands(4, 168));
  });

  it('gives one mooring distance per island, in ascending order', () => {
    const anchors = layoutIslands(4, 168).map((p) => ({ x: p.x * 1180, y: p.y * 820 }));
    const { anchorDist } = buildRoute(anchors);
    expect(anchorDist).toHaveLength(anchors.length);
    for (let i = 1; i < anchorDist.length; i++) {
      expect(anchorDist[i]).toBeGreaterThan(anchorDist[i - 1]);
    }
  });
});

describe('feuilles-d-automne', () => {
  it('more than doubles the leaves per pile from easy to hard', () => {
    expect(feuillesTuning(EASY).leaves).toBe(1);
    expect(feuillesTuning(HARD).leaves).toBeCloseTo(2.2);
  });

  it('rounds the leaves per pile to a whole number', () => {
    expect(leavesPerPile(14, EASY)).toBe(14);
    expect(leavesPerPile(14, HARD)).toBe(Math.round(14 * 2.2));
    expect(Number.isInteger(leavesPerPile(15, 0.37))).toBe(true);
  });
});

describe('grenouille', () => {
  it('keeps a full blow from overshooting the pad it aims at', () => {
    // The aim arc used to sail on to the pad after the target, so a feeble
    // blow was enough. A full blow must land only just past the next pad.
    for (let d = 0; d <= 1.0001; d += 0.1) {
      const { spacing } = grenouilleTuning(d);
      expect(maxReach(d) / spacing, `difficulty ${d.toFixed(1)}`).toBeLessThan(1.35);
    }
  });

  it('asks for a real blow to reach the next pad', () => {
    // Charge needed for a nominal step: well above a wisp of air.
    for (let d = 0; d <= 1.0001; d += 0.1) {
      const { spacing } = grenouilleTuning(d);
      expect(chargeFor(spacing, d), `difficulty ${d.toFixed(1)}`).toBeGreaterThan(0.6);
    }
  });

  it('spaces the pads further and narrows the landing from easy to hard', () => {
    const easy = grenouilleTuning(EASY);
    const hard = grenouilleTuning(HARD);
    expect(easy).toEqual({ spacing: 1, tolerance: 1, spread: 0 });
    expect(hard.spacing).toBeCloseTo(1.62);
    expect(hard.tolerance).toBeCloseTo(0.48);
    expect(hard.spread).toBeCloseTo(0.3);
  });

  it('maps a charge to a reach, and back', () => {
    // The two are inverses: the simulation aims with `chargeFor` at what
    // `reachFor` will produce, so a drift between them would silently
    // change how well the typical child plays.
    for (const d of [0, 0.5, 1]) {
      for (const gap of [0.4, 0.8, maxReach(d) * 0.9]) {
        expect(reachFor(chargeFor(gap, d), d)).toBeCloseTo(gap);
      }
    }
  });

  it('clamps a reach outside what a blow can do', () => {
    expect(reachFor(-1, 0.5)).toBe(reachFor(0, 0.5));
    expect(reachFor(2, 0.5)).toBe(reachFor(1, 0.5));
    expect(chargeFor(-5, 0.5)).toBe(0);
    expect(chargeFor(99, 0.5)).toBe(1);
  });

  it('narrows the landing window as the difficulty rises', () => {
    expect(landingHalf(HARD)).toBeLessThan(landingHalf(EASY));
  });

  it('lays out pads left to right, the same way for the same pond', () => {
    expect(padGaps(6, 0.5, 42)).toEqual(padGaps(6, 0.5, 42));
    const gaps = padGaps(8, 0.5, 42);
    expect(gaps).toHaveLength(8);
    for (let i = 1; i < gaps.length; i++) {
      expect(gaps[i]).toBeGreaterThan(gaps[i - 1]);
    }
  });

  it('keeps every pad reachable on a full blow', () => {
    // The pond would dead-end if one step were further than a full-strength
    // jump, so the widest possible step must stay under a full blow's reach.
    for (let d = 0; d <= 1.0001; d += 0.05) {
      const gaps = padGaps(40, d, 99);
      for (let i = 0; i < gaps.length; i++) {
        const step = gaps[i] - (i ? gaps[i - 1] : 0);
        expect(step, `difficulty ${d.toFixed(2)}`).toBeLessThanOrEqual(maxReach(d));
      }
    }
  });

  it('spaces the pads evenly when the difficulty adds no wobble', () => {
    const gaps = padGaps(5, EASY, 7);
    for (let i = 1; i < gaps.length; i++) {
      expect(gaps[i] - gaps[i - 1]).toBeCloseTo(grenouilleTuning(EASY).spacing);
    }
  });
});

describe('bonhomme-gonflable', () => {
  it('lengthens the breath and sags faster from easy to hard', () => {
    expect(bonhommeTuning(EASY)).toEqual({ blow: 1, sag: 1 });
    const hard = bonhommeTuning(HARD);
    expect(hard.blow).toBeCloseTo(1.7);
    expect(hard.sag).toBeCloseTo(2.4);
  });

  it('always sags slower than it inflates', () => {
    // Otherwise a child breathing normally could never get it up at all.
    for (let d = 0; d <= 1.0001; d += 0.1) {
      const { blow, sag } = bonhommeTuning(d);
      expect(deflatePerFrame(1800, blow, sag), `difficulty ${d.toFixed(1)}`).toBeLessThan(inflatePerFrame(1800, blow));
    }
  });
});

describe('every tuning', () => {
  const tunings = {
    'souffle-fusee': fuseeTuning,
    montgolfiere: montgolfiereTuning,
    'cerf-volant': cerfTuning,
    'bulles-de-savon': bullesTuning,
    'pousse-nuages': nuagesTuning,
    'bateau-pirate': bateauTuning,
    'feuilles-d-automne': feuillesTuning,
    grenouille: grenouilleTuning,
    'bonhomme-gonflable': bonhommeTuning,
  };

  it.each(Object.entries(tunings))('%s returns finite values across the whole range', (_id, tuning) => {
    for (let d = 0; d <= 1.0001; d += 0.1) {
      for (const value of Object.values(tuning(d) as Record<string, number>)) {
        expect(Number.isFinite(value)).toBe(true);
      }
    }
  });

  it.each(Object.entries(tunings))('%s clamps outside 0..1', (_id, tuning) => {
    expect(tuning(-5)).toEqual(tuning(0));
    expect(tuning(5)).toEqual(tuning(1));
  });
});
