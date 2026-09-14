import { PETALS, drawCloud, drawFlower, drawHills, drawSky, drawSun, makeCloudShape } from './draw';
import { CanvasThumbnail } from '../_shared/CanvasThumbnail';
import styles from './nuages.module.css';

/** Vignette de la carte « Jeux » : un nuage boudeur poussé loin du soleil. */
export function Thumbnail() {
  return <CanvasThumbnail className={styles.thumb} paint={paint} />;
}

/** Dessin de la vignette (voir `CanvasThumbnail` pour l'échafaudage). */
function paint(ctx: CanvasRenderingContext2D, w: number, h: number, unit: number) {
  drawSky(ctx, w, h, 0.7);
  drawSun(ctx, w * 0.38, h * 0.36, 34 * unit, 0.7, 0.2, 0);
  drawHills(ctx, w, h, unit);
  drawFlower(ctx, w * 0.2, h * 0.88, 11 * unit, PETALS[0], 1, 0);
  drawFlower(ctx, w * 0.62, h * 0.9, 10 * unit, PETALS[2], 1, 0);
  drawCloud(ctx, makeCloudShape(3, 2), w * 0.72, h * 0.44, 42 * unit, 0.3, 1, 0);
}
