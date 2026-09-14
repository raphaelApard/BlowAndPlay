import { GAMES } from '../games/registry';
import type { AnyGameDefinition, LevelBase } from '../games/types';
import type { ProfileProgress } from '../store/types';

/**
 * An adventure step = a game (its thumbnail on the map), or the final bonus.
 * A game's levels are grouped into the same step; the unlock order stays
 * interleaved (see `unlockOrder`).
 */
export type AdventureNode =
  | { kind: 'game'; id: string; gameId: string; levelIds: readonly string[] }
  | { kind: 'bonus'; id: string };

export type NodeStatus = 'done' | 'current' | 'locked';

/** One level in the unlock order. */
export interface UnlockStep {
  gameId: string;
  levelId: string;
}

/**
 * Map steps: one game per step, in registry order (`order`).
 * A game added to the registry appears automatically.
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
 * Unlock order: level 1 of every game, then level 2, and so on.
 * This way the child meets every game before going deeper into one —
 * it is the original interleaving, kept even though the map now groups
 * levels by game.
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

/** All the levels of a step are passed. */
export function isNodeDone(node: AdventureNode, progress: ProfileProgress): boolean {
  if (node.kind !== 'game') return false;
  return node.levelIds.every((levelId) => isLevelDone({ gameId: node.gameId, levelId }, progress));
}

/** Total stars earned on a step's levels (3 per level). */
export function nodeStarsTotal(node: AdventureNode, progress: ProfileProgress): number {
  if (node.kind !== 'game') return 0;
  return node.levelIds.reduce((sum, levelId) => sum + (progress[node.gameId]?.[levelId]?.stars ?? 0), 0);
}

/** Number of levels passed in a step (at least one star each). */
export function nodeLevelsDone(node: AdventureNode, progress: ProfileProgress): number {
  if (node.kind !== 'game') return 0;
  return node.levelIds.filter((levelId) => isLevelDone({ gameId: node.gameId, levelId }, progress)).length;
}

/** First level not yet passed in the interleaved order (the "current" level). */
export function currentStep(progress: ProfileProgress, order = UNLOCK_ORDER): UnlockStep | undefined {
  return order.find((step) => !isLevelDone(step, progress));
}

/**
 * Level to launch for a step: its first level not yet passed,
 * failing that the last one (the game is finished, we replay it).
 */
export function nextLevelOf(node: AdventureNode, progress: ProfileProgress): string | undefined {
  if (node.kind !== 'game') return undefined;
  return (
    node.levelIds.find((levelId) => !isLevelDone({ gameId: node.gameId, levelId }, progress)) ??
    node.levelIds[node.levelIds.length - 1]
  );
}

/** Index of the step containing the current level (the bonus if everything is passed). */
export function currentNodeIndex(progress: ProfileProgress, path = ADVENTURE_PATH, order = UNLOCK_ORDER): number {
  const step = currentStep(progress, order);
  if (!step) return path.length - 1;
  const idx = path.findIndex((n) => n.kind === 'game' && n.gameId === step.gameId);
  return idx === -1 ? path.length - 1 : idx;
}

/**
 * A step's status. A step is "current" if it contains the current level,
 * "done" if all its levels are passed, otherwise locked.
 * A step already started but not current stays playable (see `isNodeOpen`).
 */
export function nodeStatus(index: number, progress: ProfileProgress, path = ADVENTURE_PATH): NodeStatus {
  const node = path[index];
  if (!node) return 'locked';
  if (index === currentNodeIndex(progress, path)) return 'current';
  if (isNodeDone(node, progress)) return 'done';
  return 'locked';
}

/**
 * An accessible step: it contains at least one unlocked level, that is, one
 * that precedes or equals the current level in the interleaved order.
 */
export function isNodeOpen(node: AdventureNode, progress: ProfileProgress, order = UNLOCK_ORDER): boolean {
  if (node.kind !== 'game') return false;
  const current = currentStep(progress, order);
  if (!current) return true;
  const currentIdx = order.findIndex((s) => s.gameId === current.gameId && s.levelId === current.levelId);
  return order.some((s, i) => i <= currentIdx && s.gameId === node.gameId);
}

/** Index of a game's step (−1 if it is not part of it). */
export function nodeIndexOf(gameId: string, path = ADVENTURE_PATH): number {
  return path.findIndex((n) => n.kind === 'game' && n.gameId === gameId);
}
