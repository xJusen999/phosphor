export type SwitchProfile = 'linear' | 'tactile' | 'clicky';

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let noise: AudioBuffer | null = null;
let muted = false;
let selected: SwitchProfile = 'linear';
// True between a gesture's resume() call and the press it triggers: that one press may schedule on the
// still-suspended clock (it plays as the context wakes); any other press on a suspended context is dropped.
let primed = false;

/** The profile every key press plays (picked in the Sound section). */
export const selectedSwitch = () => selected;
export const selectSwitch = (p: SwitchProfile) => void (selected = p);
export const isMuted = () => muted;
export const setMuted = (m: boolean) => void (muted = m);

/**
 * Creates and resumes the audio context. Call it from a user gesture (click, key press): browsers keep
 * audio locked until then, and until it runs once `playSwitch` stays silent. Events that do not activate
 * the page (Escape, a touch pointerdown) are ignored, so they never leave a suspended context behind.
 */
export async function ensureAudio(): Promise<void> {
  const AC = globalThis.AudioContext;
  if (!AC) return;
  const activation = (globalThis.navigator as Navigator | undefined)?.userActivation;
  if (activation && !activation.isActive) return;
  try {
    if (!ctx) {
      const c = new AC();
      out = c.createGain();
      out.gain.value = 0.45;
      // Headroom: overlapping presses (fast typing) are squeezed by a limiter instead of clipping.
      const limiter = c.createDynamicsCompressor();
      limiter.threshold.value = -10;
      limiter.knee.value = 6;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.002;
      limiter.release.value = 0.12;
      out.connect(limiter).connect(c.destination);
      // Half a second of white noise; each press reads it from a random offset so no two sound alike.
      noise = c.createBuffer(1, Math.ceil(c.sampleRate * 0.5), c.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      ctx = c;
    }
    if (ctx.state !== 'running') {
      primed = true;
      await ctx.resume();
    }
  } catch {
    // No audio device or the browser refused: the site stays silent.
  }
}

// Every voice is a short chain: free it once the source has stopped.
function release(src: AudioScheduledSourceNode, ...chain: AudioNode[]) {
  src.onended = () => [src, ...chain].forEach((n) => n.disconnect());
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
  const env = envelope(c, t, dur, level);
  src.connect(f).connect(env).connect(out!);
  release(src, f, env);
  src.start(t, Math.random() * 0.38);
  src.stop(t + dur);
}

function tone(c: AudioContext, t: number, dur: number, type: OscillatorType, freq: number, level: number, drop = 1) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * drop, t + dur);
  const env = envelope(c, t, dur, level);
  o.connect(env).connect(out!);
  release(o, env);
  o.start(t);
  o.stop(t + dur);
}

/**
 * One key press, synthesised. Linear: a low "thock" (90 ms filtered noise burst + a 180 Hz body);
 * tactile: a 30 ms bump just before it; clicky: a 2.8 kHz, 12 ms click on top. `pitch` scales every frequency.
 */
export function playSwitch(profile: SwitchProfile, { pitch = 1 }: { pitch?: number } = {}): void {
  const c = ctx;
  const live = !!c && (c.state === 'running' || primed);
  primed = false;
  if (!c || !live || !out || !noise || muted) return;
  const t = c.currentTime + 0.004;
  const bottom = profile === 'tactile' ? t + 0.024 : t; // the bump comes before bottom-out
  if (profile === 'tactile') burst(c, t, 0.03, 'bandpass', 560 * pitch, 1.4, 0.4);
  burst(c, bottom, 0.09, 'lowpass', 1300 * pitch, 0.8, 0.9);
  tone(c, bottom, 0.09, 'sine', 180 * pitch, 0.55, 0.72);
  if (profile === 'clicky') tone(c, t, 0.012, 'triangle', 2800 * pitch, 0.32);
}

/** A slight random pitch per press, so fast typing does not sound like a loop. */
export const pressPitch = () => 0.95 + Math.random() * 0.1;
