import { CanvasThumbnail } from '../_shared/CanvasThumbnail';
import { BODY_COLORS, drawDancer, drawGround, drawSky, drawSun } from './draw';
import styles from './bonhomme.module.css';

/** Vignette de la carte « Jeux » : le bonhomme debout qui salue. */
export function Thumbnail() {
  return <CanvasThumbnail className={styles.thumb} paint={paint} />;
}

/** Drawing of the thumbnail (see `CanvasThumbnail` for the scaffolding). */
function paint(ctx: CanvasRenderingContext2D, w: number, h: number, unit: number) {
  const groundY = h * 0.86;

  drawSky(ctx, w, h);
  drawSun(ctx, w * 0.83, h * 0.16, 20 * unit);
  drawGround(ctx, w, h, groundY, unit);
  drawDancer(ctx, w * 0.28, groundY, unit * 0.42, BODY_COLORS[2], 0.55, 300);
  drawDancer(ctx, w * 0.6, groundY, unit * 0.62, BODY_COLORS[0], 1, 0);
}
