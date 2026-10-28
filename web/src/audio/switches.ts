export type SwitchProfile = 'linear' | 'tactile' | 'clicky';

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let noise: AudioBuffer | null = null;
let muted = false;
let selected: SwitchProfile = 'linear';

/** The profile every key press plays (picked in the Sound section). */
export const selectedSwitch = () => selected;
export const selectSwitch = (p: SwitchProfile) => void (selected = p);
export const isMuted = () => muted;
export const setMuted = (m: boolean) => void (muted = m);

/**
 * Creates and resumes the audio context. Call it from a user gesture (click, key press): browsers keep
 * audio locked until then, and until it runs once `playSwitch` stays silent.
 */
export async function ensureAudio(): Promise<void> {
  const AC = globalThis.AudioContext;
  if (!AC) return;
  try {
    if (!ctx) {
      const c = new AC();
      out = c.createGain();
      out.gain.value = 0.55;
      out.connect(c.destination);
      // Half a second of white noise; each press reads it from a random offset so no two sound alike.
      noise = c.createBuffer(1, Math.ceil(c.sampleRate * 0.5), c.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      ctx = c;
    }
    if (ctx.state !== 'running') await ctx.resume();
  } catch {
    // No audio device or the browser refused: the site stays silent.
  }
}

function envelope(c: AudioContext, t: number, dur: number, level: number) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(level, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  return g;
}

function burst(c: AudioContext, t: number, dur: number, type: BiquadFilterType, freq: number, q: number, level: number) {
  const src = c.createBufferSource();
  src.buffer = noise;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  src.connect(f).connect(envelope(c, t, dur, level)).connect(out!);
  src.start(t, Math.random() * 0.38);
  src.stop(t + dur);
}

function tone(c: AudioContext, t: number, dur: number, type: OscillatorType, freq: number, level: number, drop = 1) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * drop, t + dur);
  o.connect(envelope(c, t, dur, level)).connect(out!);
  o.start(t);
  o.stop(t + dur);
}

/**
 * One key press, synthesised. Linear: a low "thock" (90 ms filtered noise burst + a 180 Hz body);
 * tactile: a 30 ms bump just before it; clicky: a 2.8 kHz, 12 ms click on top. `pitch` scales every frequency.
 */
export function playSwitch(profile: SwitchProfile, { pitch = 1 }: { pitch?: number } = {}): void {
  const c = ctx;
  if (!c || !out || !noise || muted) return;
  const t = c.currentTime + 0.004;
  const bottom = profile === 'tactile' ? t + 0.024 : t; // the bump comes before bottom-out
  if (profile === 'tactile') burst(c, t, 0.03, 'bandpass', 560 * pitch, 1.4, 0.4);
  burst(c, bottom, 0.09, 'lowpass', 1300 * pitch, 0.8, 0.9);
  tone(c, bottom, 0.09, 'sine', 180 * pitch, 0.55, 0.72);
  if (profile === 'clicky') tone(c, t, 0.012, 'triangle', 2800 * pitch, 0.32);
}

/** A slight random pitch per press, so fast typing does not sound like a loop. */
export const pressPitch = () => 0.95 + Math.random() * 0.1;
