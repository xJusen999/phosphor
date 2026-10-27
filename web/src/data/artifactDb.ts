import { priceOf } from '@phosphor/shared';
import { byRank, type DataClient, type Score } from './client';

type Body = Record<string, unknown>;
type DocSnap = { id: string; exists?: boolean; data(): Body | undefined };

// Structural subset of the artifact `db` capability (see claude.use("db")).
export interface DbLike {
  doc(path: string): { get(): Promise<DocSnap>; set(data: Body): Promise<void> };
  collection(path: string): {
    add(data: Body): Promise<{ id: string }>;
    get(): Promise<{ size: number }>;
    orderBy(field: string, dir?: 'asc' | 'desc'): {
      limit(n: number): { get(): Promise<{ docs: DocSnap[] }> };
    };
  };
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const emailHash = (email: string) => sha256Hex(email.trim().toLowerCase());

// shortcut: ranks only look at the 1000 fastest scores, the query cap; fine for a demo leaderboard.
async function allScores(db: DbLike): Promise<(Score & { id: string })[]> {
  const snap = await db.collection('scores').orderBy('wpm', 'desc').limit(1000).get();
  return snap.docs.map((d) => ({ ...(d.data() as Score), id: d.id }));
}

export function createArtifactDb(db: DbLike): DataClient {
  return {
    mode: 'db',
    async joinWaitlist(email) {
      const ref = db.doc(`waitlist/${await emailHash(email)}`);
      const existing = await ref.get();
      if (existing.exists) return { position: Number(existing.data()?.position) || 1 };
      // Best effort: concurrent joins can read the same count.
      const { size } = await db.collection('waitlist').get();
      const position = size + 1;
      await ref.set({ at: new Date().toISOString(), position });
      return { position };
    },
    async placeOrder(config, email) {
      // Total is always recomputed here; only the three known fields are stored.
      const clean = { caseFinish: config.caseFinish, keycaps: config.keycaps, switchType: config.switchType };
      const total = priceOf(clean);
      const ref = await db.collection('orders').add({
        config: clean,
        total,
        emailHash: await emailHash(email),
        at: new Date().toISOString(),
      });
      return { id: ref.id, total };
    },
    async submitScore(s) {
      const ref = await db
        .collection('scores')
        .add({ name: s.name, wpm: s.wpm, accuracy: s.accuracy, at: new Date().toISOString() });
      const sorted = (await allScores(db)).sort(byRank);
      return { rank: Math.max(sorted.findIndex((x) => x.id === ref.id) + 1, 1) };
    },
    async topScores() {
      return (await allScores(db))
        .sort(byRank)
        .slice(0, 10)
        .map(({ name, wpm, accuracy, at }) => ({ name, wpm, accuracy, at }));
    },
  };
}
