import { Rocket } from './Rocket';
import styles from './fusee.module.css';

/** Thumbnail stars: [left %, top %, size in cqmin]. */
const STARS = [
  [8, 10, 1.6],
  [22, 26, 1.1],
  [36, 7, 1.4],
  [14, 44, 1],
  [52, 18, 1],
  [64, 40, 1.3],
  [88, 52, 1],
  [30, 50, 0.9],
] as const;

/** Smoke: [left %, bottom %, diameter in cqmin], from the flame towards the clouds. */
const SMOKE = [
  [35, 29, 7],
  [30, 21, 11],
  [23, 13, 16],
  [14, 5, 22],
] as const;

/**
 * Games card thumbnail: the rocket emerges from the clouds, flame lit, and
 * speeds towards the Moon in a sky turning to night.
 */
export function Thumbnail() {
  return (
    <div className={styles.thumb} aria-hidden>
      {STARS.map(([left, top, size], i) => (
        <span key={i} className={styles.thumbStar} style={{ left: `${left}%`, top: `${top}%`, width: `${size}cqmin`, height: `${size}cqmin` }} />
      ))}
      <div className={styles.thumbMoon}>
        <span className={styles.crater} style={{ left: '22%', top: '46%', width: '24%', height: '24%' }} />
        <span className={styles.crater} style={{ left: '56%', top: '62%', width: '14%', height: '14%' }} />
        <span className={styles.crater} style={{ left: '48%', top: '30%', width: '11%', height: '11%' }} />
      </div>
      {SMOKE.map(([left, bottom, size], i) => (
        <span key={i} className={styles.thumbSmoke} style={{ left: `${left}%`, bottom: `${bottom}%`, width: `${size}cqmin`, height: `${size}cqmin` }} />
      ))}
      <div className={styles.thumbRocket}>
        <Rocket size="17cqmin" still />
      </div>
      <div className={styles.thumbCloudsBack}>
        <span style={{ left: '8%', width: '34cqmin', height: '34cqmin' }} />
        <span style={{ left: '56%', width: '38cqmin', height: '38cqmin' }} />
        <span style={{ left: '86%', width: '30cqmin', height: '30cqmin' }} />
      </div>
      <div className={styles.thumbClouds}>
        <span style={{ left: '-8%', width: '36cqmin', height: '36cqmin' }} />
        <span style={{ left: '30%', width: '28cqmin', height: '28cqmin' }} />
        <span style={{ left: '62%', width: '32cqmin', height: '32cqmin' }} />
        <span style={{ left: '88%', width: '26cqmin', height: '26cqmin' }} />
      </div>
    </div>
  );
}
