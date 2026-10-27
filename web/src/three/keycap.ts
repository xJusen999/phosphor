import { BufferGeometry, Float32BufferAttribute } from 'three';
import { LAYOUT_60, type KeyDef } from '@phosphor/shared';

// All dimensions in millimetres (1 unit = 1 mm); the scene scales the whole keyboard.
export const UNIT = 19.05;
export const ROW_HEIGHT = [11.5, 9.5, 9, 9.25, 9.25];
// OEM sculpt: top-face slope per row in degrees (+ = back edge higher, the face leans toward the typist).
const ROW_TILT = [7, 3.5, 0, -3, -5];
const DEPTH = 17.85;
const TAPER = 3.2;
const RADIUS = 2;
const DISH = 0.8;
const CORNER_SEGMENTS = 6;
const INNER_RINGS = 4;

// One rounded-rectangle ring, counter-clockwise seen from above (x right, z toward the typist).
// Point count depends only on (nx, nz), so rings of different size can be lofted together.
function outline(hw: number, hd: number, nx: number, nz: number): [number, number][] {
  const cx = hw - RADIUS, cz = hd - RADIUS;
  const corners: [number, number, number][] = [[cx, cz, 0], [-cx, cz, Math.PI / 2], [-cx, -cz, Math.PI], [cx, -cz, 1.5 * Math.PI]];
  const pts: [number, number][] = [];
  corners.forEach(([ox, oz, a0], k) => {
    for (let j = 0; j < CORNER_SEGMENTS; j++) {
      const a = a0 + (j / CORNER_SEGMENTS) * (Math.PI / 2);
      pts.push([ox + RADIUS * Math.cos(a), oz + RADIUS * Math.sin(a)]);
    }
    const [nox, noz, na0] = corners[(k + 1) % 4];
    const sx = ox + RADIUS * Math.cos(a0 + Math.PI / 2), sz = oz + RADIUS * Math.sin(a0 + Math.PI / 2);
    const ex = nox + RADIUS * Math.cos(na0), ez = noz + RADIUS * Math.sin(na0);
    const n = k % 2 === 0 ? nx : nz;
    for (let j = 0; j < n; j++) pts.push([sx + ((ex - sx) * j) / n, sz + ((ez - sz) * j) / n]);
  });
  return pts;
}

/**
 * Sculpted OEM-like keycap: a lofted rounded rectangle (8 rings) whose top is cylindrically dished
 * and sloped per row. Base sits on y = 0, centred on x/z. UVs span the base footprint
 * (u: left to right, v: front to back, v = 1 at the back) so a legend cell maps onto the top face.
 */
export function buildKeycapGeometry(widthU: number, row: number): BufferGeometry {
  const h = ROW_HEIGHT[row];
  const W = widthU * UNIT - 1.2, hw = W / 2, hd = DEPTH / 2;
  const nx = Math.max(2, Math.ceil((W - 2 * RADIUS) / 2)), nz = Math.max(2, Math.ceil((DEPTH - 2 * RADIUS) / 2));
  const hwTop = hw - TAPER / 2, hdTop = hd - TAPER / 2;
  const tilt = Math.tan((ROW_TILT[row] * Math.PI) / 180);

  // How far the top surface drops below h at (x, z): cylindrical dish across x + row slope along z.
  const drop = (x: number, z: number) =>
    DISH * Math.max(0, 1 - (x / hwTop) ** 2) + Math.abs(tilt) * (tilt >= 0 ? z + hdTop : hdTop - z);

  // [height (mm), inset per side (mm)]: straight tapered walls, then a rounded top edge.
  const rings: [number, number][] = [];
  for (let i = 0; i < 6; i++) rings.push([(i / 5) * (h - 1.3), (i / 5) * 1.05]);
  rings.push([h - 0.45, 1.3], [h, TAPER / 2]);

  const pos: number[] = [];
  const index: number[] = [];
  const perRing = outline(hw, hd, nx, nz).length;
  const push = (x: number, y: number, z: number) => pos.push(x, y, z);

  rings.forEach(([y, inset], i) => {
    const w = i === rings.length - 1 ? 1 : (y / h) ** 3; // the sculpt fades into the walls
    for (const [x, z] of outline(hw - inset, hd - inset, nx, nz)) push(x, y - w * drop(x, z), z);
  });
  // Top face: the top ring shrunk toward the centre, then a centre vertex.
  const top = outline(hwTop, hdTop, nx, nz);
  for (let k = 1; k < INNER_RINGS; k++) {
    const s = 1 - k / INNER_RINGS;
    for (const [x, z] of top) push(x * s, h - drop(x * s, z * s), z * s);
  }
  push(0, h - drop(0, 0), 0);

  const ringCount = rings.length + INNER_RINGS - 1;
  for (let r = 0; r < ringCount - 1; r++) {
    for (let j = 0; j < perRing; j++) {
      const a = r * perRing + j, b = r * perRing + ((j + 1) % perRing);
      const c = a + perRing, d = b + perRing;
      index.push(a, c, b, b, c, d);
    }
  }
  const centre = ringCount * perRing, last = (ringCount - 1) * perRing;
  for (let j = 0; j < perRing; j++) index.push(last + j, centre, last + ((j + 1) % perRing));

  // The dish and the slope can leave the highest point a hair under h: rescale so the cap is exactly h tall.
  let maxY = 0;
  for (let i = 1; i < pos.length; i += 3) maxY = Math.max(maxY, pos[i]);
  for (let i = 1; i < pos.length; i += 3) pos[i] *= h / maxY;

  const uv: number[] = [];
  for (let i = 0; i < pos.length; i += 3) uv.push((pos[i] + hw) / W, (hd - pos[i + 2]) / DEPTH);

  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/** One instanced mesh per distinct cap shape (width and row profile), keys in layout order. */
export type CapGroup = { w: number; row: number; keys: KeyDef[]; layoutIndex: number[] };

export const capGroups: CapGroup[] = (() => {
  const byShape = new Map<string, CapGroup>();
  LAYOUT_60.forEach((k, i) => {
    const id = `${k.w}:${k.row}`;
    if (!byShape.has(id)) byShape.set(id, { w: k.w, row: k.row, keys: [], layoutIndex: [] });
    const grp = byShape.get(id)!;
    grp.keys.push(k);
    grp.layoutIndex.push(i);
  });
  return [...byShape.values()];
})();

/** KeyboardEvent.code → slot in `capGroups` (mesh) and instance index. */
export const keyToInstance = new Map<string, { mesh: number; index: number }>(
  capGroups.flatMap((grp, mesh) => grp.keys.map((k, index) => [k.code, { mesh, index }] as const)),
);

/** Key centre on the plate, in mm: x to the right, z toward the typist (row 0 at the back). */
export const keyCentre = (k: KeyDef): [number, number] => [(k.x + k.w / 2) * UNIT - (15 * UNIT) / 2, (k.row + 0.5) * UNIT - (5 * UNIT) / 2];
