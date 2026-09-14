import { useSyncExternalStore } from 'react';
import type { BreathSessionStats, BreathSourceKind } from '../breath/types';
import { GAMES } from '../games/registry';
import type { AnyGameDefinition, GameResult, SettingValue } from '../games/types';
import type { Lang } from '../i18n/strings';
import type { MascotId } from '../mascots/mascots.data';
import type { AppState, Avatar, Profile, ProfileProgress } from './types';

const STORAGE_KEY = 'souffle-aventure:v1';

/** Difficulté globale : entier de 1 (facile) à 10 (difficile). */
export const MIN_DIFFICULTY = 1;
export const MAX_DIFFICULTY = 10;
export const DEFAULT_DIFFICULTY = 5;

/** Difficulté 1..10 → 0..1, ce que reçoivent les jeux (`GameProps.difficulty`). */
export function difficultyToUnit(difficulty: number): number {
  const d = clampDifficulty(difficulty);
  return (d - MIN_DIFFICULTY) / (MAX_DIFFICULTY - MIN_DIFFICULTY);
}

export function clampDifficulty(difficulty: number): number {
  if (!Number.isFinite(difficulty)) return DEFAULT_DIFFICULTY;
  return Math.round(Math.max(MIN_DIFFICULTY, Math.min(MAX_DIFFICULTY, difficulty)));
}

/** Anciennes sauvegardes : la difficulté allait de 0 à 100. */
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
  settings: { inputSource: 'mic', difficulty: DEFAULT_DIFFICULTY, micDeviceId: null, lang: null, sound: true },
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
    // stockage indisponible (navigation privée) : on continue en mémoire
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

// ─── Sélecteurs ────────────────────────────────────────────────────────

export function selectCurrentProfile(s: AppState): Profile | null {
  return s.profiles.find((p) => p.id === s.currentProfileId) ?? null;
}

export function selectProgress(s: AppState, profileId: string | null): ProfileProgress {
  return (profileId && s.progress[profileId]) || {};
}

/**
 * Jeux de l'aventure d'un enfant, dans l'ordre du registre.
 * Aucune sélection enregistrée = tous les jeux : un nouveau jeu ajouté au
 * registre apparaît donc chez les enfants qui n'ont jamais été configurés.
 * Les ids inconnus (jeu retiré depuis) sont ignorés.
 */
export function selectAdventureGames(s: AppState, profileId: string | null): readonly AnyGameDefinition[] {
  const chosen = profileId ? s.adventureGames[profileId] : undefined;
  if (!chosen) return GAMES;
  return GAMES.filter((g) => chosen.includes(g.id));
}

/** Vrai si le jeu fait partie de l'aventure de cet enfant. */
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
   * Ajoute ou retire un jeu de l'aventure d'un enfant.
   * Sans sélection enregistrée, l'enfant a tous les jeux : on matérialise
   * alors la liste complète avant d'en retirer un. La progression du jeu
   * écarté est conservée (elle revient s'il est remis).
   */
  setAdventureGame(profileId: string, gameId: string, enabled: boolean) {
    setState((s) => {
      const current = s.adventureGames[profileId] ?? GAMES.map((g) => g.id);
      const next = enabled ? [...new Set([...current, gameId])] : current.filter((id) => id !== gameId);
      return { ...s, adventureGames: { ...s.adventureGames, [profileId]: next } };
    });
  },

  /** Remet tous les jeux dans l'aventure de cet enfant. */
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

  setDifficulty(difficulty: number) {
    const clamped = clampDifficulty(difficulty);
    setState((s) => ({ ...s, settings: { ...s.settings, difficulty: clamped } }));
  },
};
