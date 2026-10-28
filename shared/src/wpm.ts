export const computeWpm = (chars: number, ms: number): number =>
  ms <= 0 ? 0 : Math.round(chars / 5 / (ms / 60000));

// Leaderboard order, the same in the API and every web adapter: fastest first, then most accurate, then oldest.
export const byRank = (a: { wpm: number; accuracy: number; at: string }, b: { wpm: number; accuracy: number; at: string }) =>
  b.wpm - a.wpm || b.accuracy - a.accuracy || a.at.localeCompare(b.at);

export const accuracy = (correct: number, typed: number): number =>
  typed === 0 ? 1 : correct / typed;
