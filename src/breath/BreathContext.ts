import { createContext } from 'react';
import type { BreathEngine } from './BreathEngine';
import type { BreathSourceKind } from './types';

export type BreathStatus = 'idle' | 'starting' | 'running' | 'error';

export interface BreathContextValue {
  engine: BreathEngine;
  sourceKind: BreathSourceKind;
  /** Chosen mic (null = system default). */
  micDeviceId: string | null;
  status: BreathStatus;
  error: string | null;
  /** Starts the current source (asks for mic permission if needed). */
  start(): Promise<boolean>;
  stop(): void;
  /** Switches source (mic ↔ keyboard). Restarts if the engine was running. */
  setSourceKind(kind: BreathSourceKind): Promise<void>;
  /** Switches mic. Invalidates the calibration. */
  setMicDeviceId(deviceId: string | null): Promise<void>;
}

export const BreathContext = createContext<BreathContextValue | null>(null);
