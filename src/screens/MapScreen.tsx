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
 * Positions des nœuds. Paysage : de bas-gauche à haut-droite en vague.
 * Portrait : serpentin vertical (défile si besoin).
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

/** Courbe lisse (Catmull-Rom → Bézier) reliant les nœuds. */
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

/** Points d'une courbe de Bézier cubique entre deux nœuds, même contrôle que `smoothPath`. */
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

interface Completed {
  gameId: string;
  levelId: string;
  stars: Stars;
}

/**
 * Animation d'arrivée après un niveau d'aventure réussi, dans cet ordre :
 *  1. les étoiles gagnées apparaissent et tintent ;
 *  2. les cotillons tombent (`party`) ;
 *  3. le ballon s'envole vers l'étape suivante, pendant que les cotillons
 *     finissent de tomber ;
 *  4. l'étape suivante s'ouvre aussitôt le ballon posé.
 * Le vol démarre avant la fin des cotillons (`PARTY_BEFORE_FLY_MS`) : un
 * enchaînement strictement séquentiel ferait près de six secondes d'attente,
 * trop long pour un enfant de 3 à 6 ans.
 *
 * Exception : l'aventure terminée, le ballon repart au premier jeu pour un
 * nouveau tour — là, rien ne s'ouvre. Relancer aussitôt le premier jeu
 * enfermerait l'enfant dans une boucle qu'il n'a pas demandée ; c'est à lui
 * de choisir son étape (bouton « jouer » ou pastille de la carte).
 */
type Phase = 'hold' | 'stars' | 'party' | 'fly' | 'done';
const HOLD_MS = 500;
const STARS_MS = 900;
const FLY_MS = 1500;
/** Temps de cotillons seuls avant que le ballon ne parte. */
const PARTY_BEFORE_FLY_MS = 1200;

/** Durée des confettis de fin (accordée à l'animation `fall`). */
const CONFETTI_MS = 3200;

/**
 * Confettis d'arrivée : répartis sur toute la largeur, chute décalée.
 * La taille varie par `width`/`height` et non par `scale` : la propriété
 * `scale` autonome écraserait le `transform` animé par `@keyframes fall`,
 * et les confettis resteraient figés en haut de l'écran.
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

  // L'aventure ne contient que les jeux retenus pour cet enfant (espace parents).
  // Carte et ordre de déverrouillage en découlent : un jeu écarté n'apparaît
  // nulle part ici, mais reste jouable depuis l'onglet « Jeux ».
  const games = selectAdventureGames(state, profile.id);
  const path = useMemo(() => buildAdventurePath(games), [games]);
  const order = useMemo(() => buildUnlockOrder(games), [games]);
  const realCurrent = currentNodeIndex(progress, path, order);

  // Niveau qui vient d'être terminé (état de navigation posé par GameShell).
  // L'étape est celle du jeu ; l'étape suivante est rarement voisine, car
  // l'ordre de déverrouillage reste entrelacé entre les jeux.
  const completed = (location.state as { completed?: Completed } | null)?.completed;
  const fromIdx = completed ? nodeIndexOf(completed.gameId, path) : -1;
  const animating = fromIdx >= 0 && fromIdx !== realCurrent;
  const [phase, setPhase] = useState<Phase>(animating ? 'hold' : 'done');
  const balloonRef = useRef<HTMLDivElement>(null);

  // Le moteur n'est plus démarré pour lancer un jeu (le ballon ouvre l'étape
  // tout seul), mais la barre du haut affiche l'état du micro : on le démarre
  // quand même à l'arrivée sur la carte.
  // `status` est déjà pris par l'état des nœuds plus bas : on nomme celui-ci
  // explicitement pour éviter toute confusion entre souffle et étape.
  const { status: breathStatus, start } = useBreath();

  // Ce que l'écran affiche : pendant l'animation, l'étape terminée reste courante.
  const shownCurrent = phase === 'hold' || phase === 'stars' || phase === 'party' ? fromIdx : phase === 'fly' ? -1 : realCurrent;
  const statusOf = (i: number): NodeStatus => {
    const node = path[i];
    if (!node) return 'locked';
    if (i === shownCurrent) return 'current';
    // Pendant l'attente, l'étape qu'on vient de finir n'est pas encore « terminée ».
    if (phase === 'hold' && i === fromIdx) return 'current';
    if (isNodeDone(node, progress)) return 'done';
    return 'locked';
  };
  // Vrai quand tous les niveaux sont réussis : l'étape courante est l'étoile bonus.
  const endReached = path[realCurrent]?.kind === 'bonus';

  // Aventure terminée (l'étape courante est l'étoile bonus) : le ballon ne se
  // pose pas sur l'étoile, il repart au premier jeu — l'enfant peut rejouer ce
  // qu'il veut. Aucun jeu ne s'ouvre pour autant : c'est lui qui choisit.
  const firstGameIdx = path.findIndex((n) => n.kind === 'game');
  const restIdx = endReached && firstGameIdx >= 0 ? firstGameIdx : realCurrent;
  const balloonIdx = phase === 'done' ? restIdx : fromIdx;

  // Fête d'arrivée : à chaque fois que le ballon vient de se poser sur une étape
  // (`animating`), pas à chaque retour sur la carte. La fanfare reste réservée à
  // l'étoile finale — à chaque niveau elle couvrirait les étoiles qui tintent.
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

  // Centre la vue sur le nœud courant (en douceur quand le ballon vole).
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

  // Déroulé de l'animation d'arrivée.
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
      // Les cotillons tombent ; le ballon part avant qu'ils aient fini.
      const t = window.setTimeout(() => setPhase('fly'), PARTY_BEFORE_FLY_MS);
      return () => window.clearTimeout(t);
    }
    if (phase === 'fly') {
      const el = balloonRef.current;
      const curve = points[fromIdx + 1] ? segmentPoints(points, fromIdx) : [];
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
    // Terminé : on efface l'état de navigation pour ne pas rejouer l'animation au rafraîchissement.
    if (completed) navigate('.', { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Une étape lance son premier niveau non réussi (ordre entrelacé oblige,
  // ce n'est pas forcément le niveau 1).
  const open = (node: AdventureNode) => {
    if (node.kind !== 'game') return;
    const levelId = nextLevelOf(node, progress);
    if (levelId) navigate(`/play/${node.gameId}/${levelId}`);
  };

  const currentNode = path[realCurrent];
  const balloonPos = points[balloonIdx];

  // Étape courante jouable : socle commun à l'enchaînement automatique et au
  // bouton « jouer ».
  const playable = phase === 'done' && currentNode?.kind === 'game' && isNodeOpen(currentNode, progress, order);

  // En aventure, le jeu suivant s'ouvre tout seul une fois le ballon posé
  // (`animating` : on arrive bien d'un niveau terminé, pas d'un simple retour
  // sur la carte). Exception, `endReached` : l'aventure est finie et le ballon
  // est revenu au premier jeu — on ne relance rien, l'enfant choisit.
  const autoOpen = playable && animating && !endReached;

  // Bouton « jouer » : quand rien ne s'enchaîne tout seul. C'est le cas d'un
  // retour sur la carte hors animation, et du tour suivant une fois l'aventure
  // terminée.
  const showPlay = playable && !autoOpen;

  useEffect(() => {
    if (!autoOpen || currentNode?.kind !== 'game') return;
    open(currentNode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen]);

  // Démarre le moteur à l'arrivée sur la map (le micro est coupé quand l'onglet
  // est caché, et aucun autre écran ne le démarre).
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
              // Niveaux réussis sur le total de l'étape (1/3, pas 3/9) :
              // l'enfant lit une progression d'étapes, pas un score d'étoiles.
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
                    // Jouable dès qu'un de ses niveaux est déverrouillé, même si
                    // l'étape n'est ni courante ni terminée (ordre entrelacé).
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
      {/* Mascotte et bouton « jouer » sont permutés sur l'aventure : le bouton
          prend le bord de l'écran, la mascotte se décale vers l'intérieur.
          Le décalage est posé ici, et non sur `.mascot` (classe partagée avec
          l'onglet « Jeux », où la mascotte doit rester au bord). */}
      <Mascot className={styles.mapMascot} />
      {showPlay && (
        <PaperButton icon tone="sun" className={styles.nodePlay} onClick={() => open(currentNode)} aria-label={t('map.start')}>
          <PlayIcon size={54} />
        </PaperButton>
      )}
      <ParentsButton />
    </Sky>
  );
}
