'use client';

import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { fx } from '../three/bus';
import { fitPose, narrowness, poseAt, scrollProgress, SECTION_ORDER } from './poses';

type Props = { group: RefObject<Group | null>; explode: { current: number }; children: ReactNode };

/** Moves the fixed keyboard through the section poses as the page scrolls (Lenis drives window scroll). */
export function Rig({ group, explode, children }: Props) {
  const tops = useRef<number[]>([0]);
  const reduced = useRef(false);
  const zoom = useRef(0);

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

  useFrame(({ size }, delta) => {
    const g = group.current;
    if (!g) return;
    const progress = scrollProgress(tops.current, scrollY);
    const p = fitPose(poseAt(progress), narrowness(size.width / Math.max(size.height, 1), progress));
    g.position.set(...p.pos);
    g.rotation.set(...p.rot);
    // Sound: a hovered switch card eases the board a little closer (none with reduced motion).
    zoom.current = reduced.current ? 0 : zoom.current + (fx.focus - zoom.current) * (1 - Math.exp(-delta * 6));
    g.scale.setScalar(p.scale * (1 + 0.14 * zoom.current));
    // Reduced motion: no scrubbed explode, the board is either whole or apart.
    explode.current = reduced.current ? (p.explode > 0.5 ? 1 : 0) : p.explode;
  }, -1); // before the keyboard, smoke and composite read it

  return <group ref={group}>{children}</group>;
}
