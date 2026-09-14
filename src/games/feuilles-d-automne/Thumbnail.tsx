import { FOLIAGE, LEAF_COLORS, buildRoute, drawGround, drawHedgehog, drawHome, drawLeaf, drawPath, drawSky, drawTree, routeAt, seeded } from './draw';
import { CanvasThumbnail } from '../_shared/CanvasThumbnail';
import styles from './feuilles.module.css';

/** Games card thumbnail: the hedgehog in front of a pile of leaves, the burrow at the end. */
export function Thumbnail() {
  return <CanvasThumbnail className={styles.thumb} paint={paint} />;
}

/** Drawing of the thumbnail (see `CanvasThumbnail` for the scaffolding). */
function paint(ctx: CanvasRenderingContext2D, w: number, h: number, unit: number) {
  drawSky(ctx, w, h);
  drawGround(ctx, w, h, h * 0.42);
  drawTree(ctx, w * 0.14, h * 0.5, unit * 0.5, FOLIAGE[1]);
  const route = buildRoute([
    { x: w * 0.08, y: h * 0.86 },
    { x: w * 0.42, y: h * 0.74 },
    { x: w * 0.8, y: h * 0.8 },
  ]);
  drawPath(ctx, route, 22 * unit);
  drawHome(ctx, w * 0.82, h * 0.78, unit * 0.5, 0, 0);
  const rand = seeded(3);
  const pile = routeAt(route, route.anchorDist[1]);
  for (let i = 0; i < 9; i++) {
    drawLeaf(ctx, pile.x + (rand() - 0.5) * 40 * unit, pile.y - rand() * 16 * unit, 8 * unit, rand() * 6, LEAF_COLORS[i % LEAF_COLORS.length]);
  }
  const hh = routeAt(route, route.anchorDist[1] - 50 * unit);
  drawHedgehog(ctx, hh.x, hh.y + 4 * unit, unit * 0.62, 0, 0, 0);
}
