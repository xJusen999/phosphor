export const AVATAR_SIZE = 7;

// FNV-1a hash of the name seeds a mulberry32 generator: the same name always draws the same face.
function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A mirrored dot-matrix portrait (row-major, AVATAR_SIZE²): 0 = dark, 1 = lit, 2 = lit hot (phosphor).
 * Procedural on purpose: the team are invented people, so no photos.
 */
export function avatarCells(name: string): number[] {
  const r = rng(name);
  const n = AVATAR_SIZE, half = Math.ceil(n / 2);
  const cells = new Array<number>(n * n).fill(0);
  let hot = false;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < half; x++) {
      const v = r() < 0.52 ? (r() < 0.18 ? 2 : 1) : 0;
      hot ||= v === 2;
      cells[y * n + x] = cells[y * n + n - 1 - x] = v;
    }
  if (!hot) {
    const i = Math.max(cells.indexOf(1), 0);
    const x = i % n, y = (i - x) / n;
    cells[i] = cells[y * n + n - 1 - x] = 2;
  }
  return cells;
}
