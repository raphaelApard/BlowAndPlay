import { describe, expect, it } from 'vitest';
import { MASCOTS } from './mascots.data';
import { MASCOTS_EN } from './mascots.en';
import { mascotText } from './mascotText';

/**
 * `mascots.data.ts` is generated from the design file, and `mascots.en.ts` is
 * maintained by hand alongside it: the risk is the two drifting apart when a
 * mascot is added or renamed.
 */

describe('mascot data', () => {
  it('has ten mascots with unique ids', () => {
    expect(MASCOTS).toHaveLength(10);
    expect(new Set(MASCOTS.map((m) => m.id)).size).toBe(MASCOTS.length);
  });

  it('gives every mascot a name, a tagline, a description and markup', () => {
    for (const m of MASCOTS) {
      expect(m.name.trim(), m.id).not.toBe('');
      expect(m.tagline.trim(), m.id).not.toBe('');
      expect(m.description.trim(), m.id).not.toBe('');
      expect(m.html, m.id).toContain('<div');
    }
  });

  it('gives every mascot a usable visual box', () => {
    for (const m of MASCOTS) {
      expect(m.box.w, m.id).toBeGreaterThan(0);
      expect(m.box.h, m.id).toBeGreaterThan(0);
      expect(Number.isFinite(m.box.dx), m.id).toBe(true);
      expect(Number.isFinite(m.box.dy), m.id).toBe(true);
    }
  });

  it('gives every mascot at least one colour', () => {
    for (const m of MASCOTS) {
      expect(m.colors.length, m.id).toBeGreaterThan(0);
      for (const c of m.colors) expect(c, m.id).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

describe('English mascot texts', () => {
  it('cover exactly the mascots of the generated file', () => {
    expect(Object.keys(MASCOTS_EN).sort()).toEqual([...MASCOTS.map((m) => m.id)].sort());
  });

  it('are never empty', () => {
    for (const [id, text] of Object.entries(MASCOTS_EN)) {
      expect(text.tagline.trim(), id).not.toBe('');
      expect(text.description.trim(), id).not.toBe('');
    }
  });
});

describe('mascotText', () => {
  it('returns the generated French text', () => {
    const m = MASCOTS[0];
    expect(mascotText(m, 'fr')).toEqual({ tagline: m.tagline, description: m.description });
  });

  it('returns the English text', () => {
    const m = MASCOTS[0];
    expect(mascotText(m, 'en')).toEqual(MASCOTS_EN[m.id]);
  });

  it('works for every mascot in both languages', () => {
    for (const m of MASCOTS) {
      expect(mascotText(m, 'fr').tagline, m.id).not.toBe('');
      expect(mascotText(m, 'en').tagline, m.id).not.toBe('');
    }
  });
});
