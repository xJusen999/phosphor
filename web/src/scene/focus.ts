import { Euler, Vector3 } from 'three';
import { LAYOUT_60 } from '@phosphor/shared';
import { DECK_TILT, DECK_Y } from '../three/case';
import { keyCentre } from '../three/keycap';
import type { Pose, Vec3 } from './poses';

const MM = 0.01; // the keyboard root's mm → scene units scale (Keyboard.tsx)
const CAP_TOP = 14; // a cap's top face above the plate (mm): base at 5, about 9 tall

/** A key's cap-top centre in the rig group's space (before the pose), or null for an unknown code. */
export function keyLocal(code: string): Vec3 | null {
  const k = LAYOUT_60.find((d) => d.code === code);
  if (!k) return null;
  const [x, z] = keyCentre(k);
  // The deck sits at DECK_Y, tilted about x by the typing angle.
  const c = Math.cos(DECK_TILT), s = Math.sin(DECK_TILT);
  return [x * MM, (CAP_TOP * c - z * s + DECK_Y) * MM, (CAP_TOP * s + z * c) * MM];
}

/**
 * Zooms a pose onto one key: the board scales up by `1 + zoom·w` and slides so the key moves from where
 * the pose puts it toward `target` (world), reaching it at w = 1. w = 0 returns the pose unchanged.
 */
export function focusPose(p: Pose, local: Vec3, target: Vec3, w: number, zoom = 0.35): Pose {
  if (w <= 0) return p;
  const rot = new Euler(...p.rot);
  const at = (scale: number) => new Vector3(...local).multiplyScalar(scale).applyEuler(rot);
  const from = at(p.scale).add(new Vector3(...p.pos));
  const want = from.lerp(new Vector3(...target), w);
  const scale = p.scale * (1 + zoom * w);
  const pos = want.sub(at(scale));
  return { ...p, pos: [pos.x, pos.y, pos.z], scale };
}
