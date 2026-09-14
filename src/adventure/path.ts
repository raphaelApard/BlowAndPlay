import { GAMES } from '../games/registry';
import type { AnyGameDefinition, LevelBase } from '../games/types';
import type { ProfileProgress } from '../store/types';

/**
 * Une étape de l'aventure = un jeu (sa vignette sur la carte), ou le bonus final.
 * Les niveaux d'un jeu sont regroupés dans la même étape ; l'ordre de
 * déverrouillage reste entrelacé (voir `unlockOrder`).
 */
export type AdventureNode =
  | { kind: 'game'; id: string; gameId: string; levelIds: readonly string[] }
  | { kind: 'bonus'; id: string };

export type NodeStatus = 'done' | 'current' | 'locked';

/** Un niveau dans l'ordre de déverrouillage. */
export interface UnlockStep {
  gameId: string;
  levelId: string;
}

/**
 * Étapes de la carte : un jeu par étape, dans l'ordre du registre (`order`).
 * Un jeu ajouté au registre apparaît automatiquement.
 */
export function buildAdventurePath(games: readonly AnyGameDefinition[] = GAMES): AdventureNode[] {
  const nodes: AdventureNode[] = games.map((game) => ({
    kind: 'game' as const,
    id: game.id,
    gameId: game.id,
    levelIds: (game.levels as readonly LevelBase[]).map((l) => l.id),
  }));
  nodes.push({ kind: 'bonus', id: 'bonus:end' });
  return nodes;
}

/**
 * Ordre de déverrouillage : niveau 1 de chaque jeu, puis niveau 2, etc.
 * L'enfant rencontre ainsi tous les jeux avant d'en approfondir un —
 * c'est l'entrelacement d'origine, conservé même si la carte regroupe
 * désormais les niveaux par jeu.
 */
export function buildUnlockOrder(games: readonly AnyGameDefinition[] = GAMES): UnlockStep[] {
  const steps: UnlockStep[] = [];
  const maxLevels = Math.max(0, ...games.map((g) => g.levels.length));
  for (let i = 0; i < maxLevels; i++) {
    for (const game of games) {
      const level = game.levels[i] as LevelBase | undefined;
      if (level) steps.push({ gameId: game.id, levelId: level.id });
    }
  }
  return steps;
}

export const ADVENTURE_PATH: readonly AdventureNode[] = buildAdventurePath();
export const UNLOCK_ORDER: readonly UnlockStep[] = buildUnlockOrder();

function isLevelDone(step: UnlockStep, progress: ProfileProgress): boolean {
  return (progress[step.gameId]?.[step.levelId]?.stars ?? 0) > 0;
}

/** Tous les niveaux d'une étape sont réussis. */
export function isNodeDone(node: AdventureNode, progress: ProfileProgress): boolean {
  if (node.kind !== 'game') return false;
  return node.levelIds.every((levelId) => isLevelDone({ gameId: node.gameId, levelId }, progress));
}

/** Total des étoiles gagnées sur les niveaux d'une étape (3 par niveau). */
export function nodeStarsTotal(node: AdventureNode, progress: ProfileProgress): number {
  if (node.kind !== 'game') return 0;
  return node.levelIds.reduce((sum, levelId) => sum + (progress[node.gameId]?.[levelId]?.stars ?? 0), 0);
}

/** Nombre de niveaux réussis dans une étape (au moins une étoile chacun). */
export function nodeLevelsDone(node: AdventureNode, progress: ProfileProgress): number {
  if (node.kind !== 'game') return 0;
  return node.levelIds.filter((levelId) => isLevelDone({ gameId: node.gameId, levelId }, progress)).length;
}

/** Premier niveau non réussi dans l'ordre entrelacé (le niveau « courant »). */
export function currentStep(progress: ProfileProgress, order = UNLOCK_ORDER): UnlockStep | undefined {
  return order.find((step) => !isLevelDone(step, progress));
}

/**
 * Niveau à lancer pour une étape : son premier niveau non réussi,
 * à défaut le dernier (le jeu est terminé, on le rejoue).
 */
export function nextLevelOf(node: AdventureNode, progress: ProfileProgress): string | undefined {
  if (node.kind !== 'game') return undefined;
  return (
    node.levelIds.find((levelId) => !isLevelDone({ gameId: node.gameId, levelId }, progress)) ??
    node.levelIds[node.levelIds.length - 1]
  );
}

/** Index de l'étape contenant le niveau courant (le bonus si tout est réussi). */
export function currentNodeIndex(progress: ProfileProgress, path = ADVENTURE_PATH, order = UNLOCK_ORDER): number {
  const step = currentStep(progress, order);
  if (!step) return path.length - 1;
  const idx = path.findIndex((n) => n.kind === 'game' && n.gameId === step.gameId);
  return idx === -1 ? path.length - 1 : idx;
}

/**
 * État d'une étape. Une étape est « courante » si elle contient le niveau
 * courant, « terminée » si tous ses niveaux sont réussis, sinon verrouillée.
 * Une étape déjà entamée mais pas courante reste jouable (voir `isNodeOpen`).
 */
export function nodeStatus(index: number, progress: ProfileProgress, path = ADVENTURE_PATH): NodeStatus {
  const node = path[index];
  if (!node) return 'locked';
  if (index === currentNodeIndex(progress, path)) return 'current';
  if (isNodeDone(node, progress)) return 'done';
  return 'locked';
}

/**
 * Étape accessible : elle contient au moins un niveau déverrouillé, c'est-à-dire
 * qui précède ou égale le niveau courant dans l'ordre entrelacé.
 */
export function isNodeOpen(node: AdventureNode, progress: ProfileProgress, order = UNLOCK_ORDER): boolean {
  if (node.kind !== 'game') return false;
  const current = currentStep(progress, order);
  if (!current) return true;
  const currentIdx = order.findIndex((s) => s.gameId === current.gameId && s.levelId === current.levelId);
  return order.some((s, i) => i <= currentIdx && s.gameId === node.gameId);
}

/** Index de l'étape d'un jeu (−1 s'il n'en fait pas partie). */
export function nodeIndexOf(gameId: string, path = ADVENTURE_PATH): number {
  return path.findIndex((n) => n.kind === 'game' && n.gameId === gameId);
}
