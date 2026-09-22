import { CanvasThumbnail } from '../_shared/CanvasThumbnail';
import { drawAim, drawBank, drawFrog, drawPad, drawSky, drawSun, drawWater } from './draw';
import styles from './grenouille.module.css';

/** Vignette de la carte « Jeux » : la grenouille vise le nénuphar en fleur. */
export function Thumbnail() {
  return <CanvasThumbnail className={styles.thumb} paint={paint} />;
}

/** Drawing of the thumbnail (see `CanvasThumbnail` for the scaffolding). */
function paint(ctx: CanvasRenderingContext2D, w: number, h: number, unit: number) {
  const horizon = h * 0.42;
  const padY = h * 0.72;

  drawSky(ctx, w, horizon);
  drawSun(ctx, w * 0.82, h * 0.16, 20 * unit);
  drawBank(ctx, w, horizon, unit);
  drawWater(ctx, w, h, horizon, unit, 0);

  drawPad(ctx, w * 0.26, padY, 34 * unit, 0, 0, false);
  drawPad(ctx, w * 0.74, padY, 34 * unit, 0, 1, true);
  drawAim(ctx, w * 0.26, padY, w * 0.74, unit, 0);
  drawFrog(ctx, w * 0.26, padY, unit * 0.5, 0.35, 0, 0);
}
