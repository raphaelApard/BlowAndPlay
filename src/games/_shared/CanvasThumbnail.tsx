import { useEffect, useRef } from 'react';
import { setupCanvas } from './canvas';
import { thumbUnit } from './math';

interface Props {
  /** Classe de la vignette (fond), dans le module CSS du jeu. */
  className: string;
  /** Draws the thumbnail. `unit` follows the smallest side (see `thumbUnit`). */
  paint(ctx: CanvasRenderingContext2D, w: number, h: number, unit: number): void;
}

/**
 * A game's thumbnail on the Games card: a canvas matched to the screen
 * density, redrawn on resize. Each game only provides its drawing; the
 * scaffolding was identical in all six thumbnails.
 */
export function CanvasThumbnail({ className, paint }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      const ctx = setupCanvas(canvas, w, h);
      if (!ctx) return;
      paint(ctx, w, h, thumbUnit(w, h));
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
    // `paint` is a stable function per game (defined at module level).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={className} aria-hidden>
      <canvas ref={ref} />
    </div>
  );
}
