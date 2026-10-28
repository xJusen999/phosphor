import type { Texture } from 'three';

/**
 * Shared state between the GL layers and the DOM (Buttermax's "bus"): the smoke publishes its textures,
 * the hero publishes its headline drawn on a canvas, the composite reads both every frame.
 */
export const fx = {
  dye: null as Texture | null,
  velocity: null as Texture | null,
  /** Headline drawn on a canvas covering `el`'s box grown by `pad` CSS px per side; `version` bumps on every redraw. */
  headline: null as null | { el: HTMLElement; canvas: HTMLCanvasElement; pad: number; version: number },
  /** 0 = DOM headline shows, 1 = the GL copy does (the composite eases toward it). */
  headlineGL: 0,
  /** True once the composite has drawn a frame: the hero only hands the headline to GL after that. */
  glReady: false,
  /**
   * Specs leader lines: every frame the keyboard projects one anchor per layer (caps, switches, plate, PCB,
   * gasket, case) to CSS px and passes them as [x0, y0, x1, y1, …] with the explode amount (0..1).
   */
  leaders: null as null | ((pts: Float32Array, explode: number) => void),
  /** Sound section: the key (KeyboardEvent.code) of the switch card in focus; the rig zooms the board onto it. */
  focusKey: null as string | null,
  /** Where that key should land on screen (CSS px): free space the Sound section picks next to its cards. */
  focusAt: null as null | { x: number; y: number },
};

export const GL_READY_EVENT = 'phosphor:gl-ready';
export const GL_LOST_EVENT = 'phosphor:gl-lost';

/** GL went away (context lost, composite unmounted, error boundary fell back): the DOM headline must paint again. */
export function markGLLost(target: EventTarget = window) {
  fx.glReady = false;
  fx.headlineGL = 0;
  target.dispatchEvent(new Event(GL_LOST_EVENT));
}
