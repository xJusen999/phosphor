import { describe, expect, it } from 'vitest';
import { isRealClick } from '../src/three/clickGuard';

describe('isRealClick', () => {
  it('accepts a click that barely moved with nothing selected', () => {
    expect(isRealClick(0, '')).toBe(true);
    expect(isRealClick(2, '')).toBe(true);
  });
  it('rejects a drag (more than 2 px since pointerdown)', () => {
    expect(isRealClick(3, '')).toBe(false);
  });
  it('rejects a click that ends a text selection', () => {
    expect(isRealClick(0, 'Six layers')).toBe(false);
  });
  it('ignores a whitespace-only selection', () => {
    expect(isRealClick(0, ' \n')).toBe(true);
  });
});
