import { DataError, type DataClient, type Score } from './client';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100';

export function createApi(base: string = API_URL): DataClient {
  async function call<T>(path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(base + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new DataError('unavailable', `${path}: network error`);
    }
    if (!res.ok) {
      const code = res.status === 400 ? 'invalid' : res.status === 401 || res.status === 403 ? 'denied' : res.status >= 500 ? 'unavailable' : 'unknown';
      throw new DataError(code, `${path} failed: ${res.status}`);
    }
    try {
      return (await res.json()) as T;
    } catch {
      throw new DataError('unknown', `${path}: bad response body`);
    }
  }
  return {
    mode: 'api',
    joinWaitlist: (email) => call('/waitlist', { email }),
    placeOrder: (config, email) => call('/orders', { config, email }),
    submitScore: (s) => call('/scores', s),
    topScores: () => call<Score[]>('/scores'),
  };
}
