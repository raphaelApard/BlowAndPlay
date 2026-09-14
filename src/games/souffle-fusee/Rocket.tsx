import type { Ref } from 'react';
import styles from './fusee.module.css';

interface Props {
  /** Largeur du corps (px, ou longueur CSS) ; le reste suit. */
  size?: number | string;
  flameRef?: Ref<HTMLDivElement>;
  /** Sans flamme (vignette, atterrissage). */
  flame?: boolean;
  /** Sans balancement. */
  still?: boolean;
}

/** La fusée et Pip, sa pilote, dans le hublot (design « Blast Off »). */
export function Rocket({ size = 64, flameRef, flame = true, still = false }: Props) {
  return (
    <div className={still ? styles.rocket : `${styles.rocket} ${styles.rocketBob}`} style={{ fontSize: size }} aria-hidden>
      <div className={styles.nose} />
      <div className={styles.body}>
        <div className={styles.bodyStripe} />
        <div className={styles.porthole}>
          <div className={styles.pip}>
            <span className={styles.earL} />
            <span className={styles.earR} />
            <span className={styles.face} />
            <span className={styles.eyeL} />
            <span className={styles.eyeR} />
            <span className={styles.mouth} />
          </div>
        </div>
        <div className={styles.finL} />
        <div className={styles.finR} />
      </div>
      {flame && <div ref={flameRef} className={styles.flame} />}
    </div>
  );
}
