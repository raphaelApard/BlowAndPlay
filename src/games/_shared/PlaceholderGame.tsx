import { useEffect, useRef, useState } from 'react';
import { useT } from '../../i18n';
import type { GameProps, Stars } from '../types';
import styles from './PlaceholderGame.module.css';

/**
 * Stand-in game: takes up the whole screen (the shell only adds the quit
 * quitter et le curseur de souffle). Compte les souffles et permet de
 * finish with 1 to 3 stars in order to test the flow.
 *
 * To be replaced by the real component in `<game>/index.ts`.
 */
export function PlaceholderGame({ level, breath, paused, onProgress, onComplete }: GameProps) {
  const [blows, setBlows] = useState(0);
  const { t } = useT();
  const doneRef = useRef(false);

  useEffect(() => {
    if (paused) return;
    return breath.on((e) => {
      if (e.type === 'blowEnd') setBlows((n) => Math.min(3, n + 1));
    });
  }, [breath, paused]);

  useEffect(() => {
    onProgress?.(blows / 3);
  }, [blows, onProgress]);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onComplete({ stars: Math.max(1, blows) as Stars });
  };

  return (
    <div className={styles.root}>
      <div className={styles.label}>
        {t('games.artwork')}
        <br />({t('games.level', { id: level.id })})
      </div>
      <div className={styles.stars} aria-label={t('games.blows', { n: blows })}>
        {[0, 1, 2].map((i) => (
          <span key={i} className={i < blows ? styles.starOn : styles.starOff}>
            ★
          </span>
        ))}
      </div>
      <button type="button" className={styles.finish} onClick={finish} disabled={blows === 0} aria-label={t('games.finish')}>
        <span className={styles.check} />
      </button>
    </div>
  );
}
