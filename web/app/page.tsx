'use client';

import { useEffect, useRef, useState } from 'react';
import type { Group } from 'three';
import type { BuildConfig } from '@phosphor/shared';
import { Stage } from '../src/three/Stage';
import { Keyboard } from '../src/three/Keyboard';
import { Smoke } from '../src/three/Smoke';
import { Composite } from '../src/three/Composite';
import { Hero } from '../src/sections/Hero';

const FINISH: BuildConfig = { caseFinish: 'frost', keycaps: 'phosphor', switchType: 'linear' };

// Hero only for now (sections and key navigation come in the next task).
export default function Home() {
  const keyboard = useRef<Group>(null);
  const [pressed, setPressed] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    const set = (code: string, down: boolean) =>
      setPressed((p) => {
        if (p.has(code) === down) return p;
        const n = new Set(p);
        if (down) n.add(code);
        else n.delete(code);
        return n;
      });
    const kd = (e: KeyboardEvent) => set(e.code, true);
    const ku = (e: KeyboardEvent) => set(e.code, false);
    const clear = () => setPressed(new Set());
    addEventListener('keydown', kd);
    addEventListener('keyup', ku);
    addEventListener('blur', clear);
    return () => {
      removeEventListener('keydown', kd);
      removeEventListener('keyup', ku);
      removeEventListener('blur', clear);
    };
  }, []);

  return (
    <main>
      <Stage>
        <group ref={keyboard} rotation={[0, -0.32, 0]} position={[0.42, -0.4, 0.1]} scale={0.78}>
          <Keyboard pressed={pressed} finish={FINISH} explode={0} />
        </group>
        <Smoke pressed={pressed} keyboard={keyboard} />
        <Composite />
      </Stage>
      <Hero />
    </main>
  );
}
