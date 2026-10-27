/** Max device pixel ratio: touch devices and small screens (shorter side < 768 px) are capped at 1.5. */
export const maxDpr = ({ coarse, w, h }: { coarse: boolean; w: number; h: number }) =>
  coarse || Math.min(w, h) < 768 ? 1.5 : 2;
