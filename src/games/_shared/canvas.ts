/**
 * Canvas helpers common to the games and their thumbnails.
 */

/** The cut-paper shadow ink, common to every game. */
export const INK = 'rgba(35, 50, 74, 0.22)';

/**
 * Canvas pixel density, capped at 2. On 3× phones the extra pixels are not
 * visible at arm's length, but they more than double the fill cost of every
 * frame (9 pixels per CSS pixel instead of 4).
 */
export function canvasDpr(): number {
  return Math.min(2, window.devicePixelRatio || 1);
}

/**
 * Matches the canvas to the screen density and returns its already
 * transformed context: we then draw in CSS pixels, without worrying about
 * the `dpr`.
 */
export function setupCanvas(canvas: HTMLCanvasElement, width: number, height: number): CanvasRenderingContext2D | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const dpr = canvasDpr();
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
