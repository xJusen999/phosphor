import { describe, expect, it } from 'vitest';
import { LAYOUT_60 } from '@phosphor/shared';
import { createTypeTest, TEST_MS } from '../src/type/useTypeTest';
import { shuffledWords, WORDS } from '../src/type/words';

const TEXT = ['the', 'of', 'and', 'to', 'in', 'is'];
const at = (code: string) => LAYOUT_60.findIndex((k) => k.code === code);
const codes = (s: string) => [...s].map((c) => (c === ' ' ? 'Space' : `Key${c.toUpperCase()}`));

function setup() {
  let t = 0;
  const test = createTypeTest({ words: () => TEXT, now: () => t });
  const type = (s: string) => codes(s).forEach((c) => test.onKey(c));
  return { test, type, clock: (ms: number) => void (t = ms) };
}

describe('type test', () => {
  it('"the " typed correctly in 6 s is 8 wpm at full accuracy', () => {
    const { test, type, clock } = setup();
    test.start();
    type('the ');
    clock(6000);
    expect(test.active).toBe(true);
    expect(test.wpm).toBe(8);
    expect(test.acc).toBe(1);
  });

  it('one wrong char out of 10 is 90% accuracy', () => {
    const { test, type } = setup();
    test.start();
    type('thx of and');
    expect(test.acc).toBe(0.9);
  });

  it('heat is hits over the most-hit key', () => {
    const { test, type } = setup();
    test.start();
    type('the tt');
    expect(test.heat).toHaveLength(61);
    expect(test.heat[at('KeyT')]).toBe(1);
    expect(test.heat[at('KeyH')]).toBeCloseTo(1 / 3);
    expect(test.heat[at('KeyZ')]).toBe(0);
  });

  it('ends when the time is up and ignores later keys', () => {
    const { test, type, clock } = setup();
    test.start();
    type('the ');
    clock(TEST_MS);
    expect(test.timeLeft).toBe(0);
    expect(test.active).toBe(false);
    expect(test.phase).toBe('done');
    const wpm = test.wpm;
    type('of ');
    expect(test.wpm).toBe(wpm);
    expect(test.heat[at('KeyO')]).toBe(0);
  });

  it('Escape during the test ends it', () => {
    const { test, type, clock } = setup();
    test.start();
    type('th');
    clock(2000);
    test.onKey('Escape');
    expect(test.active).toBe(false);
    expect(test.phase).toBe('aborted');
  });

  it('the clock starts on the first key, and Escape before it goes back to idle', () => {
    const { test, type, clock } = setup();
    test.start();
    clock(5000);
    expect(test.timeLeft).toBe(30);
    type('the ');
    clock(11000);
    expect(test.wpm).toBe(8);
    test.start();
    test.onKey('Escape');
    expect(test.phase).toBe('idle');
  });

  it('wpm counts net characters: deleted keystrokes do not add speed', () => {
    const { test, type, clock } = setup();
    test.start();
    for (let i = 0; i < 3; i++) {
      test.onKey('KeyT');
      test.onKey('Backspace');
    }
    clock(6000);
    expect(test.wpm).toBe(0);
    expect(test.acc).toBe(1);
  });

  it('a retyped word counts once: "the⌫⌫⌫the " is 4 chars, 8 wpm in 6 s', () => {
    const { test, type, clock } = setup();
    test.start();
    type('the');
    ['Backspace', 'Backspace', 'Backspace'].forEach((c) => test.onKey(c));
    type('the ');
    clock(6000);
    expect(test.wpm).toBe(8);
  });

  it('a wrong word adds nothing; the current word adds its correct prefix', () => {
    const { test, type, clock } = setup();
    test.start();
    type('thx o'); // "thx" misses "the"; "o" starts "of": 1 net char
    clock(6000);
    expect(test.wpm).toBe(2); // 1 / 5 / 0.1 min
  });

  it('backspace fixes the current word; a space only counts after a word', () => {
    const { test, type } = setup();
    test.start();
    test.onKey('Space'); // nothing typed yet: ignored
    type('tx');
    test.onKey('Backspace');
    type('he ');
    expect(test.done).toEqual(['the']);
    expect(test.acc).toBe(4 / 5);
  });
  it('letters come from the layout (e.key), heat from the key position (e.code)', () => {
    const { test } = setup();
    test.start();
    // Dvorak: "t", "h" and "e" sit on the QWERTY K, J and D positions.
    test.onKey('KeyK', 't');
    test.onKey('KeyJ', 'h');
    test.onKey('KeyD', 'E'); // shifted
    test.onKey('Space', ' ');
    expect(test.done).toEqual(['the']);
    expect(test.heat[at('KeyK')]).toBe(1);
    expect(test.heat[at('KeyT')]).toBe(0);
    // A layout letter on a non-letter position still types; a symbol on a letter position is an error, not "q".
    test.onKey('Semicolon', 'o');
    test.onKey('KeyQ', "'");
    expect(test.cur).toBe("o'");
  });
});

describe('words', () => {
  it('200 unique lowercase words, shuffled the same way for the same seed', () => {
    expect(WORDS).toHaveLength(200);
    expect(new Set(WORDS).size).toBe(200);
    expect(WORDS.every((w) => /^[a-z]+$/.test(w))).toBe(true);
    const a = shuffledWords(42);
    expect(a).toEqual(shuffledWords(42));
    expect(a).not.toEqual(shuffledWords(43));
    expect([...a].sort()).toEqual([...WORDS].sort());
  });
});
