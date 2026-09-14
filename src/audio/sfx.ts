import { getAppState } from '../store/store';

/**
 * Synthesized sound effects (Web Audio): no audio file to load, a "wooden
 * toy" timbre consistent with the cut-paper look. Each sound lasts less than
 * a second and stays gentle so as not to pollute the mic.
 *
 * The audio context is only created on the first gesture (see `unlockAudio`).
 */
export type SfxName =
  /** Press on a button. */
  | 'tap'
  /** Choice in a grid (mascot, colour). */
  | 'pop'
  /** Step passed in a game (island, bubble, cloud…). */
  | 'step'
  /** Gentle miss (popped bubble, impact). */
  | 'thud'
  /** End of calibration, a small success. */
  | 'success'
  /** A star appearing. */
  | 'star'
  /** Level finished. */
  | 'fanfare'
  /** Departure (balloon flying off, rocket). */
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

/** To be called on the first user gesture: browsers block audio before that. */
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

/** One note: oscillator + envelope, optionally a glissando. */
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
 * Mutes the sounds until the returned function is called. Used by the adult
 * area: the sound effects accompany the child's play, not the settings. The
 * counter (rather than a boolean) lets two muted screens overlap during a
 * transition without the first one to leave restoring the sound of the second.
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

/** Plays a sound (silent if sounds are off or audio is not unlocked yet). */
export function play(name: SfxName) {
  if (muted > 0 || !soundEnabled()) return;
  const c = getCtx();
  if (!c || !master || (!unlocked && c.state !== 'running')) return;
  try {
    SOUNDS[name](c, master, c.currentTime + 0.005);
  } catch {
    // no sound: never blocking
  }
}
