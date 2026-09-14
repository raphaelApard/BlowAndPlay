import type { AnyGameDefinition, LevelBase } from './types';

/**
 * Registre des jeux — découverte automatique.
 *
 * Tout dossier `src/games/<id>/index.ts` exportant par défaut un
 * `GameDefinition` est enregistré au build. Les dossiers préfixés `_`
 * (`_template`, `_shared`) sont ignorés.
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
      throw new Error(`[games] ${path} doit exporter par défaut un GameDefinition (defineGame).`);
    }
    if (seen.has(def.id)) throw new Error(`[games] id de jeu en double : "${def.id}"`);
    if (!def.levels.length) throw new Error(`[games] "${def.id}" n'a aucun niveau.`);
    const levelIds = new Set(def.levels.map((l: LevelBase) => l.id));
    if (levelIds.size !== def.levels.length) {
      throw new Error(`[games] "${def.id}" a des ids de niveau en double.`);
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
