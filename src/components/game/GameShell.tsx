import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useBreath } from '../../breath/BreathProvider';
import type { BreathSessionStats } from '../../breath/types';
import { resolveSettings, type AnyGameDefinition, type GameResult, type LevelBase } from '../../games/types';
import { actions, useAppState, difficultyToUnit } from '../../store/store';
import { useT } from '../../i18n';
import { MascotFigure } from '../../mascots/MascotFigure';
import { selectCurrentProfile } from '../../store/store';
import { CrossIcon, PaperButton, ParentsButton, cx } from '../ui';
import { BreathStrip } from './BreathStrip';
import styles from './game.module.css';

/** Maximum time the instruction is shown if the child does not blow. */
const HINT_MAX_MS = 8000;

interface Props {
  game: AnyGameDefinition;
  level: LevelBase;
  profileId: string;
}

/**
 * Hosts a game: measures the area, provides the breath engine, aggregates the
 * breath statistics and records the result. The HUD is limited to the quit
 * button and the breath strip: the whole screen belongs to the game.
 */
export function GameShell({ game, level, profileId }: Props) {
  const navigate = useNavigate();
  // `?mode=free`: launched from the Games tab (back to the games, which
  // celebrates there). Otherwise: adventure (back to the map, which animates
  // the move to the next step).
  const [search] = useSearchParams();
  const free = search.get('mode') === 'free';
  const playPath = `/play/${game.id}/${level.id}${free ? '?mode=free' : ''}`;
  const backPath = free ? '/games' : '/map';
  const { engine, status, start } = useBreath();
  const { t, tr } = useT();
  const appState = useAppState();
  const mascot = selectCurrentProfile(appState)?.mascot;
  const difficulty = difficultyToUnit(appState.settings.difficulty);
  const storedSettings = appState.gameSettings[game.id];
  const settings = useMemo(() => resolveSettings(game.settings, storedSettings), [game.settings, storedSettings]);
  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [progress, setProgress] = useState<number | undefined>(undefined);
  const [paused, setPaused] = useState(document.hidden);
  // Instruction: the mascot shows it in a bubble, then leaves on the first blow (or after a delay).
  const [hint, setHint] = useState<'shown' | 'leaving' | 'gone'>('shown');
  const statsRef = useRef<BreathSessionStats & { intensitySum: number; samples: number }>({
    blows: 0,
    totalBlowMs: 0,
    longestBlowMs: 0,
    meanIntensity: 0,
    intensitySum: 0,
    samples: 0,
  });
  const completedRef = useRef(false);

  // No calibration → we go through the calibration screen, then come back here.
  useEffect(() => {
    if (!engine.isCalibrated()) {
      navigate(`/calibration?returnTo=${encodeURIComponent(playPath)}`, { replace: true });
    } else if (status !== 'running') {
      void start();
    }
  }, [engine, status, start, navigate, playPath]);

  // The blow that launched the game from the map is still in progress: we
  // forget it, otherwise the rocket takes off by itself. A new blow is needed.
  useEffect(() => {
    engine.resetBlow();
  }, [engine]);

  // Size of the play area.
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.round(width), height: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Pause when the tab is hidden.
  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const ready = size.width > 0 && status === 'running';

  // The mascot leaves as soon as the child blows, or after a few seconds.
  useEffect(() => {
    if (!ready || hint !== 'shown') return;
    const leave = () => setHint('leaving');
    const off = engine.on((e) => {
      if (e.type === 'blowStart') leave();
    });
    const timer = window.setTimeout(leave, HINT_MAX_MS);
    return () => {
      off();
      window.clearTimeout(timer);
    };
  }, [ready, hint, engine]);

  // Breath statistics for the game.
  useEffect(() => {
    const offEvents = engine.on((e) => {
      if (e.type !== 'blowEnd') return;
      const s = statsRef.current;
      s.blows++;
      s.totalBlowMs += e.blow.durationMs;
      s.longestBlowMs = Math.max(s.longestBlowMs, e.blow.durationMs);
    });
    const offState = engine.subscribe((st) => {
      if (!st.isBlowing) return;
      const s = statsRef.current;
      s.intensitySum += st.intensity;
      s.samples++;
    });
    return () => {
      offEvents();
      offState();
    };
  }, [engine]);

  const handleComplete = useCallback(
    (result: GameResult) => {
      if (completedRef.current) return;
      completedRef.current = true;
      const { intensitySum, samples, ...rest } = statsRef.current;
      const stats: BreathSessionStats = { ...rest, meanIntensity: samples ? intensitySum / samples : 0 };
      actions.recordResult(profileId, game.id, level.id, result, stats);
      const completed = { gameId: game.id, levelId: level.id, stars: result.stars };
      // Both modes go back where the child came from, carrying what they have
      // just finished: the games list celebrates on the spot, the map animates
      // the move to the next step.
      if (free) navigate('/games', { replace: true, state: { completed } });
      else navigate('/map', { replace: true, state: { completed } });
    },
    [profileId, game.id, level.id, navigate, free],
  );

  const Game = game.Game;

  return (
    <div className={styles.shell}>
      <div ref={stageRef} className={styles.stage}>
        {ready && (
          <Game
            key={`${game.id}:${level.id}`}
            level={level}
            settings={settings}
            breath={engine}
            width={size.width}
            height={size.height}
            paused={paused}
            difficulty={difficulty}
            onProgress={setProgress}
            onComplete={handleComplete}
          />
        )}
      </div>

      <div className={styles.hud}>
        <PaperButton icon small className={styles.exit} onClick={() => navigate(backPath)} aria-label={t('common.quit')}>
          <CrossIcon size={40} />
        </PaperButton>
        <BreathStrip progress={progress} />
        <ParentsButton className={styles.parents} />
        {/* Dev shortcut: finishes the level without blowing, to reach the map,
            the games list or the next level quickly. `import.meta.env.DEV`
            is replaced by `false` at build time, so this block is removed from
            the production bundle entirely. */}
        {import.meta.env.DEV && (
          <PaperButton small tone="ghost" className={styles.devFinish} onClick={() => handleComplete({ stars: 3 })}>
            Finish ★★★
          </PaperButton>
        )}
      </div>

      {ready && hint !== 'gone' && (
        <div
          className={cx(styles.hint, hint === 'leaving' && styles.hintOut)}
          onTransitionEnd={() => hint === 'leaving' && setHint('gone')}
          aria-hidden={hint === 'leaving'}
        >
          <span className={styles.bubble}>{tr(game.instruction)}</span>
          <MascotFigure id={mascot} size={130} mode="hello" />
        </div>
      )}
      {paused && <div className={styles.paused}>{t('common.pause')}</div>}
    </div>
  );
}
