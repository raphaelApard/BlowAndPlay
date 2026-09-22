import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { muteSfx } from '../audio/sfx';
import { useBreath } from '../breath/useBreath';
import { listMicrophones, type Microphone } from '../breath/MicBreathSource';
import type { BreathSourceKind } from '../breath/types';
import { ArrowIcon, Avatar, GameThumbnail, LangSwitch, PaperButton, Sky, StarRow } from '../components/ui';
import { cx } from '../components/ui/cx';
import { GAMES, getGame } from '../games/registry';
import { resolveSettings, type AnyGameDefinition, type LevelBase, type SettingDef, type SettingValue } from '../games/types';
import { localeOf, useT } from '../i18n';
import { MascotFigure, type MascotId } from '../mascots/MascotFigure';
import { mascotText } from '../mascots/mascotText';
import { MASCOTS } from '../mascots/mascots.data';
import { getMascot } from '../mascots/getMascot';
import { MAX_DIFFICULTY, MIN_DIFFICULTY, actions, selectCurrentProfile, selectProgress, useAppState } from '../store/store';
import type { Profile } from '../store/types';
import styles from './screens.module.css';

const PATTERN_KEY = {
  long: 'pattern.long',
  bursts: 'pattern.bursts',
  modulated: 'pattern.modulated',
  free: 'pattern.free',
} as const;

function fmtDuration(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`;
}

/**
 * Mic picker. The labels only appear once permission has been granted: a
 * "Detect" button obtains it if needed. Follows plugging and unplugging.
 */
function MicrophonePicker() {
  const { micDeviceId, setMicDeviceId, engine } = useBreath();
  const [mics, setMics] = useState<Microphone[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [changed, setChanged] = useState(false);
  const { t } = useT();

  const refresh = useCallback(() => listMicrophones().then(setMics), []);

  // Lists on mount, then follows plugging / unplugging.
  useEffect(() => {
    void refresh();
    const md = navigator.mediaDevices;
    if (!md?.addEventListener) return;
    const onChange = () => void refresh();
    md.addEventListener('devicechange', onChange);
    return () => md.removeEventListener('devicechange', onChange);
  }, [refresh]);

  const detect = async () => {
    setBusy(true);
    try {
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const current = micDeviceId ?? '';
  const unknown = current && mics && !mics.some((m) => m.deviceId === current);

  const choose = async (value: string) => {
    await setMicDeviceId(value || null);
    setChanged(true);
  };

  return (
    <div className={styles.difficulty}>
      <label htmlFor="mic">
        {t('parents.mic')} :{' '}
        <strong>{mics?.find((m) => m.deviceId === current)?.label ?? t(current ? 'parents.micNotFound' : 'parents.micDefault')}</strong>
      </label>
      <div className={styles.row}>
        <select id="mic" className={cx(styles.select, styles.grow)} value={current} onChange={(e) => choose(e.target.value)}>
          <option value="">{t('parents.micSystemDefault')}</option>
          {mics?.map((m) => (
            <option key={m.deviceId} value={m.deviceId}>
              {m.label}
            </option>
          ))}
          {unknown && (
            <option value={current} disabled>
              {t('parents.micUnplugged')}
            </option>
          )}
        </select>
        <PaperButton className={styles.smallBtn} onClick={detect} disabled={busy}>
          {busy ? '…' : t('parents.detect')}
        </PaperButton>
      </div>
      <span className={styles.muted}>
        {mics === null
          ? t('parents.micSearching')
          : mics.length === 0
            ? t('parents.micNone')
            : t(mics.length > 1 ? 'parents.micCountPlural' : 'parents.micCount', { n: mics.length })}
        {(changed || !engine.isCalibrated()) && t('parents.recalibrateNotice')}
      </span>
    </div>
  );
}

/** Settings declared by a game (`GameDefinition.settings`), rendered generically. */
function GameSettingsPanel({ game, stored }: { game: AnyGameDefinition; stored: Record<string, SettingValue> | undefined }) {
  const defs = game.settings as Record<string, SettingDef>;
  const values = resolveSettings(defs, stored);
  const set = (key: string, value: SettingValue) => actions.setGameSetting(game.id, key, value);
  const { t, tr } = useT();

  return (
    <div className={styles.difficulty}>
      <div className={styles.row}>
        <strong className={styles.grow}>{tr(game.title)}</strong>
        {stored && Object.keys(stored).length > 0 && (
          <PaperButton tone="ghost" onClick={() => actions.resetGameSettings(game.id)}>
            {t('parents.defaults')}
          </PaperButton>
        )}
      </div>
      {Object.entries(defs).map(([key, def]) => {
        const id = `gs-${game.id}-${key}`;
        const value = values[key];
        return (
          <div key={key} className={styles.gameSetting}>
            {def.type === 'range' && (
              <>
                <label htmlFor={id}>
                  {tr(def.label)} : <strong>{value as number}</strong>
                  {def.unit ?? ''}
                </label>
                <input
                  id={id}
                  type="range"
                  min={def.min}
                  max={def.max}
                  step={def.step ?? 1}
                  value={value as number}
                  onChange={(e) => set(key, Number(e.target.value))}
                />
              </>
            )}
            {def.type === 'toggle' && (
              <label htmlFor={id} className={styles.checkRow}>
                <input id={id} type="checkbox" checked={value as boolean} onChange={(e) => set(key, e.target.checked)} />
                {tr(def.label)}
              </label>
            )}
            {def.type === 'choice' && (
              <>
                <label htmlFor={id}>{tr(def.label)}</label>
                <select id={id} className={styles.select} value={value as string} onChange={(e) => set(key, e.target.value)}>
                  {def.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {tr(o.label)}
                    </option>
                  ))}
                </select>
              </>
            )}
            {def.description && <span className={styles.muted}>{tr(def.description)}</span>}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Choice of the games that make up a child's adventure.
 * No stored selection = every game; unchecking erases nothing and leaves the
 * game reachable from the Games tab. We prevent unchecking everything: an
 * empty adventure would no longer have a single step.
 */
function AdventureGamesPanel({ profile, chosen }: { profile: Profile; chosen: string[] | undefined }) {
  const { t, tr } = useT();
  const enabled = (id: string) => (chosen ? chosen.includes(id) : true);
  const count = GAMES.filter((g) => enabled(g.id)).length;

  return (
    <section className={styles.section}>
      <h2>{t('parents.adventureGames', { name: profile.name })}</h2>
      <span className={styles.muted}>{t('parents.adventureGamesHelp', { name: profile.name })}</span>
      <div className={styles.gamePicker}>
        {GAMES.map((game) => {
          const on = enabled(game.id);
          // The last checked game cannot be unchecked: the adventure would
          // keep a map with no step.
          const last = on && count === 1;
          return (
            <button
              key={game.id}
              type="button"
              role="checkbox"
              aria-checked={on}
              aria-label={tr(game.title)}
              disabled={last}
              className={cx(styles.gameChoice, on && styles.gameChoiceOn)}
              onClick={() => actions.setAdventureGame(profile.id, game.id, !on)}
            >
              <span className={styles.gameChoiceThumb}>
                <GameThumbnail game={game} />
              </span>
              <span>{tr(game.title)}</span>
            </button>
          );
        })}
      </div>
      <div className={styles.row}>
        <span className={cx(styles.muted, styles.grow)}>
          {t(count > 1 ? 'parents.adventureGamesCountPlural' : 'parents.adventureGamesCount', { n: count, total: GAMES.length })}
          {count === 1 && ` ${t('parents.adventureGamesEmpty')}`}
        </span>
        {chosen && count < GAMES.length && (
          <PaperButton tone="ghost" onClick={() => actions.resetAdventureGames(profile.id)}>
            {t('parents.adventureGamesAll')}
          </PaperButton>
        )}
      </div>
    </section>
  );
}

/** Adult area: profiles, progress, sessions, settings. Text is allowed here. */
export function ParentsScreen() {
  const navigate = useNavigate();
  const state = useAppState();
  const current = selectCurrentProfile(state);
  const progress = selectProgress(state, current?.id ?? null);
  const { sourceKind, setSourceKind } = useBreath();
  const [confirm, setConfirm] = useState<'reset' | 'delete' | null>(null);
  const { t, tr, lang } = useT();

  // No sound effects in the adult area: the sounds are made for the child's
  // play, not for settings. Covers the whole screen (buttons, language…),
  // without having to mark each button one by one.
  useEffect(() => muteSfx(), []);

  const sessions = state.sessions
    .filter((s) => s.profileId === current?.id)
    .slice(-12)
    .reverse();

  const changeSource = async (kind: BreathSourceKind) => {
    actions.setInputSource(kind);
    await setSourceKind(kind);
  };

  return (
    <Sky horizon={0.8} clouds={false}>
      <div className={styles.parents} data-no-blow>
        <div className={styles.parentsInner}>
          <div className={styles.parentsHead}>
            <PaperButton icon small onClick={() => navigate(-1)} aria-label={t('common.back')}>
              <ArrowIcon size={56} left />
            </PaperButton>
            <span className={styles.grow}>{t('parents.title')}</span>
            <LangSwitch />
          </div>

          <section className={styles.section}>
            <h2>{t('parents.children')}</h2>
            {state.profiles.length === 0 && <span className={styles.muted}>{t('parents.noProfile')}</span>}
            {state.profiles.map((p) => (
              <div key={p.id} className={styles.row}>
                <Avatar avatar={p.avatar} size={44} />
                <span className={cx(styles.grow)}>
                  {p.name} {p.id === current?.id && <span className={styles.tag}>{t('parents.selected')}</span>}
                </span>
                {p.id !== current?.id && (
                  <PaperButton className={styles.smallBtn} onClick={() => actions.selectProfile(p.id)}>
                    {t('parents.select')}
                  </PaperButton>
                )}
              </div>
            ))}
            <div className={styles.row}>
              {/* Adding a child happens on the home screen (avatar, mascot,
                  games): we take them there, rather than duplicating the form. */}
              <PaperButton className={styles.smallBtn} tone="leaf" onClick={() => navigate('/?new=1')}>
                {t('parents.addChild')}
              </PaperButton>
            </div>
          </section>

          {current && (
            <section className={styles.section}>
              <h2>{t('parents.mascotOf', { name: current.name })}</h2>
              <div className={styles.mascotRow}>
                <MascotFigure id={current.mascot} size={150} />
                <div className={styles.grow}>
                  <label htmlFor="mascot">{t('parents.mascotHelp', { name: current.name })}</label>
                  <select
                    id="mascot"
                    className={styles.select}
                    value={getMascot(current.mascot).id}
                    onChange={(e) => actions.setMascot(current.id, e.target.value as MascotId)}
                  >
                    {MASCOTS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} — {mascotText(m, lang).tagline}
                      </option>
                    ))}
                  </select>
                  <span className={styles.muted}>{mascotText(getMascot(current.mascot), lang).description}</span>
                </div>
              </div>
            </section>
          )}

          <section className={styles.section}>
            <h2>{t('parents.settings')}</h2>
            <div className={styles.row}>
              <label className={cx(styles.radio, sourceKind === 'mic' && styles.radioOn)}>
                <input type="radio" name="source" checked={sourceKind === 'mic'} onChange={() => changeSource('mic')} />
                {t('parents.sourceMic')}
              </label>
              <label className={cx(styles.radio, sourceKind === 'keyboard' && styles.radioOn)}>
                <input type="radio" name="source" checked={sourceKind === 'keyboard'} onChange={() => changeSource('keyboard')} />
                {t('parents.sourceKeyboard')}
              </label>
            </div>
            {sourceKind === 'mic' && <MicrophonePicker />}
            <div className={styles.difficulty}>
              <label htmlFor="sound" className={styles.checkRow}>
                <input id="sound" type="checkbox" checked={state.settings.sound} onChange={(e) => actions.setSound(e.target.checked)} />
                {t('parents.sound')}
              </label>
            </div>
            <div className={styles.difficulty}>
              <label htmlFor="difficulty">
                {t('parents.difficulty')} : <strong>{state.settings.difficulty}</strong> / {MAX_DIFFICULTY}
              </label>
              <input
                id="difficulty"
                type="range"
                min={MIN_DIFFICULTY}
                max={MAX_DIFFICULTY}
                step={1}
                value={state.settings.difficulty}
                onChange={(e) => actions.setDifficulty(Number(e.target.value))}
              />
              <div className={styles.difficultyScale}>
                <span>{t('parents.easy')}</span>
                <span>{t('parents.hard')}</span>
              </div>
              <span className={styles.muted}>
                {t('parents.difficultyHelp')}
              </span>
            </div>
            <div className={styles.row}>
              <PaperButton className={styles.smallBtn} onClick={() => navigate('/calibration?returnTo=/parents')}>
                {t('parents.recalibrate')}
              </PaperButton>
              {current && (
                <>
                  <PaperButton className={styles.smallBtn} onClick={() => setConfirm('reset')}>
                    {t('parents.resetProgress')}
                  </PaperButton>
                  <PaperButton className={cx(styles.smallBtn, styles.danger)} onClick={() => setConfirm('delete')}>
                    {t('parents.deleteProfile')}
                  </PaperButton>
                </>
              )}
            </div>
            {confirm && current && (
              <div className={styles.row}>
                <span className={styles.grow}>
                  {t(confirm === 'reset' ? 'parents.confirmReset' : 'parents.confirmDelete', { name: current.name })}
                </span>
                <PaperButton tone="ghost" onClick={() => setConfirm(null)}>
                  {t('common.cancel')}
                </PaperButton>
                <PaperButton
                  className={cx(styles.smallBtn, styles.danger)}
                  onClick={() => {
                    if (confirm === 'reset') actions.resetProgress(current.id);
                    else {
                      actions.deleteProfile(current.id);
                      navigate('/', { replace: true });
                    }
                    setConfirm(null);
                  }}
                >
                  {t('common.confirm')}
                </PaperButton>
              </div>
            )}
          </section>

          {current && (
            <>
              <AdventureGamesPanel profile={current} chosen={state.adventureGames[current.id]} />

              <section className={styles.section}>
                <h2>{t('parents.progressOf', { name: current.name })}</h2>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>{t('parents.game')}</th>
                        <th>{t('parents.trains')}</th>
                        {Array.from({ length: Math.max(...GAMES.map((g) => g.levels.length)) }, (_, i) => (
                          <th key={i}>{t('parents.levelN', { n: i + 1 })}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {GAMES.map((g) => (
                        <tr key={g.id}>
                          <td>
                            <strong>{tr(g.title)}</strong>
                            <div className={styles.muted} style={{ fontSize: 13 }}>
                              {tr(g.description)}
                            </div>
                          </td>
                          <td>{t(PATTERN_KEY[g.pattern])}</td>
                          {(g.levels as readonly LevelBase[]).map((l) => {
                            const lp = progress[g.id]?.[l.id];
                            return (
                              <td key={l.id}>
                                {lp ? (
                                  <>
                                    <StarRow stars={lp.stars} size={16} />
                                    <div className={styles.muted} style={{ fontSize: 12 }}>
                                      {t(lp.plays > 1 ? 'parents.playsPlural' : 'parents.plays', { n: lp.plays })}
                                    </div>
                                  </>
                                ) : (
                                  <span className={styles.muted}>—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className={styles.section}>
                <h2>{t('parents.lastSessions')}</h2>
                {sessions.length === 0 ? (
                  <span className={styles.muted}>{t('parents.noSession')}</span>
                ) : (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>{t('parents.date')}</th>
                          <th>{t('parents.game')}</th>
                          <th>{t('parents.levelShort')}</th>
                          <th>{t('parents.stars')}</th>
                          <th>{t('parents.blows')}</th>
                          <th>{t('parents.blowTime')}</th>
                          <th>{t('parents.longest')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.map((s) => (
                          <tr key={s.at}>
                            <td>{new Date(s.at).toLocaleString(localeOf(lang), { dateStyle: 'short', timeStyle: 'short' })}</td>
                            <td>{(() => { const g = getGame(s.gameId); return g ? tr(g.title) : s.gameId; })()}</td>
                            <td>{s.levelId}</td>
                            <td>
                              <StarRow stars={s.stars} size={16} />
                            </td>
                            <td>{s.blows}</td>
                            <td>{fmtDuration(s.totalBlowMs)}</td>
                            <td>{fmtDuration(s.longestBlowMs)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}

          {GAMES.some((g) => g.settings && Object.keys(g.settings).length) && (
            <section className={styles.section}>
              <h2>{t('parents.gameSettings')}</h2>
              {GAMES.filter((g) => g.settings && Object.keys(g.settings).length).map((g) => (
                <GameSettingsPanel key={g.id} game={g} stored={state.gameSettings[g.id]} />
              ))}
            </section>
          )}

          <div className={styles.parentsFoot}>
            <PaperButton onClick={() => navigate(-1)}>
              <ArrowIcon size={28} left />
              {t('common.back')}
            </PaperButton>
          </div>

          <span className={styles.muted} style={{ color: 'var(--paper)' }}>
            {t('parents.privacy')}
          </span>
        </div>
      </div>
    </Sky>
  );
}
