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
};

export const GL_READY_EVENT = 'phosphor:gl-ready';
