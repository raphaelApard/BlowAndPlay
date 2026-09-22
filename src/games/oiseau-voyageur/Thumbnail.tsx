import { CanvasThumbnail } from '../_shared/CanvasThumbnail';
import { HILL_FAR, HILL_NEAR, drawBird, drawCloud, drawHills, drawPole, drawSky, drawWater } from './draw';
import styles from './oiseau.module.css';

/** Vignette de la carte « Jeux » : l'oiseau en vol entre deux poteaux. */
export function Thumbnail() {
  return <CanvasThumbnail className={styles.thumb} paint={paint} />;
}

/** Drawing of the thumbnail (see `CanvasThumbnail` for the scaffolding). */
function paint(ctx: CanvasRenderingContext2D, w: number, h: number, unit: number) {
  const waterY = h * 0.74;

  drawSky(ctx, w, h);
  drawCloud(ctx, w * 0.22, h * 0.16, unit * 0.42);
  drawCloud(ctx, w * 0.84, h * 0.26, unit * 0.34);
  drawHills(ctx, w, waterY, 0, unit, HILL_FAR, 100, 300);
  drawHills(ctx, w, waterY, 200, unit, HILL_NEAR, 56, 190);
  drawWater(ctx, w, h, waterY, unit, 0);
  drawPole(ctx, w * 0.16, h * 0.5, waterY, unit, 0, 0);
  drawPole(ctx, w * 0.86, h * 0.5, waterY, unit, 0.5, 0);
  drawBird(ctx, w * 0.5, h * 0.46, 0.6 * unit, 1.1, -0.08, 0);
}
