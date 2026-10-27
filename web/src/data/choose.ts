import { createApi } from './api';
import { createArtifactDb, type DbLike } from './artifactDb';
import type { DataClient } from './client';
import { createOffline } from './offline';

export type ChooseEnv = {
  NEXT_PUBLIC_DATA?: string;
  claude?: { use(name: string): Promise<unknown> };
};

const DB_TIMEOUT_MS = 10_000;

export async function chooseClient(env: ChooseEnv): Promise<DataClient> {
  if (env.NEXT_PUBLIC_DATA === 'api') return createApi();
  // Sinapsis build: no artifact runtime to wait for.
  if (env.NEXT_PUBLIC_DATA === 'offline' || !env.claude) return createOffline();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const db = await Promise.race([
      (async () => env.claude!.use('db'))(),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), DB_TIMEOUT_MS);
      }),
    ]);
    return db ? createArtifactDb(db as DbLike) : createOffline();
  } catch {
    return createOffline();
  } finally {
    clearTimeout(timer);
  }
}
