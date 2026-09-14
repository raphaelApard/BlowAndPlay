import type { BreathSource, Calibration } from './types';

/**
 * Fallback / development source: holding Space (or a finger on the screen,
 * away from buttons) simulates a blow. The level rises in ~150 ms and falls
 * quickly (~90 ms) so that two presses close together make two blows.
 */
export class KeyboardBreathSource implements BreathSource {
  readonly kind = 'keyboard' as const;
  readonly defaultCalibration: Calibration = { noiseFloor: 0, peak: 1 };

  private pressed = false;
  private level = 0;
  private raf = 0;
  private lastT = 0;
  private readonly listeners = new Set<(level: number) => void>();

  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      this.pressed = true;
    }
  };
  private readonly onKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'Space') this.pressed = false;
  };
  private readonly onPointerDown = (e: PointerEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, a, input, [data-no-blow]')) return;
    this.pressed = true;
  };
  private readonly onPointerUp = () => {
    this.pressed = false;
  };

  async start(): Promise<void> {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('blur', this.onPointerUp);

    this.lastT = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(64, t - this.lastT);
      this.lastT = t;
      const target = this.pressed ? 1 : 0;
      const rate = this.pressed ? dt / 150 : dt / 90;
      this.level += (target - this.level) * Math.min(1, rate);
      if (this.level < 0.002) this.level = 0;
      for (const cb of this.listeners) cb(this.level);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('blur', this.onPointerUp);
    this.pressed = false;
    this.level = 0;
  }

  onLevel(cb: (level: number) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
}
