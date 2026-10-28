'use client';

import { useEffect, useRef } from 'react';
import type { Group } from 'three';
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
import { BuildProvider, useBuild } from '../src/state/build';
import { useTypeTest } from '../src/type/useTypeTest';

export default function Home() {
  return (
    <BuildProvider>
      <Page />
    </BuildProvider>
  );
}

function Page() {
  const keyboard = useRef<Group>(null);
  const explode = useRef(0);
  const { config } = useBuild();
  const test = useTypeTest();
  const { pressed, pointerPress, tap } = useKeyNav(test.active);
  useEffect(startLenis, []);

  return (
    <main>
      <Stage>
        <Rig group={keyboard} explode={explode}>
          <Keyboard
            pressed={pressed}
            heat={test.heat}
            finish={config}
            explode={explode}
            onCap={(k, type, at) => {
              if (type === 'down') pointerPress(k.code);
              else if (k.fn && !test.active) goTo(k.fn, at); // the test keeps the page in place
            }}
          />
        </Rig>
        <Smoke pressed={pressed} keyboard={keyboard} />
        <Composite />
      </Stage>
      <Hero />
      <Shells tap={tap} test={test} />
      <Transition />
      <Shortcuts />
    </main>
  );
}
