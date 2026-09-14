import { useState, type CSSProperties, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AVATAR_RINGS,
  AVATAR_SKINS,
  Avatar,
  Balloon,
  GameThumbnail,
  LangSwitch,
  PaperButton,
  Sky,
  cx,
} from '../components/ui';
import { play } from '../audio/sfx';
import { GAMES } from '../games/registry';
import { useT } from '../i18n';
import { DEFAULT_MASCOT, MASCOTS, MascotFigure, mascotText, type MascotId } from '../mascots/MascotFigure';
import { actions, useAppState } from '../store/store';
import type { Profile } from '../store/types';
import styles from './screens.module.css';

export function HomeScreen() {
  const { profiles } = useAppState();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  // `?new=1`: arriving from the parents area, which sends us here to create
  // a child rather than duplicating the form.
  const creating = params.get('new') === '1';
  const setCreating = (on: boolean) => setParams(on ? { new: '1' } : {}, { replace: true });
  const { t } = useT();

  const openProfile = (profile: Profile) => {
    actions.selectProfile(profile.id);
    navigate('/calibration');
  };

  return (
    <Sky horizon={0.62} scroll contentClassName={styles.homeScroll}>
      <h1 className={styles.title}>Souffle Aventure</h1>
      <Balloon className={styles.heroBalloon} />

      <div className={styles.profiles}>
        {profiles.map((p) => (
          <button
            key={p.id}
            type="button"
            className={styles.profile}
            onClick={() => {
              play('tap');
              openProfile(p);
            }}
          >
            <Avatar avatar={p.avatar} size={120} shadow={false} />
            <span>{p.name}</span>
          </button>
        ))}
        {profiles.length < 4 && (
          <button type="button" className={styles.addProfile} onClick={() => {
              play('tap');
              setCreating(true);
            }} aria-label={t('home.addChild')}>
            <span className={styles.plus} />
          </button>
        )}
      </div>

      <LangSwitch className={styles.homeLang} />

      {creating && <NewProfileDialog onClose={() => setCreating(false)} onCreated={openProfile} />}
    </Sky>
  );
}

function NewProfileDialog({ onClose, onCreated }: { onClose(): void; onCreated(p: Profile): void }) {
  const [name, setName] = useState('');
  const [skin, setSkin] = useState(AVATAR_SKINS[0]);
  const [ring, setRing] = useState(AVATAR_RINGS[0]);
  const [mascot, setMascot] = useState<MascotId>(DEFAULT_MASCOT);
  // Adventure games: all checked to begin with, like the store's default.
  const [games, setGames] = useState<string[]>(() => GAMES.map((g) => g.id));
  const { t } = useT();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const profile = actions.createProfile(name, { skin, ring }, mascot);
    // No stored selection = every game: we only write if the adult has left
    // some out, so that a game added later still appears.
    if (games.length < GAMES.length) {
      for (const g of GAMES) actions.setAdventureGame(profile.id, g.id, games.includes(g.id));
    }
    onCreated(profile);
  };

  return (
    <div className={styles.dialogBackdrop} onClick={onClose} data-no-blow>
      <form className={styles.dialog} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{t('home.newChild')}</h2>
        <div className={styles.dialogBody}>
          <div className={styles.row}>
            <Avatar avatar={{ skin, ring }} size={84} />
            <input
              className={cx(styles.input, styles.grow)}
              placeholder={t('home.firstName')}
              value={name}
              maxLength={16}
              autoFocus
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className={styles.swatches} role="radiogroup" aria-label={t('home.skin')}>
            {AVATAR_SKINS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={c === skin}
                className={cx(styles.swatch, c === skin && styles.swatchOn)}
                style={{ '--c': c } as CSSProperties}
                onClick={() => {
                  play('pop');
                  setSkin(c);
                }}
              />
            ))}
          </div>
          <div className={styles.swatches} role="radiogroup" aria-label={t('home.color')}>
            {AVATAR_RINGS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={c === ring}
                className={cx(styles.swatch, c === ring && styles.swatchOn)}
                style={{ '--c': c } as CSSProperties}
                onClick={() => {
                  play('pop');
                  setRing(c);
                }}
              />
            ))}
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel} id="mascot-label">
              {t('home.mascot')}
            </span>
            <MascotPicker value={mascot} onChange={setMascot} labelledBy="mascot-label" />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel} id="games-label">
              {t('home.games')}
            </span>
            <GamePicker value={games} onChange={setGames} labelledBy="games-label" />
          </div>
        </div>
        <div className={styles.dialogActions}>
          <PaperButton className={styles.cancel} onClick={onClose}>
            {t('common.cancel')}
          </PaperButton>
          <PaperButton tone="leaf" type="submit" disabled={!name.trim()}>
            {t('home.create')}
          </PaperButton>
        </div>
      </form>
    </div>
  );
}

/**
 * Choice of the adventure's games, at creation time: a grid of checkable
 * thumbnails. The last checked game cannot be unchecked — an empty adventure
 * would have no step (the same rule as the parents area).
 */
function GamePicker({
  value,
  onChange,
  labelledBy,
}: {
  value: string[];
  onChange(ids: string[]): void;
  labelledBy?: string;
}) {
  const { t, tr } = useT();
  const toggle = (id: string, on: boolean) => onChange(on ? [...value, id] : value.filter((x) => x !== id));

  return (
    <div className={styles.gamePicker} role="group" aria-labelledby={labelledBy} aria-label={labelledBy ? undefined : t('home.games')}>
      {GAMES.map((game) => {
        const on = value.includes(game.id);
        const last = on && value.length === 1;
        return (
          <button
            key={game.id}
            type="button"
            role="checkbox"
            aria-checked={on}
            aria-label={tr(game.title)}
            disabled={last}
            className={cx(styles.gameChoice, on && styles.gameChoiceOn)}
            onClick={() => {
              play('pop');
              toggle(game.id, !on);
            }}
          >
            <span className={styles.gameChoiceThumb}>
              <GameThumbnail game={game} />
            </span>
            <span>{tr(game.title)}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Choix de la mascotte : grille de personnages, celui choisi fait coucou. */
export function MascotPicker({
  value,
  onChange,
  labelledBy,
}: {
  value: MascotId;
  onChange(id: MascotId): void;
  /** id of a visible label; otherwise an aria-label is set. */
  labelledBy?: string;
}) {
  const { t, lang } = useT();
  return (
    <div
      className={styles.mascotPicker}
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : t('home.mascot')}
    >
      {MASCOTS.map((m) => {
        const on = m.id === value;
        return (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={`${m.name}, ${mascotText(m, lang).tagline}`}
            className={cx(styles.mascotChoice, on && styles.mascotChoiceOn)}
            onClick={() => {
              play('pop');
              onChange(m.id);
            }}
          >
            <MascotFigure id={m.id} size={56} mode={on ? 'hello' : 'idle'} />
          </button>
        );
      })}
    </div>
  );
}
