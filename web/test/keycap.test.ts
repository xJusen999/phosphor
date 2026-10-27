import { describe, expect, it } from 'vitest';
import { Box3, BufferGeometry, Vector3 } from 'three';
import { LAYOUT_60 } from '@phosphor/shared';
import { buildKeycapGeometry, capGroups, keyToInstance } from '../src/three/keycap';
import { buildCase } from '../src/three/case';

const size = (g: BufferGeometry) => new Box3().setFromBufferAttribute(g.getAttribute('position') as never).getSize(new Vector3());

// Width (x extent) of the vertices whose y lies within `eps` of `y`.
function widthAt(g: BufferGeometry, y: number, eps = 0.3) {
  const p = g.getAttribute('position');
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < p.count; i++) {
    if (Math.abs(p.getY(i) - y) > eps) continue;
    min = Math.min(min, p.getX(i));
    max = Math.max(max, p.getX(i));
  }
  return max - min;
}

const hasNaN = (g: BufferGeometry) => (g.getAttribute('position').array as Float32Array).some(Number.isNaN);

describe('buildKeycapGeometry', () => {
  it('1u row 1 is 17.85 x 9.5 x 17.85 mm and tapers to the top', () => {
    const g = buildKeycapGeometry(1, 1);
    const s = size(g);
    expect(s.x).toBeCloseTo(17.85, 1);
    expect(Math.abs(s.x - 17.85)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(s.y - 9.5)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(s.z - 17.85)).toBeLessThanOrEqual(0.05);
    expect(widthAt(g, s.y - 0.4)).toBeLessThan(widthAt(g, 0, 0.01));
  });

  it('6.25u spacebar is 117.86 mm wide', () => {
    expect(Math.abs(size(buildKeycapGeometry(6.25, 4)).x - 117.86)).toBeLessThanOrEqual(0.05);
  });

  it('row heights follow the OEM profile', () => {
    [11.5, 9.5, 9, 9.25, 9.25].forEach((h, row) => {
      expect(Math.abs(size(buildKeycapGeometry(1, row)).y - h)).toBeLessThanOrEqual(0.05);
    });
  });

  it('has uvs and normals, and no NaN positions for any cap in the layout', () => {
    for (const grp of capGroups) {
      const g = buildKeycapGeometry(grp.w, grp.row);
      expect(hasNaN(g)).toBe(false);
      expect(g.getAttribute('normal')).toBeTruthy();
      expect(g.getAttribute('uv').count).toBe(g.getAttribute('position').count);
    }
  });
});

describe('instancing', () => {
  it('groups all 61 keys into instanced meshes', () => {
    expect(capGroups.reduce((n, grp) => n + grp.keys.length, 0)).toBe(61);
    expect(capGroups.length).toBeLessThanOrEqual(12);
  });

  it('maps every key code to a unique mesh slot', () => {
    expect(keyToInstance.size).toBe(LAYOUT_60.length);
    const slots = new Set([...keyToInstance.values()].map(({ mesh, index }) => `${mesh}:${index}`));
    expect(slots.size).toBe(61);
    const p = keyToInstance.get('KeyP')!;
    expect(capGroups[p.mesh].keys[p.index].code).toBe('KeyP');
  });
});

describe('buildCase', () => {
  it('is ~300 x 105 mm with no NaN geometry', () => {
    const c = buildCase();
    const s = new Box3().setFromObject(c.getObjectByName('shell')!).getSize(new Vector3());
    expect(s.y).toBeGreaterThan(25); // wedge: shell top reaches the 30 mm rear (minus the strip)
    expect(s.x).toBeGreaterThan(295);
    expect(s.x).toBeLessThan(305);
    expect(s.z).toBeGreaterThan(100);
    expect(s.z).toBeLessThan(110);
    c.traverse((o) => {
      const g = (o as { geometry?: BufferGeometry }).geometry;
      if (g) expect(hasNaN(g)).toBe(false);
    });
  });
});
