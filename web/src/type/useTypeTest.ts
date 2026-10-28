'use client';

import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { accuracy, computeWpm, LAYOUT_60 } from '@phosphor/shared';
import { shuffledWords } from './words';

export const TEST_MS = 30_000;
const INDEX = new Map(LAYOUT_60.map((k, i) => [k.code, i]));
const MAX_EXTRA = 8; // letters typed past a word's end (shown as errors)

/** idle → armed (start pressed) → running (first key) → done (time up) or aborted (Escape). */
export type Phase = 'idle' | 'armed' | 'running' | 'done' | 'aborted';

type Options = { words?: () => string[]; now?: () => number };

/**
 * The 30-second test without React: keys come in by KeyboardEvent.code (the heat map is by key position)
 * plus KeyboardEvent.key (the character, so any layout types its own letters). The clock starts on the first key.
 * Words are compared one at a time, so a slip costs one char, not the rest of the text.
 * Accuracy counts keystrokes; wpm counts net text (right words plus their spaces, and the right start of the
 * current word), so deleted or retyped characters never add speed.
 */
export function createTypeTest({ words: given, now = () => performance.now() }: Options = {}) {
  const pick = given ?? (() => shuffledWords((Math.random() * 2 ** 32) >>> 0));
  let phase: Phase = 'idle';
  let words = given ? given() : shuffledWords(0); // a fixed first text: the server and the client render the same words
  let done: string[] = [];
  let cur = '';
  let typed = 0;
  let correct = 0; // correct keystrokes, for accuracy
  let net = 0; // chars of the words committed right, each with its space, for wpm
  let t0 = 0;
  let t1 = 0;
  const hits = new Float32Array(LAYOUT_60.length);
  const heat = new Float32Array(LAYOUT_60.length); // read every frame by the 3D keyboard, so mutated in place

  const sync = () => {
    if (phase === 'running' && now() - t0 >= TEST_MS) {
      phase = 'done';
      t1 = t0 + TEST_MS;
    }
  };
  const elapsed = () => (phase === 'running' ? Math.min(now() - t0, TEST_MS) : t1 - t0);

  return {
    start() {
      words = pick();
      done = [];
      cur = '';
      typed = correct = net = t0 = t1 = 0;
      hits.fill(0);
      heat.fill(0);
      phase = 'armed';
    },
    /** Focus left the test before the first key: back to idle, so the page gets its keys again. */
    disarm() {
      if (phase === 'armed') phase = 'idle';
    },
    /** `key` is the typed character (KeyboardEvent.key); without it a Key[A-Z] position types its QWERTY letter. */
    onKey(code: string, key?: string) {
      sync();
      if (phase !== 'armed' && phase !== 'running') return;
      if (code === 'Escape') {
        if (phase === 'running') t1 = now();
        phase = phase === 'running' ? 'aborted' : 'idle';
        return;
      }
      const i = INDEX.get(code);
      if (i === undefined) return;
      if (phase === 'armed') {
        phase = 'running';
        t0 = now();
      }
      hits[i]++;
      const max = Math.max(...hits);
      for (let j = 0; j < hits.length; j++) heat[j] = hits[j] / max;

      const word = words[done.length] ?? '';
      if (code === 'Space') {
        if (!cur) return;
        typed++;
        if (cur.length === word.length) correct++; // the space landed where the text has one
        if (cur === word) net += word.length + 1;
        done.push(cur);
        cur = '';
      } else if (code === 'Backspace') {
        cur = cur.slice(0, -1);
      } else if (key?.length === 1 || (key === undefined && /^Key[A-Z]$/.test(code))) {
        const ch = (key ?? code[3]).toLowerCase();
        typed++;
        if (word[cur.length] === ch) correct++;
        if (cur.length < word.length + MAX_EXTRA) cur += ch;
      }
    },
    get phase() {
      sync();
      return phase;
    },
    get active() {
      sync();
      return phase === 'armed' || phase === 'running';
    },
    get wpm() {
      sync();
      const word = words[done.length] ?? '';
      let prefix = 0;
      while (prefix < cur.length && cur[prefix] === word[prefix]) prefix++;
      return computeWpm(net + prefix, elapsed());
    },
    get acc() {
      return accuracy(correct, typed);
    },
    /** Seconds left (30 until the first key). */
    get timeLeft() {
      sync();
      return (TEST_MS - elapsed()) / 1000;
    },
    heat,
    get words() {
      return words;
    },
    /** What was typed for each finished word, in order. */
    get done() {
      return done;
    },
    /** What is typed so far of the current word. */
    get cur() {
      return cur;
    },
  };
}

export type TypeTest = ReturnType<typeof useTypeTest>;

const FIELD = 'input,textarea,select,[contenteditable]';

/**
 * The window keydown listener while the test is armed or running. Keys typed into a field, or pressed while a
 * dialog is open, belong to that field or dialog (an email in Order, a dialog's native Escape).
 */
export function keyCapture(onKey: (code: string, key?: string) => void, dialogOpen: () => boolean) {
  return (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || !INDEX.has(e.code)) return;
    if ((e.target as Element | null)?.closest?.(FIELD) || dialogOpen()) return;
    e.preventDefault(); // Space would scroll, Enter would press a focused button, Tab would move focus
    // Capture on window runs before useKeyNav's bubble listener, so stopping Escape here keeps it from jumping to the top.
    if (e.code === 'Escape') e.stopPropagation();
    if (!e.repeat) onKey(e.code, e.key);
  };
}

/**
 * The type test for the page. While `active`, it owns the keyboard: layout keys go to the test (no scrolling,
 * no button presses) and Escape ends it before the key navigation sees it. `heat` is one stable array.
 */
export function useTypeTest() {
  const test = useMemo(() => createTypeTest(), []);
  const [, render] = useReducer((n: number) => n + 1, 0);
  const active = test.active;

  const start = useCallback(() => {
    test.start();
    render();
  }, [test]);
  const disarm = useCallback(() => {
    test.disarm();
    render();
  }, [test]);
  const onKey = useCallback(
    (code: string, key?: string) => {
      test.onKey(code, key);
      render();
    },
    [test],
  );

  useEffect(() => {
    if (!active) return;
    const kd = keyCapture(onKey, () => !!document.querySelector('dialog[open]'));
    const id = setInterval(render, 200); // clock and live wpm; the getters end the test when time is up
    addEventListener('keydown', kd, true);
    return () => {
      clearInterval(id);
      removeEventListener('keydown', kd, true);
    };
  }, [active, onKey]);

  return {
    active,
    start,
    disarm,
    onKey,
    phase: test.phase,
    wpm: test.wpm,
    acc: test.acc,
    timeLeft: test.timeLeft,
    heat: test.heat,
    words: test.words,
    done: test.done,
    cur: test.cur,
  };
}
