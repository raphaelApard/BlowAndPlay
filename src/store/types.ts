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
  /** Chosen mascot; absent on old profiles = the default mascot. */
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
  /** Global difficulty, an integer 1 (easy) → 10 (hard). The games receive it scaled to 0..1. */
  difficulty: number;
  /** `deviceId` of the chosen mic; null = the system's default mic. */
  micDeviceId: string | null;
  /** Langue choisie ; null = suivre la langue du navigateur. */
  lang: Lang | null;
  /** Effets sonores. */
  sound: boolean;
  /** Last visited top-level section; where calibration sends the child back to. Defaults to Games. */
  lastMode: 'map' | 'games';
}

export interface AppState {
  version: 1;
  profiles: Profile[];
  currentProfileId: string | null;
  progress: Record<string, ProfileProgress>;
  sessions: SessionLog[];
  settings: Settings;
  /** Parents settings per game: gameSettings[gameId][key]. Absent = the game's default. */
  gameSettings: Record<string, Record<string, SettingValue>>;
  /**
   * Games kept in the adventure, per child: adventureGames[profileId] = enabled ids.
   * Absent = every game (the default case, and that of old saves).
   * A game left out disappears from the map and from the unlock order, but
   * reste jouable depuis l'onglet « Jeux » et garde sa progression.
   */
  adventureGames: Record<string, string[]>;
}
