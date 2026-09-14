import { useBreathState } from '../../breath/BreathProvider';
import { cx } from '../ui';
import styles from './game.module.css';

/** Bande de papier qui se remplit avec le souffle. Même métaphore partout. */
export function BreathStrip({ progress }: { progress?: number }) {
  const { intensity, isBlowing } = useBreathState();
  return (
    <div className={styles.strip} role="meter" aria-valuenow={Math.round(intensity * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx(styles.stripFill, isBlowing && styles.stripBlowing)} style={{ transform: `scaleX(${intensity})` }} />
      {progress !== undefined && <div className={styles.stripProgress} style={{ width: '100%', transform: `scaleX(${progress})` }} />}
    </div>
  );
}
