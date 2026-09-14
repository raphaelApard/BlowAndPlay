import { describe, expect, it } from 'vitest';
import { UNIT, VIEW } from '../balance/types';
import { clamp01, gameUnit, lerp, mixHex, seeded, thumbUnit } from './math';
import { PAR_TWO_STARS, starsForTime } from './stars';

describe('starsForTime', () => {
  it('gives 3 stars up to the reference time', () => {
    expect(starsForTime(5000, 10000)).toBe(3);
    expect(starsForTime(10000, 10000)).toBe(3);
  });

  it('gives 2 stars up to 1.6× the reference time', () => {
    expect(starsForTime(10001, 10000)).toBe(2);
    expect(starsForTime(10000 * PAR_TWO_STARS, 10000)).toBe(2);
  });

  it('gives 1 star beyond that', () => {
    expect(starsForTime(10000 * PAR_TWO_STARS + 1, 10000)).toBe(1);
    expect(starsForTime(60000, 10000)).toBe(1);
  });
});

describe('clamp01', () => {
  it('clamps to 0..1', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(1)).toBe(1);
    expect(clamp01(2)).toBe(1);
  });
});

describe('seeded', () => {
  it('gives the same sequence for the same seed', () => {
    const a = seeded(42);
    const b = seeded(42);
    const left = Array.from({ length: 20 }, () => a());
    const right = Array.from({ length: 20 }, () => b());
    expect(left).toEqual(right);
  });

  it('gives a different sequence for a different seed', () => {
    const a = seeded(1);
    const b = seeded(2);
    expect(Array.from({ length: 10 }, () => a())).not.toEqual(Array.from({ length: 10 }, () => b()));
  });

  it('stays within [0, 1)', () => {
    const rand = seeded(7);
    for (let i = 0; i < 500; i++) {
      const v = rand();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('lerp', () => {
  it('interpolates between the bounds', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, 1)).toBe(10);
  });

  it('extrapolates outside 0..1', () => {
    expect(lerp(0, 10, 2)).toBe(20);
    expect(lerp(0, 10, -1)).toBe(-10);
  });
});

describe('mixHex', () => {
  it('returns each end at t = 0 and t = 1', () => {
    expect(mixHex('#ff0000', '#0000ff', 0)).toBe('#ff0000');
    expect(mixHex('#ff0000', '#0000ff', 1)).toBe('#0000ff');
  });

  it('mixes halfway', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it('always pads each channel to two digits', () => {
    const mixed = mixHex('#000000', '#0000ff', 0.02);
    expect(mixed).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('gameUnit', () => {
  it('scales with the smaller of the two ratios', () => {
    expect(gameUnit(1000, 620)).toBeCloseTo(1);
    expect(gameUnit(2000, 620)).toBeCloseTo(1);
    expect(gameUnit(1000, 1240)).toBeCloseTo(1);
  });

  it('never goes below the 0.55 floor', () => {
    expect(gameUnit(100, 100)).toBe(0.55);
  });

  it('matches the unit used by the balance simulations', () => {
    // `src/games/balance/types.ts` documents that the two must stay identical.
    expect(gameUnit(VIEW.width, VIEW.height)).toBe(UNIT);
  });
});

describe('thumbUnit', () => {
  it('uses the smaller side', () => {
    expect(thumbUnit(230, 460)).toBe(1);
    expect(thumbUnit(460, 230)).toBe(1);
  });
});
