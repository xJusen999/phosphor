import { describe, expect, it, vi } from 'vitest';
import type { BuildConfig } from '@phosphor/shared';
import { chooseClient } from '../src/data/choose';
import { createOffline } from '../src/data/offline';
import { createArtifactDb } from '../src/data/artifactDb';

const clearBlankClicky: BuildConfig = { caseFinish: 'clear', keycaps: 'blank', switchType: 'clicky' };

type Doc = Record<string, unknown>;
// Minimal in-memory stand-in for the artifact `db` namespace.
function fakeDb() {
  const cols: Record<string, Map<string, Doc>> = {};
  let n = 0;
  const col = (name: string) => (cols[name] ??= new Map());
  const snaps = (c: string) => [...col(c)].map(([id, d]) => ({ id, data: () => d }));
  return {
    cols,
    doc: (path: string) => {
      const [c, id] = path.split('/');
      return {
        get: async () => ({ id, exists: col(c).has(id), data: () => col(c).get(id) }),
        set: async (d: Doc) => void col(c).set(id, d),
      };
    },
    collection: (c: string) => ({
      add: async (d: Doc) => {
        const id = `auto${n++}`;
        col(c).set(id, d);
        return { id };
      },
      get: async () => ({ size: col(c).size }),
      orderBy: () => ({ limit: () => ({ get: async () => ({ docs: snaps(c) }) }) }),
    }),
  };
}

describe('chooseClient', () => {
  it('returns api when NEXT_PUBLIC_DATA is api', async () => {
    expect((await chooseClient({ NEXT_PUBLIC_DATA: 'api' })).mode).toBe('api');
  });

  it('returns offline without calling claude.use when NEXT_PUBLIC_DATA is offline', async () => {
    const use = vi.fn();
    expect((await chooseClient({ NEXT_PUBLIC_DATA: 'offline', claude: { use } })).mode).toBe('offline');
    expect(use).not.toHaveBeenCalled();
  });

  it('falls back to offline when claude.use resolves null', async () => {
    const claude = { use: async () => null };
    expect((await chooseClient({ claude })).mode).toBe('offline');
  });

  it('falls back to offline when claude.use rejects', async () => {
    const claude = { use: async () => { throw new Error('no'); } };
    expect((await chooseClient({ claude })).mode).toBe('offline');
  });

  it('falls back to offline when claude is absent', async () => {
    expect((await chooseClient({})).mode).toBe('offline');
  });

  it('falls back to offline after the 10 s cap', async () => {
    vi.useFakeTimers();
    const p = chooseClient({ claude: { use: () => new Promise(() => {}) } });
    await vi.advanceTimersByTimeAsync(10_000);
    expect((await p).mode).toBe('offline');
    vi.useRealTimers();
  });

  it('returns db when claude.use yields a namespace', async () => {
    const claude = { use: async () => fakeDb() };
    expect((await chooseClient({ claude })).mode).toBe('db');
  });
});

describe('offline client', () => {
  it('prices the order from the config', async () => {
    const c = createOffline();
    const r = await c.placeOrder(clearBlankClicky, 'a@b.co');
    expect(r.total).toBe(284);
    expect(r.id).toBeTruthy();
  });

  it('keeps topScores sorted and capped at 10', async () => {
    const c = createOffline();
    for (let i = 0; i < 12; i++) await c.submitScore({ name: `p${i}`, wpm: 50 + i, accuracy: 90 });
    const top = await c.topScores();
    expect(top).toHaveLength(10);
    expect(top.map((s) => s.wpm)).toEqual([61, 60, 59, 58, 57, 56, 55, 54, 53, 52]);
  });

  it('reports a 1-based rank and a growing waitlist position', async () => {
    const c = createOffline();
    expect((await c.submitScore({ name: 'a', wpm: 80, accuracy: 99 })).rank).toBe(1);
    expect((await c.submitScore({ name: 'b', wpm: 90, accuracy: 99 })).rank).toBe(1);
    expect((await c.joinWaitlist('a@b.co')).position).toBe(1);
    expect((await c.joinWaitlist('c@d.co')).position).toBe(2);
    expect((await c.joinWaitlist('a@b.co')).position).toBe(1);
  });
});

describe('artifact db client', () => {
  it('stores total from priceOf, never from the caller', async () => {
    const db = fakeDb();
    const c = createArtifactDb(db);
    // A tampered config object cannot smuggle a total: the adapter only reads config fields.
    const r = await c.placeOrder({ ...clearBlankClicky, total: 1 } as BuildConfig, 'a@b.co');
    expect(r.total).toBe(284);
    const stored = [...db.cols.orders.values()][0];
    expect(stored.total).toBe(284);
    expect(stored.config).toEqual(clearBlankClicky);
  });

  it('hashes the lowercased email into the waitlist doc id', async () => {
    const db = fakeDb();
    const c = createArtifactDb(db);
    const r1 = await c.joinWaitlist('A@B.co');
    const r2 = await c.joinWaitlist('a@b.co');
    const ids = [...db.cols.waitlist.keys()];
    expect(ids).toHaveLength(1);
    expect(ids[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(ids[0]).not.toContain('a@b.co');
    expect(r1.position).toBe(1);
    expect(r2.position).toBe(1);
  });

  it('submits and ranks scores', async () => {
    const c = createArtifactDb(fakeDb());
    await c.submitScore({ name: 'a', wpm: 70, accuracy: 95 });
    const { rank } = await c.submitScore({ name: 'b', wpm: 90, accuracy: 95 });
    expect(rank).toBe(1);
    expect((await c.topScores())[0].name).toBe('b');
  });
});
