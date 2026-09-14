import { describe, expect, it } from 'vitest';
import { resolveSettings, setting } from './types';

/**
 * `resolveSettings` is the guard between stored JSON (which may come from an
 * older version, or from a hand-edited localStorage) and the typed settings a
 * game receives: anything invalid must fall back to the default rather than
 * reach the game.
 */

const DEFS = {
  speed: setting.range({ label: { fr: 'Vitesse', en: 'Speed' }, default: 1, min: 0.5, max: 2, step: 0.1 }),
  helper: setting.toggle({ label: { fr: 'Aide', en: 'Helper' }, default: true }),
  mode: setting.choice({
    label: { fr: 'Mode', en: 'Mode' },
    default: 'calme',
    options: [
      { value: 'calme', label: { fr: 'Calme', en: 'Calm' } },
      { value: 'vif', label: { fr: 'Vif', en: 'Lively' } },
    ],
  }),
};

describe('setting builders', () => {
  it('stamp the right type', () => {
    expect(DEFS.speed.type).toBe('range');
    expect(DEFS.helper.type).toBe('toggle');
    expect(DEFS.mode.type).toBe('choice');
  });
});

describe('resolveSettings', () => {
  it('gives an empty object when the game declares no settings', () => {
    expect(resolveSettings(undefined, { speed: 2 })).toEqual({});
  });

  it('falls back to the defaults when nothing is stored', () => {
    expect(resolveSettings(DEFS, undefined)).toEqual({ speed: 1, helper: true, mode: 'calme' });
  });

  it('keeps valid stored values', () => {
    expect(resolveSettings(DEFS, { speed: 1.5, helper: false, mode: 'vif' })).toEqual({
      speed: 1.5,
      helper: false,
      mode: 'vif',
    });
  });

  it('keeps a range value at its bounds', () => {
    expect(resolveSettings(DEFS, { speed: 0.5 }).speed).toBe(0.5);
    expect(resolveSettings(DEFS, { speed: 2 }).speed).toBe(2);
  });

  it('rejects a range value outside its bounds', () => {
    expect(resolveSettings(DEFS, { speed: 0.4 }).speed).toBe(1);
    expect(resolveSettings(DEFS, { speed: 2.1 }).speed).toBe(1);
  });

  it('rejects a range value that is not a number', () => {
    expect(resolveSettings(DEFS, { speed: '1.5' as unknown as number }).speed).toBe(1);
    expect(resolveSettings(DEFS, { speed: Number.NaN }).speed).toBe(1);
  });

  it('rejects a toggle that is not a real boolean', () => {
    expect(resolveSettings(DEFS, { helper: 'false' as unknown as boolean }).helper).toBe(true);
    expect(resolveSettings(DEFS, { helper: 0 as unknown as boolean }).helper).toBe(true);
  });

  it('rejects a choice outside the declared options', () => {
    expect(resolveSettings(DEFS, { mode: 'turbo' }).mode).toBe('calme');
    expect(resolveSettings(DEFS, { mode: 1 as unknown as string }).mode).toBe('calme');
  });

  it('drops stored keys the game does not declare', () => {
    const resolved = resolveSettings(DEFS, { speed: 1.5, gone: 42 });
    expect(resolved).toEqual({ speed: 1.5, helper: true, mode: 'calme' });
    expect('gone' in resolved).toBe(false);
  });

  it('resolves each setting independently', () => {
    // One invalid value must not discard the valid ones stored alongside it.
    expect(resolveSettings(DEFS, { speed: 99, helper: false, mode: 'vif' })).toEqual({
      speed: 1,
      helper: false,
      mode: 'vif',
    });
  });
});
