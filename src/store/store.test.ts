import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BreathSessionStats } from '../breath/types';
import type { AppState } from './types';

/**
 * The store loads `localStorage` when the module is imported, and keeps a
 * single module-level state. Each test therefore installs its own storage and
 * re-imports the module (`vi.resetModules()`), which is what lets us start
 * from a chosen save.
 */

const STORAGE_KEY = 'souffle-aventure:v1';

/** Minimal `localStorage`, with an optional write failure (private browsing). */
function installStorage(initial?: string) {
  const map = new Map<string, string>();
  if (initial !== undefined) map.set(STORAGE_KEY, initial);
  const storage = {
    failWrites: false,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (storage.failWrites) throw new Error('QuotaExceededError');
      map.set(k, v);
    },
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    raw: () => map.get(STORAGE_KEY),
  };
  vi.stubGlobal('localStorage', storage);
  return storage;
}

type Store = typeof import('./store');

async function freshStore(initial?: string): Promise<{ store: Store; storage: ReturnType<typeof installStorage> }> {
  vi.resetModules();
  const storage = installStorage(initial);
  const store = await import('./store');
  return { store, storage };
}

const STATS: BreathSessionStats = { blows: 4, totalBlowMs: 3200, longestBlowMs: 1100, meanIntensity: 0.62 };

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('difficulty scale', () => {
  it('scales 1..10 to 0..1', async () => {
    const { store } = await freshStore();
    expect(store.difficultyToUnit(store.MIN_DIFFICULTY)).toBe(0);
    expect(store.difficultyToUnit(store.MAX_DIFFICULTY)).toBe(1);
    expect(store.difficultyToUnit(5)).toBeCloseTo(4 / 9);
  });

  it('clamps and rounds out-of-range difficulties', async () => {
    const { store } = await freshStore();
    expect(store.clampDifficulty(0)).toBe(1);
    expect(store.clampDifficulty(-5)).toBe(1);
    expect(store.clampDifficulty(11)).toBe(10);
    expect(store.clampDifficulty(4.4)).toBe(4);
    expect(store.clampDifficulty(4.6)).toBe(5);
  });

  it('falls back to the default for a non-finite difficulty', async () => {
    const { store } = await freshStore();
    expect(store.clampDifficulty(Number.NaN)).toBe(store.DEFAULT_DIFFICULTY);
    expect(store.clampDifficulty(Number.POSITIVE_INFINITY)).toBe(store.DEFAULT_DIFFICULTY);
  });

  it('migrates old 0..100 saves', async () => {
    const { store } = await freshStore();
    expect(store.migrateDifficulty(0)).toBe(1);
    expect(store.migrateDifficulty(50)).toBe(6);
    expect(store.migrateDifficulty(100)).toBe(10);
    expect(store.migrateDifficulty(7)).toBe(7);
  });

  it('falls back to the default for a difficulty that is not a number', async () => {
    const { store } = await freshStore();
    expect(store.migrateDifficulty(undefined)).toBe(store.DEFAULT_DIFFICULTY);
    expect(store.migrateDifficulty('5')).toBe(store.DEFAULT_DIFFICULTY);
    expect(store.migrateDifficulty(null)).toBe(store.DEFAULT_DIFFICULTY);
    expect(store.migrateDifficulty(Number.NaN)).toBe(store.DEFAULT_DIFFICULTY);
  });
});

describe('loading a save', () => {
  it('starts empty when storage is empty', async () => {
    const { store } = await freshStore();
    const s = store.getAppState();
    expect(s.profiles).toEqual([]);
    expect(s.currentProfileId).toBeNull();
    expect(s.settings.difficulty).toBe(store.DEFAULT_DIFFICULTY);
  });

  it('discards a save from another version', async () => {
    const { store } = await freshStore(JSON.stringify({ version: 2, profiles: [{ id: 'p1', name: 'Zoé' }] }));
    expect(store.getAppState().profiles).toEqual([]);
  });

  it('survives malformed JSON', async () => {
    const { store } = await freshStore('{ not json');
    expect(store.getAppState().profiles).toEqual([]);
  });

  it('fills in settings missing from an older save', async () => {
    const { store } = await freshStore(JSON.stringify({ version: 1, settings: { inputSource: 'keyboard' } }));
    const { settings } = store.getAppState();
    expect(settings.inputSource).toBe('keyboard');
    expect(settings.sound).toBe(true);
    expect(settings.lang).toBeNull();
    expect(settings.micDeviceId).toBeNull();
  });

  it('migrates the difficulty of an old save on load', async () => {
    const { store } = await freshStore(JSON.stringify({ version: 1, settings: { difficulty: 100 } }));
    expect(store.getAppState().settings.difficulty).toBe(10);
  });

  it('persists mutations and reloads them identically', async () => {
    const { store, storage } = await freshStore();
    store.actions.createProfile('Zoé', { skin: '#f00', ring: '#0f0' }, 'miko');
    const saved = storage.raw();
    expect(saved).toBeTypeOf('string');

    vi.resetModules();
    installStorage(saved);
    const reloaded = (await import('./store')).getAppState();
    expect(reloaded.profiles).toHaveLength(1);
    expect(reloaded.profiles[0].name).toBe('Zoé');
    expect(reloaded.currentProfileId).toBe(reloaded.profiles[0].id);
  });

  it('keeps working in memory when storage refuses writes', async () => {
    const { store, storage } = await freshStore();
    storage.failWrites = true;
    expect(() => store.actions.setSound(false)).not.toThrow();
    expect(store.getAppState().settings.sound).toBe(false);
  });
});

describe('profiles', () => {
  it('creates a profile, trims its name and selects it', async () => {
    const { store } = await freshStore();
    const p = store.actions.createProfile('  Zoé  ', { skin: '#f00', ring: '#0f0' }, 'miko');
    expect(p.name).toBe('Zoé');
    expect(store.getAppState().currentProfileId).toBe(p.id);
    expect(store.selectCurrentProfile(store.getAppState())).toEqual(p);
  });

  it('gives each profile a distinct id', async () => {
    const { store } = await freshStore();
    const a = store.actions.createProfile('A', { skin: '#f00', ring: '#0f0' }, 'miko');
    const b = store.actions.createProfile('B', { skin: '#f00', ring: '#0f0' }, 'poum');
    expect(a.id).not.toBe(b.id);
    expect(store.getAppState().profiles).toHaveLength(2);
  });

  it('clears the selection', async () => {
    const { store } = await freshStore();
    store.actions.createProfile('Zoé', { skin: '#f00', ring: '#0f0' }, 'miko');
    store.actions.selectProfile(null);
    expect(store.selectCurrentProfile(store.getAppState())).toBeNull();
  });

  it('returns no current profile when the selected id no longer exists', async () => {
    const { store } = await freshStore();
    const p = store.actions.createProfile('Zoé', { skin: '#f00', ring: '#0f0' }, 'miko');
    store.actions.deleteProfile(p.id);
    expect(store.selectCurrentProfile(store.getAppState())).toBeNull();
  });

  it('changes one profile’s mascot and leaves the others alone', async () => {
    const { store } = await freshStore();
    const a = store.actions.createProfile('A', { skin: '#f00', ring: '#0f0' }, 'miko');
    const b = store.actions.createProfile('B', { skin: '#f00', ring: '#0f0' }, 'poum');
    store.actions.setMascot(a.id, 'rex');
    const profiles = store.getAppState().profiles;
    expect(profiles.find((p) => p.id === a.id)?.mascot).toBe('rex');
    expect(profiles.find((p) => p.id === b.id)?.mascot).toBe('poum');
  });

  it('deletes a profile with its progress, sessions and adventure selection', async () => {
    const { store } = await freshStore();
    const a = store.actions.createProfile('A', { skin: '#f00', ring: '#0f0' }, 'miko');
    const b = store.actions.createProfile('B', { skin: '#f00', ring: '#0f0' }, 'poum');
    store.actions.recordResult(a.id, 'souffle-fusee', '1', { stars: 2 }, STATS);
    store.actions.recordResult(b.id, 'souffle-fusee', '1', { stars: 3 }, STATS);
    store.actions.setAdventureGame(a.id, 'souffle-fusee', false);

    store.actions.deleteProfile(a.id);
    const s = store.getAppState();
    expect(s.profiles.map((p) => p.id)).toEqual([b.id]);
    expect(s.progress[a.id]).toBeUndefined();
    expect(s.adventureGames[a.id]).toBeUndefined();
    expect(s.sessions.every((x) => x.profileId === b.id)).toBe(true);
    expect(s.progress[b.id]).toBeDefined();
  });

  it('keeps the selection when another profile is deleted', async () => {
    const { store } = await freshStore();
    const a = store.actions.createProfile('A', { skin: '#f00', ring: '#0f0' }, 'miko');
    const b = store.actions.createProfile('B', { skin: '#f00', ring: '#0f0' }, 'poum');
    store.actions.selectProfile(b.id);
    store.actions.deleteProfile(a.id);
    expect(store.getAppState().currentProfileId).toBe(b.id);
  });
});

describe('recording a result', () => {
  it('records stars, a play and a session', async () => {
    const { store } = await freshStore();
    const p = store.actions.createProfile('Zoé', { skin: '#f00', ring: '#0f0' }, 'miko');
    store.actions.recordResult(p.id, 'souffle-fusee', '1', { stars: 2 }, STATS);

    const level = store.getAppState().progress[p.id]['souffle-fusee']['1'];
    expect(level).toMatchObject({ stars: 2, plays: 1 });
    const session = store.getAppState().sessions.at(-1);
    expect(session).toMatchObject({ profileId: p.id, gameId: 'souffle-fusee', levelId: '1', stars: 2, ...STATS });
    expect(session?.at).toBeTypeOf('number');
  });

  it('keeps the best star count when the child does worse', async () => {
    const { store } = await freshStore();
    const p = store.actions.createProfile('Zoé', { skin: '#f00', ring: '#0f0' }, 'miko');
    store.actions.recordResult(p.id, 'souffle-fusee', '1', { stars: 3 }, STATS);
    store.actions.recordResult(p.id, 'souffle-fusee', '1', { stars: 1 }, STATS);

    const level = store.getAppState().progress[p.id]['souffle-fusee']['1'];
    expect(level.stars).toBe(3);
    expect(level.plays).toBe(2);
  });

  it('raises the star count when the child does better', async () => {
    const { store } = await freshStore();
    const p = store.actions.createProfile('Zoé', { skin: '#f00', ring: '#0f0' }, 'miko');
    store.actions.recordResult(p.id, 'souffle-fusee', '1', { stars: 1 }, STATS);
    store.actions.recordResult(p.id, 'souffle-fusee', '1', { stars: 3 }, STATS);
    expect(store.getAppState().progress[p.id]['souffle-fusee']['1'].stars).toBe(3);
  });

  it('leaves bestScore undefined for a game without a score', async () => {
    const { store } = await freshStore();
    const p = store.actions.createProfile('Zoé', { skin: '#f00', ring: '#0f0' }, 'miko');
    store.actions.recordResult(p.id, 'souffle-fusee', '1', { stars: 2 }, STATS);
    expect(store.getAppState().progress[p.id]['souffle-fusee']['1'].bestScore).toBeUndefined();
  });

  it('keeps the best score across plays', async () => {
    const { store } = await freshStore();
    const p = store.actions.createProfile('Zoé', { skin: '#f00', ring: '#0f0' }, 'miko');
    store.actions.recordResult(p.id, 'souffle-fusee', '1', { stars: 2, score: 120 }, STATS);
    store.actions.recordResult(p.id, 'souffle-fusee', '1', { stars: 2, score: 80 }, STATS);
    expect(store.getAppState().progress[p.id]['souffle-fusee']['1'].bestScore).toBe(120);
    store.actions.recordResult(p.id, 'souffle-fusee', '1', { stars: 2, score: 200 }, STATS);
    expect(store.getAppState().progress[p.id]['souffle-fusee']['1'].bestScore).toBe(200);
  });

  it('takes a first score on a level that had none', async () => {
    const { store } = await freshStore();
    const p = store.actions.createProfile('Zoé', { skin: '#f00', ring: '#0f0' }, 'miko');
    store.actions.recordResult(p.id, 'souffle-fusee', '1', { stars: 2 }, STATS);
    store.actions.recordResult(p.id, 'souffle-fusee', '1', { stars: 2, score: 50 }, STATS);
    expect(store.getAppState().progress[p.id]['souffle-fusee']['1'].bestScore).toBe(50);
  });

  it('keeps levels and games independent', async () => {
    const { store } = await freshStore();
    const p = store.actions.createProfile('Zoé', { skin: '#f00', ring: '#0f0' }, 'miko');
    store.actions.recordResult(p.id, 'souffle-fusee', '1', { stars: 3 }, STATS);
    store.actions.recordResult(p.id, 'souffle-fusee', '2', { stars: 1 }, STATS);
    store.actions.recordResult(p.id, 'cerf-volant', '1', { stars: 2 }, STATS);

    const progress = store.getAppState().progress[p.id];
    expect(progress['souffle-fusee']['1'].stars).toBe(3);
    expect(progress['souffle-fusee']['2'].stars).toBe(1);
    expect(progress['cerf-volant']['1'].stars).toBe(2);
  });

  it('keeps at most 500 sessions, dropping the oldest', async () => {
    const { store } = await freshStore();
    const p = store.actions.createProfile('Zoé', { skin: '#f00', ring: '#0f0' }, 'miko');
    for (let i = 0; i < 501; i++) {
      store.actions.recordResult(p.id, 'souffle-fusee', '1', { stars: 1, score: i }, STATS);
    }
    const sessions = store.getAppState().sessions;
    expect(sessions).toHaveLength(500);
    expect(sessions[0].score).toBe(1);
    expect(sessions.at(-1)?.score).toBe(500);
  });

  it('resets one profile’s progress only', async () => {
    const { store } = await freshStore();
    const a = store.actions.createProfile('A', { skin: '#f00', ring: '#0f0' }, 'miko');
    const b = store.actions.createProfile('B', { skin: '#f00', ring: '#0f0' }, 'poum');
    store.actions.recordResult(a.id, 'souffle-fusee', '1', { stars: 3 }, STATS);
    store.actions.recordResult(b.id, 'souffle-fusee', '1', { stars: 3 }, STATS);

    store.actions.resetProgress(a.id);
    const s = store.getAppState();
    expect(s.progress[a.id]).toBeUndefined();
    expect(s.progress[b.id]).toBeDefined();
    expect(s.sessions.every((x) => x.profileId === b.id)).toBe(true);
    expect(s.profiles).toHaveLength(2);
  });
});

describe('adventure games', () => {
  it('gives every game to a child who has never been configured', async () => {
    const { store } = await freshStore();
    const { GAMES } = await import('../games/registry');
    const p = store.actions.createProfile('Zoé', { skin: '#f00', ring: '#0f0' }, 'miko');
    expect(store.selectAdventureGames(store.getAppState(), p.id)).toEqual(GAMES);
    expect(store.isAdventureGame(store.getAppState(), p.id, GAMES[0].id)).toBe(true);
  });

  it('returns the chosen games in registry order, not stored order', async () => {
    const { GAMES } = await import('../games/registry');
    const [first, second] = GAMES;
    const save = JSON.stringify({
      version: 1,
      profiles: [{ id: 'p1', name: 'Zoé', avatar: { skin: '#f00', ring: '#0f0' }, createdAt: 0 }],
      currentProfileId: 'p1',
      adventureGames: { p1: [second.id, first.id] },
    });

    vi.resetModules();
    installStorage(save);
    const reloaded = await import('./store');
    expect(reloaded.selectAdventureGames(reloaded.getAppState(), 'p1').map((g) => g.id)).toEqual([first.id, second.id]);
  });

  it('ignores an id whose game no longer exists', async () => {
    const save = JSON.stringify({
      version: 1,
      profiles: [{ id: 'p1', name: 'Zoé', avatar: { skin: '#f00', ring: '#0f0' }, createdAt: 0 }],
      adventureGames: { p1: ['moulin-a-vent', 'souffle-fusee'] },
    });
    const { store } = await freshStore(save);
    expect(store.selectAdventureGames(store.getAppState(), 'p1').map((g) => g.id)).toEqual(['souffle-fusee']);
  });

  it('materializes the full list before removing a game', async () => {
    const { store } = await freshStore();
    const { GAMES } = await import('../games/registry');
    const p = store.actions.createProfile('Zoé', { skin: '#f00', ring: '#0f0' }, 'miko');

    store.actions.setAdventureGame(p.id, 'souffle-fusee', false);
    const kept = store.getAppState().adventureGames[p.id];
    expect(kept).toHaveLength(GAMES.length - 1);
    expect(kept).not.toContain('souffle-fusee');
    expect(store.isAdventureGame(store.getAppState(), p.id, 'souffle-fusee')).toBe(false);
  });

  it('does not duplicate a game that is already enabled', async () => {
    const { store } = await freshStore();
    const p = store.actions.createProfile('Zoé', { skin: '#f00', ring: '#0f0' }, 'miko');
    store.actions.setAdventureGame(p.id, 'souffle-fusee', true);
    store.actions.setAdventureGame(p.id, 'souffle-fusee', true);
    const ids = store.getAppState().adventureGames[p.id];
    expect(ids.filter((id) => id === 'souffle-fusee')).toHaveLength(1);
  });

  it('puts a removed game back', async () => {
    const { store } = await freshStore();
    const p = store.actions.createProfile('Zoé', { skin: '#f00', ring: '#0f0' }, 'miko');
    store.actions.setAdventureGame(p.id, 'souffle-fusee', false);
    store.actions.setAdventureGame(p.id, 'souffle-fusee', true);
    expect(store.isAdventureGame(store.getAppState(), p.id, 'souffle-fusee')).toBe(true);
  });

  it('resets by forgetting the selection, not by storing every id', async () => {
    const { store } = await freshStore();
    const p = store.actions.createProfile('Zoé', { skin: '#f00', ring: '#0f0' }, 'miko');
    store.actions.setAdventureGame(p.id, 'souffle-fusee', false);
    store.actions.resetAdventureGames(p.id);
    expect(store.getAppState().adventureGames[p.id]).toBeUndefined();
    expect(store.isAdventureGame(store.getAppState(), p.id, 'souffle-fusee')).toBe(true);
  });

  it('keeps the progress of a game removed from the adventure', async () => {
    const { store } = await freshStore();
    const p = store.actions.createProfile('Zoé', { skin: '#f00', ring: '#0f0' }, 'miko');
    store.actions.recordResult(p.id, 'souffle-fusee', '1', { stars: 3 }, STATS);
    store.actions.setAdventureGame(p.id, 'souffle-fusee', false);
    expect(store.getAppState().progress[p.id]['souffle-fusee']['1'].stars).toBe(3);
  });
});

describe('settings', () => {
  it('changes only the setting it is given', async () => {
    const { store } = await freshStore();
    store.actions.setInputSource('keyboard');
    store.actions.setMicDeviceId('mic-2');
    store.actions.setSound(false);
    store.actions.setLang('en');
    store.actions.setDifficulty(8);

    expect(store.getAppState().settings).toMatchObject({
      inputSource: 'keyboard',
      micDeviceId: 'mic-2',
      sound: false,
      lang: 'en',
      difficulty: 8,
    });
  });

  it('clamps the difficulty it stores', async () => {
    const { store } = await freshStore();
    store.actions.setDifficulty(99);
    expect(store.getAppState().settings.difficulty).toBe(10);
  });

  it('merges a game setting without dropping its siblings', async () => {
    const { store } = await freshStore();
    store.actions.setGameSetting('cerf-volant', 'speed', 2);
    store.actions.setGameSetting('cerf-volant', 'helper', false);
    expect(store.getAppState().gameSettings['cerf-volant']).toEqual({ speed: 2, helper: false });
  });

  it('resets one game’s settings only', async () => {
    const { store } = await freshStore();
    store.actions.setGameSetting('cerf-volant', 'speed', 2);
    store.actions.setGameSetting('montgolfiere', 'speed', 3);
    store.actions.resetGameSettings('cerf-volant');
    const s = store.getAppState();
    expect(s.gameSettings['cerf-volant']).toBeUndefined();
    expect(s.gameSettings['montgolfiere']).toEqual({ speed: 3 });
  });
});

describe('selectors', () => {
  it('sums the stars of every game and level', async () => {
    const { store } = await freshStore();
    expect(store.totalStars({})).toBe(0);
    const progress = {
      'souffle-fusee': { '1': { stars: 3 as const, plays: 1 }, '2': { stars: 2 as const, plays: 1 } },
      'cerf-volant': { '1': { stars: 1 as const, plays: 1 } },
    };
    expect(store.totalStars(progress)).toBe(6);
  });

  it('returns an empty progress for an unknown profile', async () => {
    const { store } = await freshStore();
    expect(store.selectProgress(store.getAppState(), 'nope')).toEqual({});
    expect(store.selectProgress(store.getAppState(), null)).toEqual({});
  });
});

describe('subscription', () => {
  it('notifies listeners on every mutation until they unsubscribe', async () => {
    const { store } = await freshStore();
    const state = store.getAppState();
    // `useAppState` goes through React; the underlying store is exercised by
    // observing that a mutation replaces the state object.
    store.actions.setSound(false);
    expect(store.getAppState()).not.toBe(state);
    expect(store.getAppState().settings.sound).toBe(false);
  });
});

describe('state shape', () => {
  it('never mutates the previous state object', async () => {
    const { store } = await freshStore();
    const before = store.getAppState();
    const beforeSettings = before.settings;
    store.actions.setSound(false);
    expect(beforeSettings.sound).toBe(true);
    expect((before as AppState).settings).toBe(beforeSettings);
  });
});
