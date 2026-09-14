import type { BreathSourceKind, BreathSessionStats } from '../breath/types';
import type { SettingValue, Stars } from '../games/types';
import type { Lang } from '../i18n/strings';
import type { MascotId } from '../mascots/mascots.data';

export interface Avatar {
  /** Couleur de peau (pastel). */
  skin: string;
  /** Couleur de l'anneau. */
  ring: string;
}

export interface Profile {
  id: string;
  name: string;
  avatar: Avatar;
  /** Mascotte choisie ; absent sur les anciens profils = mascotte par défaut. */
  mascot?: MascotId;
  createdAt: number;
}

export interface LevelProgress {
  stars: Stars;
  bestScore?: number;
  plays: number;
}

/** progress[gameId][levelId] */
export type ProfileProgress = Record<string, Record<string, LevelProgress>>;

export interface SessionLog extends BreathSessionStats {
  profileId: string;
  gameId: string;
  levelId: string;
  at: number;
  stars: Stars;
  score?: number;
}

export interface Settings {
  inputSource: BreathSourceKind;
  /** Difficulté globale, entier 1 (facile) → 10 (difficile). Les jeux la reçoivent ramenée à 0..1. */
  difficulty: number;
  /** `deviceId` du micro choisi ; null = micro par défaut du système. */
  micDeviceId: string | null;
  /** Langue choisie ; null = suivre la langue du navigateur. */
  lang: Lang | null;
  /** Effets sonores. */
  sound: boolean;
}

export interface AppState {
  version: 1;
  profiles: Profile[];
  currentProfileId: string | null;
  progress: Record<string, ProfileProgress>;
  sessions: SessionLog[];
  settings: Settings;
  /** Réglages parents par jeu : gameSettings[gameId][key]. Absent = défaut du jeu. */
  gameSettings: Record<string, Record<string, SettingValue>>;
  /**
   * Jeux retenus dans l'aventure, par enfant : adventureGames[profileId] = ids activés.
   * Absent = tous les jeux (le cas par défaut, et celui des anciennes sauvegardes).
   * Un jeu écarté disparaît de la carte et de l'ordre de déverrouillage, mais
   * reste jouable depuis l'onglet « Jeux » et garde sa progression.
   */
  adventureGames: Record<string, string[]>;
}
