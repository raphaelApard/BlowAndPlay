import { drawBubble, drawCloud, drawGarden, drawKid, drawSky, drawSun } from './draw';
import { CanvasThumbnail } from '../_shared/CanvasThumbnail';
import styles from './bulles.module.css';

/** Vignette de la carte « Jeux » : l'enfant souffle une grosse bulle. */
export function Thumbnail() {
  return <CanvasThumbnail className={styles.thumb} paint={paint} />;
}

/** Drawing of the thumbnail (see `CanvasThumbnail` for the scaffolding). */
function paint(ctx: CanvasRenderingContext2D, w: number, h: number, unit: number) {
  const groundY = h * 0.84;

  drawSky(ctx, w, h);
  drawSun(ctx, w * 0.85, h * 0.14, 22 * unit);
  drawCloud(ctx, w * 0.25, h * 0.14, unit * 0.45);
  drawGarden(ctx, w, h, groundY, unit, 0);
  const ring = drawKid(ctx, w * 0.22, groundY + 4 * unit, unit * 0.62, 0.8, 0);
  drawBubble(ctx, ring.x + 46 * unit, ring.y - 4 * unit, 44 * unit, 0.1, 0, true);
  drawBubble(ctx, w * 0.78, h * 0.3, 16 * unit, 0, 0);
  drawBubble(ctx, w * 0.62, h * 0.18, 10 * unit, 0, 0);
}
