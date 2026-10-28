'use client';

import { useEffect, useState } from 'react';
import { fx, GL_LOST_EVENT, GL_READY_EVENT } from '../three/bus';
import s from './ui.module.css';

const VERBS = ['Warming the phosphor', 'Seating the switches', 'Tuning the thock', 'Lighting the legends', 'Letting the fog in'];
const VERB_MS = 900;
const MIN_MS = 700; // a loader that blinks away reads as a glitch
const MAX_MS = 6000; // whatever is still loading, the page shows by then
const OUT_MS = 950; // the CSS fade below

let lift = () => {};
/** Resolves when the loader starts to lift: the hero's intro plays from there, not hidden under it. */
export const loaded = new Promise<void>((r) => (lift = r));

/**
 * Full-screen paper with a breathing phosphor dot and rotating verbs, over the page until the fonts are in
 * and the first GL frame is drawn (shaders compiled, smoke pre-warmed). WebGL failing also lifts it.
 */
export function Loader() {
  const [verb, setVerb] = useState(0);
  const [phase, setPhase] = useState<'on' | 'out' | 'gone'>('on');

  useEffect(() => {
    const ac = new AbortController();
    const tick = setInterval(() => setVerb((v) => (v + 1) % VERBS.length), VERB_MS);
    const gl = new Promise<void>((r) => {
      if (fx.glReady || fx.glFailed) return r(); // Stage's probe may have failed before this effect ran
      addEventListener(GL_READY_EVENT, () => r(), { once: true, signal: ac.signal });
      addEventListener(GL_LOST_EVENT, () => r(), { once: true, signal: ac.signal });
    });
    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    let gone = 0;
    Promise.race([Promise.all([document.fonts.ready, gl, wait(MIN_MS)]), wait(MAX_MS)]).then(() => {
      if (ac.signal.aborted) return;
      ac.abort();
      clearInterval(tick);
      setPhase('out');
      lift();
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      gone = window.setTimeout(() => setPhase('gone'), reduced ? 0 : OUT_MS);
    });
    return () => {
      ac.abort();
      clearInterval(tick);
      clearTimeout(gone);
    };
  }, []);

  if (phase === 'gone') return null;
  return (
    <div className={s.loader} data-out={phase === 'out' ? '' : undefined} role="status" aria-label="Loading">
      <div className={s.mark} aria-hidden="true">
        <span className={s.loaderDot} />
        <span key={verb} className={s.verb}>
          {VERBS[verb]}…
        </span>
      </div>
    </div>
  );
}
