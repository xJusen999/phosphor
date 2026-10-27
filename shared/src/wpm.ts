export const computeWpm = (chars: number, ms: number): number =>
  ms <= 0 ? 0 : Math.round(chars / 5 / (ms / 60000));

export const accuracy = (correct: number, typed: number): number =>
  typed === 0 ? 1 : correct / typed;
