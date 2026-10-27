'use client';

import { Component, useEffect, useState, type ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import {
  CanvasTexture, DirectionalLight, EquirectangularReflectionMapping, NeutralToneMapping, PMREMGenerator,
  RectAreaLight, SRGBColorSpace,
} from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { canRenderGL, maxDpr } from './quality';
import { markGLLost } from './bus';

// Studio: a canvas-painted room (soft top light, two hot strips, warm floor bounce) → PMREM,
// plus a key light and one RectAreaLight strip raking across the caps.
function Studio() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    RectAreaLightUniformsLib.init();
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 512;
    const g = c.getContext('2d')!;
    const sky = g.createLinearGradient(0, 0, 0, 512);
    sky.addColorStop(0, '#ffffff');
    sky.addColorStop(0.42, '#e9e9e4');
    sky.addColorStop(0.5, '#cfcfc9');
    sky.addColorStop(0.62, '#f1f1ec');
    sky.addColorStop(1, '#a9aaa4');
    g.fillStyle = sky;
    g.fillRect(0, 0, 1024, 512);
    g.fillStyle = '#ffffff';
    g.fillRect(140, 60, 320, 40);
    g.fillRect(600, 90, 260, 26);
    g.fillStyle = 'rgba(57,255,110,0.35)'; // faint green bounce from the backlight
    g.fillRect(0, 300, 1024, 40);
    const t = new CanvasTexture(c);
    t.mapping = EquirectangularReflectionMapping;
    t.colorSpace = SRGBColorSpace;
    const pm = new PMREMGenerator(gl);
    const env = pm.fromEquirectangular(t).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.7;
    t.dispose();
    pm.dispose();

    const key = new DirectionalLight('#fffaf0', 2.4);
    key.position.set(-2, 6, -2.5); // from above and behind: tops bright, cap fronts fall into soft shade
    const strip = new RectAreaLight('#ffffff', 2.5, 7, 0.6);
    strip.position.set(1.5, 3.2, 2.6);
    strip.lookAt(0, 0, 0);
    scene.add(key, strip);
    return () => {
      scene.remove(key, strip);
      scene.environment = null;
      env.dispose();
    };
  }, [gl, scene]);
  return null;
}

const FIXED = { position: 'fixed', inset: 0, width: '100%', height: '100%' } as const;

function Fallback() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="./keyboard-fallback.webp" alt="The Phosphor One keyboard, backlit in phosphor green"
      style={{ ...FIXED, objectFit: 'contain', pointerEvents: 'none' }} />
  );
}

// WebGL can still fail after the probe (context creation, lost GPU): show the still instead of nothing.
class GLBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    markGLLost();
  }
  render() {
    return this.state.failed ? <Fallback /> : this.props.children;
  }
}

// WebGL2 with renderable half-float targets; anything less gets the still image.
function hasWebGL2() {
  const gl = document.createElement('canvas').getContext('webgl2');
  const ok = canRenderGL(gl);
  gl?.getExtension('WEBGL_lose_context')?.loseContext(); // free the probe context right away
  return ok;
}

/** Fixed full-screen canvas; falls back to a still image without WebGL2. */
export function Stage({ children }: { children: ReactNode }) {
  const [support, setSupport] = useState<null | { webgl2: boolean; dpr: number }>(null);
  useEffect(() => {
    setSupport({
      webgl2: hasWebGL2(),
      dpr: maxDpr({ coarse: matchMedia('(pointer: coarse)').matches, w: innerWidth, h: innerHeight }),
    });
  }, []);

  if (!support) return null;
  if (!support.webgl2) return <Fallback />;
  return (
    <GLBoundary>
      <Canvas
        style={FIXED}
        // Pointer events come from the whole page: the sections' DOM sits above the fixed canvas.
        eventSource={document.body}
        eventPrefix="client"
        aria-hidden="true" // the DOM nav and the Shortcuts map carry what the 3D keys do
        dpr={[1, support.dpr]}
        camera={{ fov: 26, position: [0, 3.5, 4.3], near: 0.1, far: 50 }}
        // MSAA happens in Composite's scene target; the default framebuffer only gets a full-screen pass.
        gl={{ antialias: false, alpha: true, toneMapping: NeutralToneMapping }}
        onCreated={({ gl, scene, camera }) => {
          camera.lookAt(0, 0, 0);
          if (process.env.NODE_ENV !== 'production') Object.assign(window, { __phosphor: { gl, scene, camera } });
        }}
      >
        <Studio />
        {children}
      </Canvas>
    </GLBoundary>
  );
}
