import { useMemo, type CSSProperties } from 'react';
import { MASCOTS, type MascotDef, type MascotId } from './mascots.data';
import './mascots.keyframes.css';
import styles from './mascots.module.css';

export type { MascotId, MascotDef } from './mascots.data';
export { MASCOTS } from './mascots.data';
export { mascotText } from './mascotText';

export const DEFAULT_MASCOT: MascotId = 'miko';

export type MascotMode = 'idle' | 'hello' | 'bravo' | 'think';

/** Body / arm animations per state (taken from the Claude Design prototype). */
const MODES: Record<MascotMode, { body: string; arm: string }> = {
  idle: { body: 'breathe 3.2s ease-in-out infinite', arm: 'armIdle 3.2s ease-in-out infinite' },
  hello: { body: 'leanWave 1.8s ease-in-out 2', arm: 'wave 0.5s ease-in-out 7' },
  bravo: { body: 'celebrate 1.2s cubic-bezier(.3,1.35,.55,1) 2', arm: 'armUp 1.2s cubic-bezier(.3,1.35,.55,1) 2' },
  think: { body: 'thinkSway 2.6s ease-in-out infinite', arm: 'armChin 2.6s ease-in-out infinite' },
};

export function getMascot(id: string | undefined): MascotDef {
  return MASCOTS.find((m) => m.id === id) ?? MASCOTS.find((m) => m.id === DEFAULT_MASCOT)!;
}

interface MascotFigureProps {
  id: MascotId | undefined;
  /** Displayed height in px; the width follows the character's proportions. */
  size?: number;
  mode?: MascotMode;
  className?: string;
  style?: CSSProperties;
}

/**
 * Animated character (pure CSS). The markup comes from the design file,
 * injected as is; it is scaled from its measured box.
 */
export function MascotFigure({ id, size = 120, mode = 'idle', className, style }: MascotFigureProps) {
  const def = getMascot(id);
  const s = size / def.box.h;
  const anim = MODES[mode];
  const html = useMemo(() => ({ __html: def.html }), [def]);
  return (
    <div
      className={[styles.figure, className].filter(Boolean).join(' ')}
      data-mode={mode}
      style={{ width: def.box.w * s, height: size, ...style }}
      role="img"
      aria-label={def.name}
    >
      <div
        key={`${def.id}-${mode}`}
        className={styles.inner}
        style={
          {
            left: -def.box.dx * s,
            top: -def.box.dy * s,
            transform: `scale(${s})`,
            '--m-body': anim.body,
            '--m-arm': anim.arm,
          } as CSSProperties
        }
        dangerouslySetInnerHTML={html}
      />
    </div>
  );
}
