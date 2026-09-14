import { useNavigate } from 'react-router-dom';
import { GameThumbnail, LevelSquares, Mascot, PaperButton, ParentsButton, PlayIcon, Sky, TopBar } from '../components/ui';
import { GAMES } from '../games/registry';
import type { LevelBase } from '../games/types';
import { useT } from '../i18n';
import { selectProgress, useAppState } from '../store/store';
import { useCurrentProfile } from './useCurrentProfile';
import styles from './screens.module.css';

/** Sélection libre : un jeu, on lance le premier niveau non réussi. */
export function GamesScreen() {
  const navigate = useNavigate();
  const profile = useCurrentProfile();
  const progress = selectProgress(useAppState(), profile.id);
  const { t, tr } = useT();

  return (
    <Sky horizon={0.66} clouds={false}>
      <Mascot />
      <div className={styles.gamesRow}>
        <div className={styles.gamesInner}>
        {GAMES.map((game) => {
          const levels = game.levels as readonly LevelBase[];
          const done = levels.map((l) => (progress[game.id]?.[l.id]?.stars ?? 0) > 0);
          const nextLevel = levels[done.indexOf(false)] ?? levels[0];
          return (
            <div key={game.id} className={styles.gameCard}>
              <div className={styles.gameVisual}>
                <GameThumbnail game={game} />
              </div>
              <div className={styles.gameMeta}>
                <div className={styles.gameTitle}>{tr(game.title)}</div>
                <div className={styles.gameFoot}>
                  <LevelSquares done={done} total={levels.length} />
                  <PaperButton
                    icon
                    small
                    tone="leaf"
                    onClick={() => navigate(`/play/${game.id}/${nextLevel.id}?mode=free`)}
                    aria-label={t('games.playGame', { title: tr(game.title) })}
                  >
                    <PlayIcon size={70} />
                  </PaperButton>
                </div>
              </div>
            </div>
          );
        })}
        </div>
      </div>
      <TopBar name={profile.name} avatar={profile.avatar} />
      <ParentsButton />
    </Sky>
  );
}
