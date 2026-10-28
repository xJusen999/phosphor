import { describe, expect, it } from 'vitest';
import { simResolution, splatRadius } from '../src/three/fluid/fluid';

describe('simResolution', () => {
  it('is 128 on coarse pointers / small screens', () => {
    expect(simResolution({ coarse: true })).toBe(128);
  });

  it('is 256 otherwise', () => {
    expect(simResolution({ coarse: false })).toBe(256);
  });
});

describe('splatRadius', () => {
  it('keeps the brush about the same size in pixels: smaller fraction on wider viewports', () => {
    expect(splatRadius(1920)).toBeLessThan(splatRadius(1280));
    expect(splatRadius(1280)).toBeLessThan(splatRadius(600));
  });

  it('is clamped to a sane range, also for degenerate widths', () => {
    for (const w of [0, -10, 1, 320, 1440, 8000, Number.NaN]) {
      const r = splatRadius(w);
      expect(Number.isFinite(r)).toBe(true);
      expect(r).toBeGreaterThanOrEqual(0.03);
      expect(r).toBeLessThanOrEqual(0.12);
    }
  });
});
