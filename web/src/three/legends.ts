import { CanvasTexture, SRGBColorSpace } from 'three';
import { LAYOUT_60, type KeyDef, type SectionId } from '@phosphor/shared';
import { CASE } from './case';
import { UNIT, keyCentre } from './keycap';

// Canvas-painted textures (browser only): the legend atlas, the plate's LED map and the floor spill.
const PX = 8; // atlas pixels per mm
const DEPTH = 17.85;
const AW = Math.round(15 * UNIT * PX), AH = Math.round(5 * UNIT * PX);

const SUB: Partial<Record<SectionId, string>> = {
  top: 'home', brand: 'phosphor', specs: 'specs', sound: 'sound', build: 'build', type: 'type', order: 'order',
};

/** UV rect [u0, v0, du, dv] of a key's cell in the atlas (cells are laid out like the keyboard). */
export function legendRect(k: KeyDef): [number, number, number, number] {
  const x0 = (k.x * UNIT + 0.6) * PX, y0 = (k.row * UNIT + 0.6) * PX;
  const w = (k.w * UNIT - 1.2) * PX, h = DEPTH * PX;
  return [x0 / AW, 1 - (y0 + h) / AH, w / AW, h / AH];
}

function fontFamily() {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--font-mono').trim();
  return v ? `${v}, ui-monospace, monospace` : 'ui-monospace, Menlo, Consolas, monospace';
}

/** Wait (bounded) for the legend font so the atlas is not painted with a fallback. */
export async function legendFontReady(): Promise<void> {
  const timeout = new Promise((r) => setTimeout(r, 2500));
  await Promise.race([document.fonts.load(`500 40px ${fontFamily()}`).catch(() => undefined), timeout]);
}

/**
 * Legend atlas, one cell per key in layout position. Channels are masks, not colours:
 * R = crisp legend, G = soft halo of the legend. The keycap shader tints them with the backlight.
 */
export function legendAtlas(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = AW;
  c.height = AH;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000'; // opaque black so the additive masks stay linear after upload
  g.fillRect(0, 0, AW, AH);
  g.globalCompositeOperation = 'lighter';
  const family = fontFamily();

  const text = (s: string, x: number, y: number, sizeMm: number, align: CanvasTextAlign, weight = 500) => {
    g.font = `${weight} ${sizeMm * PX}px ${family}`;
    g.textAlign = align;
    g.textBaseline = 'middle';
    g.fillStyle = '#000';
    g.shadowColor = 'rgb(0,255,0)';
    g.shadowBlur = sizeMm * PX * 0.4;
    g.fillText(s, x, y);
    g.fillText(s, x, y); // doubled for a denser halo
    g.shadowColor = 'transparent';
    g.fillStyle = 'rgb(255,0,0)';
    g.fillText(s, x, y);
  };

  for (const k of LAYOUT_60) {
    const x0 = (k.x * UNIT + 0.6) * PX, y0 = (k.row * UNIT + 0.6) * PX;
    const w = (k.w * UNIT - 1.2) * PX, h = DEPTH * PX;
    const inset = 3.3 * PX;
    const word = k.label.length > 1;
    if (!k.label) {
      // Space: legend-less except for its section hint.
    } else if (word) {
      text(k.label.toLowerCase(), x0 + inset, y0 + h * 0.4, 3.4, 'left');
    } else {
      text(k.label, x0 + w / 2, y0 + h * 0.45, 6.4, 'center');
    }
    const sub = k.fn && SUB[k.fn];
    if (sub) {
      const subX = k.label ? x0 + w - inset : x0 + w / 2;
      text(sub, subX, y0 + h * 0.76, 2.3, k.label ? 'right' : 'center', 400);
    }
  }
  const t = new CanvasTexture(c);
  t.anisotropy = 8;
  return t;
}

/** Plate emissive map: a dim base with a bright LED pool under every key (fn keys hotter). Mapped in mm. */
export function plateTexture(pw: number, pd: number): CanvasTexture {
  const P = 3;
  const c = document.createElement('canvas');
  c.width = Math.round(pw * P);
  c.height = Math.round(pd * P);
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgb(70,70,70)';
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'lighter';
  for (const k of LAYOUT_60) {
    const [x, z] = keyCentre(k);
    const cx = (x + pw / 2) * P, cy = (z - 3.5 + pd / 2) * P; // north-facing LED
    const r = (k.w > 1.5 ? 12 : 10) * P;
    const grd = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    const a = k.fn ? 1 : 0.62;
    grd.addColorStop(0, `rgba(255,255,255,${a})`);
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  }
  const t = new CanvasTexture(c);
  // Extrude UVs are in mm centred on the slab: map them onto the canvas.
  t.repeat.set(1 / pw, 1 / pd);
  t.offset.set(0.5, 0.5);
  return t;
}

/** Floor under the floating keyboard: a soft contact shadow and green spill from the underglow strip. */
export function floorTexture(planeW: number, planeD: number): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = Math.round((1024 * planeD) / planeW);
  const g = c.getContext('2d')!;
  const s = c.width / planeW;
  const box = (w: number, d: number, r: number) => {
    const x = -5000 - (w * s) / 2, y = c.height / 2 - (d * s) / 2;
    g.beginPath();
    g.roundRect(x, y, w * s, d * s, r * s);
  };
  // Shapes are drawn off-canvas; only their shadow lands (works without ctx.filter support).
  g.shadowOffsetX = 5000 + c.width / 2;
  g.shadowColor = 'rgba(57,255,110,0.55)';
  g.shadowBlur = 34 * s;
  box(CASE.w + 6, CASE.d + 6, 14);
  g.lineWidth = 8 * s;
  g.stroke();
  g.shadowColor = 'rgba(13,15,12,0.30)';
  g.shadowBlur = 22 * s;
  box(CASE.w - 30, CASE.d - 24, 20);
  g.fill();
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}
