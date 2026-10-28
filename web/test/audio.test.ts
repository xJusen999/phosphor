import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Minimal Web Audio stand-in: counts the nodes each context creates.
const made = { contexts: 0, oscillators: 0, sources: 0 };

class FakeParam {
  value = 0;
  setValueAtTime() { return this; }
  linearRampToValueAtTime() { return this; }
  exponentialRampToValueAtTime() { return this; }
}
class FakeNode {
  frequency = new FakeParam();
  gain = new FakeParam();
  Q = new FakeParam();
  playbackRate = new FakeParam();
  threshold = new FakeParam();
  knee = new FakeParam();
  ratio = new FakeParam();
  attack = new FakeParam();
  release = new FakeParam();
  type = '';
  buffer: unknown = null;
  onended: (() => void) | null = null;
  disconnected = false;
  connect<T>(n: T) { return n; }
  disconnect() { this.disconnected = true; }
  start() {}
  stop() {}
}
const sources: FakeNode[] = [];
const track = (n: FakeNode) => (sources.push(n), n);
class FakeAudioContext {
  state = 'suspended';
  currentTime = 0;
  sampleRate = 48000;
  destination = new FakeNode();
  constructor() { made.contexts++; }
  async resume() { this.state = 'running'; }
  createGain() { return new FakeNode(); }
  createBiquadFilter() { return new FakeNode(); }
  createOscillator() { made.oscillators++; return track(new FakeNode()); }
  createBufferSource() { made.sources++; return track(new FakeNode()); }
  createDynamicsCompressor() { return new FakeNode(); }
  createBuffer(_c: number, length: number) { return { getChannelData: () => new Float32Array(length) }; }
  // The "decoded" buffer is the URL it came from, so a test can tell which recording a voice plays.
  async decodeAudioData(data: string) { return { url: data }; }
}

// A browser that never lets the context run (resume() is refused without user activation).
class StuckAudioContext extends FakeAudioContext {
  async resume() {}
}

// Fresh module state per test (the audio context is a module singleton).
const load = () => import('../src/audio/switches');

beforeEach(() => {
  vi.resetModules();
  Object.assign(made, { contexts: 0, oscillators: 0, sources: 0 });
  sources.length = 0;
  vi.stubGlobal('AudioContext', FakeAudioContext);
});
afterEach(() => vi.unstubAllGlobals());

// Serves every sound file (its body is its own URL); `fail` makes them 404.
const serve = (fail = false) => {
  const fetch = vi.fn(async (url: string) => ({ ok: !fail, arrayBuffer: async () => url }));
  vi.stubGlobal('fetch', fetch);
  return fetch;
};
// Lets the pending fetch/decode promises settle.
const settle = () => new Promise((r) => setTimeout(r, 0));
const played = () => sources.map((n) => (n.buffer as { url?: string } | null)?.url).filter(Boolean);

describe('ensureAudio', () => {
  it('creates no context without user activation (e.g. Escape keydown, touch pointerdown)', async () => {
    vi.stubGlobal('navigator', { userActivation: { isActive: false } });
    const { ensureAudio, playSwitch } = await load();
    await ensureAudio();
    playSwitch('linear');
    expect(made).toEqual({ contexts: 0, oscillators: 0, sources: 0 });
  });

  it('creates the context during a user activation', async () => {
    vi.stubGlobal('navigator', { userActivation: { isActive: true } });
    const { ensureAudio } = await load();
    await ensureAudio();
    expect(made.contexts).toBe(1);
  });
});

describe('playSwitch', () => {
  it('is a silent no-op before ensureAudio', async () => {
    const { playSwitch } = await load();
    playSwitch('clicky');
    expect(made).toEqual({ contexts: 0, oscillators: 0, sources: 0 });
  });

  it('plays after ensureAudio; clicky schedules one more oscillator than linear', async () => {
    const { ensureAudio, playSwitch } = await load();
    await ensureAudio();
    playSwitch('linear');
    const linear = made.oscillators;
    expect(linear).toBeGreaterThan(0);
    expect(made.sources).toBeGreaterThan(0);
    playSwitch('clicky');
    expect(made.oscillators - linear).toBe(linear + 1);
  });

  it('tactile adds a bump to the linear sound', async () => {
    const { ensureAudio, playSwitch } = await load();
    await ensureAudio();
    playSwitch('linear');
    const linear = { ...made };
    playSwitch('tactile');
    expect(made.sources - linear.sources).toBeGreaterThan(linear.sources);
  });

  it('stays silent while muted', async () => {
    const { ensureAudio, playSwitch, setMuted } = await load();
    await ensureAudio();
    setMuted(true);
    playSwitch('linear');
    expect(made.oscillators + made.sources).toBe(0);
  });

  it('queues nothing on a suspended context: only the press that resumed it plays', async () => {
    vi.stubGlobal('AudioContext', StuckAudioContext);
    const { ensureAudio, playSwitch } = await load();
    await ensureAudio();
    playSwitch('linear'); // the gesture's own press
    const first = { ...made };
    expect(first.oscillators).toBe(1);
    playSwitch('linear'); // a later hover while still suspended
    playSwitch('clicky');
    expect(made).toEqual(first);
  });

  it('does not throw without AudioContext', async () => {
    vi.stubGlobal('AudioContext', undefined);
    const { ensureAudio, playSwitch } = await load();
    await expect(ensureAudio()).resolves.toBeUndefined();
    expect(() => playSwitch('clicky')).not.toThrow();
  });

  it('disconnects every voice once it has played, so fast typing does not pile up nodes', async () => {
    const { ensureAudio, playSwitch } = await load();
    await ensureAudio();
    playSwitch('clicky');
    expect(sources.length).toBeGreaterThan(0);
    sources.forEach((n) => n.onended?.());
    expect(sources.every((n) => n.disconnected)).toBe(true);
  });

  it('creates one context however many gestures', async () => {
    const { ensureAudio } = await load();
    await ensureAudio();
    await ensureAudio();
    expect(made.contexts).toBe(1);
  });
});

describe('recorded switches', () => {
  it('loads the selected profile from relative URLs on the first gesture', async () => {
    const fetch = serve();
    const { ensureAudio, selectSwitch } = await load();
    selectSwitch('tactile');
    await ensureAudio();
    await settle();
    const urls = fetch.mock.calls.map(([u]) => u);
    expect(urls).toContain('./sounds/tactile/press0.wav');
    expect(urls).toContain('./sounds/tactile/up.wav');
    expect(urls.every((u) => u.startsWith('./sounds/'))).toBe(true);
  });

  it('falls back to the synth before the buffers are ready', async () => {
    serve();
    const { ensureAudio, playSwitch } = await load();
    await ensureAudio();
    playSwitch('linear'); // same tick: nothing decoded yet
    expect(made.oscillators).toBeGreaterThan(0);
    expect(played()).toEqual([]);
  });

  it('falls back to the synth when the files fail to load', async () => {
    serve(true);
    const { ensureAudio, playSwitch } = await load();
    await ensureAudio();
    await settle();
    playSwitch('clicky');
    expect(made.oscillators).toBeGreaterThan(0);
    expect(played()).toEqual([]);
  });

  it('plays a recorded press once loaded, never the same variant twice in a row', async () => {
    serve();
    const { ensureAudio, playSwitch } = await load();
    await ensureAudio();
    await settle();
    for (let i = 0; i < 40; i++) playSwitch('linear');
    const urls = played();
    expect(made.oscillators).toBe(0);
    expect(urls).toHaveLength(40);
    expect(urls.every((u) => /^\.\/sounds\/linear\/press[0-4]\.wav$/.test(u!))).toBe(true);
    urls.slice(1).forEach((u, i) => expect(u).not.toBe(urls[i]));
    expect(new Set(urls).size).toBeGreaterThan(2);
  });

  it('maps Space, Enter and Backspace to their own recordings', async () => {
    serve();
    const { ensureAudio, selectSwitch, playSwitch } = await load();
    selectSwitch('clicky');
    await ensureAudio();
    await settle();
    playSwitch('clicky', { code: 'Space' });
    playSwitch('clicky', { code: 'Enter' });
    playSwitch('clicky', { code: 'NumpadEnter' });
    playSwitch('clicky', { code: 'Backspace' });
    playSwitch('clicky', { code: 'KeyA' });
    const urls = played();
    expect(urls.slice(0, 4)).toEqual([
      './sounds/clicky/space.wav', './sounds/clicky/enter.wav', './sounds/clicky/enter.wav', './sounds/clicky/backspace.wav',
    ]);
    expect(urls[4]).toMatch(/press[0-4]\.wav$/);
  });

  it('plays a keyup sound where the pack has one, nothing where it has not', async () => {
    serve();
    const { ensureAudio, selectSwitch, releaseSwitch, playSwitch } = await load();
    await ensureAudio();
    (['linear', 'clicky', 'tactile'] as const).forEach(selectSwitch); // all three banks load
    await settle();
    releaseSwitch('linear', 'KeyA');
    releaseSwitch('clicky', 'Space');
    releaseSwitch('tactile', 'KeyA');
    releaseSwitch('tactile', 'Space');
    expect(played()).toEqual(['./sounds/tactile/up.wav', './sounds/tactile/up-space.wav']);
    // The silent ones were loaded: their presses are recorded, not synthesised.
    playSwitch('linear');
    playSwitch('clicky');
    expect(played().slice(2)).toEqual([expect.stringMatching(/linear\/press/), expect.stringMatching(/clicky\/press/)]);
    expect(made.oscillators).toBe(0);
  });

  it('a release never plays on a suspended context, even right after an unlock without a press', async () => {
    serve();
    vi.stubGlobal('AudioContext', StuckAudioContext);
    const { ensureAudio, selectSwitch, releaseSwitch } = await load();
    selectSwitch('tactile');
    await ensureAudio(); // e.g. the pointerup unlock: resume() asked, no press followed
    await settle();
    releaseSwitch('tactile', 'KeyA');
    expect(made.oscillators + made.sources).toBe(0);
  });

  it('creates no nodes on a suspended context, press or release', async () => {
    serve();
    vi.stubGlobal('AudioContext', StuckAudioContext);
    const { ensureAudio, playSwitch, releaseSwitch } = await load();
    await ensureAudio();
    playSwitch('tactile'); // the gesture's own press may play
    await settle();
    const first = { ...made };
    playSwitch('tactile');
    releaseSwitch('tactile', 'KeyA');
    expect(made).toEqual(first);
  });

  it('disconnects a recorded voice once it has played', async () => {
    serve();
    const { ensureAudio, selectSwitch, playSwitch } = await load();
    selectSwitch('tactile');
    await ensureAudio();
    await settle();
    playSwitch('tactile');
    expect(sources).toHaveLength(1);
    sources[0].onended?.();
    expect(sources[0].disconnected).toBe(true);
  });
});
