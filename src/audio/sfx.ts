import { getAppState } from '../store/store';

/**
 * Effets sonores synthétisés (Web Audio) : aucun fichier audio à charger,
 * timbre « jouet en bois » cohérent avec le papier découpé. Chaque son dure
 * moins d'une seconde et reste doux pour ne pas polluer le micro.
 *
 * Le contexte audio n'est créé qu'au premier geste (voir `unlockAudio`).
 */
export type SfxName =
  /** Appui sur un bouton. */
  | 'tap'
  /** Choix dans une grille (mascotte, couleur). */
  | 'pop'
  /** Étape réussie dans un jeu (île, bulle, nuage…). */
  | 'step'
  /** Raté doux (bulle éclatée, choc). */
  | 'thud'
  /** Fin de calibrage, petite réussite. */
  | 'success'
  /** Étoile qui apparaît. */
  | 'star'
  /** Niveau terminé. */
  | 'fanfare'
  /** Départ (ballon qui vole, fusée). */
  | 'whoosh';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let unlocked = false;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  return ctx;
}

/** À appeler sur le premier geste utilisateur : les navigateurs bloquent l'audio avant. */
export function unlockAudio() {
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  unlocked = true;
}

export function soundEnabled(): boolean {
  return getAppState().settings.sound;
}

type Wave = OscillatorType;

/** Une note : oscillateur + enveloppe, éventuellement glissando. */
function tone(c: AudioContext, out: AudioNode, opts: { freq: number; to?: number; wave?: Wave; at: number; dur: number; gain: number; attack?: number }) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = opts.wave ?? 'sine';
  o.frequency.setValueAtTime(opts.freq, opts.at);
  if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, opts.at + opts.dur);
  g.gain.setValueAtTime(0.0001, opts.at);
  g.gain.exponentialRampToValueAtTime(opts.gain, opts.at + (opts.attack ?? 0.008));
  g.gain.exponentialRampToValueAtTime(0.0001, opts.at + opts.dur);
  o.connect(g).connect(out);
  o.start(opts.at);
  o.stop(opts.at + opts.dur + 0.05);
}

let noiseBuf: AudioBuffer | null = null;
function noise(c: AudioContext, out: AudioNode, opts: { at: number; dur: number; gain: number; from: number; to: number; q?: number }) {
  if (!noiseBuf || noiseBuf.sampleRate !== c.sampleRate) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = opts.q ?? 1;
  f.frequency.setValueAtTime(opts.from, opts.at);
  f.frequency.exponentialRampToValueAtTime(opts.to, opts.at + opts.dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, opts.at);
  g.gain.exponentialRampToValueAtTime(opts.gain, opts.at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, opts.at + opts.dur);
  src.connect(f).connect(g).connect(out);
  src.start(opts.at);
  src.stop(opts.at + opts.dur + 0.05);
}

const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;

const SOUNDS: Record<SfxName, (c: AudioContext, out: AudioNode, t: number) => void> = {
  tap: (c, o, t) => tone(c, o, { freq: 620, to: 420, wave: 'triangle', at: t, dur: 0.09, gain: 0.35 }),
  pop: (c, o, t) => {
    tone(c, o, { freq: 320, to: 900, wave: 'sine', at: t, dur: 0.08, gain: 0.4 });
    noise(c, o, { at: t, dur: 0.06, gain: 0.15, from: 1200, to: 3000 });
  },
  step: (c, o, t) => {
    tone(c, o, { freq: E5, wave: 'triangle', at: t, dur: 0.14, gain: 0.35 });
    tone(c, o, { freq: G5, wave: 'triangle', at: t + 0.09, dur: 0.22, gain: 0.35 });
  },
  thud: (c, o, t) => {
    tone(c, o, { freq: 180, to: 60, wave: 'sine', at: t, dur: 0.18, gain: 0.5, attack: 0.004 });
    noise(c, o, { at: t, dur: 0.12, gain: 0.2, from: 900, to: 200 });
  },
  success: (c, o, t) => {
    tone(c, o, { freq: C5, wave: 'triangle', at: t, dur: 0.16, gain: 0.35 });
    tone(c, o, { freq: E5, wave: 'triangle', at: t + 0.1, dur: 0.16, gain: 0.35 });
    tone(c, o, { freq: G5, wave: 'triangle', at: t + 0.2, dur: 0.32, gain: 0.35 });
  },
  star: (c, o, t) => {
    tone(c, o, { freq: C6, wave: 'sine', at: t, dur: 0.35, gain: 0.3 });
    tone(c, o, { freq: C6 * 2, wave: 'sine', at: t + 0.02, dur: 0.25, gain: 0.12 });
  },
  fanfare: (c, o, t) => {
    const notes = [C5, E5, G5, C6];
    notes.forEach((f, i) => {
      tone(c, o, { freq: f, wave: 'triangle', at: t + i * 0.13, dur: i === notes.length - 1 ? 0.6 : 0.18, gain: 0.35 });
      tone(c, o, { freq: f / 2, wave: 'sine', at: t + i * 0.13, dur: i === notes.length - 1 ? 0.6 : 0.18, gain: 0.18 });
    });
  },
  whoosh: (c, o, t) => noise(c, o, { at: t, dur: 0.5, gain: 0.3, from: 300, to: 2400, q: 0.8 }),
};

let muted = 0;

/**
 * Coupe les sons tant que la fonction rendue n'est pas appelée. Utilisé par
 * l'espace adulte : les bruitages accompagnent le jeu de l'enfant, pas les
 * réglages. Le compteur (plutôt qu'un booléen) laisse deux écrans muets se
 * chevaucher pendant une transition sans que le premier à partir rétablisse
 * le son du second.
 */
export function muteSfx(): () => void {
  muted++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    muted--;
  };
}

/** Joue un son (silencieux si les sons sont coupés ou l'audio pas encore débloqué). */
export function play(name: SfxName) {
  if (muted > 0 || !soundEnabled()) return;
  const c = getCtx();
  if (!c || !master || (!unlocked && c.state !== 'running')) return;
  try {
    SOUNDS[name](c, master, c.currentTime + 0.005);
  } catch {
    // pas de son : jamais bloquant
  }
}
