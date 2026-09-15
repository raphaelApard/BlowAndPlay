import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { play } from '../audio/sfx';
import { GameThumbnail, LevelSquares, Mascot, PaperButton, ParentsButton, PlayIcon, Sky, TopBar } from '../components/ui';
import { GAMES } from '../games/registry';
import type { LevelBase, Stars } from '../games/types';
import { useT } from '../i18n';
import { selectProgress, useAppState } from '../store/store';
import { useCurrentProfile } from './useCurrentProfile';
import styles from './screens.module.css';

interface Completed {
  gameId: string;
  levelId: string;
  stars: Stars;
}

/** Time left for the chimes (up to 3 stars) before the navigation state is cleared. */
const CELEBRATION_MS = 1400;

/** Free selection: pick a game, we launch the first level not yet passed. */
export function GamesScreen() {
  const navigate = useNavigate();
  const profile = useCurrentProfile();
  const progress = selectProgress(useAppState(), profile.id);
  const { t, tr } = useT();

  // A game has just been finished (navigation state set by GameShell): the
  // child lands back here and the stars chime on the spot — there is no
  // reward screen any more.
  const location = useLocation();
  const completed = (location.state as { completed?: Completed } | null)?.completed;
  // The celebration is fired once per arrival. Clearing the navigation state
  // immediately would re-render with no `completed`, re-run the effect and
  // tear down its own timers (silent chimes): the guard keeps the first run in
  // charge, and the state is only cleared once the chimes are over.
  const celebratedRef = useRef(false);

  useEffect(() => {
    if (!completed || celebratedRef.current) return;
    celebratedRef.current = true;
    // One chime per star earned, staggered.
    const dings = Array.from({ length: completed.stars }, (_, i) => window.setTimeout(() => play('star'), 200 + i * 300));
    const end = window.setTimeout(() => {
      // Cleared only now: a refresh must not replay the celebration.
      navigate('.', { replace: true, state: null });
    }, CELEBRATION_MS);
    return () => {
      dings.forEach((id) => window.clearTimeout(id));
      window.clearTimeout(end);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed?.gameId, completed?.levelId, completed?.stars]);

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
