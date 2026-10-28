export type SwitchProfile = 'linear' | 'tactile' | 'clicky';

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let noise: AudioBuffer | null = null;
let muted = false;
let selected: SwitchProfile = 'linear';
// True between a gesture's resume() call and the press it triggers: that one press may schedule on the
// still-suspended clock (it plays as the context wakes); any other press on a suspended context is dropped.
let primed = false;

// Recorded switches (Mechvibes packs, built by scripts/build-sounds.py): five press variants, the three keys
// that sound different, and keyup sounds where the pack has them. Relative URLs: the export runs from a subfolder.
const PROFILES: SwitchProfile[] = ['linear', 'tactile', 'clicky'];
const PRESSES = 5;
const KEYS: Record<string, string> = { Space: 'space', Enter: 'enter', NumpadEnter: 'enter', Backspace: 'backspace' };
const HAS_UP: Record<SwitchProfile, boolean> = { linear: false, tactile: true, clicky: false };
const files = (p: SwitchProfile) => [
  ...Array.from({ length: PRESSES }, (_, i) => `press${i}`), 'space', 'enter', 'backspace',
  ...(HAS_UP[p] ? ['up', 'up-space', 'up-enter', 'up-backspace'] : []),
];
const banks: Partial<Record<SwitchProfile, Record<string, AudioBuffer>>> = {};
const loads: Partial<Record<SwitchProfile, Promise<void>>> = {};
let lastPress = -1;

// Once per profile; a failed load is not retried and that profile keeps the synth.
function loadBank(c: AudioContext, p: SwitchProfile) {
  loads[p] ??= Promise.all(
    files(p).map(async (name) => {
      const r = await fetch(`./sounds/${p}/${name}.wav`);
      if (!r.ok) throw new Error(`${r.status} ${name}`);
      return [name, await c.decodeAudioData(await r.arrayBuffer())] as const;
    }),
  ).then((all) => void (banks[p] = Object.fromEntries(all)), () => {});
}

/** The profile every key press plays (picked in the Sound section). */
export const selectedSwitch = () => selected;
export const selectSwitch = (p: SwitchProfile) => {
  selected = p;
  if (ctx) loadBank(ctx, p);
};
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
      out.gain.value = 0.35; // a single press peaks around -10 dBFS
      // Headroom: overlapping presses (fast typing) are squeezed by a limiter instead of clipping. Its threshold
      // sits near 0 dBFS because the compressor adds makeup gain (0.6 × its reduction at 0 dBFS) to every sound:
      // at -10 dB it lifted single presses ~5 dB.
      const limiter = c.createDynamicsCompressor();
      limiter.threshold.value = -1;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.001;
      limiter.release.value = 0.1;
      out.connect(limiter).connect(c.destination);
      // Half a second of white noise; each press reads it from a random offset so no two sound alike.
      noise = c.createBuffer(1, Math.ceil(c.sampleRate * 0.5), c.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      ctx = c;
      loadBank(c, selected);
      // The other two in idle time, so switching profile is instant.
      const later = globalThis.requestIdleCallback ?? ((f: () => void) => setTimeout(f, 1500));
      later(() => PROFILES.forEach((p) => loadBank(c, p)));
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

// A context that may sound now: running, or the press that is resuming it (`consume` spends that pass).
function live(consume: boolean) {
  const c = ctx;
  const ok = !!c && (c.state === 'running' || primed) && !!out && !muted;
  if (consume) primed = false;
  return ok ? c : null;
}

// One recording, with a ±3% pitch and level spread so repeats do not sound looped.
function sample(c: AudioContext, buffer: AudioBuffer, pitch = 1) {
  const src = c.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = pitch * (0.97 + Math.random() * 0.06);
  const g = c.createGain();
  g.gain.value = 0.97 + Math.random() * 0.06;
  src.connect(g).connect(out!);
  release(src, g);
  src.start(c.currentTime + 0.004);
}

/** The keyup sound of `code` (KeyboardEvent.code), for the packs recorded with one; silent otherwise. */
export function releaseSwitch(profile: SwitchProfile, code?: string): void {
  const c = live(false);
  const bank = banks[profile];
  const key = code && KEYS[code];
  const buf = bank && (bank[key ? `up-${key}` : 'up'] ?? bank.up);
  if (c && buf) sample(c, buf);
}

/**
 * One key press: the profile's recording once loaded (Space, Enter and Backspace have their own; other keys
 * take a random press variant, never the same twice in a row), synthesised until then or if it failed to load.
 * Synth: linear: a low "thock" (90 ms filtered noise burst + a 180 Hz body);
 * tactile: a 30 ms bump just before it; clicky: a 2.8 kHz, 12 ms click on top. `pitch` scales every frequency.
 */
export function playSwitch(profile: SwitchProfile, { pitch = 1, code }: { pitch?: number; code?: string } = {}): void {
  const c = live(true);
  if (!c || !noise) return;
  const bank = banks[profile];
  if (bank) {
    const key = code && KEYS[code];
    if (!key) {
      const i = Math.floor(Math.random() * (lastPress < 0 ? PRESSES : PRESSES - 1));
      lastPress = lastPress >= 0 && i >= lastPress ? i + 1 : i;
    }
    return sample(c, bank[key || `press${lastPress}`], pitch);
  }
  const t = c.currentTime + 0.004;
  const bottom = profile === 'tactile' ? t + 0.024 : t; // the bump comes before bottom-out
  if (profile === 'tactile') burst(c, t, 0.03, 'bandpass', 560 * pitch, 1.4, 0.4);
  burst(c, bottom, 0.09, 'lowpass', 1300 * pitch, 0.8, 0.9);
  tone(c, bottom, 0.09, 'sine', 180 * pitch, 0.55, 0.72);
  if (profile === 'clicky') tone(c, t, 0.012, 'triangle', 2800 * pitch, 0.32);
}

/** A slight random pitch per press, so fast typing does not sound like a loop. */
export const pressPitch = () => 0.97 + Math.random() * 0.06;
