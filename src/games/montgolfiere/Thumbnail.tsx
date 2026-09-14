import { HILL_FAR, drawBalloon, drawCloud, drawGround, drawHills, drawObstacle, drawSky } from './draw';
import { CanvasThumbnail } from '../_shared/CanvasThumbnail';
import styles from './montgolfiere.module.css';

/** Vignette de la carte « Jeux » : le ballon survole un arbre et une maison. */
export function Thumbnail() {
  return <CanvasThumbnail className={styles.thumb} paint={paint} />;
}

/** Drawing of the thumbnail (see `CanvasThumbnail` for the scaffolding). */
function paint(ctx: CanvasRenderingContext2D, w: number, h: number, unit: number) {
  const groundY = h * 0.86;

  drawSky(ctx, w, h);
  drawCloud(ctx, w * 0.2, h * 0.16, unit * 0.5);
  drawCloud(ctx, w * 0.82, h * 0.3, unit * 0.4);
  drawHills(ctx, w, groundY, 0, unit, HILL_FAR, 90, 260);
  drawGround(ctx, w, h, groundY, 0, unit);
  drawObstacle(ctx, 'tree', w * 0.3, groundY, 70 * unit, 120 * unit, 0);
  drawObstacle(ctx, 'house', w * 0.78, groundY, 80 * unit, 100 * unit, 0);
  drawBalloon(ctx, w * 0.52, h * 0.34, 34 * unit, 0.6, 0.05, 0);
}
