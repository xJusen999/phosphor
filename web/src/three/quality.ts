/** Max device pixel ratio: touch devices and small screens (shorter side < 768 px) are capped at 1.5. */
export const maxDpr = ({ coarse, w, h }: { coarse: boolean; w: number; h: number }) =>
  coarse || Math.min(w, h) < 768 ? 1.5 : 2;

/** The smoke and the composite render into half-float targets: WebGL2 alone does not make those renderable. */
export const canRenderGL = (gl: { getExtension(name: string): unknown } | null) =>
  !!gl && !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
