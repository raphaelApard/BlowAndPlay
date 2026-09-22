import { useEffect, useRef, type Ref } from 'react';
import { useBreath } from '../../breath/useBreath';
import type { BreathState } from '../../breath/types';
import styles from './game.module.css';

/**
 * Paper strip that fills with the breath. The same metaphor everywhere.
 *
 * Written straight to the DOM from the engine subscription: a React state
 * would re-render on every frame, for the whole length of every game.
 * `progressRef` receives the level progress bar, which GameShell writes the
 * same way; it stays hidden until the game reports some progress.
 */
export function BreathStrip({ progressRef }: { progressRef?: Ref<HTMLDivElement> }) {
  const { engine } = useBreath();
  const meterRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let shownPct = -1;
    let shownBlowing: boolean | null = null;
    const apply = ({ intensity, isBlowing }: BreathState) => {
      const meter = meterRef.current;
      const fill = fillRef.current;
      if (!meter || !fill) return;
      fill.style.transform = `scaleX(${intensity})`;
      if (isBlowing !== shownBlowing) {
        fill.classList.toggle(styles.stripBlowing, isBlowing);
        shownBlowing = isBlowing;
      }
      const pct = Math.round(intensity * 100);
      if (pct !== shownPct) {
        meter.setAttribute('aria-valuenow', String(pct));
        shownPct = pct;
      }
    };
    apply(engine.getState());
    const off = engine.subscribe(apply);
    return () => {
      off();
    };
  }, [engine]);

  return (
    <div ref={meterRef} className={styles.strip} role="meter" aria-valuenow={0} aria-valuemin={0} aria-valuemax={100}>
      <div ref={fillRef} className={styles.stripFill} style={{ transform: 'scaleX(0)' }} />
      {progressRef && <div ref={progressRef} className={styles.stripProgress} style={{ width: '100%' }} hidden />}
    </div>
  );
}
