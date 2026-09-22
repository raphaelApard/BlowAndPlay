import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { computeCalibration } from '../breath/BreathEngine';
import { useBreath, useBreathState } from '../breath/useBreath';
import { Candle, PaperButton, ParentsButton, PlayIcon, Sky } from '../components/ui';
import { cx } from '../components/ui/cx';
import { play } from '../audio/sfx';
import { useT } from '../i18n';
import { MascotFigure, type MascotMode } from '../mascots/MascotFigure';
import { actions, getAppState, selectCurrentProfile, useAppState } from '../store/store';
import styles from './screens.module.css';

const SILENCE_MS = 2000;
const BLOW_MS = 3000;

type Phase = 'intro' | 'silence' | 'blow' | 'done';

/** The mascot's attitude at each step. */
const MASCOT_MODE: Record<Phase, MascotMode> = {
  intro: 'hello',
  silence: 'think',
  blow: 'idle',
  done: 'bravo',
};

/**
 * Calibration on every session (~5 s): 2 s of silence for the ambient noise,
 * 3 s of blowing for the maximum. No value is displayed.
 * A single page: both steps stay visible, the current one is brought forward.
 */
export function CalibrationScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // No explicit returnTo (opening a profile from the home screen): go back
  // to whichever section — Adventure or Games — was last visited, Games by
  // default for a child who has never picked one.
  const returnTo = params.get('returnTo') || (getAppState().settings.lastMode === 'map' ? '/map' : '/games');
  const { engine, status, error, start, sourceKind, setSourceKind } = useBreath();
  const [phase, setPhase] = useState<Phase>('intro');
  const [elapsed, setElapsed] = useState(0);
  const { t } = useT();
  const mascot = selectCurrentProfile(useAppState())?.mascot;
  const samplerRef = useRef<ReturnType<typeof engine.sampleRaw> | null>(null);
  const silenceRef = useRef<number[]>([]);

  const begin = async () => {
    const ok = await start();
    if (!ok) return;
    engine.setCalibration(null);
    samplerRef.current = engine.sampleRaw();
    setElapsed(0);
    setPhase('silence');
  };

  // Phase timer.
  useEffect(() => {
    if (phase !== 'silence' && phase !== 'blow') return;
    const duration = phase === 'silence' ? SILENCE_MS : BLOW_MS;
    const startedAt = performance.now();
    let raf = 0;
    const tick = () => {
      const e = performance.now() - startedAt;
      setElapsed(Math.min(1, e / duration));
      if (e < duration) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const samples = samplerRef.current?.stop() ?? [];
      if (phase === 'silence') {
        silenceRef.current = samples;
        samplerRef.current = engine.sampleRaw();
        setElapsed(0);
        setPhase('blow');
        play('pop');
      } else {
        const fallback = engine.getSource()?.defaultCalibration ?? { noiseFloor: 0, peak: 1 };
        engine.setCalibration(computeCalibration(silenceRef.current, samples, fallback));
        setPhase('done');
        play('success');
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, engine]);

  useEffect(() => {
    if (phase !== 'done') return;
    const t = window.setTimeout(() => navigate(returnTo, { replace: true }), 600);
    return () => window.clearTimeout(t);
  }, [phase, navigate, returnTo]);

  const useFinger = async () => {
    actions.setInputSource('keyboard');
    await setSourceKind('keyboard');
    setPhase('intro');
  };

  const stepState = (step: 'silence' | 'blow'): StepState => {
    if (phase === 'intro') return 'todo';
    if (phase === step) return 'active';
    if (phase === 'done' || step === 'silence') return 'done';
    return 'todo';
  };

  // With the finger, "blowing" means keeping the finger pressed down.
  const finger = sourceKind === 'keyboard';
  const explanation = t(
    phase === 'intro'
      ? finger
        ? 'calib.explainIntroFinger'
        : 'calib.explainIntro'
      : phase === 'silence'
        ? 'calib.explainSilence'
        : phase === 'blow'
          ? finger
            ? 'calib.explainBlowFinger'
            : 'calib.explainBlow'
          : 'calib.explainDone',
  );

  return (
    <Sky horizon={0.7} clouds={false}>
      <div className={styles.calib}>
        {status === 'error' ? (
          <div className={styles.problem} data-no-blow>
            <strong>{t('calib.micUnavailable')}</strong>
            <span>{t('calib.micHelp')}</span>
            <span className={styles.muted}>{error}</span>
            <div className={styles.row}>
              <PaperButton tone="leaf" onClick={begin}>
                {t('calib.retry')}
              </PaperButton>
              <PaperButton onClick={useFinger}>{t('calib.useFinger')}</PaperButton>
            </div>
          </div>
        ) : (
          <div className={cx(styles.calibBoard, phase === 'intro' && styles.calibBoardIdle)}>
            <h1 className={styles.calibTitle}>{t('calib.title')}</h1>
            <div className={styles.calibCoach}>
              <MascotFigure id={mascot} size={104} mode={MASCOT_MODE[phase]} className={styles.calibMascot} />
              <p className={styles.calibBubble} aria-live="polite">
                {explanation}
              </p>
            </div>
            <div className={styles.calibSteps}>
              {phase === 'intro' && (
                <div className={styles.calibStartOverlay}>
                  <PaperButton icon tone="leaf" onClick={begin} disabled={status === 'starting'} aria-label={t('calib.start')}>
                    <PlayIcon size={84} />
                  </PaperButton>
                </div>
              )}
              <StepCard n={1} word={t('calib.hush')} state={stepState('silence')}>
                <div className={styles.calibStage}>
                  <div className={styles.hush} />
                </div>
                <div className={styles.calibStrip}>
                  <div
                    className={styles.calibTimer}
                    style={{ transform: `scaleX(${phase === 'silence' ? elapsed : stepState('silence') === 'done' ? 1 : 0})` }}
                  />
                </div>
              </StepCard>
              <StepCard n={2} word={t('calib.blow')} state={stepState('blow')}>
                <BlowStage active={phase === 'blow'} done={phase === 'done'} />
              </StepCard>
            </div>
          </div>
        )}
      </div>
      <ParentsButton className={styles.parentsFlat} />
      {sourceKind === 'keyboard' && phase === 'intro' && (
        <PaperButton
          tone="ghost"
          style={{ position: 'absolute', right: 'var(--edge)', bottom: 'calc(var(--edge) + var(--safe-bottom))' }}
          onClick={async () => {
            actions.setInputSource('mic');
            await setSourceKind('mic');
          }}
        >
          {t('calib.useMic')}
        </PaperButton>
      )}
    </Sky>
  );
}

type StepState = 'todo' | 'active' | 'done';

const STEP_CLASS: Record<StepState, string | undefined> = {
  todo: undefined,
  active: styles.calibStepActive,
  done: styles.calibStepDone,
};

/** One calibration step: number, keyword, scene and gauge. Stays displayed whatever the state. */
function StepCard({ n, word, state, children }: { n: number; word: string; state: StepState; children: ReactNode }) {
  return (
    <section className={cx(styles.calibStep, STEP_CLASS[state])} aria-current={state === 'active' ? 'step' : undefined}>
      <header className={styles.calibStepHead}>
        <span className={styles.calibStepNum}>{state === 'done' ? '✓' : n}</span>
        <span className={styles.calibStepWord}>{word}</span>
      </header>
      {children}
    </section>
  );
}

/** Blow scene: the candle flame weakens with the raw level relative to the source's default. */
function BlowStage({ active, done }: { active: boolean; done: boolean }) {
  const { raw } = useBreathState();
  const { engine } = useBreath();
  const { noiseFloor, peak } = engine.getCalibration();
  const live = Math.min(1, Math.max(0, (raw - noiseFloor) / Math.max(peak - noiseFloor, 1e-4)));
  const level = active ? live : done ? 1 : 0;

  return (
    <>
      <div className={styles.calibStage}>
        <Candle className={styles.calibCandle} power={level} lit={!done} />
      </div>
      <div className={styles.calibStrip}>
        <div className={styles.calibFill} style={{ transform: `scaleX(${level})` }} />
      </div>
    </>
  );
}
