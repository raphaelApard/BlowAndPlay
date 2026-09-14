import { describe, expect, it } from 'vitest';
import { GAMES, getGame, getLevel } from './registry';
import type { LevelBase, SettingDefs } from './types';

/**
 * The contract every registered game must honour. This file is data-driven:
 * adding a game to `src/games/` adds its cases automatically, so a new game
 * cannot land half-declared (the registry itself only checks ids and levels).
 */

const PATTERNS = ['long', 'bursts', 'modulated', 'free'];

describe('the registry', () => {
  it('discovers the games', () => {
    expect(GAMES.length).toBeGreaterThan(0);
  });

  it('skips the `_` folders (template, shared)', () => {
    expect(GAMES.map((g) => g.id).filter((id) => id.startsWith('_'))).toEqual([]);
  });

  it('gives every game a unique id', () => {
    expect(new Set(GAMES.map((g) => g.id)).size).toBe(GAMES.length);
  });

  it('sorts by order, then by French title', () => {
    const sorted = [...GAMES].sort((a, b) => a.order - b.order || a.title.fr.localeCompare(b.title.fr));
    expect(GAMES.map((g) => g.id)).toEqual(sorted.map((g) => g.id));
  });

  it('gives every game a distinct order, so the listing is not title-dependent', () => {
    expect(new Set(GAMES.map((g) => g.order)).size).toBe(GAMES.length);
  });

  it('finds a game and a level by id', () => {
    const game = GAMES[0];
    expect(getGame(game.id)).toBe(game);
    expect(getLevel(game.id, game.levels[0].id)).toBe(game.levels[0]);
  });

  it('returns undefined for an unknown game or level', () => {
    expect(getGame('nope')).toBeUndefined();
    expect(getLevel('nope', '1')).toBeUndefined();
    expect(getLevel(GAMES[0].id, 'nope')).toBeUndefined();
  });
});

describe.each(GAMES.map((g) => [g.id, g] as const))('%s', (id, game) => {
  it('has a kebab-case id', () => {
    expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('is described in both languages', () => {
    for (const field of ['title', 'description', 'instruction'] as const) {
      expect(game[field].fr?.trim(), `${field}.fr`).not.toBe('');
      expect(game[field].en?.trim(), `${field}.en`).not.toBe('');
    }
  });

  it('declares a known breath pattern', () => {
    expect(PATTERNS).toContain(game.pattern);
  });

  it('declares an accent colour', () => {
    expect(game.accent).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('declares a finite order', () => {
    expect(Number.isFinite(game.order)).toBe(true);
  });

  it('has levels with unique, non-empty ids', () => {
    const levels = game.levels as readonly LevelBase[];
    expect(levels.length).toBeGreaterThan(0);
    for (const level of levels) expect(level.id.trim()).not.toBe('');
    expect(new Set(levels.map((l) => l.id)).size).toBe(levels.length);
  });

  it('provides the game component', () => {
    expect(game.Game).toBeTypeOf('function');
  });

  it('provides a thumbnail component when it declares one', () => {
    if (game.Thumbnail) expect(game.Thumbnail).toBeTypeOf('function');
  });

  it('declares parents settings whose defaults are valid', () => {
    const defs = game.settings as SettingDefs | undefined;
    if (!defs) return;
    for (const [key, def] of Object.entries(defs)) {
      expect(def.label.fr?.trim(), `${key}.label.fr`).not.toBe('');
      expect(def.label.en?.trim(), `${key}.label.en`).not.toBe('');
      if (def.type === 'range') {
        expect(def.min, key).toBeLessThan(def.max);
        expect(def.default, key).toBeGreaterThanOrEqual(def.min);
        expect(def.default, key).toBeLessThanOrEqual(def.max);
      } else if (def.type === 'choice') {
        expect(def.options.length, key).toBeGreaterThan(0);
        expect(def.options.map((o) => o.value), key).toContain(def.default);
      } else {
        expect(def.default, key).toBeTypeOf('boolean');
      }
    }
  });
});
