import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { BreathEngine } from './BreathEngine';
import { KeyboardBreathSource } from './KeyboardBreathSource';
import { MicBreathSource } from './MicBreathSource';
import type { BreathSourceKind, BreathState } from './types';

export type BreathStatus = 'idle' | 'starting' | 'running' | 'error';

interface BreathContextValue {
  engine: BreathEngine;
  sourceKind: BreathSourceKind;
  /** Micro choisi (null = défaut système). */
  micDeviceId: string | null;
  status: BreathStatus;
  error: string | null;
  /** Démarre la source courante (demande la permission micro si besoin). */
  start(): Promise<boolean>;
  stop(): void;
  /** Change de source (micro ↔ clavier). Redémarre si le moteur tournait. */
  setSourceKind(kind: BreathSourceKind): Promise<void>;
  /** Change de micro. Invalide le calibrage. */
  setMicDeviceId(deviceId: string | null): Promise<void>;
}

const BreathContext = createContext<BreathContextValue | null>(null);

function createSource(kind: BreathSourceKind, micDeviceId: string | null) {
  return kind === 'mic' ? new MicBreathSource(micDeviceId) : new KeyboardBreathSource();
}

interface Props {
  initialSourceKind: BreathSourceKind;
  initialMicDeviceId?: string | null;
  onSourceKindChange?(kind: BreathSourceKind): void;
  onMicDeviceIdChange?(deviceId: string | null): void;
  children: ReactNode;
}

export function BreathProvider({
  initialSourceKind,
  initialMicDeviceId = null,
  onSourceKindChange,
  onMicDeviceIdChange,
  children,
}: Props) {
  const [engine] = useState(() => {
    const e = new BreathEngine();
    void e.setSource(createSource(initialSourceKind, initialMicDeviceId));
    return e;
  });

  const [sourceKind, setKind] = useState<BreathSourceKind>(initialSourceKind);
  const [micDeviceId, setMicId] = useState<string | null>(initialMicDeviceId);
  const [status, setStatus] = useState<BreathStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    if (engine.isRunning()) return true;
    setStatus('starting');
    setError(null);
    try {
      await engine.start();
      setStatus('running');
      return true;
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  }, [engine]);

  const stop = useCallback(() => {
    engine.stop();
    setStatus('idle');
  }, [engine]);

  const swapSource = useCallback(
    async (kind: BreathSourceKind, deviceId: string | null) => {
      setError(null);
      try {
        await engine.setSource(createSource(kind, deviceId));
        setStatus(engine.isRunning() ? 'running' : 'idle');
      } catch (e) {
        setStatus('error');
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [engine],
  );

  const setSourceKind = useCallback(
    async (kind: BreathSourceKind) => {
      if (kind === sourceKind) return;
      setKind(kind);
      onSourceKindChange?.(kind);
      await swapSource(kind, micDeviceId);
    },
    [sourceKind, micDeviceId, onSourceKindChange, swapSource],
  );

  const setMicDeviceId = useCallback(
    async (deviceId: string | null) => {
      if (deviceId === micDeviceId) return;
      setMicId(deviceId);
      onMicDeviceIdChange?.(deviceId);
      if (sourceKind === 'mic') await swapSource('mic', deviceId);
    },
    [sourceKind, micDeviceId, onMicDeviceIdChange, swapSource],
  );

  // Coupe le micro quand l'onglet est caché (économie + vie privée).
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && engine.isRunning()) {
        engine.stop();
        setStatus('idle');
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [engine]);

  const value = useMemo<BreathContextValue>(
    () => ({ engine, sourceKind, micDeviceId, status, error, start, stop, setSourceKind, setMicDeviceId }),
    [engine, sourceKind, micDeviceId, status, error, start, stop, setSourceKind, setMicDeviceId],
  );

  return <BreathContext.Provider value={value}>{children}</BreathContext.Provider>;
}

export function useBreath(): BreathContextValue {
  const ctx = useContext(BreathContext);
  if (!ctx) throw new Error('useBreath doit être utilisé sous <BreathProvider>');
  return ctx;
}

/** État du souffle re-rendu à chaque frame (HUD, jauges). */
export function useBreathState(): BreathState {
  const { engine } = useBreath();
  return useSyncExternalStore(
    (cb) => engine.subscribe(cb),
    () => engine.getState(),
    () => engine.getState(),
  );
}
