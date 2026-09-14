import type { BreathSource, Calibration } from './types';

/**
 * Source micro : RMS du signal après un passe-bas (le souffle sur un micro
 * est un bruit large bande, dominé par les basses fréquences).
 */
export class MicBreathSource implements BreathSource {
  readonly kind = 'mic' as const;
  readonly defaultCalibration: Calibration = { noiseFloor: 0.01, peak: 0.25 };

  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private buffer: Float32Array<ArrayBuffer> | null = null;
  private raf = 0;
  private readonly listeners = new Set<(level: number) => void>();

  /** Micro à utiliser ; null = défaut système. */
  readonly deviceId: string | null;

  constructor(deviceId: string | null = null) {
    this.deviceId = deviceId;
  }

  async start(): Promise<void> {
    if (this.ctx) return;
    const base: MediaTrackConstraints = {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    };
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: this.deviceId ? { ...base, deviceId: { exact: this.deviceId } } : base,
      });
    } catch (e) {
      // Micro choisi débranché ou inconnu : on retombe sur le défaut.
      if (!this.deviceId || (e instanceof DOMException && e.name === 'NotAllowedError')) throw e;
      stream = await navigator.mediaDevices.getUserMedia({ audio: base });
    }
    const ctx = new AudioContext();
    await ctx.resume();

    const input = ctx.createMediaStreamSource(stream);
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 1200;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0;
    input.connect(lowpass).connect(analyser);

    this.ctx = ctx;
    this.stream = stream;
    this.analyser = analyser;
    this.buffer = new Float32Array(analyser.fftSize);

    const tick = () => {
      if (!this.analyser || !this.buffer) return;
      this.analyser.getFloatTimeDomainData(this.buffer);
      let sum = 0;
      for (let i = 0; i < this.buffer.length; i++) sum += this.buffer[i] * this.buffer[i];
      const rms = Math.sqrt(sum / this.buffer.length);
      for (const cb of this.listeners) cb(rms);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close();
    this.ctx = null;
    this.stream = null;
    this.analyser = null;
    this.buffer = null;
  }

  onLevel(cb: (level: number) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
}

export interface Microphone {
  deviceId: string;
  label: string;
}

/**
 * Liste les micros disponibles. Les libellés ne sont fournis qu'une fois la
 * permission accordée : on ouvre brièvement un flux si nécessaire.
 */
export async function listMicrophones(): Promise<Microphone[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  let devices = await navigator.mediaDevices.enumerateDevices();
  const unlabeled = devices.some((d) => d.kind === 'audioinput' && !d.label);
  if (unlabeled) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      devices = await navigator.mediaDevices.enumerateDevices();
    } catch {
      // permission refusée : on renvoie ce qu'on a
    }
  }
  return devices
    .filter((d) => d.kind === 'audioinput' && d.deviceId && d.deviceId !== 'default')
    .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Micro ${i + 1}` }));
}
