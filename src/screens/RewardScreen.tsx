import { useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { play } from '../audio/sfx';
import { ArrowIcon, PaperButton, ParentsButton, ReplayIcon, Sky, cx } from '../components/ui';
import { useT } from '../i18n';
import { MascotFigure } from '../mascots/MascotFigure';
import { selectCurrentProfile, useAppState } from '../store/store';
import type { Stars } from '../games/types';
import styles from './screens.module.css';

interface RewardState {
  gameId: string;
  levelId: string;
  stars: Stars;
}

/**
 * Arrival confetti. The delays are positive and short: the child arrives on
 * the screen and the pieces fall from the top. Negative delays would start
 * them mid-flight, already scattered down the screen — the celebration would
 * be half over before it was seen.
 */
const CONFETTI = [
  { left: '9%', color: '#ff6b6b', delay: '0s', round: false },
  { left: '22%', color: '#ffd93d', delay: '0.35s', round: true },
  { left: '37%', color: '#6bcb77', delay: '0.15s', round: false },
  { left: '62%', color: '#ff6b6b', delay: '0.5s', round: true },
  { left: '77%', color: '#ffd93d', delay: '0.25s', round: false },
  { left: '91%', color: '#6bcb77', delay: '0.45s', round: true },
];

/**
 * Reward screen for the Games mode (free selection). In adventure mode, the
 * game goes straight back to the map, which animates the move to the next step.
 */
export function RewardScreen() {
  const navigate = useNavigate();
  const profile = selectCurrentProfile(useAppState());
  const { t } = useT();
  const state = useLocation().state as RewardState | null;
  const stars = state?.stars ?? 0;

  // One chime per star earned, staggered, like the animation.
  useEffect(() => {
    const timers = Array.from({ length: stars }, (_, i) => window.setTimeout(() => play('star'), 300 + i * 350));
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [stars]);

  if (!state) return <Navigate to="/games" replace />;

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
        {/* Left: leave the reward screen for the games list. Right: play the
            same level again — from the Games tab the child picks what they
            do next, the screen no longer chains on to the next level. */}
        <PaperButton icon onClick={() => navigate('/games', { replace: true })} aria-label={t('common.back')}>
          <ArrowIcon size={80} left />
        </PaperButton>
        <PaperButton
          icon
          tone="leaf"
          onClick={() => navigate(`/play/${state.gameId}/${state.levelId}?mode=free`, { replace: true })}
          aria-label={t('reward.replay')}
        >
          <ReplayIcon size={72} />
        </PaperButton>
      </div>
      <ParentsButton className={styles.parentsFlat} />
    </Sky>
  );
}
