'use client';

import { useEffect, useState } from 'react';
import type { BuildConfig } from '@phosphor/shared';
import { Stage } from '../src/three/Stage';
import { Keyboard } from '../src/three/Keyboard';

const FINISH: BuildConfig = { caseFinish: 'frost', keycaps: 'phosphor', switchType: 'linear' };

// Placeholder page: the hero keyboard only (sections and navigation come later).
export default function Home() {
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
      <h1 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Phosphor One</h1>
      <Stage>
        <group rotation={[0, -0.32, 0]} position={[0, -0.18, 0]}>
          <Keyboard pressed={pressed} finish={FINISH} explode={0} />
        </group>
      </Stage>
    </main>
  );
}
