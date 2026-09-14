import { buildRoute, drawBoat, drawIsland, drawRouteDashes, drawSea, drawWaves, makeIslandStyles, makeWaves, routeAt } from './draw';
import { CanvasThumbnail } from '../_shared/CanvasThumbnail';
import styles from './pirate.module.css';

/** Vignette de la carte « Jeux » : mini-carte, trois îles, bateau en route. */
export function Thumbnail() {
  return <CanvasThumbnail className={styles.thumb} paint={paint} />;
}

/** Dessin de la vignette (voir `CanvasThumbnail` pour l'échafaudage). */
function paint(ctx: CanvasRenderingContext2D, w: number, h: number, unit: number) {
  drawSea(ctx, w, h);
  drawWaves(ctx, makeWaves(8, 7), w, h, 0, unit * 0.8);
  const anchors = [
    { x: 0.14, y: 0.8 },
    { x: 0.3, y: 0.3 },
    { x: 0.74, y: 0.74 },
    { x: 0.82, y: 0.24 },
  ].map((p) => ({ x: p.x * w, y: p.y * h }));
  const route = buildRoute(anchors);
  const isl = makeIslandStyles(3, 3);
  for (let i = 0; i < 3; i++) drawRouteDashes(ctx, route, i, i + 1, unit, '#fff', 0.6);
  for (let i = 1; i < anchors.length; i++) {
    drawIsland(ctx, anchors[i].x, anchors[i].y, isl[i - 1], unit * 0.72, i === 1 ? 'done' : i === 2 ? 'next' : 'todo', 0, i === 3);
  }
  const b = routeAt(route, route.anchorDist[1] + (route.anchorDist[2] - route.anchorDist[1]) * 0.45);
  drawBoat(ctx, b.x, b.y, unit * 0.95, b.dx, b.dy, 0.8, 0);
}
