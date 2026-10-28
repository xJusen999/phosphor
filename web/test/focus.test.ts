import { describe, expect, it } from 'vitest';
import { Euler, Vector3 } from 'three';
import { focusPose, keyLocal } from '../src/scene/focus';
import { poses, type Vec3 } from '../src/scene/poses';

const world = (p: { pos: Vec3; rot: Vec3; scale: number }, local: Vec3) =>
  new Vector3(...local).multiplyScalar(p.scale).applyEuler(new Euler(...p.rot)).add(new Vector3(...p.pos));

describe('keyLocal', () => {
  it('finds a key by KeyboardEvent.code, in keyboard-group units (mm × 0.01)', () => {
    const l = keyLocal('KeyL')!, c = keyLocal('KeyC')!;
    expect(l[0]).toBeGreaterThan(c[0]); // L sits right of C
    expect(Math.abs(l[0])).toBeLessThan(1.5); // inside a 300 mm board
    expect(l[1]).toBeGreaterThan(0.2); // on top of the deck
  });

  it('is null for an unknown code', () => {
    expect(keyLocal('Nope')).toBeNull();
  });
});

describe('focusPose', () => {
  const local = keyLocal('KeyT')!;
  const target: Vec3 = [0.1, -0.4, 0.9];

  it('leaves the pose alone at weight 0', () => {
    expect(focusPose(poses.sound, local, target, 0)).toEqual(poses.sound);
  });

  it('at weight 1 the key lands on the target and the board is scaled up', () => {
    const p = focusPose(poses.sound, local, target, 1, 0.4);
    expect(p.scale).toBeCloseTo(poses.sound.scale * 1.4);
    const w = world(p, local);
    expect(w.x).toBeCloseTo(target[0]);
    expect(w.y).toBeCloseTo(target[1]);
    expect(w.z).toBeCloseTo(target[2]);
    expect(p.rot).toEqual(poses.sound.rot);
  });

  it('halfway, the key is halfway to the target', () => {
    const from = world(poses.sound, local);
    const w = world(focusPose(poses.sound, local, target, 0.5), local);
    expect(w.x).toBeCloseTo((from.x + target[0]) / 2);
    expect(w.y).toBeCloseTo((from.y + target[1]) / 2);
  });
});
