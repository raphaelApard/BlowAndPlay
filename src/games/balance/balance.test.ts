import { describe, expect, it } from 'vitest';
import { GAMES } from '../registry';
import type { LevelBase } from '../types';
import { Child, TYPICAL_CHILD } from './child';
import type { Outcome } from './types';
import { MAX_DIFFICULTY, MIN_DIFFICULTY, difficultyToUnit, migrateDifficulty } from '../../store/store';

/**
 * Équilibrage : pour une difficulté choisie par les parents, tous les jeux
 * doivent demander à « l'enfant type » un effort comparable. Un jeu bien plus
 * dur que les autres frustre l'enfant ; un jeu bien plus facile l'ennuie.
 *
 * Mesure : `blowMs`, le temps total de souffle nécessaire pour finir le
 * niveau (l'effort réel), et `elapsedMs`, la durée de la partie.
 */

/** Écart toléré autour de la médiane des jeux (×). */
const EFFORT_TOLERANCE = 1.5;
const DURATION_TOLERANCE = 1.6;

const DIFFICULTIES = Array.from({ length: MAX_DIFFICULTY - MIN_DIFFICULTY + 1 }, (_, i) => MIN_DIFFICULTY + i);
const LEVEL_COUNT = Math.min(...GAMES.map((g) => g.levels.length));

function play(gameIndex: number, levelIndex: number, difficulty: number): Outcome {
  const game = GAMES[gameIndex];
  const level = game.levels[levelIndex] as LevelBase;
  if (!game.simulate) throw new Error(`${game.id} : pas de simulation d'équilibrage (ajouter simulate.ts, voir src/games/balance/)`);
  return game.simulate(level, difficultyToUnit(difficulty), new Child(TYPICAL_CHILD));
}

function median(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Tableau complet, calculé une fois au chargement du fichier :
 * results[level][difficulty][game]. Les tests ne font ensuite que lire ces
 * valeurs, d'où leur durée de 0 ms ; le temps de simulation est affiché
 * dans le rapport.
 */
const startedAt = performance.now();
const results = Array.from({ length: LEVEL_COUNT }, (_, li) => DIFFICULTIES.map((d) => GAMES.map((_, gi) => play(gi, li, d))));
const simulationMs = performance.now() - startedAt;
const simulationCount = LEVEL_COUNT * DIFFICULTIES.length * GAMES.length;

function fmt(ms: number) {
  return Number.isFinite(ms) ? `${(ms / 1000).toFixed(1)}s` : '∞';
}

describe('difficulté globale', () => {
  it('va de 1 à 10 et se ramène à 0..1 pour les jeux', () => {
    expect(difficultyToUnit(MIN_DIFFICULTY)).toBe(0);
    expect(difficultyToUnit(MAX_DIFFICULTY)).toBe(1);
    expect(difficultyToUnit(5)).toBeCloseTo(4 / 9);
  });
  it('migre les anciennes sauvegardes 0..100', () => {
    expect(migrateDifficulty(0)).toBe(1);
    expect(migrateDifficulty(50)).toBe(6);
    expect(migrateDifficulty(100)).toBe(10);
    expect(migrateDifficulty(7)).toBe(7);
    expect(migrateDifficulty(undefined)).toBe(5);
  });
});

describe('chaque jeu a une simulation', () => {
  for (const game of GAMES) {
    it(game.id, () => {
      expect(game.simulate, `${game.id} doit exporter simulate (voir src/games/balance/)`).toBeTypeOf('function');
    });
  }
});

describe("l'enfant type finit chaque niveau à chaque difficulté", () => {
  for (const [li, byDifficulty] of results.entries()) {
    for (const [di, byGame] of byDifficulty.entries()) {
      it(`niveau ${li + 1}, difficulté ${DIFFICULTIES[di]}`, () => {
        const stuck = GAMES.filter((_, gi) => !byGame[gi].finished).map((g) => g.id);
        expect(stuck, `jeux impossibles à finir : ${stuck.join(', ')}`).toEqual([]);
      });
    }
  }
});

describe('les jeux demandent un effort comparable', () => {
  for (const [li, byDifficulty] of results.entries()) {
    for (const [di, byGame] of byDifficulty.entries()) {
      it(`niveau ${li + 1}, difficulté ${DIFFICULTIES[di]} : souffle à ±${Math.round((EFFORT_TOLERANCE - 1) * 100)} % de la médiane`, () => {
        const med = median(byGame.map((o) => o.blowMs));
        const off = GAMES.filter((_, gi) => byGame[gi].blowMs > med * EFFORT_TOLERANCE || byGame[gi].blowMs < med / EFFORT_TOLERANCE).map(
          (g, _, __) => `${g.id} (${fmt(byGame[GAMES.indexOf(g)].blowMs)} de souffle, médiane ${fmt(med)})`,
        );
        expect(off, `jeux déséquilibrés : ${off.join(' ; ')}`).toEqual([]);
      });
      it(`niveau ${li + 1}, difficulté ${DIFFICULTIES[di]} : durée à ±${Math.round((DURATION_TOLERANCE - 1) * 100)} % de la médiane`, () => {
        const med = median(byGame.map((o) => o.elapsedMs));
        const off = GAMES.filter((_, gi) => byGame[gi].elapsedMs > med * DURATION_TOLERANCE || byGame[gi].elapsedMs < med / DURATION_TOLERANCE).map(
          (g) => `${g.id} (${fmt(byGame[GAMES.indexOf(g)].elapsedMs)}, médiane ${fmt(med)})`,
        );
        expect(off, `jeux déséquilibrés : ${off.join(' ; ')}`).toEqual([]);
      });
    }
  }
});

describe('la difficulté monte avec le réglage, et avec les niveaux', () => {
  for (const [gi, game] of GAMES.entries()) {
    it(`${game.id} : plus dur quand la difficulté augmente`, () => {
      for (let li = 0; li < LEVEL_COUNT; li++) {
        const easy = results[li][0][gi].blowMs;
        const hard = results[li][DIFFICULTIES.length - 1][gi].blowMs;
        expect(hard, `niveau ${li + 1} : ${fmt(hard)} à ${MAX_DIFFICULTY} contre ${fmt(easy)} à ${MIN_DIFFICULTY}`).toBeGreaterThan(easy * 1.3);
        for (let di = 1; di < DIFFICULTIES.length; di++) {
          const prev = results[li][di - 1][gi].blowMs;
          const cur = results[li][di][gi].blowMs;
          expect(cur, `niveau ${li + 1} : difficulté ${DIFFICULTIES[di]} (${fmt(cur)}) plus facile que ${DIFFICULTIES[di - 1]} (${fmt(prev)})`).toBeGreaterThanOrEqual(prev * 0.95);
        }
      }
    });
    it(`${game.id} : plus dur d'un niveau au suivant`, () => {
      for (let li = 1; li < LEVEL_COUNT; li++) {
        for (let di = 0; di < DIFFICULTIES.length; di++) {
          const prev = results[li - 1][di][gi].blowMs;
          const cur = results[li][di][gi].blowMs;
          expect(cur, `difficulté ${DIFFICULTIES[di]} : niveau ${li + 1} (${fmt(cur)}) plus facile que niveau ${li} (${fmt(prev)})`).toBeGreaterThanOrEqual(prev);
        }
      }
    });
  }
});

describe('rapport', () => {
  it('tableau effort / durée / étoiles (enfant type)', () => {
    expect(simulationCount).toBe(210);
    expect(simulationMs).toBeGreaterThan(0);
    const lines: string[] = [`${simulationCount} parties simulées en ${simulationMs.toFixed(0)} ms`];
    for (let li = 0; li < LEVEL_COUNT; li++) {
      lines.push(`\nNiveau ${li + 1} — souffle (durée, étoiles)`);
      lines.push(['jeu'.padEnd(20), ...DIFFICULTIES.map((d) => `d${d}`.padStart(16))].join(''));
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
