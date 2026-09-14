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

/** Durée maximale d'affichage de la consigne si l'enfant ne souffle pas. */
const HINT_MAX_MS = 8000;

interface Props {
  game: AnyGameDefinition;
  level: LevelBase;
  profileId: string;
}

/**
 * Héberge un jeu : mesure la zone, fournit le moteur de souffle, agrège les
 * statistiques de souffle et enregistre le résultat. Le HUD se limite au
 * bouton quitter et au curseur de souffle : tout l'écran est au jeu.
 */
export function GameShell({ game, level, profileId }: Props) {
  const navigate = useNavigate();
  // `?mode=free` : lancé depuis l'onglet Jeux (écran de récompense, retour aux jeux).
  // Sinon : aventure (retour direct à la map, qui anime le passage à l'étape suivante).
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
  // Consigne : la mascotte la montre dans une bulle, puis s'en va au premier souffle (ou après un délai).
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

  // Pas de calibrage → on passe par l'écran de calibrage puis on revient ici.
  useEffect(() => {
    if (!engine.isCalibrated()) {
      navigate(`/calibration?returnTo=${encodeURIComponent(playPath)}`, { replace: true });
    } else if (status !== 'running') {
      void start();
    }
  }, [engine, status, start, navigate, playPath]);

  // Le souffle qui a lancé le jeu depuis la carte est encore en cours : on
  // l'oublie, sinon la fusée décolle toute seule. Il faut un nouveau souffle.
  useEffect(() => {
    engine.resetBlow();
  }, [engine]);

  // Taille de la zone de jeu.
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

  // Pause quand l'onglet est caché.
  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const ready = size.width > 0 && status === 'running';

  // La mascotte part dès que l'enfant souffle, ou au bout de quelques secondes.
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

  // Statistiques de souffle de la partie.
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
      if (free) navigate('/reward', { replace: true, state: completed });
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
