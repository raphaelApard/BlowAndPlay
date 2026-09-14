import { describe, expect, it } from 'vitest';
import { GAMES as REAL_GAMES } from '../games/registry';
import type { AnyGameDefinition } from '../games/types';
import type { ProfileProgress } from '../store/types';
import {
  ADVENTURE_PATH as REAL_PATH,
  buildAdventurePath,
  buildUnlockOrder,
  currentNodeIndex,
  currentStep,
  isNodeDone,
  isNodeOpen,
  nextLevelOf,
  nodeIndexOf,
  nodeLevelsDone,
  nodeStarsTotal,
  nodeStatus,
} from './path';

/**
 * Fixture games rather than the real registry: these tests describe the
 * unlock rules, and must not change when a game is added to the project.
 */
function game(id: string, levels: string[], order = 0): AnyGameDefinition {
  return {
    id,
    order,
    title: { fr: id, en: id },
    description: { fr: '', en: '' },
    instruction: { fr: '', en: '' },
    pattern: 'long',
    accent: '#000000',
    levels: levels.map((l) => ({ id: l })),
    Game: (() => null) as unknown as AnyGameDefinition['Game'],
  };
}

const GAMES = [game('alpha', ['1', '2']), game('beta', ['1', '2']), game('gamma', ['1', '2'])];
const PATH = buildAdventurePath(GAMES);
const ORDER = buildUnlockOrder(GAMES);

/** Progress from a list of "gameId:levelId" passed with one star. */
function progressOf(...done: string[]): ProfileProgress {
  const out: ProfileProgress = {};
  for (const entry of done) {
    const [gameId, levelId] = entry.split(':');
    out[gameId] ??= {};
    out[gameId][levelId] = { stars: 1, plays: 1 };
  }
  return out;
}

const ALL_DONE = progressOf(...GAMES.flatMap((g) => g.levels.map((l: { id: string }) => `${g.id}:${l.id}`)));

describe('buildAdventurePath', () => {
  it('makes one step per game, in the order given, then the bonus', () => {
    expect(PATH.map((n) => n.id)).toEqual(['alpha', 'beta', 'gamma', 'bonus:end']);
    expect(PATH.at(-1)?.kind).toBe('bonus');
  });

  it('groups each game’s levels into its step', () => {
    const node = PATH[0];
    expect(node.kind === 'game' && node.levelIds).toEqual(['1', '2']);
  });

  it('is just the bonus when no game is selected', () => {
    expect(buildAdventurePath([]).map((n) => n.id)).toEqual(['bonus:end']);
  });
});

describe('buildUnlockOrder', () => {
  it('interleaves: level 1 of every game, then level 2', () => {
    expect(ORDER.map((s) => `${s.gameId}:${s.levelId}`)).toEqual([
      'alpha:1',
      'beta:1',
      'gamma:1',
      'alpha:2',
      'beta:2',
      'gamma:2',
    ]);
  });

  it('lets a shorter game drop out of the later rounds', () => {
    const order = buildUnlockOrder([game('short', ['1']), game('long', ['1', '2', '3'])]);
    expect(order.map((s) => `${s.gameId}:${s.levelId}`)).toEqual(['short:1', 'long:1', 'long:2', 'long:3']);
  });

  it('is empty without games', () => {
    expect(buildUnlockOrder([])).toEqual([]);
  });
});

describe('a level counts as done from one star', () => {
  it('does not count a level played without a star', () => {
    const progress: ProfileProgress = { alpha: { '1': { stars: 0, plays: 3 } } };
    expect(currentStep(progress, ORDER)).toEqual({ gameId: 'alpha', levelId: '1' });
  });

  it('counts a level with one star', () => {
    expect(currentStep(progressOf('alpha:1'), ORDER)).toEqual({ gameId: 'beta', levelId: '1' });
  });
});

describe('node state', () => {
  it('is done only when every level of the step is passed', () => {
    expect(isNodeDone(PATH[0], progressOf('alpha:1'))).toBe(false);
    expect(isNodeDone(PATH[0], progressOf('alpha:1', 'alpha:2'))).toBe(true);
  });

  it('is never done for the bonus', () => {
    expect(isNodeDone(PATH[3], ALL_DONE)).toBe(false);
  });

  it('totals the stars of a step', () => {
    const progress: ProfileProgress = { alpha: { '1': { stars: 3, plays: 1 }, '2': { stars: 2, plays: 1 } } };
    expect(nodeStarsTotal(PATH[0], progress)).toBe(5);
    expect(nodeStarsTotal(PATH[3], progress)).toBe(0);
  });

  it('counts the levels passed in a step', () => {
    expect(nodeLevelsDone(PATH[0], progressOf('alpha:1'))).toBe(1);
    expect(nodeLevelsDone(PATH[0], progressOf('alpha:1', 'alpha:2'))).toBe(2);
    expect(nodeLevelsDone(PATH[3], ALL_DONE)).toBe(0);
  });
});

describe('currentStep', () => {
  it('is the first level of the first game at the start', () => {
    expect(currentStep({}, ORDER)).toEqual({ gameId: 'alpha', levelId: '1' });
  });

  it('follows the interleaved order', () => {
    expect(currentStep(progressOf('alpha:1', 'beta:1'), ORDER)).toEqual({ gameId: 'gamma', levelId: '1' });
    expect(currentStep(progressOf('alpha:1', 'beta:1', 'gamma:1'), ORDER)).toEqual({ gameId: 'alpha', levelId: '2' });
  });

  it('is undefined once everything is passed', () => {
    expect(currentStep(ALL_DONE, ORDER)).toBeUndefined();
  });
});

describe('nextLevelOf', () => {
  it('is the first level not yet passed', () => {
    expect(nextLevelOf(PATH[0], progressOf('alpha:1'))).toBe('2');
  });

  it('replays the last level once the game is finished', () => {
    expect(nextLevelOf(PATH[0], progressOf('alpha:1', 'alpha:2'))).toBe('2');
  });

  it('is undefined for the bonus', () => {
    expect(nextLevelOf(PATH[3], {})).toBeUndefined();
  });
});

describe('currentNodeIndex', () => {
  it('points at the step holding the current level', () => {
    expect(currentNodeIndex({}, PATH, ORDER)).toBe(0);
    expect(currentNodeIndex(progressOf('alpha:1'), PATH, ORDER)).toBe(1);
  });

  it('points at the bonus once the adventure is finished', () => {
    expect(currentNodeIndex(ALL_DONE, PATH, ORDER)).toBe(PATH.length - 1);
  });

  it('falls back to the bonus when the current level’s game is not on the path', () => {
    // A game excluded from this child's adventure: it is in the unlock order
    // passed in, but not among the map's steps.
    const orphanOrder = [...ORDER, { gameId: 'removed', levelId: '1' }];
    expect(currentNodeIndex(ALL_DONE, PATH, orphanOrder)).toBe(PATH.length - 1);
  });
});

/**
 * `nodeStatus` takes no unlock order: it derives the current step from the
 * real `UNLOCK_ORDER`. So it is exercised against the real path — with
 * fixture games it would always fall back to the bonus.
 */
describe('nodeStatus', () => {
  const realDone = (...ids: string[]) =>
    progressOf(...ids.flatMap((id) => REAL_GAMES.find((g) => g.id === id)!.levels.map((l: { id: string }) => `${id}:${l.id}`)));

  it('marks the step holding the current level as current', () => {
    expect(nodeStatus(0, {})).toBe('current');
  });

  it('marks a fully passed step as done once the current level has moved on', () => {
    // Every level of the first game passed: the current level is now level 1
    // of the second game, so the first step reads as done.
    const progress = realDone(REAL_GAMES[0].id);
    expect(nodeStatus(0, progress)).toBe('done');
  });

  it('prefers current over done for the step holding the current level', () => {
    // The first game is finished but the current level is its level 2 only if
    // nothing else is pending; here level 1 of the other games is still to do,
    // so the current step sits in the second game.
    const progress = realDone(REAL_GAMES[0].id);
    expect(nodeStatus(1, progress)).toBe('current');
  });

  it('locks a step not yet reached', () => {
    expect(nodeStatus(REAL_PATH.length - 2, {})).toBe('locked');
  });

  it('locks an index outside the path', () => {
    expect(nodeStatus(99, {})).toBe('locked');
  });
});

describe('isNodeOpen', () => {
  it('opens only the first game at the very start', () => {
    expect(isNodeOpen(PATH[0], {}, ORDER)).toBe(true);
    expect(isNodeOpen(PATH[1], {}, ORDER)).toBe(false);
  });

  it('keeps an already-started game open once the current step has moved on', () => {
    // alpha:1 passed, the current step is beta:1: alpha must stay playable.
    const progress = progressOf('alpha:1');
    expect(isNodeOpen(PATH[0], progress, ORDER)).toBe(true);
    expect(isNodeOpen(PATH[1], progress, ORDER)).toBe(true);
    expect(isNodeOpen(PATH[2], progress, ORDER)).toBe(false);
  });

  it('opens every game once the adventure is finished', () => {
    for (const node of PATH.filter((n) => n.kind === 'game')) {
      expect(isNodeOpen(node, ALL_DONE, ORDER)).toBe(true);
    }
  });

  it('never opens the bonus step', () => {
    expect(isNodeOpen(PATH[3], {}, ORDER)).toBe(false);
  });
});

describe('nodeIndexOf', () => {
  it('finds a game’s step', () => {
    expect(nodeIndexOf('beta', PATH)).toBe(1);
  });

  it('returns −1 for a game that is not on the path', () => {
    expect(nodeIndexOf('nope', PATH)).toBe(-1);
  });
});
