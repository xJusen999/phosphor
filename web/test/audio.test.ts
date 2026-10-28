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
  type = '';
  buffer: unknown = null;
  connect<T>(n: T) { return n; }
  start() {}
  stop() {}
}
class FakeAudioContext {
  state = 'suspended';
  currentTime = 0;
  sampleRate = 48000;
  destination = new FakeNode();
  constructor() { made.contexts++; }
  async resume() { this.state = 'running'; }
  createGain() { return new FakeNode(); }
  createBiquadFilter() { return new FakeNode(); }
  createOscillator() { made.oscillators++; return new FakeNode(); }
  createBufferSource() { made.sources++; return new FakeNode(); }
  createBuffer(_c: number, length: number) { return { getChannelData: () => new Float32Array(length) }; }
}

// Fresh module state per test (the audio context is a module singleton).
const load = () => import('../src/audio/switches');

beforeEach(() => {
  vi.resetModules();
  Object.assign(made, { contexts: 0, oscillators: 0, sources: 0 });
  vi.stubGlobal('AudioContext', FakeAudioContext);
});
afterEach(() => vi.unstubAllGlobals());

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

  it('does not throw without AudioContext', async () => {
    vi.stubGlobal('AudioContext', undefined);
    const { ensureAudio, playSwitch } = await load();
    await expect(ensureAudio()).resolves.toBeUndefined();
    expect(() => playSwitch('clicky')).not.toThrow();
  });

  it('creates one context however many gestures', async () => {
    const { ensureAudio } = await load();
    await ensureAudio();
    await ensureAudio();
    expect(made.contexts).toBe(1);
  });
});
