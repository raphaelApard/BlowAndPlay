import { drawCloud, drawHill, drawKid, drawKite, drawSky, drawString, drawSun, drawWindBand } from './draw';
import { CanvasThumbnail } from '../_shared/CanvasThumbnail';
import styles from './cerf.module.css';

/** Vignette de la carte « Jeux » : l'enfant et son cerf-volant dans la bande de vent. */
export function Thumbnail() {
  return <CanvasThumbnail className={styles.thumb} paint={paint} />;
}

/** Drawing of the thumbnail (see `CanvasThumbnail` for the scaffolding). */
function paint(ctx: CanvasRenderingContext2D, w: number, h: number, unit: number) {
  const groundY = h * 0.84;

  drawSky(ctx, w, h);
  drawSun(ctx, w * 0.85, h * 0.14, 22 * unit);
  drawCloud(ctx, w * 0.2, h * 0.14, unit * 0.45);
  drawWindBand(ctx, w, h * 0.26, h * 0.5, 0, 0.9, 0);
  drawHill(ctx, w, h, groundY, unit);
  const hand = drawKid(ctx, w * 0.28, groundY + 4 * unit, unit * 0.62, -0.9, 0);
  const kx = w * 0.66;
  const ky = h * 0.38;
  drawString(ctx, hand.x, hand.y, kx, ky, 10 * unit);
  drawKite(ctx, kx, ky, 26 * unit, 0.35, 0, 1);
}
