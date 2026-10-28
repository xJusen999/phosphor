'use client';

import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Euler, Vector3, type Group } from 'three';
import { fx } from '../three/bus';
import { focusPose, keyLocal } from './focus';
import { fitPose, narrowness, poseAt, scrollProgress, SECTION_ORDER } from './poses';

const SOUND = SECTION_ORDER.indexOf('sound');
const FOCUS_ZOOM = 0.25; // the board grows by a quarter around the focused key

type Props = { group: RefObject<Group | null>; explode: { current: number }; children: ReactNode };

/** Moves the fixed keyboard through the section poses as the page scrolls (Lenis drives window scroll). */
export function Rig({ group, explode, children }: Props) {
  const tops = useRef<number[]>([0]);
  const reduced = useRef(false);
  const zoom = useRef(0);
  const focused = useRef<string | null>(null);
  const tmp = useMemo(() => ({ v: new Vector3(), e: new Euler() }), []);

  useEffect(() => {
    const measure = () => {
      tops.current = SECTION_ORDER.map((id) => {
        const el = document.getElementById(id);
        return el ? el.getBoundingClientRect().top + scrollY : 0;
      });
    };
    measure();
    reduced.current = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    return () => ro.disconnect();
  }, []);

  useFrame(({ size, camera }, delta) => {
    const g = group.current;
    if (!g) return;
    const progress = scrollProgress(tops.current, scrollY);
    const aspect = size.width / Math.max(size.height, 1);
    let p = fitPose(poseAt(progress), narrowness(aspect, progress));

    // Sound: zoom onto the focused card's key; only near the Sound stop, so scrolling away releases it.
    if (fx.focusKey) focused.current = fx.focusKey; // keep the last key while easing back out
    const near = Math.max(0, 1 - Math.abs(progress * (SECTION_ORDER.length - 1) - SOUND));
    const goal = fx.focusKey ? near : 0;
    zoom.current = reduced.current ? goal : zoom.current + (goal - zoom.current) * (1 - Math.exp(-delta * 5));
    const local = focused.current ? keyLocal(focused.current) : null;
    if (local && zoom.current > 1e-4) {
      // The target keeps the key's depth on screen, so the board slides across rather than toward the camera.
      const w = tmp.v.set(...local).multiplyScalar(p.scale).applyEuler(tmp.e.set(...p.rot));
      w.set(w.x + p.pos[0], w.y + p.pos[1], w.z + p.pos[2]).project(camera);
      const at = fx.focusAt ?? { x: size.width / 2, y: size.height * 0.8 };
      const t = w.set((at.x / size.width) * 2 - 1, 1 - (at.y / size.height) * 2, w.z).unproject(camera);
      p = focusPose(p, local, [t.x, t.y, t.z], zoom.current, FOCUS_ZOOM);
    }
    g.position.set(...p.pos);
    g.rotation.set(...p.rot);
    g.scale.setScalar(p.scale);
    // Reduced motion: no scrubbed explode, the board is either whole or apart.
    explode.current = reduced.current ? (p.explode > 0.5 ? 1 : 0) : p.explode;
  }, -1); // before the keyboard, smoke and composite read it

  return <group ref={group}>{children}</group>;
}
