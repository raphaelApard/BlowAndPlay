/**
 * Petites fonctions numériques partagées par tous les jeux.
 *
 * Elles étaient recopiées à l'identique dans chaque `draw.ts` : une seule
 * source évite qu'un jeu dérive (un `seeded` différent changerait le décor
 * d'un jeu et, par ricochet, son équilibrage).
 */

export function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * PRNG mulberry32 : rendu pur et déterministe. Même graine = même décor,
 * ce qui rend les niveaux reproductibles et les simulations comparables.
 */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Mélange deux couleurs `#rrggbb` (dégradés de ciel, fondus). */
export function mixHex(h1: string, h2: string, t: number) {
  const n = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const [r1, g1, b1] = n(h1);
  const [r2, g2, b2] = n(h2);
  const c = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  return `#${c(lerp(r1, r2, t))}${c(lerp(g1, g2, t))}${c(lerp(b1, b2, t))}`;
}

/**
 * Facteur d'échelle du décor : tout se dessine en « unités » multipliées par
 * `unit`, pour que la scène garde ses proportions de la tablette au mobile.
 * `src/games/balance/types.ts` applique la même formule à l'écran de
 * référence des simulations — garder les deux identiques.
 */
export function gameUnit(width: number, height: number) {
  return Math.max(0.55, Math.min(width / 1000, height / 620));
}

/** Échelle d'une vignette (carte « Jeux »), calée sur son plus petit côté. */
export function thumbUnit(width: number, height: number) {
  return Math.min(width, height) / 230;
}
