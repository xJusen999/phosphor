import { describe, expect, it } from 'vitest';
import { stepKey } from '../src/three/keySpring';
import { maxDpr } from '../src/three/quality';

const DT = 1 / 60;

function run(y: number, v: number, target: number, still: boolean, frames: number) {
  let s = { y, v, dirty: false };
  for (let i = 0; i < frames; i++) s = stepKey(s.y, s.v, target, DT, still);
  return s;
}

describe('stepKey', () => {
  it('reduced motion: press snaps down and is dirty', () => {
    expect(stepKey(0, 0, -4, DT, true)).toEqual({ y: -4, v: 0, dirty: true });
  });

  it('reduced motion: release snaps back up and is dirty', () => {
    expect(stepKey(-4, 0, 0, DT, true)).toEqual({ y: 0, v: 0, dirty: true });
  });

  it('reduced motion: at rest it is not dirty', () => {
    expect(stepKey(0, 0, 0, DT, true).dirty).toBe(false);
  });

  it('animated: press travels down, release settles exactly at 0', () => {
    const down = run(0, 0, -4, false, 60);
    expect(Math.abs(down.y + 4)).toBeLessThan(1e-3);
    const up = run(down.y, down.v, 0, false, 120);
    expect(up.y).toBe(0);
    expect(up.v).toBe(0);
    expect(stepKey(up.y, up.v, 0, DT, false).dirty).toBe(false);
  });

  it('reduced motion toggled mid-press releases to 0', () => {
    const mid = run(0, 0, -4, false, 3);
    expect(mid.y).toBeLessThan(0);
    const released = stepKey(mid.y, mid.v, 0, DT, true);
    expect(released).toEqual({ y: 0, v: 0, dirty: true });
  });
});

describe('maxDpr', () => {
  it('caps touch and small screens at 1.5', () => {
    expect(maxDpr({ coarse: true, w: 1920, h: 1080 })).toBe(1.5);
    expect(maxDpr({ coarse: false, w: 700, h: 1200 })).toBe(1.5);
    expect(maxDpr({ coarse: false, w: 1440, h: 760 })).toBe(1.5);
  });

  it('allows 2 on large desktop screens', () => {
    expect(maxDpr({ coarse: false, w: 1440, h: 900 })).toBe(2);
  });
});
