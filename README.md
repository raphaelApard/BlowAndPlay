# Souffle Aventure

Plateforme de jeux thérapeutiques au souffle pour enfants de 3 à 6 ans.
Tablette paysage (1024×640) en priorité, mobile portrait pris en charge.
Design : piste « Papier découpé » (Claude Design, `Souffle Aventure.dc.html`).

```sh
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # tsc + vite → dist/
pnpm lint
pnpm test       # vitest : équilibrage de la difficulté entre les jeux
```

## Parcours

Accueil (profil) → Calibrage (chaque session, ~5 s)
→ Map aventure → Partie → retour sur la map (étoiles + ballon qui vole à
l'étape suivante). Onglet Jeux → Partie (`?mode=free`) → Récompense → niveau
suivant du même jeu.

## Architecture

```
src/
  breath/      moteur de souffle (micro Web Audio, secours clavier/doigt, calibrage, événements)
  games/       ← AJOUTER UN JEU ICI — voir src/games/README.md
  adventure/   construction du chemin de l'aventure à partir du registre
  store/       profils, progression, sessions (localStorage, useSyncExternalStore)
  components/  ui (kit papier découpé) · game (GameShell : HUD, stats, résultat)
  screens/     un fichier par écran
  styles/      tokens.css (palette, ombres, typo) · global.css
```

### Ajouter un jeu

1. `cp -r src/games/_template src/games/mon-jeu`
2. Renseigner `index.ts` (`defineGame({...})`) et écrire `Game.tsx`.
3. C'est tout : le registre (`import.meta.glob`) le découvre, l'onglet Jeux
   et la map aventure l'intègrent, la progression et l'espace parents suivent.

Détails du contrat (`GameProps`, souffle, niveaux) : `src/games/README.md`.

Jeux :

- **Souffle-Fusée** (`src/games/souffle-fusee/`) — premier vrai jeu, importé
  des designs « Souffle-Fusée » et « Blast Off - Screens ». Rendu DOM piloté
  par refs dans une boucle rAF ; 3 niveaux (altitude de base, temps de
  référence pour les étoiles). Fin de partie : atterrissage sur la Lune
  ronde, puis fête (tour de la Lune avec traînée, anneaux, confettis) avant
  l'écran de récompense.
- **Bulles de savon** (`src/games/bulles-de-savon/`) — canvas 2D. Un souffle
  long et régulier gonfle une bulle à la baguette ; les variations la font
  trembler et ralentissent sa croissance, un souffle trop fort (au-dessus du
  seuil, 250 ms) la fait éclater, et l'arrêt du souffle la détache. Les bulles
  qui atteignent le cercle cible vont se ranger en haut à droite ; à la fin
  elles éclatent en confettis. 3 niveaux (1,5 / 2,5 / 3,5 s de souffle, 3 / 4 /
  5 bulles) ; étoiles : 3 sans bulle éclatée, 2 jusqu'à deux, sinon 1.
- **Bateau Pirate** (`src/games/bateau-pirate/`) — carte au trésor sur
  canvas 2D (`draw.ts` partagé avec la vignette). Chaque souffle gonfle la
  voile et pousse le bateau le long d'une route en pointillés qui passe sous
  les îles ; il glisse, ralentit, s'amarre devant chaque île (drapeau planté)
  et la fête commence au coffre (pièces, anneaux). 3 niveaux (3, 4, 5 îles).
- **Montgolfière** (`src/games/montgolfiere/`) — défilement horizontal sur
  canvas 2D. Un souffle soutenu allume le brûleur et fait décoller ; le ballon
  avance ensuite tout seul près du sol et chaque souffle le fait monter pour
  survoler arbres, rochers, maisons et tours. Les chocs secouent l'obstacle et
  coûtent des étoiles (3 sans choc, 2 jusqu'à deux chocs, sinon 1). Arrivée :
  descente sur la plateforme, drapeau hissé, confettis. 3 niveaux (6, 9, 12
  obstacles).
- **Pousse-nuages** (`src/games/pousse-nuages/`) — canvas 2D. Le soleil
  boude derrière un nuage grognon (quatre silhouettes et six couleurs qui
  tournent) ; chaque souffle pousse le nuage vers la
  droite, il glisse puis revient doucement vers le soleil (selon la
  difficulté). Un souffle long s'essouffle (pleine poussée jusqu'à 0,7 s puis
  décroissante) : ce sont les souffles courts répétés qui marchent. Nuage
  chassé → une fleur éclot, le suivant arrive ; à la fin, grand soleil
  souriant et pluie de pétales. 3 niveaux (3, 5, 8 nuages), étoiles au temps.
- **Cerf-volant** (`src/games/cerf-volant/`) — canvas 2D. L'altitude du
  cerf-volant suit la force du souffle (doux = bas, fort = haut) avec un peu
  d'inertie. Une bande de vent arc-en-ciel montre la zone à tenir ; un anneau
  autour du cerf-volant se remplit tant qu'il y reste (et s'érode doucement
  dehors), des étoiles y filent et se cueillent. Zone tenue → la bande change
  d'altitude ; à la fin, le cerf-volant monte tout en haut sous les confettis.
  3 niveaux (bande 0,5 / 0,35 / 0,25, tenue 3 / 4 / 5 s, 3 / 3 / 4 cibles),
  étoiles selon l'efficacité (temps dans la zone / temps total).
- **Feuilles d'automne** (`src/games/feuilles-d-automne/`) — canvas 2D,
  souffle libre. Un hérisson suit un chemin sinueux vers son terrier au pied
  d'un arbre ; des tas de feuilles le bloquent. Tout souffle envoie les
  feuilles voler (à raison de l'intensité) ; tas dégagé, il repart. Arrivé,
  il entre, la fenêtre s'allume, des cœurs montent. 3 niveaux (3 / 5 / 7 tas
  de 12 / 14 / 16 feuilles), étoiles selon le temps.

### Souffle

- `MicBreathSource` : RMS après passe-bas 1,2 kHz, ~60 Hz.
- `KeyboardBreathSource` : Espace ou doigt maintenu (dev / sans micro).
- `BreathEngine` : normalisation par calibrage (bruit ambiant / souffle max),
  lissage attaque/relâche, hystérésis → `blowStart` / `blowEnd`.
- Le choix de source et du micro (liste des entrées audio, suivi des
  branchements) est dans l'espace parents (appui long sur le bouton en bas
  à gauche). Le micro choisi est mémorisé (`settings.micDeviceId`) ; s'il
  est débranché, on retombe sur le micro par défaut.

### Difficulté globale

Réglage parents (1 = facile → 10 = difficile), stocké dans `settings.difficulty`
et transmis à chaque jeu via `GameProps.difficulty` (0..1). Chaque jeu
l'interprète avec ses propres réglages de niveau (fonction `tuning` de son
`rules.ts`). Souffle-Fusée : distance à la Lune ×1 → ×2 et gravité 0,05 →
0,15. Bateau Pirate : poussée de chaque souffle ÷1 → ÷1,8 et freinage 0,975 →
0,955 par frame. Montgolfière : obstacles ×1 → ×2,5 plus nombreux, ×1,15 →
×1,85 plus hauts, plus serrés (vitesse fixe). Pousse-nuages : poussée ÷1 → ÷2
et retour du nuage vers le soleil 0 → 0,1 px/frame. Cerf-volant : bande ×1 →
×0,6 et tenue ×1 → ×1,5. Bulles de savon : souffle ×1 → ×1,6 et seuil « trop
fort » 0,95 → 0,8. Moulin à vent : tolérance ×1 → ×0,65 et tenue ×1 → ×1,7.
Feuilles d'automne : feuilles par tas ×1 → ×2,2.

Ces réglages sont **équilibrés entre les jeux** : `pnpm test` simule chaque
niveau de chaque jeu à chaque difficulté avec un « enfant type »
(`src/games/balance/`) et vérifie que le temps de souffle demandé reste
comparable d'un jeu à l'autre, et monte avec la difficulté. Voir
`src/games/README.md` § 4.

### Réglages parents par jeu

Un jeu peut déclarer ses propres réglages (`GameDefinition.settings`,
helpers `setting.range / toggle / choice`). Ils apparaissent dans l'espace
parents sous « Réglages des jeux », sont mémorisés dans
`gameSettings[gameId]` et arrivent typés dans `GameProps.settings`.
Exemple dans `src/games/_template`. Souffle-Fusée n'en déclare pas : il ne
dépend que de la difficulté globale.

### Données

Tout reste sur l'appareil (`localStorage`, clé `souffle-aventure:v1`).
Aucune donnée médicale ; l'espace parents montre étoiles, nombre et
durée des souffles par partie.

## Déploiement

SPA statique : `vercel.json` réécrit toutes les routes vers `index.html`.
