'use client';

import { useEffect, useRef } from 'react';
import type { Group } from 'three';
import type { BuildConfig } from '@phosphor/shared';
import { Stage } from '../src/three/Stage';
import { Keyboard } from '../src/three/Keyboard';
import { Smoke } from '../src/three/Smoke';
import { Composite } from '../src/three/Composite';
import { Rig } from '../src/scene/Rig';
import { Hero } from '../src/sections/Hero';
import { Shells } from '../src/sections/Shells';
import { startLenis } from '../src/nav/lenis';
import { useKeyNav } from '../src/nav/useKeyNav';
import { goTo, Transition } from '../src/nav/Transition';
import { Shortcuts } from '../src/nav/Shortcuts';

const FINISH: BuildConfig = { caseFinish: 'frost', keycaps: 'phosphor', switchType: 'linear' };

export default function Home() {
  const keyboard = useRef<Group>(null);
  const explode = useRef(0);
  const { pressed, pointerPress, tap } = useKeyNav();
  useEffect(startLenis, []);

  return (
    <main>
      <Stage>
        <Rig group={keyboard} explode={explode}>
          <Keyboard
            pressed={pressed}
            finish={FINISH}
            explode={explode}
            onCap={(k, type, at) => {
              if (type === 'down') pointerPress(k.code);
              else if (k.fn) goTo(k.fn, at);
            }}
          />
        </Rig>
        <Smoke pressed={pressed} keyboard={keyboard} />
        <Composite />
      </Stage>
      <Hero />
      <Shells tap={tap} />
      <Transition />
      <Shortcuts />
    </main>
  );
}
