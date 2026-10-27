export type BuildConfig = {
  caseFinish: 'frost' | 'graphite' | 'clear';
  keycaps: 'phosphor' | 'ink' | 'blank';
  switchType: 'linear' | 'tactile' | 'clicky';
};

type Opt = { label: string; price: number };

export const OPTIONS = {
  base: 219,
  caseFinish: {
    frost: { label: 'Frost', price: 0 },
    graphite: { label: 'Graphite', price: 20 },
    clear: { label: 'Clear', price: 30 },
  },
  keycaps: {
    phosphor: { label: 'Phosphor', price: 0 },
    ink: { label: 'Ink', price: 15 },
    blank: { label: 'Blank', price: 25 },
  },
  switchType: {
    linear: { label: 'Linear', price: 0 },
    tactile: { label: 'Tactile', price: 0 },
    clicky: { label: 'Clicky', price: 10 },
  },
} as const satisfies Record<string, number | Record<string, Opt>>;

export function priceOf(c: BuildConfig): number {
  let total: number = OPTIONS.base;
  for (const group of ['caseFinish', 'keycaps', 'switchType'] as const) {
    const opts: Record<string, Opt> = OPTIONS[group];
    const id = c[group];
    if (!Object.prototype.hasOwnProperty.call(opts, id)) throw new Error('unknown option');
    total += opts[id].price;
  }
  return total;
}
