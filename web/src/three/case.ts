import {
  BufferGeometry, Color, ExtrudeGeometry, Group, Mesh, MeshBasicMaterial, MeshPhysicalMaterial,
  MeshStandardMaterial, Path, PlaneGeometry, Shape,
} from 'three';

// Millimetres. The case is a wedge: 22 mm at the front, 30 mm at the back (typing angle).
export const CASE = { w: 300, d: 105, front: 22, rear: 30, wall: 4, radius: 9 };
export const PHOSPHOR = new Color('#39ff6e');
const STRIP_H = 4;
const BEVEL = 2;

// The internal stack (gasket, PCB, plate, switches, caps) follows the typing angle; plate top 4 mm under the rim.
export const DECK_TILT = Math.atan((CASE.rear - CASE.front) / CASE.d);
export const DECK_Y = (CASE.front + CASE.rear) / 2 - 4;

function rounded<T extends Path>(w: number, d: number, r: number, into: T): T {
  const x = -w / 2, y = -d / 2;
  into.moveTo(x + r, y);
  into.lineTo(x + w - r, y);
  into.quadraticCurveTo(x + w, y, x + w, y + r);
  into.lineTo(x + w, y + d - r);
  into.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  into.lineTo(x + r, y + d);
  into.quadraticCurveTo(x, y + d, x, y + d - r);
  into.lineTo(x, y + r);
  into.quadraticCurveTo(x, y, x + r, y);
  return into;
}

// Rounded slab lying flat, bottom at y = 0.
function slab(w: number, d: number, t: number, r: number, bevel = 0): BufferGeometry {
  const g = new ExtrudeGeometry(rounded(w - 2 * bevel, d - 2 * bevel, Math.max(r - bevel, 0.5), new Shape()), {
    depth: t - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 8,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bevel, 0);
  return g;
}

// Hollow shell: rounded tube with a 4 mm wall and bevelled edges, then sheared into the wedge.
function shellGeometry(): BufferGeometry {
  const { w, d, wall, radius } = CASE;
  const outer = rounded(w - 2 * BEVEL, d - 2 * BEVEL, radius - BEVEL, new Shape());
  outer.holes.push(rounded(w - 2 * wall + 2 * BEVEL, d - 2 * wall + 2 * BEVEL, radius - wall + BEVEL, new Path()));
  const depth = 15;
  const g = new ExtrudeGeometry(outer, { depth, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL, bevelSegments: 4, curveSegments: 10 });
  g.rotateX(-Math.PI / 2); // extrusion now runs up y (from -BEVEL to depth + BEVEL); shape y became -z
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i);
    const top = CASE.front + ((CASE.rear - CASE.front) * (d / 2 - z)) / d; // back (-z) is taller
    p.setY(i, STRIP_H + ((p.getY(i) + BEVEL) / (depth + 2 * BEVEL)) * (top - STRIP_H));
  }
  g.computeBoundingBox();
  return g;
}

/**
 * Case group (mm, y up, z toward the typist): shell, emissive underglow strip under the base,
 * a soft floor plane for shadow and spill, and the tilted `deck` (gasket, PCB, plate) that the
 * keyboard fills with switches and keycaps. Textures are painted later (canvas, browser only).
 */
export function buildCase(): Group {
  const root = new Group();
  root.name = 'case';

  const shell = new Mesh(shellGeometry(), new MeshPhysicalMaterial({
    color: '#eeeeea', roughness: 0.34, clearcoat: 0.35, clearcoatRoughness: 0.35, sheen: 0.4, sheenColor: '#ffffff',
  }));
  shell.name = 'shell';

  const strip = new Mesh(
    slab(CASE.w - 5, CASE.d - 5, STRIP_H, CASE.radius - 2.5),
    new MeshBasicMaterial({ color: PHOSPHOR.clone().multiplyScalar(2.2) }),
  );
  strip.name = 'strip';

  const floor = new Mesh(new PlaneGeometry(CASE.w * 1.55, CASE.d * 2.6), new MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }));
  floor.name = 'floor';
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -26;
  floor.renderOrder = -1;

  const deck = new Group();
  deck.name = 'deck';
  deck.position.y = DECK_Y;
  deck.rotation.x = DECK_TILT;

  const pw = CASE.w - 2 * CASE.wall - 5, pd = CASE.d - 2 * CASE.wall - 1.5;
  const plate = new Mesh(slab(pw, pd, 1.5, 3), new MeshStandardMaterial({
    color: '#16241a', roughness: 0.55, metalness: 0.2, emissive: PHOSPHOR, emissiveIntensity: 1,
  }));
  plate.name = 'plate';
  plate.position.y = -1.5;
  const pcb = new Mesh(slab(pw, pd, 1.6, 3), new MeshStandardMaterial({ color: '#e4e7e1', roughness: 0.7 }));
  pcb.name = 'pcb';
  pcb.position.y = -6.6;
  const gasket = new Mesh(slab(pw, pd, 2.4, 3), new MeshStandardMaterial({ color: '#c9ccc6', roughness: 0.95 }));
  gasket.name = 'gasket';
  gasket.position.y = -9;
  deck.add(gasket, pcb, plate);

  root.add(floor, strip, shell, deck);
  return root;
}
