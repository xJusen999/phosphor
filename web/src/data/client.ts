import type { BuildConfig } from '@phosphor/shared';

export type Score = { name: string; wpm: number; accuracy: number; at: string };
export type NewScore = Pick<Score, 'name' | 'wpm' | 'accuracy'>;

export interface DataClient {
  mode: 'api' | 'db' | 'offline';
  joinWaitlist(email: string): Promise<{ position: number }>;
  placeOrder(config: BuildConfig, email: string): Promise<{ id: string; total: number }>;
  submitScore(s: NewScore): Promise<{ rank: number }>;
  topScores(): Promise<Score[]>;
}

// Same ordering as the API: fastest first, then most accurate, then oldest.
export const byRank = (a: Score, b: Score) =>
  b.wpm - a.wpm || b.accuracy - a.accuracy || a.at.localeCompare(b.at);
