# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Souffle Aventure" — breath-controlled (microphone) therapeutic games for children aged 3–6.
UI language is French/English; **the code, comments and docs are written in English** — match that when editing.
Identifiers that are also user-facing names or paths (game ids and folders like `souffle-fusee`,
i18n FR dictionary values, `{ fr, en }` data) stay as they are — renaming them breaks the UI, the
registry and saved progress.
Tablet landscape (1024×640) first, mobile portrait supported. No backend: everything lives in `localStorage`.

## Commands

```sh
pnpm dev        # vite dev server, http://localhost:5173
pnpm build      # tsc -b && vite build → dist/
pnpm lint       # oxlint (not eslint)
pnpm test       # vitest run — the cross-game difficulty balance suite
pnpm balance    # same suite only, dot reporter
```

Single test file / name:

```sh
pnpm vitest run src/games/balance/balance.test.ts
pnpm vitest run -t "cerf-volant"
pnpm vitest run src/games/balance --silent=false --reporter=verbose   # prints the full balance table
```

`vitest.config.ts` only picks up `src/**/*.test.ts`; the balance suite is currently the only test file.

## Architecture

```
src/
  breath/      breath engine (Web Audio mic, keyboard/finger fallback, calibration, events)
  games/       one folder per game — auto-discovered; see src/games/README.md
  adventure/   builds the adventure path from the registry
  store/       profiles, progress, sessions (localStorage + useSyncExternalStore)
  components/  ui/ (cut-paper kit) · game/ (GameShell: HUD, stats, result)
  screens/     one file per screen
  i18n/        FR/EN dictionaries + useT()
  mascots/     10 sticker characters, markup injected as HTML strings
  audio/       8 Web-Audio-synthesized sounds (no audio assets)
```

Routes (`src/App.tsx`): `/` → `/calibration` → `/map` | `/games` → `/play/:gameId/:levelId` → back to `/map` or `/games`.
Every route except `/` and `/parents` requires a selected profile.

### Games are a plugin system — this is the core design

The user's explicit constraint: **build the system for adding games, don't restructure the shell.**

`src/games/registry.ts` eagerly `import.meta.glob`s `./*/index.ts`. Any folder exporting a default
`defineGame({...})` is registered at build time; folders prefixed `_` (`_template`, `_shared`) are skipped.
The registry validates ids and level ids and **throws at load** on duplicates or empty levels.
Adding a folder is all it takes — the Games tab, the adventure map (`src/adventure/path.ts` interleaves
level 1 of every game, then level 2…, ordered by `order`), progress and the parents area all follow.

To add a game: `cp -r src/games/_template src/games/my-game`, then fill `index.ts` and write `Game.tsx`.
Read `src/games/README.md` for the full contract before doing this.

A game folder holds:

| file | role |
| --- | --- |
| `index.ts` | `defineGame({...})` — id, `{fr,en}` title/description/instruction, pattern, accent, order, levels, optional parent settings |
| `Game.tsx` | the game itself, receives `GameProps<L>` |
| `rules.ts` | `tuning(difficulty)` + physics constants — **single source shared by `Game.tsx` and `simulate.ts`** |
| `simulate.ts` | headless replay of the same loop, used by the balance suite |
| `draw.ts` | canvas drawing, usually shared with `Thumbnail.tsx` |

Levels extend `LevelBase` with per-game fields — the only thing the shell doesn't know about.
`GameShell` gives the game a started, calibrated `breath` engine, the measured `width`/`height`,
`paused`, `difficulty` (0..1), and expects exactly one `onComplete({ stars })`.
A game must **not** navigate, show text to the child (use pictos/shapes/colours), or mention anything medical.

Most games are canvas 2D driven by a rAF loop reading `breath.getState().intensity`;
Souffle-Fusée is the exception (DOM driven by refs).

### Breath

`BreathEngine` normalizes a source's raw level against the calibration, smooths it (attack/release),
and applies hysteresis to emit `blowStart`/`blowEnd`. Two consumption styles:
`subscribe(cb)` per frame for canvas loops, `on(cb)` for discrete blows; `useBreathState()` in React
(re-renders every frame — avoid in game loops).

Sources: `MicBreathSource` (RMS after a 1.2 kHz low-pass, ~60 Hz) and `KeyboardBreathSource`
(Space or held finger — the dev path when there's no mic). Source and mic device are chosen in the
parents area and remembered in `settings`.

Calibration lives **in memory only** (silence phase + blow phase → `computeCalibration`). A full page
reload loses it and the shell redirects to `/calibration` — this matters when driving the app in a browser.

### Difficulty balance — do not break this

Global difficulty is an integer 1–10 (default 5) in `settings.difficulty`, converted by
`difficultyToUnit` to the 0..1 `GameProps.difficulty` each game receives. Old 0–100 saves are migrated
by `migrateDifficulty`.

Games must demand **comparable effort at equal difficulty** — the user's requirement, because a game much
harder than the others frustrates the child. Every game therefore ships `simulate.ts`, replaying its loop
against the shared "typical child" model (`TYPICAL_CHILD` in `src/games/balance/child.ts`, a yardstick,
not a real child) and
returning per-frame intent (`long` / `bursts` / `hold` / `rest`).

`pnpm balance` simulates 7 games × 3 levels × 10 difficulties = 210 runs and asserts:

- every level finishable at every difficulty;
- blow time within ±50 % of the cross-game median, game duration within ±60 %;
- effort monotonic with difficulty (d10 ≥ 1.3× d1, never dropping below 0.95× the previous step) and
  rising from one level to the next.

A game without `simulate` fails the suite. The report test derives the run count from the registry and
asserts the number of games separately — **update that number when adding or removing a game.** When
retuning, change `rules.ts` / levels and re-run; never tune the child model to make one game pass.

Alongside the balance suite, `src/**/*.test.ts` covers the store, the adventure path, the breath engine,
the game contract (data-driven over the registry, so a new game is checked automatically), each game's
`tuning` endpoints, i18n and the shared helpers. There is no DOM test environment: components and screens
are untested until jsdom + testing-library are added.

### Store

Single module-level state in `src/store/store.ts`, persisted to `localStorage['souffle-aventure:v1']`,
exposed via `useSyncExternalStore`. Mutations go through `actions.*`; reads through the `select*` helpers.
Writes are wrapped in try/catch so private browsing degrades to memory only.

### i18n

All UI text goes through `src/i18n/`: `const { t, tr } = useT()`. FR is the reference dictionary in
`strings.ts` and EN must define every key (enforced by the type). Data-provided text — game
`title`/`description`/`instruction`, setting labels — are `{ fr, en }` objects read with `tr()`.
Mascot EN text lives in `mascots.en.ts` because `mascots.data.ts` is generated.
`settings.lang = null` means follow the browser.

### Audio

No audio assets: `src/audio/sfx.ts` synthesizes 8 sounds with Web Audio, unlocked on the first gesture
by `AudioUnlock` in `App.tsx` and gated by `settings.sound`.
**No voice** — Web Speech was tried and removed at the user's request; if it returns, the agreed path is
pre-recorded clips per game and language, not runtime TTS.

## Conventions

- `verbatimModuleSyntax` is on — use `import type` for type-only imports.
- `noUnusedLocals` / `noUnusedParameters` are on: `pnpm build` fails on unused code that `pnpm dev` tolerates.
- CSS modules per component/game, design tokens in `src/styles/tokens.css` (cut-paper look: flat colours,
  hard offset shadows, Lilita One + Nunito).
- Deployment is a static SPA; `vercel.json` rewrites all routes to `index.html`.
