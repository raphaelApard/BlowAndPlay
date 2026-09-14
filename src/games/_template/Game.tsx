import { useEffect, useRef } from 'react';
import type { GameProps } from '../types';
import type { TemplateLevel, TemplateSettings } from './index';

/**
 * Squelette de jeu : une boucle rAF qui lit le souffle, un état dans une
 * ref (pas de re-rendu React par frame), et `onComplete` appelé une fois.
 */
export function Game({
  level,
  settings,
  breath,
  width,
  height,
  paused,
  difficulty,
  onProgress,
  onComplete,
}: GameProps<TemplateLevel, TemplateSettings>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const doneRef = useRef(false);
  const accumulatedRef = useRef(0);

  useEffect(() => {
    if (paused) return;
    let raf = 0;
    let last = performance.now();
    // Exemple : la difficulté globale allonge l'objectif du niveau (×0,7 → ×1,5),
    // le réglage parents « vitesse » le raccourcit.
    const targetMs = (level.targetMs * (0.7 + difficulty * 0.8)) / settings.speed;

    const frame = (t: number) => {
      const dt = t - last;
      last = t;
      const { intensity, isBlowing } = breath.getState();

      // ── Logique du jeu ──
      if (isBlowing) accumulatedRef.current += dt * intensity;
      const progress = Math.min(1, accumulatedRef.current / targetMs);
      onProgress?.(progress);

      // ── Rendu ──
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = settings.helper ? '#ffd93d' : '#ff6b6b';
        const r = 40 + intensity * 60;
        ctx.beginPath();
        ctx.arc(width / 2, height * (0.8 - progress * 0.6), r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (progress >= 1 && !doneRef.current) {
        doneRef.current = true;
        onComplete({ stars: 3 });
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [breath, level, settings, width, height, paused, difficulty, onProgress, onComplete]);

  return <canvas ref={canvasRef} width={width} height={height} style={{ display: 'block' }} />;
}
