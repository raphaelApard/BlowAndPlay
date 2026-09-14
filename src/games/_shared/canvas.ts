/**
 * Utilitaires canvas communs aux jeux et à leurs vignettes.
 */

/** Encre des ombres « papier découpé », commune à tous les jeux. */
export const INK = 'rgba(35, 50, 74, 0.22)';

/**
 * Cale le canvas sur la densité de l'écran et renvoie son contexte déjà
 * transformé : on dessine ensuite en pixels CSS, sans se soucier du `dpr`.
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
 * Forme découpée : l'ombre franche décalée, puis la forme elle-même.
 * C'est le geste de base du style « papier découpé » de tous les jeux.
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
