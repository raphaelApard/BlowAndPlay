import { PETALS, drawCloud, drawFlower, drawHills, drawSky, drawSun, makeCloudShape } from './draw';
import { CanvasThumbnail } from '../_shared/CanvasThumbnail';
import styles from './nuages.module.css';

/** Games card thumbnail: a sulky cloud pushed away from the sun. */
export function Thumbnail() {
  return <CanvasThumbnail className={styles.thumb} paint={paint} />;
}

/** Drawing of the thumbnail (see `CanvasThumbnail` for the scaffolding). */
function paint(ctx: CanvasRenderingContext2D, w: number, h: number, unit: number) {
  drawSky(ctx, w, h, 0.7);
  drawSun(ctx, w * 0.38, h * 0.36, 34 * unit, 0.7, 0.2, 0);
  drawHills(ctx, w, h, unit);
  drawFlower(ctx, w * 0.16, h * 0.92, 20 * unit, PETALS[0], 1, 0);
  drawFlower(ctx, w * 0.6, h * 0.95, 17 * unit, PETALS[2], 1, 0);
  drawCloud(ctx, makeCloudShape(3, 2), w * 0.72, h * 0.44, 42 * unit, 0.3, 1, 0);
}
