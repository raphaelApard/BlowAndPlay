/**
 * Canvas helpers common to the games and their thumbnails.
 */

/** The cut-paper shadow ink, common to every game. */
export const INK = 'rgba(35, 50, 74, 0.22)';

/**
 * Matches the canvas to the screen density and returns its already
 * transformed context: we then draw in CSS pixels, without worrying about
 * the `dpr`.
 */
export function setupCanvas(canvas: HTMLCanvasElement, width: number, height: number): CanvasRenderingContext2D | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/**
 * A cut-out shape: the hard offset shadow, then the shape itself.
 * This is the basic gesture of the cut-paper style used by every game.
 */
export function cut(ctx: CanvasRenderingContext2D, shape: () => void, fill: string, offset = 4) {
  ctx.save();
  ctx.translate(offset, offset);
  ctx.beginPath();
  shape();
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  shape();
  ctx.fillStyle = fill;
  ctx.fill();
}
