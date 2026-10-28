'use client';

import { useCallback, useEffect, useState } from 'react';
import { chooseClient, type ChooseEnv } from './choose';
import { DataError, type DataClient, type DataErrorCode } from './client';

let pending: Promise<DataClient> | null = null;

/** The page's one DataClient, chosen once on the client; null while it is being chosen (up to 10 s). */
export function useDataClient(): DataClient | null {
  const [client, setClient] = useState<DataClient | null>(null);
  useEffect(() => {
    let alive = true;
    // Only `claude.use` is read: the artifact runtime hands out `db` through it.
    pending ??= chooseClient({
      NEXT_PUBLIC_DATA: process.env.NEXT_PUBLIC_DATA,
      claude: (window as { claude?: ChooseEnv['claude'] }).claude,
    });
    pending.then((c) => alive && setClient(c));
    return () => {
      alive = false;
    };
  }, []);
  return client;
}

const MESSAGES: Record<DataErrorCode, string> = {
  unavailable: 'Can’t reach the server right now. Try again in a moment.',
  denied: 'This copy of the page isn’t allowed to save. Open the full version.',
  invalid: 'That doesn’t look right. Check it and try again.',
  unknown: 'Something went wrong. Try again.',
};

export type Req<T> =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'ok'; value: T }
  | { state: 'error'; message: string };

/** One request's visible state. `run` never throws: a rejection becomes an error message. */
export function useRequest<T>() {
  const [req, setReq] = useState<Req<T>>({ state: 'idle' });
  const run = useCallback(async (call: () => Promise<T>) => {
    setReq({ state: 'loading' });
    try {
      setReq({ state: 'ok', value: await call() });
    } catch (e) {
      setReq({ state: 'error', message: MESSAGES[e instanceof DataError ? e.code : 'unknown'] });
    }
  }, []);
  return [req, run, setReq] as const;
}
