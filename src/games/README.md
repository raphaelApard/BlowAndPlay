# Adding a game

A game = a folder in `src/games/`, discovered automatically at build time.

```
src/games/
  _template/        ← to copy (ignored by the registry: `_` prefix)
  _shared/          ← code common to all games (see below)
  montgolfiere/
    index.ts        ← export default defineGame({...})
    Game.tsx        ← the game component
  ...
```

## What `_shared/` provides — use it rather than copying

| module | contents |
| --- | --- |
| `math.ts` | `clamp01`, `seeded` (mulberry32), `lerp`, `mixHex`, `gameUnit(w,h)` (scenery scale), `thumbUnit(w,h)` |
| `canvas.ts` | `INK` (shadow ink), `cut()` (the "cut paper" shape), `setupCanvas()` (screen density) |
| `stars.ts` | `starsForTime(elapsedMs, parMs)` — the common 3 / 2 / 1 star scale |
| `CanvasThumbnail.tsx` | scaffolding for a thumbnail: canvas, screen density, resizing |

These functions used to be copied into each game; they now have a single
source. A game's `draw.ts` re-exports them (`export { clamp01, seeded } from
'../_shared/math';`) so that `Game.tsx`, `simulate.ts` and `Thumbnail.tsx`
keep a single entry point: `./draw`.

The **colour palette** (`SKY_TOP`, `CORAL`…) and the `tuning(difficulty)`
function, on the other hand, stay specific to each game: they are its art
direction and its difficulty curve, deliberately independent.

## 1. Copy the template

```sh
cp -r src/games/_template src/games/my-game
```

## 2. Describe the game in `index.ts`

```ts
export default defineGame({
  id: 'my-game',          // stable: URL + progress
  title: { fr: 'Mon jeu', en: 'My game' },   // shown to the child, in each language
  description: { fr: '…', en: '…' }, // parents area
  instruction: { fr: 'Souffle pour…', en: 'Blow to…' }, // mascot speech bubble at launch
  pattern: 'long',        // 'long' | 'bursts' | 'modulated' | 'free'
  accent: '#ffd93d',
  order: 40,
  levels: [{ id: '1', targetMs: 2000 }, { id: '2', targetMs: 4000 }],
  Game,                   // component
  Thumbnail,              // optional
});
```

The thumbnail is always displayed via `<GameThumbnail game={…} />`
(`src/components/ui`): the adventure map, the Games tab, the game picker when
creating a child and the parents-side list of adventure games all go through
it. A game with no `Thumbnail` automatically gets a placeholder there — so
there is never a fallback to write in a screen.

Levels extend `LevelBase` with the game's own settings: that is the only
thing the shell does not know about.

### Game-specific parents settings (optional)

```ts
export const SETTINGS = {
  sensitivity: setting.range({ label: { fr: 'Sensibilité', en: 'Sensitivity' }, default: 1, min: 0.5, max: 2, step: 0.1, unit: '×' }),
  helper: setting.toggle({ label: { fr: 'Aide visuelle', en: 'Visual helper' }, default: true }),
  mode: setting.choice({ label: { fr: 'Mode', en: 'Mode' }, default: 'calme', options: [{ value: 'calme', label: { fr: 'Calme', en: 'Calm' } }, { value: 'vif', label: { fr: 'Vif', en: 'Lively' } }] }),
};
export default defineGame<MyLevel, typeof SETTINGS>({ ..., settings: SETTINGS, Game });
```

The parents area shows these controls under "Réglages des jeux", the store
remembers them (`gameSettings[gameId]`), and the game receives them resolved
and typed in `props.settings` (`SettingValues<typeof SETTINGS>`).

## 3. Write the `Game.tsx` component

It receives `GameProps<MyLevel>`:

| prop | role |
| --- | --- |
| `level` | the level to play |
| `settings` | the game's parents settings, resolved (defaults if untouched) |
| `breath` | a started, calibrated `BreathEngine` |
| `width`, `height` | play area in px (follows resizing) |
| `paused` | freeze the game (tab hidden) |
| `difficulty` | the global parents setting (1 → 10 on the parents side), received scaled to 0 (easy) → 1 (hard); combine it with the level |
| `onProgress(0..1)` | optional, feeds the HUD gauge |
| `onComplete({ stars })` | **exactly once**, at the end of the level |

Reading the breath:

```ts
// Every frame (canvas / rAF loop):
useEffect(() => breath.subscribe((s) => { s.intensity /* 0..1 */; s.isBlowing; s.blowDurationMs }), [breath]);

// Discrete events:
useEffect(() => breath.on((e) => { if (e.type === 'blowEnd') e.blow.durationMs; }), [breath]);

// In React, re-renders every frame:
const { intensity } = useBreathState();
```

## What the shell does for you

- starts the mic, forces calibration if missing, pauses when the tab is hidden;
- HUD: quit button, level badge, paper strip (intensity + progress);
- records stars + breath statistics in the profile's progress;
- chains: in adventure mode, back to the map (animation towards the next step);
  from the Games tab (`?mode=free`), back to the list, which celebrates there.

A game must **not**: mention anything medical, show text to the child
(use pictos, shapes, colours), or handle navigation.

## 4. Balancing the difficulty (`simulate.ts`)

Games must demand the **same effort** at equal difficulty: a game much harder
than the others frustrates the child. Each game therefore provides a headless
simulation, played by the "typical child" (`src/games/balance/`):

- `rules.ts`: the `tuning(difficulty)` function and the physics constants,
  shared by `Game.tsx` and the simulation (a single source);
- `simulate.ts`: the same loop as the game, without rendering, returning on
  each frame what the game asks of the child (`long`, `bursts`, `hold`,
  `rest`) and calling `finish(elapsedMs, stars)` at the end;
- `index.ts`: `simulate` in `defineGame({...})`.

`pnpm test` (or `pnpm balance`) checks, for each difficulty 1 → 10 and each
level, that the typical child finishes every game, that the breath time
required stays within ±50 % of the cross-game median (game duration within
±60 %), and that effort rises with difficulty and from one level to the next.
The report prints the full table (breath, duration, stars). A game without
`simulate` makes the test fail.

## Adventure

`src/adventure/path.ts` builds two things from the registry:

- **the map steps** (`ADVENTURE_PATH`) — one step per game, in `order` order,
  displayed with the game's thumbnail (`GameThumbnail`);
- **the unlock order** (`UNLOCK_ORDER`) — level 1 of every game, then level 2,
  and so on, so that the child meets every game before going deeper into one.

A step is therefore "complete" when all its levels are passed, and "current"
when it contains the current level. A new game appears automatically in the
adventure and in the Games tab.
