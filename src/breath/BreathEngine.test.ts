import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BreathEngine, computeCalibration } from './BreathEngine';
import type { BreathEvent, BreathSource, Calibration } from './types';

/**
 * The engine turns a source's raw level into an intensity and into
 * blowStart / blowEnd events. It is driven entirely by the source callback,
 * so a fake source plus a controlled clock covers it without a browser.
 */

class FakeSource implements BreathSource {
  readonly kind = 'mic' as const;
  defaultCalibration: Calibration = { noiseFloor: 0, peak: 1 };
  started = 0;
  stopped = 0;
  private readonly listeners = new Set<(level: number) => void>();

  async start() {
    this.started++;
  }

  stop() {
    this.stopped++;
  }

  onLevel(cb: (level: number) => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /** Pushes a raw level, as the mic would on a frame. */
  emit(level: number) {
    for (const cb of [...this.listeners]) cb(level);
  }

  get listenerCount() {
    return this.listeners.size;
  }
}

/** Controlled clock: each frame advances `performance.now()` by 16 ms. */
let now = 0;
const FRAME = 16;

function frame(source: FakeSource, level: number, times = 1) {
  for (let i = 0; i < times; i++) {
    now += FRAME;
    source.emit(level);
  }
}

beforeEach(() => {
  now = 1000;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** An engine already started on a fake source, with a 0..1 calibration. */
async function started(options?: ConstructorParameters<typeof BreathEngine>[0]) {
  const source = new FakeSource();
  const engine = new BreathEngine(options);
  await engine.setSource(source);
  await engine.start();
  engine.setCalibration({ noiseFloor: 0, peak: 1 });
  return { engine, source };
}

/** Blows hard enough, long enough, for the smoothing to settle high. */
function settleHigh(source: FakeSource, level = 1) {
  frame(source, level, 30);
}

describe('computeCalibration', () => {
  const fallback: Calibration = { noiseFloor: 0.01, peak: 0.25 };

  it('falls back when a phase produced no sample', () => {
    expect(computeCalibration([], [0.5], fallback)).toBe(fallback);
    expect(computeCalibration([0.01], [], fallback)).toBe(fallback);
  });

  it('puts the noise floor above the ambient noise', () => {
    const silence = Array.from({ length: 20 }, () => 0.02);
    const { noiseFloor } = computeCalibration(silence, [0.6], fallback);
    expect(noiseFloor).toBeCloseTo(0.02 * 1.25);
  });

  it('takes the peak near the top of the blow phase', () => {
    const silence = Array.from({ length: 10 }, () => 0);
    const blow = Array.from({ length: 100 }, (_, i) => i / 100);
    const { peak } = computeCalibration(silence, blow, fallback);
    expect(peak).toBeGreaterThan(0.7);
    expect(peak).toBeLessThanOrEqual(1);
  });

  it('keeps a usable range when the child barely blew', () => {
    const silence = Array.from({ length: 10 }, () => 0.1);
    const blow = Array.from({ length: 10 }, () => 0.1);
    const { noiseFloor, peak } = computeCalibration(silence, blow, fallback);
    expect(peak).toBeGreaterThan(noiseFloor);
  });

  it('handles a single sample per phase', () => {
    expect(() => computeCalibration([0.01], [0.5], fallback)).not.toThrow();
  });
});

describe('calibration used by the engine', () => {
  it('falls back to the source default, then to 0..1', async () => {
    const engine = new BreathEngine();
    expect(engine.getCalibration()).toEqual({ noiseFloor: 0, peak: 1 });

    const source = new FakeSource();
    source.defaultCalibration = { noiseFloor: 0.01, peak: 0.25 };
    await engine.setSource(source);
    expect(engine.getCalibration()).toEqual({ noiseFloor: 0.01, peak: 0.25 });
  });

  it('reports whether it has been calibrated', async () => {
    const { engine } = await started();
    expect(engine.isCalibrated()).toBe(true);
    engine.setCalibration(null);
    expect(engine.isCalibrated()).toBe(false);
  });

  it('normalizes the raw level against the calibration', async () => {
    const { engine, source } = await started();
    engine.setCalibration({ noiseFloor: 0.1, peak: 0.5 });

    frame(source, 0.1, 40);
    expect(engine.getState().intensity).toBe(0);

    settleHigh(source, 0.5);
    expect(engine.getState().intensity).toBeCloseTo(1, 2);
  });

  it('clamps a level above the calibrated peak', async () => {
    const { engine, source } = await started();
    engine.setCalibration({ noiseFloor: 0, peak: 0.5 });
    settleHigh(source, 5);
    expect(engine.getState().intensity).toBeLessThanOrEqual(1);
  });

  it('does not divide by zero on a degenerate calibration', async () => {
    const { engine, source } = await started();
    engine.setCalibration({ noiseFloor: 0.3, peak: 0.3 });
    frame(source, 0.5, 5);
    expect(Number.isFinite(engine.getState().intensity)).toBe(true);
  });
});

describe('smoothing', () => {
  it('rises faster than it falls', async () => {
    const { engine, source } = await started();
    frame(source, 1);
    const afterOneRise = engine.getState().intensity;

    settleHigh(source);
    const high = engine.getState().intensity;
    frame(source, 0);
    const droppedBy = high - engine.getState().intensity;

    expect(afterOneRise).toBeCloseTo(0.35, 5);
    expect(droppedBy / high).toBeCloseTo(0.12, 5);
  });

  it('snaps to zero once the level is negligible', async () => {
    const { engine, source } = await started();
    settleHigh(source);
    frame(source, 0, 200);
    expect(engine.getState().intensity).toBe(0);
  });
});

describe('blow detection', () => {
  it('emits one blowStart when crossing the on threshold', async () => {
    const { engine, source } = await started();
    const events: BreathEvent[] = [];
    engine.on((e) => events.push(e));

    settleHigh(source);
    expect(events.filter((e) => e.type === 'blowStart')).toHaveLength(1);
    expect(engine.getState().isBlowing).toBe(true);
  });

  it('does not end the blow on a dip inside the hysteresis band', async () => {
    const { engine, source } = await started();
    const events: BreathEvent[] = [];
    engine.on((e) => events.push(e));

    settleHigh(source);
    // Settle between offThreshold (0.10) and onThreshold (0.18).
    frame(source, 0.14, 40);
    expect(engine.getState().intensity).toBeGreaterThan(0.1);
    expect(engine.getState().intensity).toBeLessThan(0.18);
    expect(engine.getState().isBlowing).toBe(true);
    expect(events.filter((e) => e.type === 'blowEnd')).toHaveLength(0);
  });

  it('emits blowEnd once the level falls below the off threshold', async () => {
    const { engine, source } = await started();
    const events: BreathEvent[] = [];
    engine.on((e) => events.push(e));

    settleHigh(source);
    frame(source, 0, 40);
    expect(events.filter((e) => e.type === 'blowEnd')).toHaveLength(1);
    expect(engine.getState().isBlowing).toBe(false);
  });

  it('ignores a blow shorter than minBlowMs', async () => {
    // A very high threshold: whatever the release ramp costs, this blow is
    // shorter — it starts, but must never be reported as a finished blow.
    const { engine, source } = await started({ minBlowMs: 100_000 });
    const events: BreathEvent[] = [];
    engine.on((e) => events.push(e));

    settleHigh(source);
    frame(source, 0, 40);
    expect(events.filter((e) => e.type === 'blowStart')).toHaveLength(1);
    expect(events.filter((e) => e.type === 'blowEnd')).toHaveLength(0);
  });

  it('reports a blow that lasts longer than minBlowMs', async () => {
    const { engine, source } = await started({ minBlowMs: 80 });
    const events: BreathEvent[] = [];
    engine.on((e) => events.push(e));

    settleHigh(source);
    frame(source, 0, 40);
    const end = events.find((e) => e.type === 'blowEnd');
    expect(end?.type === 'blowEnd' && end.blow.durationMs).toBeGreaterThanOrEqual(80);
  });

  it('summarizes the blow it ends', async () => {
    const { engine, source } = await started();
    const events: BreathEvent[] = [];
    engine.on((e) => events.push(e));

    const startedAt = now;
    settleHigh(source);
    frame(source, 0, 40);

    const end = events.find((e) => e.type === 'blowEnd');
    expect(end).toBeDefined();
    if (end?.type !== 'blowEnd') throw new Error('no blowEnd emitted');

    const { blow } = end;
    expect(blow.durationMs).toBeGreaterThan(0);
    expect(blow.peak).toBeGreaterThan(0.9);
    expect(blow.mean).toBeGreaterThan(0);
    expect(blow.mean).toBeLessThanOrEqual(blow.peak);
    expect(blow.startedAt).toBeGreaterThanOrEqual(startedAt);
  });

  it('counts two blows when the level returns to silence in between', async () => {
    const { engine, source } = await started();
    const events: BreathEvent[] = [];
    engine.on((e) => events.push(e));

    settleHigh(source);
    frame(source, 0, 40);
    settleHigh(source);
    frame(source, 0, 40);

    expect(events.filter((e) => e.type === 'blowStart')).toHaveLength(2);
    expect(events.filter((e) => e.type === 'blowEnd')).toHaveLength(2);
  });

  it('reports the duration of the blow in progress, and 0 otherwise', async () => {
    const { engine, source } = await started();
    expect(engine.getState().blowDurationMs).toBe(0);

    settleHigh(source);
    const during = engine.getState().blowDurationMs;
    expect(during).toBeGreaterThan(0);

    frame(source, 1, 10);
    expect(engine.getState().blowDurationMs).toBeGreaterThan(during);

    frame(source, 0, 40);
    expect(engine.getState().blowDurationMs).toBe(0);
  });
});

describe('resetBlow', () => {
  it('forgets the blow in progress without emitting blowEnd', async () => {
    const { engine, source } = await started();
    settleHigh(source);
    const events: BreathEvent[] = [];
    engine.on((e) => events.push(e));

    engine.resetBlow();
    expect(events).toEqual([]);
    expect(engine.getState().isBlowing).toBe(false);
  });

  it('stays silent while the child is still blowing', async () => {
    // This is what stops the blow that launched the game from also playing it.
    const { engine, source } = await started();
    settleHigh(source);
    engine.resetBlow();

    const events: BreathEvent[] = [];
    engine.on((e) => events.push(e));
    settleHigh(source);

    expect(events).toEqual([]);
    expect(engine.getState().isBlowing).toBe(false);
  });

  it('re-arms once the level has fallen back', async () => {
    const { engine, source } = await started();
    settleHigh(source);
    engine.resetBlow();
    settleHigh(source);

    const events: BreathEvent[] = [];
    engine.on((e) => events.push(e));
    frame(source, 0, 60);
    settleHigh(source);

    expect(events.filter((e) => e.type === 'blowStart')).toHaveLength(1);
    expect(engine.getState().isBlowing).toBe(true);
  });
});

describe('source lifecycle', () => {
  it('starts the source once', async () => {
    const { engine, source } = await started();
    await engine.start();
    expect(source.started).toBe(1);
    expect(engine.isRunning()).toBe(true);
  });

  it('stops the source and unsubscribes from it', async () => {
    const { engine, source } = await started();
    engine.stop();
    expect(source.stopped).toBeGreaterThan(0);
    expect(engine.isRunning()).toBe(false);
    expect(source.listenerCount).toBe(0);
  });

  it('resets the envelope when stopped', async () => {
    const { engine, source } = await started();
    settleHigh(source);
    engine.stop();
    expect(engine.getState().intensity).toBe(0);
    expect(engine.getState().isBlowing).toBe(false);
  });

  it('does nothing on start without a source', async () => {
    const engine = new BreathEngine();
    await engine.start();
    expect(engine.isRunning()).toBe(false);
  });

  it('drops the calibration when the source changes', async () => {
    const { engine } = await started();
    expect(engine.isCalibrated()).toBe(true);
    await engine.setSource(new FakeSource());
    expect(engine.isCalibrated()).toBe(false);
  });

  it('restarts on the new source only if it was running', async () => {
    const { engine } = await started();
    const next = new FakeSource();
    await engine.setSource(next);
    expect(next.started).toBe(1);

    engine.stop();
    const last = new FakeSource();
    await engine.setSource(last);
    expect(last.started).toBe(0);
  });

  it('collects raw samples for the calibration screen', async () => {
    const { engine, source } = await started();
    const sampling = engine.sampleRaw();
    frame(source, 0.4, 3);
    const samples = sampling.stop();
    expect(samples).toEqual([0.4, 0.4, 0.4]);

    frame(source, 0.9);
    expect(sampling.stop()).toEqual([0.4, 0.4, 0.4]);
  });
});

describe('subscriptions', () => {
  it('notifies state listeners on every sample, until they unsubscribe', async () => {
    const { engine, source } = await started();
    const seen: number[] = [];
    const off = engine.subscribe((s) => seen.push(s.intensity));

    frame(source, 1, 3);
    expect(seen).toHaveLength(3);

    off();
    frame(source, 1);
    expect(seen).toHaveLength(3);
  });

  it('stops sending events after unsubscribe', async () => {
    const { engine, source } = await started();
    const events: BreathEvent[] = [];
    const off = engine.on((e) => events.push(e));

    settleHigh(source);
    expect(events).toHaveLength(1);

    off();
    frame(source, 0, 40);
    expect(events).toHaveLength(1);
  });

  it('keeps every listener independent', async () => {
    const { engine, source } = await started();
    let a = 0;
    let b = 0;
    const offA = engine.subscribe(() => a++);
    engine.subscribe(() => b++);

    frame(source, 1);
    offA();
    frame(source, 1);

    expect(a).toBe(1);
    expect(b).toBe(2);
  });
});
