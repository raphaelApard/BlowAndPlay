import { useEffect, useRef, useState } from 'react';
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

/** Duration of the celebration (matched to the `gamesFall` animation). */
const CONFETTI_MS = 3600;

/**
 * Confetti spread across the width, with staggered falls. The size varies
 * through `width`/`height` and not through `scale`: a standalone `scale`
 * would override the `transform` animated by the keyframes, and the pieces
 * would stay frozen at the top of the screen.
 */
const CONFETTI = Array.from({ length: 20 }, (_, i) => {
  const size = 0.7 + ((i * 7) % 10) / 14;
  const round = i % 3 === 0;
  return {
    left: `${3 + i * 4.9}%`,
    color: ['#ff6b6b', '#ffd93d', '#6bcb77', '#5ec2f0'][i % 4],
    delay: `${(i % 6) * 0.14}s`,
    round,
    width: Math.round((round ? 16 : 18) * size),
    height: Math.round((round ? 16 : 26) * size),
  };
});

/** Free selection: pick a game, we launch the first level not yet passed. */
export function GamesScreen() {
  const navigate = useNavigate();
  const profile = useCurrentProfile();
  const progress = selectProgress(useAppState(), profile.id);
  const { t, tr } = useT();

  // A game has just been finished (navigation state set by GameShell): the
  // child lands back here and the celebration happens on the spot — there is
  // no reward screen any more.
  const location = useLocation();
  const completed = (location.state as { completed?: Completed } | null)?.completed;
  const [party, setParty] = useState(false);
  // The celebration is fired once per arrival. Clearing the navigation state
  // immediately would re-render with no `completed`, re-run the effect and
  // tear down its own timers (silent chimes, confetti left running): the guard
  // keeps the first run in charge, and the state is only cleared at the end.
  const celebratedRef = useRef(false);

  useEffect(() => {
    if (!completed || celebratedRef.current) return;
    celebratedRef.current = true;
    setParty(true);
    // One chime per star earned, staggered, then the confetti finishes falling.
    const dings = Array.from({ length: completed.stars }, (_, i) => window.setTimeout(() => play('star'), 200 + i * 300));
    const end = window.setTimeout(() => {
      setParty(false);
      // Cleared only now: a refresh must not replay the celebration.
      navigate('.', { replace: true, state: null });
    }, CONFETTI_MS);
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
      {party && (
        <div aria-hidden>
          {CONFETTI.map((c, i) => (
            <span
              key={i}
              className={styles.confetti}
              style={{
                left: c.left,
                background: c.color,
                animationDelay: c.delay,
                borderRadius: c.round ? '50%' : 3,
                width: c.width,
                height: c.height,
              }}
            />
          ))}
        </div>
      )}
      <TopBar name={profile.name} avatar={profile.avatar} />
      <ParentsButton />
    </Sky>
  );
}
