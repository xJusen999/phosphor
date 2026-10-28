'use client';

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { cleanName } from '@phosphor/shared';
import { offlineNote, typing } from '../content/copy';
import type { TypeTest } from '../type/useTypeTest';
import type { Score } from '../data/client';
import { FULL_VERSION_URL } from '../data/fullVersion';
import { useDataClient, useRequest } from '../data/useData';
import { KeyCap } from '../nav/Menu';
import shell from './Shells.module.css';
import s from './Product.module.css';

const SHOWN = 80; // words rendered ahead of the caret; three lines are visible

const pct = (a: number) => `${Math.round(a * 100)}%`;

/** T: the 30-second test, the result and the top-ten table. */
export function Type({ test }: { test: TypeTest }) {
  const client = useDataClient();
  const [scores, loadScores] = useRequest<Score[]>();
  const [sent, submit, resetSent] = useRequest<{ rank: number }>();
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const lines = useRef<HTMLDivElement>(null);
  const caretWord = useRef<HTMLSpanElement>(null);
  const nameField = useRef<HTMLInputElement>(null);
  const { phase, done, cur, words } = test;

  useEffect(() => {
    if (client) void loadScores(() => client.topScores());
  }, [client, loadScores]);

  // Keep the caret's line second from the top (first while on line one).
  useLayoutEffect(() => {
    const w = caretWord.current, box = lines.current;
    if (!w || !box) return;
    const line = w.offsetHeight;
    box.style.transform = `translateY(${-Math.max(0, w.offsetTop - line)}px)`;
  });

  // Time up: the next keys go to the name field, not to the shortcuts.
  useEffect(() => {
    if (phase === 'done') nameField.current?.focus({ preventScroll: true });
  }, [phase]);

  const start = () => {
    resetSent({ state: 'idle' });
    setNameError(false);
    test.start();
    panel.current?.focus({ preventScroll: true }); // off the button, so Space and Enter type instead of pressing it
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const clean = cleanName(name);
    setNameError(!clean);
    if (!clean || !client) return;
    void submit(async () => {
      const r = await client.submitScore({ name: clean, wpm: test.wpm, accuracy: test.acc });
      void loadScores(() => client.topScores());
      return r;
    });
  };

  const seconds = Math.ceil(test.timeLeft);
  const rank = sent.state === 'ok' ? sent.value.rank : 0;
  const result = `${test.wpm} wpm at ${pct(test.acc)} accuracy.`;
  const status =
    phase === 'armed' ? typing.armed
    : phase === 'running' ? typing.running
    : phase === 'done' ? `Time. ${result}`
    : phase === 'aborted' ? `${typing.aborted} ${result}`
    : '';

  return (
    <section id="type" className={shell.section} data-side="left" aria-labelledby="type-title">
      <div className={`${shell.body} ${s.typeBody}`}>
        <div className={s.typeHead}>
          <p className={shell.eyebrow} data-rise>
            <KeyCap k="T" /> Type
          </p>
          <h2 id="type-title" className={shell.title} data-reveal>
            {typing.title}
          </h2>
          <p className={shell.copy} data-rise>{typing.lead}</p>
        </div>

        <div className={s.typeGrid} data-rise>
          <div ref={panel} className={s.panel} tabIndex={-1} data-phase={phase} role="group" aria-label="Typing test"
            aria-describedby="type-next"
            // Armed but focus went elsewhere (a click on the page, Tab to a field): give the keys back.
            onBlur={(e) => !panel.current?.contains(e.relatedTarget as Node | null) && test.disarm()}>
            <div className={s.stats}>
              <span className={s.stat}>
                <b>{seconds}</b> s
              </span>
              <span className={s.stat}>
                <b>{test.wpm}</b> wpm
              </span>
              <span className={s.stat}>
                <b>{pct(test.acc)}</b> acc
              </span>
              {!test.active && (
                <button type="button" className={s.start} onClick={start}>
                  {phase === 'idle' ? typing.start : typing.again}
                </button>
              )}
            </div>
            {/* The word box is visual only; screen readers get the word to type here, one word at a time. */}
            <p id="type-next" className="sr-only" aria-live="polite">
              {test.active ? `Type: ${words[done.length] ?? ''}` : ''}
            </p>
            <div className={s.words} aria-hidden="true">
              <div ref={lines} className={s.lines}>
                {words.slice(0, done.length + SHOWN).map((w, i) => {
                  const typed = i < done.length ? done[i] : i === done.length && test.active ? cur : null;
                  const here = i === done.length && test.active;
                  return (
                    <span key={i} ref={i === done.length ? caretWord : undefined} className={s.word}
                      data-end={here && cur.length >= w.length ? '' : undefined}>
                      {[...w].map((ch, j) => (
                        <span key={j} data-c={typed === null || j >= typed.length ? undefined : typed[j] === ch ? 'ok' : 'bad'}
                          data-at={here && j === cur.length ? '' : undefined}>
                          {ch}
                        </span>
                      ))}
                      {typed && typed.length > w.length && <span data-c="bad">{typed.slice(w.length)}</span>}
                    </span>
                  );
                })}
              </div>
            </div>
            <p className={s.status} role="status">{status}</p>

            {phase === 'done' && (
              <div className={s.result}>
                <p className={s.resultLine}>
                  <b>{test.wpm}</b> words per minute at <b>{pct(test.acc)}</b> accuracy.
                </p>
                {sent.state === 'ok' ? (
                  <p className={s.ok} role="status">
                    You’re number {rank} on the board.
                  </p>
                ) : (
                  <form className={shell.waitlist} onSubmit={onSubmit} noValidate>
                    <label className="sr-only" htmlFor="score-name">Name for the leaderboard</label>
                    <input ref={nameField} id="score-name" name="name" value={name} maxLength={16} autoComplete="nickname"
                      placeholder="Your name (16 max)" aria-invalid={nameError} aria-describedby="score-msg"
                      onChange={(e) => setName(e.target.value)} />
                    <button type="submit" disabled={!client || sent.state === 'loading'}>
                      {!client ? 'Connecting…' : sent.state === 'loading' ? 'Posting…' : 'Post my score'}
                    </button>
                    <p id="score-msg" className={s.msg} role="alert">
                      {nameError ? 'Letters, digits, spaces, _ . or -, up to 16.' : sent.state === 'error' ? sent.message : ''}
                    </p>
                  </form>
                )}
              </div>
            )}
          </div>

          <div className={s.board}>
            <p className={s.groupLabel}>{typing.board}</p>
            {scores.state === 'ok' && scores.value.length > 0 && (
              <table>
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Name</th>
                    <th scope="col">wpm</th>
                    <th scope="col">acc</th>
                  </tr>
                </thead>
                <tbody>
                  {scores.value.map((sc, i) => (
                    <tr key={`${sc.at}-${i}`} data-you={rank === i + 1 ? '' : undefined}>
                      <td>{i + 1}</td>
                      <td>{sc.name}</td>
                      <td>{sc.wpm}</td>
                      <td>{pct(sc.accuracy)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {scores.state === 'ok' && scores.value.length === 0 && <p className={s.msg}>{typing.empty}</p>}
            {(scores.state === 'idle' || scores.state === 'loading') && <p className={s.msg}>Loading scores…</p>}
            {scores.state === 'error' && (
              <p className={s.msg} role="alert">
                {scores.message}{' '}
                <button type="button" className={s.link} onClick={() => client && loadScores(() => client.topScores())}>
                  Retry
                </button>
              </p>
            )}
            {client?.mode === 'offline' && (
              <p className={s.offline}>
                {offlineNote} <a href={FULL_VERSION_URL} target="_blank" rel="noopener">Open the full version</a>
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
