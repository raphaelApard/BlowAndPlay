import type { AnyGameDefinition, LevelBase } from './types';

/**
 * Games registry — automatic discovery.
 *
 * Any `src/games/<id>/index.ts` folder exporting a `GameDefinition` as its
 * default is registered at build time. Folders prefixed with `_`
 * (`_template`, `_shared`) are ignored.
 */
const modules = import.meta.glob<{ default: AnyGameDefinition }>('./*/index.ts', {
  eager: true,
});

function loadGames(): AnyGameDefinition[] {
  const games: AnyGameDefinition[] = [];
  const seen = new Set<string>();

  for (const [path, mod] of Object.entries(modules)) {
    if (path.startsWith('./_')) continue;
    const def = mod.default;
    if (!def || typeof def !== 'object' || !def.id || !def.Game) {
      throw new Error(`[games] ${path} must export a GameDefinition as its default (defineGame).`);
    }
    if (seen.has(def.id)) throw new Error(`[games] duplicate game id: "${def.id}"`);
    if (!def.levels.length) throw new Error(`[games] "${def.id}" has no levels.`);
    const levelIds = new Set(def.levels.map((l: LevelBase) => l.id));
    if (levelIds.size !== def.levels.length) {
      throw new Error(`[games] "${def.id}" has duplicate level ids.`);
    }
    seen.add(def.id);
    games.push(def);
  }

  return games.sort((a, b) => a.order - b.order || a.title.fr.localeCompare(b.title.fr));
}

export const GAMES: readonly AnyGameDefinition[] = loadGames();

export function getGame(id: string): AnyGameDefinition | undefined {
  return GAMES.find((g) => g.id === id);
}

export function getLevel(gameId: string, levelId: string): LevelBase | undefined {
  return getGame(gameId)?.levels.find((l: LevelBase) => l.id === levelId);
}
