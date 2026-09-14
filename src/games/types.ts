import type { ComponentType } from 'react';
import type { BreathEngine } from '../breath/BreathEngine';
import type { Localized } from '../i18n/strings';
import type { Simulate } from './balance/types';

/**
 * Contrat d'un jeu. Voir `src/games/README.md` pour ajouter un jeu.
 */

/** Type de souffle travaillé — sert à décrire le jeu côté parents et à équilibrer l'aventure. */
export type BreathPattern =
  /** Un souffle long et régulier (ex. montgolfière). */
  | 'long'
  /** Souffles courts répétés (ex. pousse-nuages). */
  | 'bursts'
  /** Doux / fort, contrôle de l'intensité (ex. cerf-volant). */
  | 'modulated'
  /** Libre. */
  | 'free';

export type Stars = 0 | 1 | 2 | 3;

/** Un niveau. Chaque jeu étend ce type avec ses propres réglages. */
export interface LevelBase {
  /** Identifiant stable, utilisé dans l'URL et la progression (ex. "1", "2"). */
  id: string;
}

export interface GameResult {
  stars: Stars;
  /** Score optionnel, propre au jeu (affiché côté parents). */
  score?: number;
}

// ─── Réglages parents propres à un jeu ─────────────────────────────────
//
// Un jeu déclare ses réglages dans `settings` ; l'espace parents les affiche
// automatiquement, le store les mémorise, et le jeu les reçoit résolus
// (valeur enregistrée ou défaut) dans `props.settings`.

export type SettingValue = number | boolean | string;

interface SettingBase {
  /** Libellé affiché aux parents, dans chaque langue. */
  label: Localized;
  description?: Localized;
}
export interface RangeSettingDef extends SettingBase {
  type: 'range';
  default: number;
  min: number;
  max: number;
  step?: number;
  /** Suffixe affiché après la valeur (ex. "×", "s"). */
  unit?: string;
}
export interface ToggleSettingDef extends SettingBase {
  type: 'toggle';
  default: boolean;
}
export interface ChoiceSettingDef<T extends string = string> extends SettingBase {
  type: 'choice';
  default: T;
  options: readonly { value: T; label: Localized }[];
}
export type SettingDef = RangeSettingDef | ToggleSettingDef | ChoiceSettingDef;
export type SettingDefs = Record<string, SettingDef>;

/** Valeurs résolues à partir des définitions : `{ vitesse: number, aide: boolean }`. */
export type SettingValues<D extends SettingDefs> = { [K in keyof D]: D[K]['default'] };

export const setting = {
  range: (def: Omit<RangeSettingDef, 'type'>): RangeSettingDef => ({ type: 'range', ...def }),
  toggle: (def: Omit<ToggleSettingDef, 'type'>): ToggleSettingDef => ({ type: 'toggle', ...def }),
  choice: <T extends string>(def: Omit<ChoiceSettingDef<T>, 'type'>): ChoiceSettingDef<T> => ({ type: 'choice', ...def }),
};

/** Fusionne défauts et valeurs enregistrées (en ignorant les valeurs invalides). */
export function resolveSettings<D extends SettingDefs>(
  defs: D | undefined,
  stored: Record<string, SettingValue> | undefined,
): SettingValues<D> {
  const out: Record<string, SettingValue> = {};
  for (const [key, def] of Object.entries(defs ?? {})) {
    const v = stored?.[key];
    if (def.type === 'range' && typeof v === 'number' && v >= def.min && v <= def.max) out[key] = v;
    else if (def.type === 'toggle' && typeof v === 'boolean') out[key] = v;
    else if (def.type === 'choice' && typeof v === 'string' && def.options.some((o) => o.value === v)) out[key] = v;
    else out[key] = def.default;
  }
  return out as SettingValues<D>;
}

export interface GameProps<L extends LevelBase = LevelBase, S extends object = Record<string, SettingValue>> {
  level: L;
  /** Réglages parents du jeu, résolus (voir `GameDefinition.settings`). */
  settings: S;
  /** Moteur de souffle déjà démarré et calibré. */
  breath: BreathEngine;
  /** Zone de jeu disponible, en px (mise à jour au redimensionnement). */
  width: number;
  height: number;
  /** Vrai quand l'onglet est caché ou qu'un dialogue est ouvert : geler le jeu. */
  paused: boolean;
  /**
   * Difficulté globale (réglage parents), 0 = facile → 1 = difficile.
   * À combiner avec les réglages du niveau : force de souffle exigée,
   * distance, tolérance…
   */
  difficulty: number;
  /** Avancement 0..1 affiché dans le HUD (optionnel). */
  onProgress?(progress: number): void;
  /** À appeler une seule fois quand le niveau est terminé. */
  onComplete(result: GameResult): void;
}

export interface GameDefinition<L extends LevelBase = LevelBase, D extends SettingDefs = SettingDefs> {
  /** Identifiant unique, kebab-case, stable (utilisé en URL et stockage). */
  id: string;
  /** Nom affiché à l'enfant, dans chaque langue. */
  title: Localized;
  /** Description pour l'espace parents, dans chaque langue. */
  description: Localized;
  /**
   * Consigne montrée par la mascotte dans une bulle au lancement d'un jeu.
   * Une phrase courte, à la deuxième personne : « Souffle fort pour… ».
   */
  instruction: Localized;
  pattern: BreathPattern;
  /** Couleur d'accent (carte, pastille sur la map). */
  accent: string;
  /** Ordre dans la liste des jeux et l'aventure (croissant). */
  order: number;
  levels: readonly L[];
  /**
   * Réglages parents propres au jeu (optionnel). Affichés dans l'espace
   * parents, mémorisés, et reçus résolus dans `GameProps.settings`.
   */
  settings?: D;
  /** Visuel de la carte de sélection. Sans visuel : placeholder. */
  Thumbnail?: ComponentType<{ className?: string }>;
  /** Le jeu lui-même. Monté par GameShell pour un niveau donné. */
  Game: ComponentType<GameProps<L, SettingValues<D>>>;
  /**
   * Simulation sans écran du niveau par « l'enfant type » (voir
   * `src/games/balance/`). Obligatoire en pratique : le test d'équilibrage
   * refuse un jeu qui n'en a pas, pour garantir que tous les jeux restent
   * au même niveau de difficulté.
   */
  simulate?: Simulate<L>;
}

/** Helper d'inférence : `export default defineGame({...})`. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export function defineGame<L extends LevelBase, D extends SettingDefs = {}>(def: GameDefinition<L, D>): GameDefinition<L, D> {
  return def;
}

// Le registre mélange des jeux aux niveaux et réglages hétérogènes ; `Game`
// étant contravariant sur ses props, on efface les paramètres de type ici.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyGameDefinition = GameDefinition<any, any>;
