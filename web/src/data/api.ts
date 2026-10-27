import type { DataClient, Score } from './client';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100';

export function createApi(base: string = API_URL): DataClient {
  async function call<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
    return res.json() as Promise<T>;
  }
  return {
    mode: 'api',
    joinWaitlist: (email) => call('/waitlist', { email }),
    placeOrder: (config, email) => call('/orders', { config, email }),
    submitScore: (s) => call('/scores', s),
    topScores: () => call<Score[]>('/scores'),
  };
}
