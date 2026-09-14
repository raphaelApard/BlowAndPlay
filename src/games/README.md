# Ajouter un jeu

Un jeu = un dossier dans `src/games/`, découvert automatiquement au build.

```
src/games/
  _template/        ← à copier (ignoré par le registre : préfixe `_`)
  _shared/          ← code commun aux jeux (voir ci-dessous)
  montgolfiere/
    index.ts        ← export default defineGame({...})
    Game.tsx        ← le composant du jeu
  ...
```

## Ce que `_shared/` fournit — à utiliser plutôt que recopier

| module | contenu |
| --- | --- |
| `math.ts` | `clamp01`, `seeded` (mulberry32), `lerp`, `mixHex`, `gameUnit(w,h)` (échelle du décor), `thumbUnit(w,h)` |
| `canvas.ts` | `INK` (encre des ombres), `cut()` (forme « papier découpé »), `setupCanvas()` (densité d'écran) |
| `stars.ts` | `starsForTime(elapsedMs, parMs)` — barème commun 3 / 2 / 1 étoiles |
| `CanvasThumbnail.tsx` | échafaudage d'une vignette : canvas, densité d'écran, redimensionnement |

Ces fonctions étaient recopiées dans chaque jeu ; elles n'ont plus qu'une
source. Un `draw.ts` de jeu les réexporte (`export { clamp01, seeded } from
'../_shared/math';`) pour que `Game.tsx`, `simulate.ts` et `Thumbnail.tsx`
gardent un seul point d'entrée : `./draw`.

En revanche, la **palette de couleurs** (`SKY_TOP`, `CORAL`…) et la fonction
`tuning(difficulty)` restent propres à chaque jeu : ce sont sa direction
artistique et sa courbe de difficulté, volontairement indépendantes.

## 1. Copier le template

```sh
cp -r src/games/_template src/games/mon-jeu
```

## 2. Décrire le jeu dans `index.ts`

```ts
export default defineGame({
  id: 'mon-jeu',          // stable : URL + progression
  title: { fr: 'Mon jeu', en: 'My game' },   // affiché à l'enfant, dans chaque langue
  description: { fr: '…', en: '…' }, // espace parents
  instruction: { fr: 'Souffle pour…', en: 'Blow to…' }, // bulle de la mascotte au lancement
  pattern: 'long',        // 'long' | 'bursts' | 'modulated' | 'free'
  accent: '#ffd93d',
  order: 40,
  levels: [{ id: '1', targetMs: 2000 }, { id: '2', targetMs: 4000 }],
  Game,                   // composant
  Thumbnail,              // optionnel
});
```

La vignette est toujours affichée via `<GameThumbnail game={…} />`
(`src/components/ui`) : carte d'aventure, onglet « Jeux », choix des jeux à la
création d'un enfant et liste des jeux de l'aventure côté parents passent tous
par là. Un jeu sans `Thumbnail` y reçoit automatiquement un placeholder — il
n'y a donc jamais de repli à écrire dans un écran.

Les niveaux étendent `LevelBase` avec les réglages propres au jeu :
c'est la seule chose que le shell ne connaît pas.

### Réglages parents propres au jeu (optionnel)

```ts
export const SETTINGS = {
  sensitivity: setting.range({ label: { fr: 'Sensibilité', en: 'Sensitivity' }, default: 1, min: 0.5, max: 2, step: 0.1, unit: '×' }),
  helper: setting.toggle({ label: { fr: 'Aide visuelle', en: 'Visual helper' }, default: true }),
  mode: setting.choice({ label: { fr: 'Mode', en: 'Mode' }, default: 'calme', options: [{ value: 'calme', label: { fr: 'Calme', en: 'Calm' } }, { value: 'vif', label: { fr: 'Vif', en: 'Lively' } }] }),
};
export default defineGame<MonNiveau, typeof SETTINGS>({ ..., settings: SETTINGS, Game });
```

L'espace parents affiche ces contrôles sous « Réglages des jeux », le
store les mémorise (`gameSettings[gameId]`), et le jeu les reçoit résolus
et typés dans `props.settings` (`SettingValues<typeof SETTINGS>`).

## 3. Écrire le composant `Game.tsx`

Il reçoit `GameProps<MonNiveau>` :

| prop | rôle |
| --- | --- |
| `level` | le niveau à jouer |
| `settings` | réglages parents du jeu, résolus (défaut si non modifiés) |
| `breath` | `BreathEngine` démarré et calibré |
| `width`, `height` | zone de jeu en px (suit le redimensionnement) |
| `paused` | geler le jeu (onglet caché) |
| `difficulty` | réglage parents global (1 → 10 côté parents), reçu ramené à 0 (facile) → 1 (difficile) ; à combiner avec le niveau |
| `onProgress(0..1)` | optionnel, alimente la jauge du HUD |
| `onComplete({ stars })` | **une seule fois**, à la fin du niveau |

Lire le souffle :

```ts
// À chaque frame (boucle canvas / rAF) :
useEffect(() => breath.subscribe((s) => { s.intensity /* 0..1 */; s.isBlowing; s.blowDurationMs }), [breath]);

// Événements discrets :
useEffect(() => breath.on((e) => { if (e.type === 'blowEnd') e.blow.durationMs; }), [breath]);

// En React, re-rendu chaque frame :
const { intensity } = useBreathState();
```

## Ce que le shell fait pour vous

- démarre le micro, force le calibrage si absent, met en pause quand l'onglet est caché ;
- HUD : bouton quitter, badge de niveau, bande de papier (intensité + progression) ;
- enregistre étoiles + statistiques de souffle dans la progression du profil ;
- enchaîne : en aventure, retour sur la map (animation vers l'étape suivante) ;
  depuis l'onglet Jeux (`?mode=free`), écran de récompense puis niveau suivant du jeu.

Le jeu ne doit **pas** : parler de médical, afficher du texte à l'enfant
(pictos, formes, couleurs), ni gérer la navigation.

## 4. Équilibrer la difficulté (`simulate.ts`)

Les jeux doivent demander le **même effort** à difficulté égale : un jeu
bien plus dur que les autres frustre l'enfant. Chaque jeu fournit donc une
simulation sans écran, jouée par « l'enfant type » (`src/games/balance/`) :

- `rules.ts` : la fonction `tuning(difficulty)` et les constantes de
  physique, partagées par `Game.tsx` et la simulation (une seule source) ;
- `simulate.ts` : la même boucle que le jeu, sans rendu, qui renvoie à
  chaque image ce que le jeu demande à l'enfant (`long`, `bursts`,
  `hold`, `rest`) et appelle `finish(elapsedMs, stars)` à la fin ;
- `index.ts` : `simulate` dans `defineGame({...})`.

`pnpm test` (ou `pnpm balance`) vérifie pour chaque difficulté 1 → 10 et
chaque niveau que l'enfant type finit tous les jeux, que le temps de souffle
demandé reste à ±50 % de la médiane des jeux (durée de partie à ±60 %), et
que l'effort monte avec la difficulté et d'un niveau au suivant. Le rapport
imprime le tableau complet (souffle, durée, étoiles). Un jeu sans
`simulate` fait échouer le test.

## Aventure

`src/adventure/path.ts` construit deux choses à partir du registre :

- **les étapes de la carte** (`ADVENTURE_PATH`) — une étape par jeu, dans
  l'ordre `order`, affichée avec la vignette du jeu (`GameThumbnail`) ;
- **l'ordre de déverrouillage** (`UNLOCK_ORDER`) — le niveau 1 de chaque jeu,
  puis le niveau 2, etc., pour que l'enfant rencontre tous les jeux avant
  d'en approfondir un.

Une étape est donc « terminée » quand tous ses niveaux sont réussis, et
« courante » quand elle contient le niveau courant. Un nouveau jeu apparaît
automatiquement dans l'aventure et dans l'onglet Jeux.
