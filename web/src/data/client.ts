import type { BuildConfig } from '@phosphor/shared';

export type Score = { name: string; wpm: number; accuracy: number; at: string };
export type NewScore = Pick<Score, 'name' | 'wpm' | 'accuracy'>;

export type DataErrorCode = 'unavailable' | 'denied' | 'invalid' | 'unknown';

// The only error type DataClient methods reject with.
export class DataError extends Error {
  constructor(
    public readonly code: DataErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'DataError';
  }
}

export interface DataClient {
  mode: 'api' | 'db' | 'offline';
  joinWaitlist(email: string): Promise<{ position: number }>;
  placeOrder(config: BuildConfig, email: string): Promise<{ id: string; total: number }>;
  submitScore(s: NewScore): Promise<{ rank: number }>;
  topScores(): Promise<Score[]>;
}
