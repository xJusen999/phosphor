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
