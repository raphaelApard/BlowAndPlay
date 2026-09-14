import { useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { play } from '../audio/sfx';
import { getGame } from '../games/registry';
import { ArrowIcon, PaperButton, ParentsButton, PlayIcon, Sky, cx } from '../components/ui';
import { useT } from '../i18n';
import { MascotFigure } from '../mascots/MascotFigure';
import { selectCurrentProfile, useAppState } from '../store/store';
import type { LevelBase, Stars } from '../games/types';
import styles from './screens.module.css';

interface RewardState {
  gameId: string;
  levelId: string;
  stars: Stars;
}

const CONFETTI = [
  { left: '9%', color: '#ff6b6b', delay: '0s', round: false },
  { left: '22%', color: '#ffd93d', delay: '-2s', round: true },
  { left: '37%', color: '#6bcb77', delay: '-1s', round: false },
  { left: '62%', color: '#ff6b6b', delay: '-3s', round: true },
  { left: '77%', color: '#ffd93d', delay: '-0.5s', round: false },
  { left: '91%', color: '#6bcb77', delay: '-2.5s', round: true },
];

/**
 * Écran de récompense du mode « Jeux » (sélection libre). En aventure, le
 * jeu revient directement sur la map, qui anime le passage à l'étape suivante.
 */
export function RewardScreen() {
  const navigate = useNavigate();
  const profile = selectCurrentProfile(useAppState());
  const { t } = useT();
  const state = useLocation().state as RewardState | null;
  const stars = state?.stars ?? 0;

  // Une étoile qui tinte par étoile gagnée, en décalé, comme l'animation.
  useEffect(() => {
    const timers = Array.from({ length: stars }, (_, i) => window.setTimeout(() => play('star'), 300 + i * 350));
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [stars]);

  if (!state) return <Navigate to="/games" replace />;

  const levels = (getGame(state.gameId)?.levels ?? []) as readonly LevelBase[];
  const next = levels[levels.findIndex((l) => l.id === state.levelId) + 1];
  const goNext = () => {
    if (next) navigate(`/play/${state.gameId}/${next.id}?mode=free`, { replace: true });
    else navigate('/games', { replace: true });
  };

  return (
    <Sky horizon={0.66} clouds={false} sun={false}>
      {CONFETTI.map((c, i) => (
        <span
          key={i}
          className={styles.confetti}
          style={{ left: c.left, background: c.color, animationDelay: c.delay, borderRadius: c.round ? '50%' : 3 }}
          aria-hidden
        />
      ))}
      <div className={styles.rewardSlide}>
        <h1 className={styles.bigWord} style={{ margin: 0 }}>
          {t('reward.bravo')}
        </h1>
        <div className={styles.rewardStars} aria-label={t('reward.stars', { n: state.stars })}>
          {[0, 1, 2].map((i) => (
            <div key={i} className={cx(styles.rewardStar, i >= state.stars && styles.rewardStarOff)}>
              ★
            </div>
          ))}
        </div>
        <MascotFigure id={profile?.mascot} size={170} mode="bravo" style={{ justifySelf: 'center' }} />
      </div>
      <div className={styles.rewardActions}>
        <PaperButton icon onClick={() => navigate(`/play/${state.gameId}/${state.levelId}?mode=free`, { replace: true })} aria-label={t('reward.replay')}>
          <ArrowIcon size={80} left />
        </PaperButton>
        <PaperButton icon tone="leaf" onClick={goNext} aria-label={t('reward.next')}>
          <PlayIcon size={90} />
        </PaperButton>
      </div>
      <ParentsButton className={styles.parentsFlat} />
    </Sky>
  );
}
