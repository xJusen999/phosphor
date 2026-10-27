'use client';

import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { poseAt, scrollProgress, SECTION_ORDER } from './poses';

type Props = { group: RefObject<Group | null>; explode: { current: number }; children: ReactNode };

/** Moves the fixed keyboard through the section poses as the page scrolls (Lenis drives window scroll). */
export function Rig({ group, explode, children }: Props) {
  const tops = useRef<number[]>([0]);

  useEffect(() => {
    const measure = () => {
      tops.current = SECTION_ORDER.map((id) => {
        const el = document.getElementById(id);
        return el ? el.getBoundingClientRect().top + scrollY : 0;
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    return () => ro.disconnect();
  }, []);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const p = poseAt(scrollProgress(tops.current, scrollY));
    g.position.set(...p.pos);
    g.rotation.set(...p.rot);
    g.scale.setScalar(p.scale);
    explode.current = p.explode;
  }, -1); // before the keyboard, smoke and composite read it

  return <group ref={group}>{children}</group>;
}
