'use client';

import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Box3, Vector3, type Camera, type Object3D } from 'three';
import { LAYOUT_60 } from '@phosphor/shared';
import { Fluid, simResolution, splatRadius } from './fluid/fluid';
import { keyCentre } from './keycap';
import { fx } from './bus';

const KEYS = new Map(LAYOUT_60.map((k) => [k.code, k]));
const POINTER_FORCE = 5200; // sim texels/s per UV of cursor travel in one frame
const PREWARM_STEPS = 150; // ~2.5 s of smoke already in the room on the first frame
const PREWARM_STILL = 420; // reduced motion: an older, wispier smoke for the one frame that stays
const STEP = 1 / 60;
const VENT_FORCE = 900; // sim texels/s added per second of venting
// Vents in keyboard screen-box units (centre 0, edges ±1) and their outward drift.
const VENTS = [
  { at: [-1.04, -0.3], dir: [-1, 0.3] },
  { at: [1.04, 0.05], dir: [1, 0.35] },
  { at: [-0.35, -1.1], dir: [-0.45, -0.55] },
  { at: [0.5, -1.05], dir: [0.55, -0.45] },
];

type Props = { pressed: Set<string>; keyboard: RefObject<Object3D | null> };

const box = new Box3();
const v = new Vector3();

// Keyboard shell projected to the screen: centre and half extents in UV (y up).
function screenBox(kb: Object3D, camera: Camera) {
  const shell = kb.getObjectByName('shell');
  if (!shell) return null;
  kb.updateWorldMatrix(true, true); // the first frame runs before any render has set the matrices
  box.setFromObject(shell);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < 8; i++) {
    v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera);
    const x = (v.x + 1) / 2, y = (v.y + 1) / 2;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, hw: (x1 - x0) / 2, hh: (y1 - y0) / 2, bottom: y0 };
}

/**
 * Grey smoke on the paper: a GPU fluid (dye R = smoke, G = haze, B = green tint) fed by wisps rising
 * from under the keyboard, the cursor and key presses. The keyboard's backlight tints the dye green
 * where it sits on screen; the composite (Composite.tsx) shades the dye and draws it.
 */
export function Smoke({ pressed, keyboard }: Props) {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const fluid = useMemo(() => {
    const coarse = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 768;
    return new Fluid(gl, {
      res: simResolution({ coarse, dpr: devicePixelRatio }),
      pressureIterations: coarse ? 8 : 20,
      curl: 28,
      velocityDissipation: 0.5,
      dyeDissipation: [0.45, 0.22, 1.2, 0],
    });
  }, [gl]);
  const st = useRef({ reduced: false, warmed: false, t: 0, prev: new Set<string>() });
  const ptr = useRef({ x: 0, y: 0, px: 0, py: 0, moved: false, seen: false });

  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => (st.current.reduced = mq.matches);
    sync();
    mq.addEventListener('change', sync);
    const move = (e: PointerEvent) => {
      const p = ptr.current;
      p.x = e.clientX / innerWidth;
      p.y = 1 - e.clientY / innerHeight;
      if (!p.seen) [p.px, p.py, p.seen] = [p.x, p.y, true];
      p.moved = true;
    };
    addEventListener('pointermove', move, { passive: true });
    if (process.env.NODE_ENV !== 'production') Object.assign(window, { __fluid: fluid });
    return () => {
      mq.removeEventListener('change', sync);
      removeEventListener('pointermove', move);
      fx.dye = fx.velocity = null;
      fluid.dispose();
    };
  }, [fluid]);

  // Dry-ice fog: four vents just outside the keyboard's silhouette, drifting outward and swaying, plus the
  // backlight tint over the keyboard itself. Vents are born green (lit by the keys) and fade to grey.
  const emit = (dt: number, t: number, kb: ReturnType<typeof screenBox>, aspect: number) => {
    if (!kb) return;
    const { cx, cy, hw, hh } = kb;
    fluid.splat(cx, cy, cx, cy, [0, 0], [0, 0, 0.9 * dt], hh * 0.9, [(hw * aspect) / hh, 1]);
    VENTS.forEach(({ at, dir }, i) => {
      const sway = Math.sin(t * 0.43 + i * 1.9);
      const x = cx + at[0] * hw + sway * hw * 0.06, y = cy + at[1] * hh + Math.cos(t * 0.31 + i) * hh * 0.08;
      const vx = dir[0] + sway * 0.35, vy = dir[1] + Math.cos(t * 0.7 + i * 2.3) * 0.35;
      fluid.splat(x, y, x, y, [vx * VENT_FORCE * dt, vy * VENT_FORCE * dt], [2.4 * dt, 1.8 * dt, 1.3 * dt], 0.034);
    });
  };

  useFrame(({ camera }, delta) => {
    const s = st.current;
    fluid.resize(size.width, size.height);
    const aspect = size.width / Math.max(size.height, 1);
    const kb = keyboard.current ? screenBox(keyboard.current, camera) : null;

    if (!s.warmed && kb) {
      for (let i = 0, n = s.reduced ? PREWARM_STILL : PREWARM_STEPS; i < n; i++) {
        emit(STEP, (s.t += STEP), kb, aspect);
        fluid.step(STEP);
      }
      s.warmed = true;
    }
    if (s.reduced || !s.warmed) {
      // Reduced motion: the pre-warmed frame stays as a still.
      fx.dye = fluid.dyeTexture;
      fx.velocity = fluid.velocityTexture;
      return;
    }

    const dt = Math.min(delta, 1 / 30);
    s.t += dt;
    emit(dt, s.t, kb, aspect);

    const p = ptr.current;
    if (p.moved) {
      const dx = p.x - p.px, dy = p.y - p.py;
      const speed = Math.min(Math.hypot(dx * aspect, dy) * 40, 1);
      fluid.splat(p.x, p.y, p.px, p.py, [dx * POINTER_FORCE, dy * POINTER_FORCE], [0.22 * speed, 0.3 * speed, 0], splatRadius(size.width));
      [p.px, p.py, p.moved] = [p.x, p.y, false];
    }

    // Each new key press puffs green-lit smoke up from that key.
    // `pressed` is replaced, never mutated, on every change.
    const deck = keyboard.current?.getObjectByName('deck');
    if (pressed !== s.prev && deck) {
      for (const code of pressed) {
        const k = KEYS.get(code);
        if (s.prev.has(code) || !k) continue;
        const [x, z] = keyCentre(k);
        deck.localToWorld(v.set(x, 18, z)).project(camera);
        const u = (v.x + 1) / 2, w = (v.y + 1) / 2;
        fluid.splat(u, w, u, w, [0, 420], [0.7, 0.5, 1.6], 0.04);
      }
      s.prev = pressed;
    }

    fluid.step(dt);
    fx.dye = fluid.dyeTexture;
    fx.velocity = fluid.velocityTexture;
  });

  return null;
}
