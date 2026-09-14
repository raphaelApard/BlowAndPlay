import { describe, expect, it } from 'vitest';
import { difficultyToUnit } from '../../store/store';
import { GAMES } from '../registry';
import type { LevelBase } from '../types';
import { Child, TYPICAL_CHILD } from './child';
import { run } from './harness';
import { FRAME_MS, MAX_MS } from './types';

/**
 * The balance suite compares the games with one another; it assumes, without
 * ever checking, that a simulation is reproducible and that the child model
 * behaves. Those assumptions are what this file pins down — if they break,
 * the balance table stops describing anything stable.
 */

const MID = difficultyToUnit(5);

describe.each(GAMES.map((g) => [g.id, g] as const))('%s', (_id, game) => {
  it('replays a level identically', () => {
    const level = game.levels[0] as LevelBase;
    const first = game.simulate!(level, MID, new Child(TYPICAL_CHILD));
    const second = game.simulate!(level, MID, new Child(TYPICAL_CHILD));
    expect(second).toEqual(first);
  });

  it('finishes every level with a plausible outcome', () => {
    for (const level of game.levels as readonly LevelBase[]) {
      const outcome = game.simulate!(level, MID, new Child(TYPICAL_CHILD));
      expect(outcome.finished, `${game.id} level ${level.id}`).toBe(true);
      expect(Number.isFinite(outcome.elapsedMs)).toBe(true);
      expect(outcome.elapsedMs).toBeGreaterThan(0);
      expect(outcome.blowMs).toBeGreaterThan(0);
      expect(outcome.blowMs).toBeLessThanOrEqual(outcome.elapsedMs);
      expect(outcome.blows).toBeGreaterThan(0);
      expect([1, 2, 3]).toContain(outcome.stars);
    }
  });
});

describe('the run loop', () => {
  it('gives up after MAX_MS when the game never finishes', () => {
    const outcome = run(new Child(TYPICAL_CHILD), () => ({ kind: 'long' }));
    expect(outcome.finished).toBe(false);
    expect(outcome.elapsedMs).toBe(Infinity);
    expect(outcome.stars).toBe(0);
    // The effort is still measured, which is what the report shows.
    expect(outcome.blowMs).toBeGreaterThan(0);
  });

  it('keeps the first result when finish is called twice', () => {
    const outcome = run(new Child(TYPICAL_CHILD), (f, finish) => {
      if (f.t >= 1000) {
        finish(1000, 3);
        finish(5000, 1);
      }
      return { kind: 'long' };
    });
    expect(outcome.elapsedMs).toBe(1000);
    expect(outcome.stars).toBe(3);
  });

  it('smooths the intensity the way the games do', () => {
    // `power` trails the raw intensity: it must stay between 0 and the peak.
    let maxPower = 0;
    let maxRaw = 0;
    run(new Child(TYPICAL_CHILD), (f, finish) => {
      maxPower = Math.max(maxPower, f.power);
      maxRaw = Math.max(maxRaw, f.st.intensity);
      if (f.t >= 5000) finish(f.t, 3);
      return { kind: 'long' };
    });
    expect(maxPower).toBeGreaterThan(0);
    expect(maxPower).toBeLessThanOrEqual(maxRaw);
  });

  it('advances one 60 Hz frame at a time', () => {
    const times: number[] = [];
    run(new Child(TYPICAL_CHILD), (f, finish) => {
      times.push(f.t);
      if (f.t >= FRAME_MS * 3) finish(f.t, 3);
      return { kind: 'rest' };
    });
    expect(times[0]).toBe(0);
    expect(times[1]).toBeCloseTo(FRAME_MS);
    expect(MAX_MS).toBeGreaterThan(0);
  });
});

describe('the typical child', () => {
  it('does not blow when the game asks for nothing', () => {
    const child = new Child(TYPICAL_CHILD);
    for (let i = 0; i < 300; i++) child.next(FRAME_MS, { kind: 'rest' });
    expect(child.blowMs).toBe(0);
    expect(child.blows).toBe(0);
  });

  it('blows when asked, and counts one blow per rising edge', () => {
    const child = new Child(TYPICAL_CHILD);
    for (let i = 0; i < 60; i++) child.next(FRAME_MS, { kind: 'long' });
    expect(child.blows).toBe(1);
    expect(child.blowMs).toBeGreaterThan(0);
  });

  it('runs out of breath on a long blow, then starts again', () => {
    const child = new Child(TYPICAL_CHILD);
    const intensities: number[] = [];
    // Well beyond longMaxMs + longRestMs, so at least one pause must appear.
    for (let i = 0; i < 600; i++) intensities.push(child.next(FRAME_MS, { kind: 'long' }).intensity);

    expect(Math.max(...intensities)).toBeGreaterThan(0.5);
    expect(Math.min(...intensities)).toBe(0);
    expect(child.blows).toBeGreaterThan(1);
  });

  it('holds around the intensity the game asks for', () => {
    const child = new Child(TYPICAL_CHILD);
    // Let the slow "measured blow" ramp settle before sampling.
    for (let i = 0; i < 120; i++) child.next(FRAME_MS, { kind: 'hold', level: 0.5 });
    const samples: number[] = [];
    for (let i = 0; i < 60; i++) samples.push(child.next(FRAME_MS, { kind: 'hold', level: 0.5 }).intensity);
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    expect(mean).toBeGreaterThan(0.3);
    expect(mean).toBeLessThan(0.7);
  });

  it('accumulates effort only while actually blowing', () => {
    const child = new Child(TYPICAL_CHILD);
    for (let i = 0; i < 60; i++) child.next(FRAME_MS, { kind: 'long' });
    const afterBlowing = child.blowMs;
    for (let i = 0; i < 120; i++) child.next(FRAME_MS, { kind: 'rest' });
    // Breath keeps falling for a few frames, but must then stop counting.
    const settled = child.blowMs;
    for (let i = 0; i < 60; i++) child.next(FRAME_MS, { kind: 'rest' });
    expect(child.blowMs).toBe(settled);
    expect(settled).toBeGreaterThanOrEqual(afterBlowing);
  });

  it('reports the duration of the blow in progress', () => {
    const child = new Child(TYPICAL_CHILD);
    let last = 0;
    for (let i = 0; i < 30; i++) last = child.next(FRAME_MS, { kind: 'long' }).blowDurationMs;
    expect(last).toBeGreaterThan(0);

    let after = last;
    for (let i = 0; i < 120; i++) after = child.next(FRAME_MS, { kind: 'rest' }).blowDurationMs;
    expect(after).toBe(0);
  });
});
