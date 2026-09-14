/**
 * Small numeric helpers shared by every game.
 *
 * They used to be copied identically into each `draw.ts`: a single source
 * prevents a game from drifting (a different `seeded` would change a game's
 * scenery and, as a knock-on effect, its balance).
 */

export function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * mulberry32 PRNG: pure and deterministic. Same seed = same scenery, which
 * makes the levels reproducible and the simulations comparable.
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

/** Mixes two `#rrggbb` colours (sky gradients, fades). */
export function mixHex(h1: string, h2: string, t: number) {
  const n = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const [r1, g1, b1] = n(h1);
  const [r2, g2, b2] = n(h2);
  const c = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  return `#${c(lerp(r1, r2, t))}${c(lerp(g1, g2, t))}${c(lerp(b1, b2, t))}`;
}

/**
 * Scenery scale factor: everything is drawn in "units" multiplied by `unit`,
 * so that the scene keeps its proportions from tablet to mobile.
 * `src/games/balance/types.ts` applies the same formula to the simulations'
 * reference screen — keep the two identical.
 */
export function gameUnit(width: number, height: number) {
  return Math.max(0.55, Math.min(width / 1000, height / 620));
}

/** Scale of a thumbnail (Games card), based on its smallest side. */
export function thumbUnit(width: number, height: number) {
  return Math.min(width, height) / 230;
}
