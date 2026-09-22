import { useSyncExternalStore } from 'react';
import type { BreathSessionStats, BreathSourceKind } from '../breath/types';
import { GAMES } from '../games/registry';
import type { AnyGameDefinition, GameResult, SettingValue } from '../games/types';
import type { Lang } from '../i18n/strings';
import type { MascotId } from '../mascots/mascots.data';
import type { AppState, Avatar, Profile, ProfileProgress } from './types';

const STORAGE_KEY = 'souffle-aventure:v1';

/** Global difficulty: an integer from 1 (easy) to 10 (hard). */
export const MIN_DIFFICULTY = 1;
export const MAX_DIFFICULTY = 10;
export const DEFAULT_DIFFICULTY = 5;

/** Difficulty 1..10 → 0..1, what the games receive (`GameProps.difficulty`). */
export function difficultyToUnit(difficulty: number): number {
  const d = clampDifficulty(difficulty);
  return (d - MIN_DIFFICULTY) / (MAX_DIFFICULTY - MIN_DIFFICULTY);
}

export function clampDifficulty(difficulty: number): number {
  if (!Number.isFinite(difficulty)) return DEFAULT_DIFFICULTY;
  return Math.round(Math.max(MIN_DIFFICULTY, Math.min(MAX_DIFFICULTY, difficulty)));
}

/** Old saves: difficulty used to range from 0 to 100. */
export function migrateDifficulty(stored: unknown): number {
  if (typeof stored !== 'number' || !Number.isFinite(stored)) return DEFAULT_DIFFICULTY;
  if (stored > MAX_DIFFICULTY) return clampDifficulty(MIN_DIFFICULTY + (stored / 100) * (MAX_DIFFICULTY - MIN_DIFFICULTY));
  return clampDifficulty(stored);
}
const MAX_SESSIONS = 500;

const EMPTY: AppState = {
  version: 1,
  profiles: [],
  currentProfileId: null,
  progress: {},
  sessions: [],
  settings: { inputSource: 'mic', difficulty: DEFAULT_DIFFICULTY, micDeviceId: null, lang: null, sound: true, lastMode: 'games' },
  gameSettings: {},
  adventureGames: {},
};

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    if (parsed.version !== 1) return EMPTY;
    const settings = { ...EMPTY.settings, ...parsed.settings };
    settings.difficulty = migrateDifficulty(settings.difficulty);
    return { ...EMPTY, ...parsed, settings };
  } catch {
    return EMPTY;
  }
}

let state: AppState = load();
const listeners = new Set<() => void>();

function setState(update: (prev: AppState) => AppState) {
  state = update(state);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage unavailable (private browsing): we carry on in memory
  }
  for (const cb of listeners) cb();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export function getAppState(): AppState {
  return state;
}

// ─── Selectors ─────────────────────────────────────────────────────────

export function selectCurrentProfile(s: AppState): Profile | null {
  return s.profiles.find((p) => p.id === s.currentProfileId) ?? null;
}

export function selectProgress(s: AppState, profileId: string | null): ProfileProgress {
  return (profileId && s.progress[profileId]) || {};
}

/**
 * A child's adventure games, in registry order.
 * No stored selection = every game: a new game added to the registry
 * therefore appears for children who have never been configured.
 * Unknown ids (a game removed since) are ignored.
 */
export function selectAdventureGames(s: AppState, profileId: string | null): readonly AnyGameDefinition[] {
  const chosen = profileId ? s.adventureGames[profileId] : undefined;
  if (!chosen) return GAMES;
  return GAMES.filter((g) => chosen.includes(g.id));
}

/** True if the game is part of this child's adventure. */
export function isAdventureGame(s: AppState, profileId: string | null, gameId: string): boolean {
  const chosen = profileId ? s.adventureGames[profileId] : undefined;
  return chosen ? chosen.includes(gameId) : true;
}

export function totalStars(progress: ProfileProgress): number {
  let total = 0;
  for (const game of Object.values(progress)) {
    for (const level of Object.values(game)) total += level.stars;
  }
  return total;
}

// ─── Actions ───────────────────────────────────────────────────────────

export const actions = {
  createProfile(name: string, avatar: Avatar, mascot: MascotId): Profile {
    const profile: Profile = {
      id: `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      avatar,
      mascot,
      createdAt: Date.now(),
    };
    setState((s) => ({ ...s, profiles: [...s.profiles, profile], currentProfileId: profile.id }));
    return profile;
  },

  setMascot(profileId: string, mascot: MascotId) {
    setState((s) => ({ ...s, profiles: s.profiles.map((p) => (p.id === profileId ? { ...p, mascot } : p)) }));
  },

  selectProfile(id: string | null) {
    setState((s) => ({ ...s, currentProfileId: id }));
  },

  deleteProfile(id: string) {
    setState((s) => {
      const { [id]: _removed, ...progress } = s.progress;
      const { [id]: _removedGames, ...adventureGames } = s.adventureGames;
      return {
        ...s,
        profiles: s.profiles.filter((p) => p.id !== id),
        currentProfileId: s.currentProfileId === id ? null : s.currentProfileId,
        progress,
        adventureGames,
        sessions: s.sessions.filter((x) => x.profileId !== id),
      };
    });
  },

  recordResult(
    profileId: string,
    gameId: string,
    levelId: string,
    result: GameResult,
    stats: BreathSessionStats,
  ) {
    setState((s) => {
      const profileProgress = s.progress[profileId] ?? {};
      const gameProgress = profileProgress[gameId] ?? {};
      const prev = gameProgress[levelId];
      const next = {
        stars: Math.max(prev?.stars ?? 0, result.stars) as GameResult['stars'],
        bestScore:
          result.score === undefined ? prev?.bestScore : Math.max(prev?.bestScore ?? -Infinity, result.score),
        plays: (prev?.plays ?? 0) + 1,
      };
      return {
        ...s,
        progress: {
          ...s.progress,
          [profileId]: { ...profileProgress, [gameId]: { ...gameProgress, [levelId]: next } },
        },
        sessions: [
          ...s.sessions.slice(-(MAX_SESSIONS - 1)),
          { profileId, gameId, levelId, at: Date.now(), stars: result.stars, score: result.score, ...stats },
        ],
      };
    });
  },

  resetProgress(profileId: string) {
    setState((s) => {
      const { [profileId]: _removed, ...progress } = s.progress;
      return { ...s, progress, sessions: s.sessions.filter((x) => x.profileId !== profileId) };
    });
  },

  setInputSource(inputSource: BreathSourceKind) {
    setState((s) => ({ ...s, settings: { ...s.settings, inputSource } }));
  },

  setMicDeviceId(micDeviceId: string | null) {
    setState((s) => ({ ...s, settings: { ...s.settings, micDeviceId } }));
  },

  setGameSetting(gameId: string, key: string, value: SettingValue) {
    setState((s) => ({
      ...s,
      gameSettings: { ...s.gameSettings, [gameId]: { ...s.gameSettings[gameId], [key]: value } },
    }));
  },

  /**
   * Adds or removes a game from a child's adventure.
   * Without a stored selection, the child has every game: we then materialize
   * the full list before removing one. The progress of the removed game is
   * kept (it comes back if the game is restored).
   */
  setAdventureGame(profileId: string, gameId: string, enabled: boolean) {
    setState((s) => {
      const current = s.adventureGames[profileId] ?? GAMES.map((g) => g.id);
      const next = enabled ? [...new Set([...current, gameId])] : current.filter((id) => id !== gameId);
      return { ...s, adventureGames: { ...s.adventureGames, [profileId]: next } };
    });
  },

  /** Puts every game back into this child's adventure. */
  resetAdventureGames(profileId: string) {
    setState((s) => {
      const { [profileId]: _removed, ...adventureGames } = s.adventureGames;
      return { ...s, adventureGames };
    });
  },

  resetGameSettings(gameId: string) {
    setState((s) => {
      const { [gameId]: _removed, ...gameSettings } = s.gameSettings;
      return { ...s, gameSettings };
    });
  },

  setSound(sound: boolean) {
    setState((s) => ({ ...s, settings: { ...s.settings, sound } }));
  },

  setLang(lang: Lang | null) {
    setState((s) => ({ ...s, settings: { ...s.settings, lang } }));
  },

  setLastMode(lastMode: 'map' | 'games') {
    setState((s) => (s.settings.lastMode === lastMode ? s : { ...s, settings: { ...s.settings, lastMode } }));
  },

  setDifficulty(difficulty: number) {
    const clamped = clampDifficulty(difficulty);
    setState((s) => ({ ...s, settings: { ...s.settings, difficulty: clamped } }));
  },
};
