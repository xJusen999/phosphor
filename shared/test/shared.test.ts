import { describe, expect, it } from 'vitest';
import {
  LAYOUT_60, shouldHandleKey, priceOf, isEmail, cleanName, computeWpm, accuracy,
} from '../src';

const ev = (o: Partial<Parameters<typeof shouldHandleKey>[0]> & { code: string }) => ({
  shiftKey: false, ctrlKey: false, metaKey: false, altKey: false,
  targetTag: 'BODY', targetEditable: false, typeTestActive: false, ...o,
});

describe('layout', () => {
  it('has 61 keys and rows of 15u', () => {
    expect(LAYOUT_60).toHaveLength(61);
    for (let r = 0; r < 5; r++) {
      const sum = LAYOUT_60.filter((k) => k.row === r).reduce((a, k) => a + k.w, 0);
      expect(sum).toBe(15);
    }
  });
  it('x is the cumulative left edge', () => {
    for (let r = 0; r < 5; r++) {
      let x = 0;
      for (const k of LAYOUT_60.filter((k) => k.row === r)) {
        expect(k.x).toBe(x);
        x += k.w;
      }
    }
  });
  it('fn keys are exactly the section keys', () => {
    const codes = LAYOUT_60.filter((k) => k.fn).map((k) => k.code).sort();
    expect(codes).toEqual(['Escape', 'KeyT', 'KeyP', 'KeyO', 'KeyS', 'KeyB', 'Space'].sort());
  });
});

describe('shouldHandleKey', () => {
  it('maps P to brand and blocks in typing contexts', () => {
    expect(shouldHandleKey(ev({ code: 'KeyP' }))).toBe('brand');
    expect(shouldHandleKey(ev({ code: 'KeyP', targetTag: 'INPUT' }))).toBeNull();
    expect(shouldHandleKey(ev({ code: 'KeyP', targetEditable: true }))).toBeNull();
    expect(shouldHandleKey(ev({ code: 'KeyP', typeTestActive: true }))).toBeNull();
    expect(shouldHandleKey(ev({ code: 'KeyP', ctrlKey: true }))).toBeNull();
  });
  it('Space only on non-interactive targets', () => {
    expect(shouldHandleKey(ev({ code: 'Space', targetTag: 'BUTTON' }))).toBeNull();
    expect(shouldHandleKey(ev({ code: 'Space' }))).toBe('sound');
  });
  it('? opens shortcuts', () => {
    expect(shouldHandleKey(ev({ code: 'Slash', shiftKey: true }))).toBe('shortcuts');
  });
  it('Escape goes top anywhere except during the type test', () => {
    expect(shouldHandleKey(ev({ code: 'Escape', targetTag: 'INPUT' }))).toBe('top');
    expect(shouldHandleKey(ev({ code: 'Escape', targetEditable: true }))).toBe('top');
    expect(shouldHandleKey(ev({ code: 'Escape', typeTestActive: true }))).toBeNull();
  });
});

describe('pricing', () => {
  it('sums options', () => {
    expect(priceOf({ caseFinish: 'frost', keycaps: 'phosphor', switchType: 'linear' })).toBe(219);
    expect(priceOf({ caseFinish: 'clear', keycaps: 'blank', switchType: 'clicky' })).toBe(284);
  });
  it('throws on unknown option', () => {
    expect(() => priceOf({ caseFinish: 'gold' } as any)).toThrow('unknown option');
  });
});

describe('validation', () => {
  it('isEmail', () => {
    expect(isEmail('a@b.co')).toBe(true);
    expect(isEmail('a@b')).toBe(false);
  });
  it('cleanName', () => {
    expect(cleanName('  neo  ')).toBe('neo');
    expect(cleanName('')).toBeNull();
    expect(cleanName('x'.repeat(17))).toBeNull();
    expect(cleanName('<b>')).toBeNull();
  });
});

describe('wpm', () => {
  it('computeWpm', () => {
    expect(computeWpm(250, 60000)).toBe(50);
    expect(computeWpm(10, 0)).toBe(0);
  });
  it('accuracy', () => {
    expect(accuracy(0, 0)).toBe(1);
    expect(accuracy(45, 50)).toBe(0.9);
  });
});
