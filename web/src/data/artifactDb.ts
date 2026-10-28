import { byRank, cleanName, priceOf } from '@phosphor/shared';
import { DataError, type DataClient, type NewScore, type Score } from './client';

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

// Same limits as the API's ScoreDto: a clean name as typed, 0-300 wpm, accuracy 0-1.
const validScore = (x: Body): x is Body & NewScore =>
  typeof x.name === 'string' && cleanName(x.name) === x.name &&
  typeof x.wpm === 'number' && x.wpm >= 0 && x.wpm <= 300 &&
  typeof x.accuracy === 'number' && x.accuracy >= 0 && x.accuracy <= 1;

// shortcut: ranks only look at the 1000 fastest scores, the query cap; fine for a demo leaderboard.
async function allScores(db: DbLike): Promise<(Score & { id: string })[]> {
  const snap = await db.collection('scores').orderBy('wpm', 'desc').limit(1000).get();
  // Shared docs are writable by any viewer: keep only well-formed, in-range ones.
  return snap.docs.flatMap((d) => {
    const x = d.data();
    if (!x || !validScore(x)) return [];
    return [{ name: x.name, wpm: x.wpm, accuracy: x.accuracy, at: String(x.at ?? ''), id: d.id }];
  });
}

const DENIED = new Set(['not_granted', 'not_writer', 'capability_disabled', 'capability_removed']);
const UNAVAILABLE = new Set(['unavailable', 'network', 'revoked', 'quota_exceeded', 'resource_exhausted']);

// Store rejections become DataError; never a fake success.
function toDataError(e: unknown): DataError {
  if (e instanceof DataError) return e;
  const code = (e as { code?: unknown } | null)?.code;
  if (typeof code === 'string') {
    if (DENIED.has(code)) return new DataError('denied', code);
    if (code === 'invalid_argument') return new DataError('invalid', code);
    if (UNAVAILABLE.has(code)) return new DataError('unavailable', code);
  }
  // A codeless fetch-style failure is a network problem.
  if (e instanceof TypeError && typeof code !== 'string') return new DataError('unavailable', e.message);
  if (e instanceof Error && e.message === 'unknown option') return new DataError('invalid', e.message);
  return new DataError('unknown', e instanceof Error ? e.message : String(code ?? e));
}

async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw toDataError(e);
  }
}

function createRaw(db: DbLike): DataClient {
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
      if (!validScore(s)) throw new DataError('invalid', 'score out of range');
      const ref = await db
        .collection('scores')
        .add({ name: s.name, wpm: s.wpm, accuracy: s.accuracy, at: new Date().toISOString() });
      const sorted = (await allScores(db)).sort(byRank);
      const i = sorted.findIndex((x) => x.id === ref.id);
      // Not in the 1000-score window: ranked after everything we can see.
      return { rank: i < 0 ? sorted.length + 1 : i + 1 };
    },
    async topScores() {
      return (await allScores(db))
        .sort(byRank)
        .slice(0, 10)
        .map(({ name, wpm, accuracy, at }) => ({ name, wpm, accuracy, at }));
    },
  };
}

export function createArtifactDb(db: DbLike): DataClient {
  const raw = createRaw(db);
  return {
    mode: 'db',
    joinWaitlist: (e) => guard(() => raw.joinWaitlist(e)),
    placeOrder: (c, e) => guard(() => raw.placeOrder(c, e)),
    submitScore: (s) => guard(() => raw.submitScore(s)),
    topScores: () => guard(() => raw.topScores()),
  };
}
