import { describe, expect, it } from 'vitest';
import { GAMES } from '../registry';
import type { LevelBase } from '../types';
import { Child, TYPICAL_CHILD } from './child';
import type { Outcome } from './types';
import { MAX_DIFFICULTY, MIN_DIFFICULTY, difficultyToUnit, migrateDifficulty } from '../../store/store';

/**
 * Balance: for a difficulty chosen by the parents, every game must demand a
 * comparable effort from the "typical child". A game much harder than the
 * others frustrates the child; a game much easier bores them.
 *
 * Measure: `blowMs`, the total breath time needed to finish the level (the
 * actual effort), and `elapsedMs`, the duration of the game.
 */

/** Tolerated deviation around the cross-game median (×). */
const EFFORT_TOLERANCE = 1.5;
const DURATION_TOLERANCE = 1.6;

const DIFFICULTIES = Array.from({ length: MAX_DIFFICULTY - MIN_DIFFICULTY + 1 }, (_, i) => MIN_DIFFICULTY + i);
const LEVEL_COUNT = Math.min(...GAMES.map((g) => g.levels.length));

function play(gameIndex: number, levelIndex: number, difficulty: number): Outcome {
  const game = GAMES[gameIndex];
  const level = game.levels[levelIndex] as LevelBase;
  if (!game.simulate) throw new Error(`${game.id}: no balance simulation (add simulate.ts, see src/games/balance/)`);
  return game.simulate(level, difficultyToUnit(difficulty), new Child(TYPICAL_CHILD));
}

function median(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * The full table, computed once when the file loads:
 * results[level][difficulty][game]. The tests then only read these values,
 * hence their 0 ms duration; the simulation time is printed in the report.
 */
const startedAt = performance.now();
const results = Array.from({ length: LEVEL_COUNT }, (_, li) => DIFFICULTIES.map((d) => GAMES.map((_, gi) => play(gi, li, d))));
const simulationMs = performance.now() - startedAt;
const simulationCount = LEVEL_COUNT * DIFFICULTIES.length * GAMES.length;

function fmt(ms: number) {
  return Number.isFinite(ms) ? `${(ms / 1000).toFixed(1)}s` : '∞';
}

describe('global difficulty', () => {
  it('goes from 1 to 10 and is scaled to 0..1 for the games', () => {
    expect(difficultyToUnit(MIN_DIFFICULTY)).toBe(0);
    expect(difficultyToUnit(MAX_DIFFICULTY)).toBe(1);
    expect(difficultyToUnit(5)).toBeCloseTo(4 / 9);
  });
  it('migrates old 0..100 saves', () => {
    expect(migrateDifficulty(0)).toBe(1);
    expect(migrateDifficulty(50)).toBe(6);
    expect(migrateDifficulty(100)).toBe(10);
    expect(migrateDifficulty(7)).toBe(7);
    expect(migrateDifficulty(undefined)).toBe(5);
  });
});

describe('every game has a simulation', () => {
  for (const game of GAMES) {
    it(game.id, () => {
      expect(game.simulate, `${game.id} must export simulate (see src/games/balance/)`).toBeTypeOf('function');
    });
  }
});

describe('the typical child finishes every level at every difficulty', () => {
  for (const [li, byDifficulty] of results.entries()) {
    for (const [di, byGame] of byDifficulty.entries()) {
      it(`level ${li + 1}, difficulty ${DIFFICULTIES[di]}`, () => {
        const stuck = GAMES.filter((_, gi) => !byGame[gi].finished).map((g) => g.id);
        expect(stuck, `games impossible to finish: ${stuck.join(', ')}`).toEqual([]);
      });
    }
  }
});

describe('the games demand a comparable effort', () => {
  for (const [li, byDifficulty] of results.entries()) {
    for (const [di, byGame] of byDifficulty.entries()) {
      it(`level ${li + 1}, difficulty ${DIFFICULTIES[di]}: breath within ±${Math.round((EFFORT_TOLERANCE - 1) * 100)} % of the median`, () => {
        const med = median(byGame.map((o) => o.blowMs));
        const off = GAMES.filter((_, gi) => byGame[gi].blowMs > med * EFFORT_TOLERANCE || byGame[gi].blowMs < med / EFFORT_TOLERANCE).map(
          (g, _, __) => `${g.id} (${fmt(byGame[GAMES.indexOf(g)].blowMs)} of breath, median ${fmt(med)})`,
        );
        expect(off, `unbalanced games: ${off.join(' ; ')}`).toEqual([]);
      });
      it(`level ${li + 1}, difficulty ${DIFFICULTIES[di]}: duration within ±${Math.round((DURATION_TOLERANCE - 1) * 100)} % of the median`, () => {
        const med = median(byGame.map((o) => o.elapsedMs));
        const off = GAMES.filter((_, gi) => byGame[gi].elapsedMs > med * DURATION_TOLERANCE || byGame[gi].elapsedMs < med / DURATION_TOLERANCE).map(
          (g) => `${g.id} (${fmt(byGame[GAMES.indexOf(g)].elapsedMs)}, median ${fmt(med)})`,
        );
        expect(off, `unbalanced games: ${off.join(' ; ')}`).toEqual([]);
      });
    }
  }
});

describe('difficulty rises with the setting, and with the levels', () => {
  for (const [gi, game] of GAMES.entries()) {
    it(`${game.id}: harder as the difficulty increases`, () => {
      for (let li = 0; li < LEVEL_COUNT; li++) {
        const easy = results[li][0][gi].blowMs;
        const hard = results[li][DIFFICULTIES.length - 1][gi].blowMs;
        expect(hard, `level ${li + 1}: ${fmt(hard)} at ${MAX_DIFFICULTY} against ${fmt(easy)} at ${MIN_DIFFICULTY}`).toBeGreaterThan(easy * 1.3);
        for (let di = 1; di < DIFFICULTIES.length; di++) {
          const prev = results[li][di - 1][gi].blowMs;
          const cur = results[li][di][gi].blowMs;
          expect(cur, `level ${li + 1}: difficulty ${DIFFICULTIES[di]} (${fmt(cur)}) easier than ${DIFFICULTIES[di - 1]} (${fmt(prev)})`).toBeGreaterThanOrEqual(prev * 0.95);
        }
      }
    });
    it(`${game.id}: harder from one level to the next`, () => {
      for (let li = 1; li < LEVEL_COUNT; li++) {
        for (let di = 0; di < DIFFICULTIES.length; di++) {
          const prev = results[li - 1][di][gi].blowMs;
          const cur = results[li][di][gi].blowMs;
          expect(cur, `difficulty ${DIFFICULTIES[di]}: level ${li + 1} (${fmt(cur)}) easier than level ${li} (${fmt(prev)})`).toBeGreaterThanOrEqual(prev);
        }
      }
    });
  }
});

describe('report', () => {
  it('effort / duration / stars table (typical child)', () => {
    // Computed, not hardcoded: adding a game then fails on the game count
    // below, which names the real cause, rather than on an opaque total.
    expect(GAMES.length, 'games registered').toBe(7);
    expect(simulationCount).toBe(GAMES.length * LEVEL_COUNT * DIFFICULTIES.length);
    expect(simulationMs).toBeGreaterThan(0);
    const lines: string[] = [`${simulationCount} games simulated in ${simulationMs.toFixed(0)} ms`];
    for (let li = 0; li < LEVEL_COUNT; li++) {
      lines.push(`\nLevel ${li + 1} — breath (duration, stars)`);
      lines.push(['game'.padEnd(20), ...DIFFICULTIES.map((d) => `d${d}`.padStart(16))].join(''));
      for (const [gi, game] of GAMES.entries()) {
        lines.push(
          [game.id.padEnd(20), ...DIFFICULTIES.map((_, di) => {
            const o = results[li][di][gi];
            return `${fmt(o.blowMs)} (${fmt(o.elapsedMs)},${o.stars}★)`.padStart(16);
          })].join(''),
        );
      }
    }
    console.log(lines.join('\n'));
  });
});
