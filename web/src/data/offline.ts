import { byRank, priceOf } from '@phosphor/shared';
import type { DataClient, Score } from './client';

// In-memory only: lives until the page is closed. Never throws.
export function createOffline(): DataClient {
  const waitlist: string[] = [];
  const scores: Score[] = [];
  let orders = 0;
  return {
    mode: 'offline',
    async joinWaitlist(email) {
      const key = email.trim().toLowerCase();
      if (!waitlist.includes(key)) waitlist.push(key);
      return { position: waitlist.indexOf(key) + 1 };
    },
    async placeOrder(config, _email) {
      let total = 0;
      try {
        total = priceOf(config);
      } catch {
        // an unknown option cannot come from the UI; keep the "never throws" contract
      }
      return { id: `offline-${++orders}`, total };
    },
    async submitScore(s) {
      const entry: Score = { ...s, at: new Date().toISOString() };
      scores.push(entry);
      return { rank: [...scores].sort(byRank).indexOf(entry) + 1 };
    },
    async topScores() {
      return [...scores].sort(byRank).slice(0, 10);
    },
  };
}
