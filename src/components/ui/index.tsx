import { useRef, useState, useSyncExternalStore, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { play } from '../../audio/sfx';
import { useBreath, useBreathState } from '../../breath/BreathProvider';
import { LANGS, setLang, useT, type Lang } from '../../i18n';
import { MascotFigure, type MascotMode } from '../../mascots/MascotFigure';
import type { AnyGameDefinition } from '../../games/types';
import { actions, selectCurrentProfile, useAppState } from '../../store/store';
import type { Avatar as AvatarData } from '../../store/types';
import styles from './ui.module.css';

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

// ─── Fond ──────────────────────────────────────────────────────────────

interface SkyProps {
  children: ReactNode;
  /** Position du premier relief (0..1 de la hauteur). */
  horizon?: number;
  clouds?: boolean;
  sun?: boolean;
  /** Laisse le contenu défiler s'il dépasse (accueil en portrait). */
  scroll?: boolean;
  /** Classe posée sur le conteneur de contenu. */
  contentClassName?: string;
}

export function Sky({ children, horizon = 0.62, clouds = true, sun = true, scroll, contentClassName }: SkyProps) {
  return (
    <div className={styles.sky}>
      {sun && <div className={styles.sun} />}
      {clouds && (
        <>
          <Cloud style={{ left: '6%', top: '22%', animation: 'drift 20s ease-in-out infinite alternate' }} />
          <Cloud
            style={{
              right: '12%',
              top: '30%',
              width: 140,
              height: 46,
              animation: 'drift 24s ease-in-out infinite alternate-reverse',
            }}
          />
        </>
      )}
      <Ground horizon={horizon} />
      <div className={cx(styles.content, scroll && styles.contentScroll, contentClassName)}>{children}</div>
    </div>
  );
}

/* Relief en papier découpé : prés verts sur le ciel, bande de terre. */
const HILLS: ReadonlyArray<{ d: string; fill: string }> = [
  { d: 'M0 150 C 190 104, 360 176, 560 138 S 850 168, 1000 122 L1000 300 L0 300 Z', fill: 'var(--leaf-2)' },
  { d: 'M0 212 C 170 176, 330 236, 520 204 S 820 232, 1000 184 L1000 300 L0 300 Z', fill: 'var(--leaf)' },
  { d: 'M0 268 C 260 254, 620 282, 1000 258 L1000 300 L0 300 Z', fill: 'var(--earth)' },
];

function Ground({ horizon }: { horizon: number }) {
  return (
    <>
      <svg
        className={styles.ground}
        style={{ top: `${horizon * 100}%`, height: `${(1 - horizon) * 100}%` }}
        viewBox="0 0 1000 300"
        preserveAspectRatio="none"
        aria-hidden
      >
        {HILLS.map((h, i) => (
          <g key={i}>
            <path d={h.d} fill="var(--ink)" opacity={0.1} transform="translate(0 -7)" />
            <path d={h.d} fill={h.fill} />
          </g>
        ))}
      </svg>
      <div className={cx(styles.tree, styles.treeLeft)} aria-hidden />
      <div className={cx(styles.tree, styles.treeRight)} aria-hidden />
      <div className={cx(styles.bush, styles.bushLeft)} aria-hidden />
      <div className={cx(styles.bush, styles.bushRight)} aria-hidden />
    </>
  );
}

export function Cloud({ style }: { style?: CSSProperties }) {
  return <div className={styles.cloud} style={style} aria-hidden />;
}

export function Balloon({ style, className }: { style?: CSSProperties; className?: string }) {
  return (
    <div className={cx(styles.balloon, className)} style={style} aria-hidden>
      <div className={styles.balloonEnvelope} />
      <div className={styles.balloonBasket} />
    </div>
  );
}

/**
 * Bougie d'anniversaire : la flamme rétrécit quand on souffle et s'éteint à
 * `lit === false`. `power` (0..1) est l'intensité du souffle.
 */
export function Candle({
  power = 0,
  lit = true,
  style,
  className,
}: {
  power?: number;
  lit?: boolean;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div className={cx(styles.candle, className)} style={style} aria-hidden>
      <div className={styles.candleFlameSlot}>
        {lit && (
          <div
            className={styles.candleFlame}
            style={{ '--power': power } as CSSProperties}
          />
        )}
        {!lit && <div className={styles.candleSmoke} />}
      </div>
      <div className={styles.candleWick} />
      <div className={styles.candleBody}>
        <div className={styles.candleStripe} />
      </div>
    </div>
  );
}

// ─── Avatar ────────────────────────────────────────────────────────────

export function Avatar({ avatar, size = 72, shadow = true }: { avatar: AvatarData; size?: number; shadow?: boolean }) {
  return (
    <div
      className={cx(styles.avatar, shadow && styles.avatarShadow)}
      style={{ fontSize: size, '--skin': avatar.skin, '--ring': avatar.ring } as CSSProperties}
      aria-hidden
    />
  );
}

export const AVATAR_SKINS = ['#ffb08a', '#c9a27e', '#f3c9b1', '#8d5a3b', '#ffd6c2', '#5c3a21'];
export const AVATAR_RINGS = ['#ffd93d', '#6bcb77', '#ff6b6b', '#5ec2f0', '#ffffff'];

// ─── Boutons ───────────────────────────────────────────────────────────

type Tone = 'paper' | 'coral' | 'leaf' | 'sun' | 'ghost';

interface PaperButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone;
  icon?: boolean;
  small?: boolean;
  /** Pas de son d'appui (bouton déclenché par appui long, etc.). */
  silent?: boolean;
}

const toneClass: Record<Tone, string | undefined> = {
  paper: undefined,
  coral: styles.coral,
  leaf: styles.leaf,
  sun: styles.sunBtn,
  ghost: styles.ghost,
};

export function PaperButton({ tone = 'paper', icon, small, className, type = 'button', onClick, silent, ...rest }: PaperButtonProps) {
  return (
    <button
      type={type}
      className={cx(styles.btn, toneClass[tone], icon && (small ? styles.iconSm : styles.icon), className)}
      onClick={(e) => {
        if (!silent) play('tap');
        onClick?.(e);
      }}
      {...rest}
    />
  );
}

export function PlayIcon({ size = 64 }: { size?: number }) {
  return <span className={styles.play} style={{ fontSize: size }} aria-hidden />;
}
export function CrossIcon({ size = 44 }: { size?: number }) {
  return <span className={styles.cross} style={{ fontSize: size }} aria-hidden />;
}
export function ArrowIcon({ size = 64, left }: { size?: number; left?: boolean }) {
  return <span className={cx(styles.arrow, left && styles.arrowLeft)} style={{ fontSize: size }} aria-hidden />;
}

// ─── Étoiles ───────────────────────────────────────────────────────────

export function StarRow({ stars, size = 22 }: { stars: number; size?: number }) {
  const { t } = useT();
  return (
    <span className={styles.stars} style={{ fontSize: size }} aria-label={t('stars.ofThree', { n: stars })}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={i < stars ? undefined : styles.starOff}>
          ★
        </span>
      ))}
    </span>
  );
}

/** Carrés de progression : un par niveau, allumé si réussi. */
export function LevelSquares({ done, total }: { done: boolean[]; total: number }) {
  const { t } = useT();
  return (
    <span className={styles.squares} aria-label={t('levels.ofTotal', { n: done.filter(Boolean).length, total })}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cx(styles.square, done[i] && styles.squareOn)} />
      ))}
    </span>
  );
}

// ─── Placeholder & mascotte ────────────────────────────────────────────

export function Placeholder({ label, className, style }: { label: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={cx(styles.placeholder, className)} style={style}>
      {label}
    </div>
  );
}

/**
 * Vignette d'un jeu, avec repli quand le jeu n'en fournit pas.
 * Source unique : carte d'aventure, onglet « Jeux » et espace parents
 * passent tous par ici, pour que la même vignette s'affiche partout.
 */
export function GameThumbnail({
  game,
  className,
}: {
  /** Jeu à illustrer ; `undefined` (id inconnu) donne le repli. */
  game: AnyGameDefinition | undefined;
  className?: string;
}) {
  const { t, tr } = useT();
  const Thumb = game?.Thumbnail;
  if (Thumb) return <Thumb className={className} />;
  return (
    <Placeholder
      className={className}
      style={{ width: '100%', height: '100%' }}
      label={
        <>
          {t('games.artwork')}
          {game && (
            <>
              <br />
              {tr(game.title).toLowerCase()}
            </>
          )}
        </>
      }
    />
  );
}

/** Mascotte du profil courant (ou celle par défaut), posée en bas à droite. */
export function Mascot({ style, mode = 'idle' }: { style?: CSSProperties; mode?: MascotMode }) {
  const profile = selectCurrentProfile(useAppState());
  const portrait = useMediaQuery('(orientation: portrait)');
  return (
    <div className={styles.mascot} style={style} aria-hidden>
      <MascotFigure id={profile?.mascot} size={portrait ? 96 : 140} mode={mode} />
    </div>
  );
}

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

// ─── Barre du haut : profil, onglets, état du micro ────────────────────

interface TopBarProps {
  name: string;
  avatar: AvatarData;
  tabs?: boolean;
}

export function TopBar({ name, avatar, tabs = true }: TopBarProps) {
  const { t } = useT();
  return (
    <div className={styles.topbar}>
      <div className={styles.who}>
        <Avatar avatar={avatar} />
        <span className={styles.whoName}>{name}</span>
      </div>
      {tabs && (
        <nav className={styles.tabs} aria-label={t('topbar.sections')}>
          <NavLink
            to="/map"
            className={({ isActive }) => cx(styles.tab, isActive ? styles.coral : styles.tabIdle)}
          >
            <span className={styles.tabDot} />
            {t('topbar.adventure')}
          </NavLink>
          <NavLink
            to="/games"
            className={({ isActive }) => cx(styles.tab, isActive ? styles.coral : styles.tabIdle)}
          >
            <span className={styles.tabGrid}>
              <span />
              <span />
              <span />
              <span />
            </span>
            {t('topbar.games')}
          </NavLink>
        </nav>
      )}
      <div className={styles.topRight}>
        <MicStatus />
        <CloseButton />
      </div>
    </div>
  );
}

/**
 * Sortie vers la liste des enfants : on désélectionne le profil, ce qui
 * renvoie l'écran d'accueil. Les routes de jeu exigent un profil, donc on
 * navigue explicitement plutôt que de compter sur la redirection.
 */
function CloseButton() {
  const navigate = useNavigate();
  const { t } = useT();
  return (
    <button
      type="button"
      className={styles.closeBtn}
      aria-label={t('topbar.close')}
      onClick={() => {
        play('tap');
        actions.selectProfile(null);
        navigate('/');
      }}
    >
      <span className={styles.closeGlyph} aria-hidden>
        <span />
        <span />
      </span>
    </button>
  );
}

/**
 * État du micro et niveau de souffle, en haut à droite.
 * L'icône dit si le souffle est capté (micro vert) ou non (micro barré) ;
 * la barre suit l'intensité, pour qu'un adulte voie d'un coup d'œil que
 * souffler produit bien quelque chose.
 */
export function MicStatus() {
  const { status, sourceKind } = useBreath();
  const { t } = useT();
  // Au doigt, il n'y a pas de micro à surveiller : l'appui se voit à l'écran.
  if (sourceKind === 'keyboard') return null;
  const on = status === 'running';
  return (
    <div
      className={styles.micStatus}
      role="status"
      aria-label={t(on ? 'topbar.micOn' : 'topbar.micOff')}
    >
      <MicIcon off={!on} />
      <BreathMeter active={on} />
    </div>
  );
}

function MicIcon({ off }: { off: boolean }) {
  return (
    <span className={cx(styles.micIcon, off && styles.micIconOff)} aria-hidden>
      <span className={styles.micBody} />
      <span className={styles.micStand} />
      {off && <span className={styles.micSlash} />}
    </span>
  );
}

/**
 * Barre de niveau. Composant à part : `useBreathState` re-rend à chaque
 * image, on garde ce coût sur une feuille plutôt que sur toute la barre
 * du haut (et donc sur l'écran qui la contient).
 */
function BreathMeter({ active }: { active: boolean }) {
  const { intensity } = useBreathState();
  // Courbe d'affichage seulement : un souffle faible doit se voir bouger.
  // La racine relève surtout le bas de l'échelle (0,04 → 0,2). On ne touche
  // pas aux seuils du moteur, qui règlent la détection et les jeux.
  const level = active ? Math.sqrt(Math.min(1, Math.max(0, intensity))) : 0;
  return (
    <span
      className={styles.micMeter}
      role="meter"
      aria-valuenow={Math.round(level * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span className={styles.micMeterFill} style={{ transform: `scaleY(${level})` }} />
    </span>
  );
}

// ─── Accès parents : appui long 700 ms ─────────────────────────────────

export function ParentsButton({ label, className }: { label?: string; className?: string }) {
  const navigate = useNavigate();
  const { t } = useT();
  const timer = useRef(0);
  const [pressing, setPressing] = useState(false);

  const startPress = () => {
    setPressing(true);
    timer.current = window.setTimeout(() => {
      setPressing(false);
      navigate('/parents');
    }, 700);
  };
  const cancel = () => {
    window.clearTimeout(timer.current);
    setPressing(false);
  };

  return (
    <PaperButton
      tone="ghost"
      silent
      className={cx(styles.parents, pressing && styles.parentsPressing, className)}
      onPointerDown={startPress}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={t('common.parentsLongPress')}
      data-no-blow
    >
      <span className={styles.parentsIcon}>
        <span className={styles.parentsFill} />
      </span>
      {label ?? t('common.parents')}
    </PaperButton>
  );
}

// ─── Langue ────────────────────────────────────────────────────────────

const LANG_LABEL: Record<Lang, string> = { fr: 'FR', en: 'EN' };

/** Sélecteur FR / EN. Le choix est mémorisé ; sans choix, l'app suit le navigateur. */
export function LangSwitch({ className }: { className?: string }) {
  const { lang, t } = useT();
  return (
    <div className={cx(styles.langSwitch, className)} role="radiogroup" aria-label={t('common.language')} data-no-blow>
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={l === lang}
          lang={l}
          className={cx(styles.langBtn, l === lang && styles.langOn)}
          onClick={() => {
            play('tap');
            setLang(l);
          }}
        >
          {LANG_LABEL[l]}
        </button>
      ))}
    </div>
  );
}
