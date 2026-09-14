import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  buildAdventurePath,
  buildUnlockOrder,
  currentNodeIndex,
  isNodeDone,
  isNodeOpen,
  nextLevelOf,
  nodeIndexOf,
  nodeLevelsDone,
  type AdventureNode,
  type NodeStatus,
} from '../adventure/path';
import { getGame } from '../games/registry';
import type { Stars } from '../games/types';
import { useBreath } from '../breath/BreathProvider';
import { Balloon, GameThumbnail, Mascot, PaperButton, ParentsButton, PlayIcon, Sky, TopBar, cx } from '../components/ui';
import { play } from '../audio/sfx';
import { useT } from '../i18n';
import { selectAdventureGames, selectProgress, useAppState } from '../store/store';
import { useCurrentProfile } from './useCurrentProfile';
import styles from './screens.module.css';

interface Point {
  x: number;
  y: number;
}

/**
 * Node positions. Landscape: from bottom-left to top-right in a wave.
 * Portrait: a vertical snake (scrolls if needed).
 */
function layoutNodes(count: number, width: number, height: number, portrait: boolean): { points: Point[]; stageW: number; stageH: number } {
  if (portrait) {
    const step = 150;
    const stageH = Math.max(height, count * step + 320);
    const points = Array.from({ length: count }, (_, i) => ({
      x: width * (i % 2 === 0 ? 0.68 : 0.32),
      y: stageH - 260 - i * step,
    }));
    return { points, stageW: width, stageH };
  }
  const step = 112;
  const stageW = Math.max(width, count * step + 220);
  const points = Array.from({ length: count }, (_, i) => {
    const t = count > 1 ? i / (count - 1) : 0;
    return {
      x: 110 + t * (stageW - 260),
      y: height * (0.64 - t * 0.42) + Math.sin(i * 1.7) * height * 0.06,
    };
  });
  return { points, stageW, stageH: height };
}

/** Smooth curve (Catmull-Rom → Bézier) connecting the nodes. */
function smoothPath(points: Point[]): string {
  if (points.length < 2) return '';
  let d = `M${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p2.x} ${p2.y}`;
  }
  return d;
}

/** Points of a cubic Bézier curve between two nodes, same control as `smoothPath`. */
function segmentPoints(points: Point[], i: number, samples = 32): Point[] {
  const p0 = points[i - 1] ?? points[i];
  const p1 = points[i];
  const p2 = points[i + 1];
  const p3 = points[i + 2] ?? p2;
  const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
  const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
  return Array.from({ length: samples + 1 }, (_, k) => {
    const t = k / samples;
    const u = 1 - t;
    return {
      x: u * u * u * p1.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p2.x,
      y: u * u * u * p1.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p2.y,
    };
  });
}

/**
 * Straight line between two nodes, sampled like `segmentPoints`. Used when the
 * balloon goes back several steps at once (end of a round): following the
 * curve would make it retrace the whole map backwards.
 */
function straightPoints(from: Point, to: Point, samples = 32): Point[] {
  return Array.from({ length: samples + 1 }, (_, k) => {
    const t = k / samples;
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
  });
}

interface Completed {
  gameId: string;
  levelId: string;
  stars: Stars;
}

/**
 * Arrival animation after an adventure level is passed, in this order:
 *  1. the stars earned appear and chime;
 *  2. the confetti falls (`party`);
 *  3. the balloon flies off to the next step, while the confetti finishes
 *     falling;
 *  4. the next step opens as soon as the balloon has landed.
 * The flight starts before the confetti ends (`PARTY_BEFORE_FLY_MS`): a
 * strictly sequential chain would mean nearly six seconds of waiting, too
 * long for a child aged 3 to 6.
 *
 * Exceptions, at the two kinds of boundary — nothing opens by itself then:
 *  - end of a round (every game passed at this level): the balloon comes back
 *    to the first game, ready for the next level;
 *  - end of the adventure (every level of every game passed): the balloon
 *    stays on the final yellow star.
 * Relaunching a game straight away would trap the child in a loop they did
 * not ask for; it is up to them to choose their step (the play button or a
 * dot on the map).
 */
type Phase = 'hold' | 'stars' | 'party' | 'fly' | 'done';
const HOLD_MS = 500;
const STARS_MS = 900;
const FLY_MS = 1500;
/** Time of confetti alone before the balloon leaves. */
const PARTY_BEFORE_FLY_MS = 1200;

/** Duration of the final confetti (matched to the `fall` animation). */
const CONFETTI_MS = 3200;

/**
 * Arrival confetti: spread across the full width, with staggered falls.
 * The size varies through `width`/`height` and not through `scale`: the
 * standalone `scale` property would override the `transform` animated by
 * `@keyframes fall`, and the confetti would stay frozen at the top of the
 * screen.
 */
const CONFETTI = Array.from({ length: 24 }, (_, i) => {
  const size = 0.7 + ((i * 7) % 10) / 14;
  const round = i % 3 === 0;
  return {
    left: `${2 + i * 4.1}%`,
    color: ['#ff6b6b', '#ffd93d', '#6bcb77', '#5ec2f0'][i % 4],
    delay: `${(i % 7) * 0.18}s`,
    round,
    width: Math.round((round ? 16 : 18) * size),
    height: Math.round((round ? 16 : 26) * size),
  };
});

export function MapScreen() {
  const navigate = useNavigate();
  const profile = useCurrentProfile();
  const { t, tr } = useT();
  const location = useLocation();
  const state = useAppState();
  const progress = selectProgress(state, profile.id);

  // The adventure only contains the games kept for this child (parents area).
  // The map and the unlock order follow from it: a game left out appears
  // nowhere here, but stays playable from the Games tab.
  const games = selectAdventureGames(state, profile.id);
  const path = useMemo(() => buildAdventurePath(games), [games]);
  const order = useMemo(() => buildUnlockOrder(games), [games]);
  const realCurrent = currentNodeIndex(progress, path, order);

  // The level that was just finished (navigation state set by GameShell).
  // The step is the game's; the next step is rarely adjacent, because the
  // unlock order stays interleaved across the games.
  const completed = (location.state as { completed?: Completed } | null)?.completed;
  const fromIdx = completed ? nodeIndexOf(completed.gameId, path) : -1;
  const animating = fromIdx >= 0 && fromIdx !== realCurrent;
  const [phase, setPhase] = useState<Phase>(animating ? 'hold' : 'done');
  const balloonRef = useRef<HTMLDivElement>(null);

  // The engine is no longer started in order to launch a game (the balloon
  // opens the step by itself), but the top bar shows the mic status: we start
  // it anyway on arriving at the map.
  // `status` is already taken by the node status below: we name this one
  // explicitly to avoid any confusion between breath and step.
  const { status: breathStatus, start } = useBreath();

  // What the screen shows: during the animation, the finished step stays current.
  const shownCurrent = phase === 'hold' || phase === 'stars' || phase === 'party' ? fromIdx : phase === 'fly' ? -1 : realCurrent;
  const statusOf = (i: number): NodeStatus => {
    const node = path[i];
    if (!node) return 'locked';
    if (i === shownCurrent) return 'current';
    // During the wait, the step just finished is not yet "done".
    if (phase === 'hold' && i === fromIdx) return 'current';
    if (isNodeDone(node, progress)) return 'done';
    return 'locked';
  };
  // True when every level is passed: the current step is the bonus star.
  const endReached = path[realCurrent]?.kind === 'bonus';

  // End of a round: the child has just finished the last game of the map and
  // the adventure goes back to the first game for the next level (the unlock
  // order is interleaved, so `realCurrent` is already that first game). The
  // balloon therefore comes back to the start of the map — but nothing opens
  // by itself, as at the very end: the child chooses their step.
  const firstGameIdx = path.findIndex((n) => n.kind === 'game');
  const roundEnd = !endReached && animating && realCurrent === firstGameIdx && fromIdx > firstGameIdx;

  // Where the balloon comes to rest. At the very end of the adventure it stays
  // on the yellow star (the step it has just reached); otherwise on the
  // current step, which at the end of a round is the first game again.
  const restIdx = realCurrent;
  const balloonIdx = phase === 'done' ? restIdx : fromIdx;

  // Arrival celebration: every time the balloon has just landed on a step
  // (`animating`), not on every return to the map. The fanfare stays reserved
  // for the final star — on every level it would cover the chiming stars.
  const [party, setParty] = useState(false);
  useEffect(() => {
    if (phase !== 'party') return;
    setParty(true);
    if (endReached) play('fanfare');
    const t = window.setTimeout(() => setParty(false), CONFETTI_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0, portrait: false });

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setViewport({ width, height, portrait: height > width });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { points, stageW, stageH } = layoutNodes(path.length, viewport.width, viewport.height, viewport.portrait);

  // Centres the view on the current node (smoothly while the balloon flies).
  const focusIdx = phase === 'hold' || phase === 'stars' || phase === 'party' ? fromIdx : realCurrent;
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const p = points[focusIdx];
    if (!el || !p || !viewport.width) return;
    el.scrollTo({
      left: p.x - viewport.width / 2,
      top: p.y - viewport.height / 2,
      behavior: phase === 'fly' ? 'smooth' : 'auto',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusIdx, viewport.width, viewport.height]);

  // Course of the arrival animation.
  useEffect(() => {
    if (phase === 'hold') {
      const t = window.setTimeout(() => setPhase('stars'), HOLD_MS);
      return () => window.clearTimeout(t);
    }
    if (phase === 'stars') {
      const n = completed?.stars ?? 0;
      const dings = Array.from({ length: n }, (_, i) => window.setTimeout(() => play('star'), i * 220));
      const t = window.setTimeout(() => setPhase('party'), STARS_MS);
      return () => {
        dings.forEach((id) => window.clearTimeout(id));
        window.clearTimeout(t);
      };
    }
    if (phase === 'party') {
      // The confetti falls; the balloon leaves before it has finished.
      const t = window.setTimeout(() => setPhase('fly'), PARTY_BEFORE_FLY_MS);
      return () => window.clearTimeout(t);
    }
    if (phase === 'fly') {
      const el = balloonRef.current;
      // Usually the next step along the path (one segment). At the end of a
      // round the balloon goes back to the first game, several steps
      // backwards: it then flies straight there rather than following the
      // curve, which would make it retrace the whole map.
      const curve =
        restIdx === fromIdx + 1 && points[fromIdx + 1]
          ? segmentPoints(points, fromIdx)
          : points[restIdx] && points[fromIdx]
            ? straightPoints(points[fromIdx], points[restIdx])
            : [];
      if (!el || !curve.length) {
        setPhase('done');
        return;
      }
      play('whoosh');
      let raf = 0;
      const t0 = performance.now();
      const frame = (now: number) => {
        const u = Math.min(1, (now - t0) / FLY_MS);
        const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        const p = curve[Math.round(e * (curve.length - 1))];
        el.style.left = `${p.x}px`;
        el.style.top = `${p.y - Math.sin(u * Math.PI) * 40}px`;
        if (u < 1) raf = requestAnimationFrame(frame);
        else setPhase('done');
      };
      raf = requestAnimationFrame(frame);
      return () => cancelAnimationFrame(raf);
    }
    // Done: we clear the navigation state so the animation does not replay on refresh.
    if (completed) navigate('.', { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // A step launches its first level not yet passed (because of the
  // interleaved order, that is not necessarily level 1).
  const open = (node: AdventureNode) => {
    if (node.kind !== 'game') return;
    const levelId = nextLevelOf(node, progress);
    if (levelId) navigate(`/play/${node.gameId}/${levelId}`);
  };

  const balloonPos = points[balloonIdx];

  // The step the play button launches: the current step, except once the
  // adventure is over — the current step is then the bonus star, which cannot
  // be played. The button then falls back to the first game, so as to stay
  // usable for another round (the balloon, meanwhile, stays on the star).
  const playNode = endReached && firstGameIdx >= 0 ? path[firstGameIdx] : path[realCurrent];

  // Playable step: common ground for the automatic chaining and the button.
  const playable = playNode?.kind === 'game' && isNodeOpen(playNode, progress, order);

  // In adventure mode, the next game opens by itself once the balloon has
  // landed (`animating`: we really are arriving from a finished level, not
  // from a plain return to the map). Two exceptions, where the balloon comes
  // back to the start of the map: the end of a round (`roundEnd`) and the end
  // of the adventure (`endReached`). Sending the child straight back into the
  // first game would trap them in a loop they did not ask for — it is up to
  // them to choose their step (the play button or a dot on the map).
  const autoOpen = playable && phase === 'done' && animating && !endReached && !roundEnd;

  // Play button: always present on the map as soon as there is a step to
  // launch — including during the arrival animation and when the automatic
  // chaining is about to take over. The child thus has a stable landmark,
  // one that does not flicker from one screen to the next.
  const showPlay = playable;

  useEffect(() => {
    if (!autoOpen || playNode?.kind !== 'game') return;
    open(playNode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen]);

  // Starts the engine on arriving at the map (the mic is cut when the tab is
  // hidden, and no other screen starts it).
  useEffect(() => {
    if (breathStatus === 'idle') void start();
  }, [breathStatus, start]);

  return (
    <Sky horizon={0.5} clouds={false}>
      <div ref={scrollRef} className={styles.mapScroll}>
        {viewport.width > 0 && (
          <div className={styles.mapStage} style={{ width: stageW, height: stageH }}>
            <svg className={styles.mapPath} width={stageW} height={stageH} aria-hidden>
              <path d={smoothPath(points)} fill="none" stroke="#23324a" strokeWidth={14} strokeDasharray="20 18" strokeLinecap="round" opacity={0.18} />
              <path d={smoothPath(points)} fill="none" stroke="#fff" strokeWidth={14} strokeDasharray="20 18" strokeLinecap="round" />
            </svg>

            {path.map((node, i) => {
              const p = points[i];
              const status = statusOf(i);
              const tilt = `${((i % 3) - 1) * 5}deg`;
              const pos: CSSProperties = { left: p.x, top: p.y, transform: `rotate(${tilt})`, '--tilt': tilt } as CSSProperties;

              if (node.kind === 'bonus') {
                return (
                  <div key={node.id} className={cx(styles.node, styles.nodeBonus)} style={pos} aria-label={t('map.bonus')}>
                    ★
                  </div>
                );
              }

              const game = getGame(node.gameId);
              const title = game ? tr(game.title) : node.gameId;
              // Levels passed out of the step's total (1/3, not 3/9): the
              // child reads a progression of steps, not a star score.
              const levelsDone = nodeLevelsDone(node, progress);
              const levelsTotal = node.levelIds.length;

              return (
                <div key={node.id}>
                  {status === 'current' && <div className={styles.pulse} style={{ left: p.x, top: p.y }} />}
                  {levelsDone > 0 && (
                    <div className={cx(styles.nodeStars, i === fromIdx && styles.nodeStarsPop)} style={{ left: p.x, top: p.y }}>
                      <span className={styles.nodeStarsCount} aria-label={t('map.gameStars', { n: levelsDone, max: levelsTotal })}>
                        ★ {levelsDone}/{levelsTotal}
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    className={cx(
                      styles.node,
                      status === 'done' && styles.nodeDone,
                      status === 'current' && styles.nodeCurrent,
                      status === 'locked' && styles.nodeLocked,
                    )}
                    style={pos}
                    // Playable as soon as one of its levels is unlocked, even if
                    // the step is neither current nor done (interleaved order).
                    disabled={!isNodeOpen(node, progress, order)}
                    onClick={() => open(node)}
                    aria-label={t(isNodeOpen(node, progress, order) ? 'map.game' : 'map.gameLocked', { title })}
                  >
                    <GameThumbnail game={game} className={styles.nodeThumb} />
                  </button>
                </div>
              );
            })}

            {balloonPos && (
              <div ref={balloonRef} className={styles.balloonAnchor} style={{ left: balloonPos.x, top: balloonPos.y }}>
                <Balloon className={cx(styles.nodeBalloon, phase === 'fly' && styles.nodeBalloonFlying)} />
              </div>
            )}
          </div>
        )}
      </div>

      {party && (
        <div className={styles.mapConfetti} aria-hidden>
          {CONFETTI.map((c, i) => (
            <span
              key={i}
              className={styles.mapConfettiPiece}
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
      {/* The mascot and the play button are swapped on the adventure: the
          button takes the edge of the screen, the mascot shifts inwards.
          The offset is set here, and not on `.mascot` (a class shared with
          the Games tab, where the mascot must stay at the edge). */}
      <Mascot className={styles.mapMascot} />
      {showPlay && (
        <PaperButton icon tone="sun" className={styles.nodePlay} onClick={() => open(playNode)} aria-label={t('map.start')}>
          <PlayIcon size={54} />
        </PaperButton>
      )}
      <ParentsButton />
    </Sky>
  );
}
