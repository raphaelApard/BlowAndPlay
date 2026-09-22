import { useCallback, useContext, useSyncExternalStore } from 'react';
import { BreathContext, type BreathContextValue } from './BreathContext';
import type { BreathState } from './types';

export function useBreath(): BreathContextValue {
  const ctx = useContext(BreathContext);
  if (!ctx) throw new Error('useBreath must be used under <BreathProvider>');
  return ctx;
}

/**
 * Breath state re-rendered on every frame. Costly: prefer `engine.subscribe`
 * writing to the DOM (see `BreathStrip`) for anything that stays on screen.
 */
export function useBreathState(): BreathState {
  const { engine } = useBreath();
  // Stable callbacks: an inline `subscribe` makes React unsubscribe and
  // resubscribe on every render — that is, on every frame here.
  const subscribe = useCallback((cb: () => void) => engine.subscribe(cb), [engine]);
  const getState = useCallback(() => engine.getState(), [engine]);
  return useSyncExternalStore(subscribe, getState, getState);
}
