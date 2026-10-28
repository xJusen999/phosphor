'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import {
  Box3, BoxGeometry, Color, Group, InstancedBufferAttribute, InstancedMesh, Mesh, MeshBasicMaterial, MeshPhysicalMaterial,
  MeshStandardMaterial, Object3D, PlaneGeometry, Vector3, type Texture,
} from 'three';
import { LAYOUT_60, type BuildConfig, type KeyDef } from '@phosphor/shared';
import { buildCase, CASE, DECK_SIZE, LAYER_Y, PHOSPHOR } from './case';
import { buildKeycapGeometry, capGroups, keyCentre, UNIT } from './keycap';
import { stepKey } from './keySpring';
import { isRealClick } from './clickGuard';
import { fx } from './bus';
import { floorTexture, legendAtlas, legendFontReady, legendRect, plateTexture } from './legends';

export { keyToInstance } from './keycap';

type Props = {
  pressed: Set<string>;
  heat?: Float32Array;
  finish: BuildConfig;
  /** 0..1; a ref lets the scroll rig drive it every frame without re-rendering. */
  explode: number | { current: number };
  /** A cap under the pointer was pressed ('down') or clicked ('click'), at client coordinates. */
  onCap?: (key: KeyDef, type: 'down' | 'click', at: { x: number; y: number }) => void;
};

// DOM controls drawn over the canvas keep their clicks (R3F listens on the whole body).
const OVER_DOM = 'a, button, input, textarea, select, label, summary, dialog';

const CAP_Y = 5; // cap base above the plate top (mm)
const TRAVEL = -4;
const BASE_GLOW = 1.15;
const FN_GLOW = 2.6;
const BREATH_S = 2.4;
// Explode offsets per layer (mm, up): caps, switches, plate, PCB, gasket; strip goes down. Evenly spread so
// every layer clears the case rim and gets its own leader line in Specs.
const EXPLODE = { caps: 104, switches: 74, plate: 50, pcb: 32, gasket: 16, strip: -10 };

const CASE_FINISH: Record<BuildConfig['caseFinish'], Partial<MeshPhysicalMaterial>> = {
  frost: { color: new Color('#eeeeea'), roughness: 0.34, metalness: 0, opacity: 1, transparent: false, emissiveIntensity: 0 },
  graphite: { color: new Color('#2a2d2b'), roughness: 0.42, metalness: 0.55, opacity: 1, transparent: false, emissiveIntensity: 0 },
  // Polycarbonate fills with the LEDs' light: a faint green glow, so it reads as clear even on a white page.
  clear: { color: new Color('#e3f5e8'), roughness: 0.06, metalness: 0, opacity: 0.34, transparent: true, emissive: PHOSPHOR.clone(), emissiveIntensity: 0.28 },
};
const CAP_COLOR: Record<BuildConfig['keycaps'], string> = { phosphor: '#f4f4f0', ink: '#1a1d1a', blank: '#f4f4f0' };

// Keycap material: white PBT, legends lit from below. Per-instance backlight comes in as instanceColor
// (phosphor green × intensity); the atlas masks are R = legend, G = legend halo.
function capMaterial(atlas: { value: Texture }, legend: { value: number }) {
  const m = new MeshStandardMaterial({ color: CAP_COLOR.phosphor, roughness: 0.5 });
  m.onBeforeCompile = (s) => {
    s.uniforms.uAtlas = atlas;
    s.uniforms.uLegend = legend;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aLegend;\nvarying vec2 vLegUv;\nvarying float vCapY;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvLegUv = aLegend.xy + uv * aLegend.zw;\nvCapY = position.y;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uAtlas;\nuniform float uLegend;\nvarying vec2 vLegUv;\nvarying float vCapY;')
      .replace('#include <color_fragment>', 'vec3 leg = texture2D(uAtlas, vLegUv).rgb * uLegend;\ndiffuseColor.rgb *= 1.0 - 0.92 * leg.r;')
      .replace(
        '#include <emissivemap_fragment>',
        `float glowI = max(vColor.g, 1e-3);
        // fn caps (as in sketch A): mint-washed cap, dark-green legend in a dense green aura,
        // and a white-hot core in the light under the cap.
        float hotness = smoothstep(1.6, 2.2, glowI);
        vec3 whiteHot = vec3(0.83, 1.0, 0.87) * glowI;
        float skirt = 1.0 - smoothstep(0.0, 7.5, vCapY);
        totalEmissiveRadiance = mix(vColor * 0.8, vColor * 0.08, hotness) * leg.r
          + vColor * ((0.3 + 0.9 * hotness) * leg.g + 0.07 * hotness)
          + mix(vColor, whiteHot, hotness) * 0.85 * skirt * skirt;`,
      );
  };
  return m;
}

function build() {
  const root = new Group();
  const kase = buildCase();
  const deck = kase.getObjectByName('deck')!;
  const plate = deck.getObjectByName('plate') as Mesh;
  plate.geometry.computeBoundingBox();
  const pb = plate.geometry.boundingBox!;
  (plate.material as MeshStandardMaterial).emissiveMap = plateTexture(pb.max.x - pb.min.x, pb.max.z - pb.min.z);
  (plate.material as MeshStandardMaterial).emissiveIntensity = 2.1;
  const floor = kase.getObjectByName('floor') as Mesh;
  const fp = (floor.geometry as PlaneGeometry).parameters;
  (floor.material as MeshBasicMaterial).map = floorTexture(fp.width, fp.height);

  const uniforms = { atlas: { value: legendAtlas() as Texture }, legend: { value: 1 } };
  const capMat = capMaterial(uniforms.atlas, uniforms.legend);
  const caps = new Group();
  const dummy = new Object3D();
  const green = new Color();

  const meshes = capGroups.map((grp) => {
    const geo = buildKeycapGeometry(grp.w, grp.row);
    geo.setAttribute('aLegend', new InstancedBufferAttribute(new Float32Array(grp.keys.flatMap(legendRect)), 4));
    const mesh = new InstancedMesh(geo, capMat, grp.keys.length);
    grp.keys.forEach((k, i) => {
      const [x, z] = keyCentre(k);
      dummy.position.set(x, CAP_Y, z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, green.copy(PHOSPHOR).multiplyScalar(k.fn ? FN_GLOW : BASE_GLOW));
    });
    caps.add(mesh);
    return mesh;
  });

  // Translucent switch housings: they fill the gaps between caps with lit green.
  const switches = new InstancedMesh(
    new BoxGeometry(14, 4.6, 14).translate(0, 2.3, 0),
    new MeshStandardMaterial({ color: '#dfe9e2', roughness: 0.3, emissive: PHOSPHOR, emissiveIntensity: 0.9 }),
    LAYOUT_60.length,
  );
  LAYOUT_60.forEach((k, i) => {
    const [x, z] = keyCentre(k);
    dummy.position.set(x, 0, z);
    dummy.updateMatrix();
    switches.setMatrixAt(i, dummy.matrix);
  });

  deck.add(switches, caps);
  root.add(kase);
  root.scale.setScalar(0.01); // mm → scene units
  const layer = (name: string) => kase.getObjectByName(name)!;
  const layers = { plate: layer('plate'), pcb: layer('pcb'), gasket: layer('gasket'), strip: layer('strip') };

  // Leader-line anchors on each layer's right edge, in Specs' order (caps → case); they ride the explode.
  const edge = DECK_SIZE.w / 2;
  const anchors = ([
    [caps, 7.5 * UNIT - 4, CAP_Y + 9],
    [switches, edge - 8, 4.6],
    [layers.plate, edge, 1.5],
    [layers.pcb, edge, 1.6],
    [layers.gasket, edge, 2.4],
    [kase.getObjectByName('shell')!, CASE.w / 2, 16],
  ] as const).map(([parent, x, y]) => {
    const a = new Object3D();
    a.position.set(x, y, 0);
    parent.add(a);
    return a;
  });
  return { root, kase, caps, switches, layers, anchors, meshes, uniforms, capMat };
}

/** The Phosphor One, built procedurally. Keys are addressed by KeyboardEvent.code (see keyToInstance). */
export function Keyboard({ pressed, heat, finish, explode, onCap }: Props) {
  const parts = useMemo(build, []);
  const reduced = useRef(false);
  // Spring state per layout key: travel (mm) and velocity.
  const spring = useMemo(() => ({ y: new Float32Array(LAYOUT_60.length), v: new Float32Array(LAYOUT_60.length) }), []);

  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => (reduced.current = mq.matches);
    sync();
    mq.addEventListener('change', sync);
    let alive = true;
    // Repaint the atlas once the legend font is in (the first paint may use a fallback face).
    legendFontReady().then(() => {
      if (!alive) return;
      const old = parts.uniforms.atlas.value;
      parts.uniforms.atlas.value = legendAtlas();
      old.dispose();
    });
    return () => {
      alive = false;
      mq.removeEventListener('change', sync);
    };
  }, [parts]);

  useEffect(
    () => () => {
      parts.root.traverse((o) => {
        const m = o as Mesh;
        m.geometry?.dispose();
        const mats = m.material ? ([] as unknown[]).concat(m.material) : [];
        for (const mat of mats as MeshStandardMaterial[]) {
          mat.map?.dispose();
          mat.emissiveMap?.dispose();
          mat.dispose();
        }
      });
      parts.uniforms.atlas.value.dispose();
    },
    [parts],
  );

  useEffect(() => {
    const shell = parts.kase.getObjectByName('shell') as Mesh<never, MeshPhysicalMaterial>;
    Object.assign(shell.material, CASE_FINISH[finish.caseFinish]);
    shell.material.depthWrite = finish.caseFinish !== 'clear';
    shell.material.needsUpdate = true;
    parts.capMat.color.set(CAP_COLOR[finish.keycaps]);
    parts.uniforms.legend.value = finish.keycaps === 'blank' ? 0 : 1;
  }, [finish, parts]);

  // R3F raycasts the whole board on every pointer event anywhere on the page (its events come from <body>).
  // Gate it: events are on only while the pointer is over the board's projected screen box.
  const get = useThree((s) => s.get);
  useEffect(() => {
    const shell = parts.kase.getObjectByName('shell')!;
    const box = new Box3(), caps = new Box3(), p = new Vector3();
    const MARGIN = 8; // CSS px
    let on = true;
    const gate = (e: PointerEvent) => {
      const { camera, size, setEvents } = get();
      box.setFromObject(shell).union(caps.setFromObject(parts.caps)); // the caps rise above the shell when exploded
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < 8; i++) {
        p.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera);
        const x = ((p.x + 1) / 2) * size.width, y = ((1 - p.y) / 2) * size.height;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      const inside = e.clientX > x0 - MARGIN && e.clientX < x1 + MARGIN && e.clientY > y0 - MARGIN && e.clientY < y1 + MARGIN;
      if (inside !== on) setEvents({ enabled: (on = inside) });
    };
    // Capture on window: runs before R3F's own listener on <body> sees the same event.
    const opts = { capture: true, passive: true };
    addEventListener('pointermove', gate, opts);
    addEventListener('pointerdown', gate, opts);
    return () => {
      removeEventListener('pointermove', gate, opts);
      removeEventListener('pointerdown', gate, opts);
      get().setEvents({ enabled: true });
    };
  }, [get, parts]);

  const dummy = useMemo(() => new Object3D(), []);
  const color = useMemo(() => new Color(), []);
  const anchor = useMemo(() => new Vector3(), []);
  const leaderPts = useMemo(() => new Float32Array(parts.anchors.length * 2), [parts]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const still = reduced.current;
    const breath = still ? 1 : 0.85 + 0.15 * Math.sin((state.clock.elapsedTime / BREATH_S) * Math.PI * 2);

    const e = Math.min(Math.max(typeof explode === 'number' ? explode : explode.current, 0), 1);
    parts.caps.position.y = e * EXPLODE.caps;
    parts.switches.position.y = e * EXPLODE.switches;
    parts.layers.plate.position.y = LAYER_Y.plate + e * EXPLODE.plate;
    parts.layers.pcb.position.y = LAYER_Y.pcb + e * EXPLODE.pcb;
    parts.layers.gasket.position.y = LAYER_Y.gasket + e * EXPLODE.gasket;
    parts.layers.strip.position.y = e * EXPLODE.strip;

    if (fx.leaders) {
      parts.anchors.forEach((a, i) => {
        a.getWorldPosition(anchor).project(state.camera);
        leaderPts[i * 2] = ((anchor.x + 1) / 2) * state.size.width;
        leaderPts[i * 2 + 1] = ((1 - anchor.y) / 2) * state.size.height;
      });
      fx.leaders(leaderPts, e);
    }

    parts.meshes.forEach((mesh, m) => {
      const grp = capGroups[m];
      let moved = false;
      grp.keys.forEach((k, i) => {
        const li = grp.layoutIndex[i];
        const target = pressed.has(k.code) ? TRAVEL : 0;
        const s = stepKey(spring.y[li], spring.v[li], target, dt, still);
        spring.y[li] = s.y;
        spring.v[li] = s.v;
        const y = s.y;
        if (s.dirty) {
          const [x, z] = keyCentre(k);
          dummy.position.set(x, CAP_Y + y, z);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          moved = true;
        }
        const press = Math.min(Math.max(y / TRAVEL, 0), 1);
        const h = heat?.[li] ?? 0;
        // Press flash stays under the fn "white-hot" threshold (1.6) for plain keys; heat can cross it.
        // sqrt: Space tops the hit count, so the letters still show their share of the heat.
        const glow = (k.fn ? FN_GLOW * breath : BASE_GLOW) * (1 + (k.fn ? 0.6 : 0.38) * press) * (1 + 1.8 * Math.sqrt(h));
        mesh.setColorAt(i, color.copy(PHOSPHOR).multiplyScalar(glow));
      });
      if (moved) mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor!.needsUpdate = true;
    });
  });

  // The nearest hit only: a cap behind the shell or under a DOM control does not count.
  const capAt = (e: ThreeEvent<MouseEvent>) => {
    const hit = e.intersections[0];
    const m = parts.meshes.findIndex((mesh) => mesh === hit?.object);
    if (m < 0 || hit.instanceId === undefined || (e.nativeEvent.target as Element | null)?.closest?.(OVER_DOM)) return null;
    return capGroups[m].keys[hit.instanceId];
  };
  const fire = (type: 'down' | 'click') => (e: ThreeEvent<MouseEvent>) => {
    const k = capAt(e);
    if (!k || (type === 'click' && !isRealClick(e.delta, getSelection()?.toString() ?? ''))) return;
    e.stopPropagation();
    onCap?.(k, type, { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY });
  };
  const hover = (e: ThreeEvent<MouseEvent>) => {
    document.body.style.cursor = capAt(e)?.fn ? 'pointer' : '';
  };

  return (
    <primitive object={parts.root} onPointerDown={fire('down')} onClick={fire('click')} onPointerMove={hover}
      onPointerOut={() => (document.body.style.cursor = '')} />
  );
}
