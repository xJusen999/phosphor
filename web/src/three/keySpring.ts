// Key travel spring (mm). `dirty` is true whenever y changed, so the caller rewrites the instance matrix.
const STIFFNESS = 1400;
const DAMPING = 46; // slightly under-damped: a fast press with a small rebound
const REST = 1e-3;

export function stepKey(y: number, v: number, target: number, dt: number, still: boolean) {
  let ny = target, nv = 0;
  if (!still) {
    nv = v + (STIFFNESS * (target - y) - DAMPING * v) * dt;
    ny = y + nv * dt;
    if (Math.abs(ny - target) < REST && Math.abs(nv) < REST) {
      ny = target; // settle exactly so the last write lands on the rest position
      nv = 0;
    }
  }
  return { y: ny, v: nv, dirty: ny !== y };
}
