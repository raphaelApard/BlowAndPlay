import type { ComponentType } from 'react';
import type { BreathEngine } from '../breath/BreathEngine';
import type { Localized } from '../i18n/strings';
import type { Simulate } from './balance/types';

/**
 * A game's contract. See `src/games/README.md` to add a game.
 */

/** The kind of breath being practised — describes the game for parents and balances the adventure. */
export type BreathPattern =
  /** One long, steady blow (e.g. montgolfiere). */
  | 'long'
  /** Repeated short blows (e.g. pousse-nuages). */
  | 'bursts'
  /** Gentle / strong, controlling the intensity (e.g. cerf-volant). */
  | 'modulated'
  /** Free. */
  | 'free';

export type Stars = 0 | 1 | 2 | 3;

/** One level. Each game extends this type with its own settings. */
export interface LevelBase {
  /** Stable identifier, used in the URL and in progress (e.g. "1", "2"). */
  id: string;
}

export interface GameResult {
  stars: Stars;
  /** Optional score, specific to the game (shown on the parents side). */
  score?: number;
}

// ─── Game-specific parents settings ────────────────────────────────────
//
// A game declares its settings in `settings`; the parents area displays them
// automatically, the store remembers them, and the game receives them resolved
// (stored value or default) in `props.settings`.

export type SettingValue = number | boolean | string;

interface SettingBase {
  /** Label shown to parents, in each language. */
  label: Localized;
  description?: Localized;
}
export interface RangeSettingDef extends SettingBase {
  type: 'range';
  default: number;
  min: number;
  max: number;
  step?: number;
  /** Suffix displayed after the value (e.g. "×", "s"). */
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

/** Values resolved from the definitions: `{ speed: number, helper: boolean }`. */
export type SettingValues<D extends SettingDefs> = { [K in keyof D]: D[K]['default'] };

export const setting = {
  range: (def: Omit<RangeSettingDef, 'type'>): RangeSettingDef => ({ type: 'range', ...def }),
  toggle: (def: Omit<ToggleSettingDef, 'type'>): ToggleSettingDef => ({ type: 'toggle', ...def }),
  choice: <T extends string>(def: Omit<ChoiceSettingDef<T>, 'type'>): ChoiceSettingDef<T> => ({ type: 'choice', ...def }),
};

/** Merges defaults and stored values (ignoring invalid values). */
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
  /** The game's parents settings, resolved (see `GameDefinition.settings`). */
  settings: S;
  /** Breath engine, already started and calibrated. */
  breath: BreathEngine;
  /** Available play area, in px (updated on resize). */
  width: number;
  height: number;
  /** True when the tab is hidden or a dialog is open: freeze the game. */
  paused: boolean;
  /**
   * Global difficulty (parents setting), 0 = easy → 1 = hard.
   * To be combined with the level's settings: breath strength required,
   * distance, tolerance…
   */
  difficulty: number;
  /** Progress 0..1 shown in the HUD (optional). */
  onProgress?(progress: number): void;
  /** To be called exactly once when the level is finished. */
  onComplete(result: GameResult): void;
}

export interface GameDefinition<L extends LevelBase = LevelBase, D extends SettingDefs = SettingDefs> {
  /** Unique identifier, kebab-case, stable (used in the URL and in storage). */
  id: string;
  /** Name shown to the child, in each language. */
  title: Localized;
  /** Description for the parents area, in each language. */
  description: Localized;
  /**
   * Instruction shown by the mascot in a speech bubble when a game starts.
   * A short sentence, in the second person: « Souffle fort pour… ».
   */
  instruction: Localized;
  pattern: BreathPattern;
  /** Accent colour (card, dot on the map). */
  accent: string;
  /** Order in the games list and in the adventure (ascending). */
  order: number;
  levels: readonly L[];
  /**
   * The game's own parents settings (optional). Displayed in the parents
   * area, remembered, and received resolved in `GameProps.settings`.
   */
  settings?: D;
  /** Visual for the selection card. Without one: a placeholder. */
  Thumbnail?: ComponentType<{ className?: string }>;
  /** The game itself. Mounted by GameShell for a given level. */
  Game: ComponentType<GameProps<L, SettingValues<D>>>;
  /**
   * Headless simulation of the level by the "typical child" (see
   * `src/games/balance/`). Mandatory in practice: the balance test rejects a
   * game that does not have one, to guarantee that all games stay at the
   * same level of difficulty.
   */
  simulate?: Simulate<L>;
}

/** Inference helper: `export default defineGame({...})`. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export function defineGame<L extends LevelBase, D extends SettingDefs = {}>(def: GameDefinition<L, D>): GameDefinition<L, D> {
  return def;
}

// The registry mixes games with heterogeneous levels and settings; since
// `Game` is contravariant on its props, we erase the type parameters here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyGameDefinition = GameDefinition<any, any>;
