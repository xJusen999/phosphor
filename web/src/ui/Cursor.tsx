'use client';

import { useEffect, useRef, useState } from 'react';
import s from './ui.module.css';

const INTERACTIVE = 'a, button, label, summary, select, [role="button"]';
const TEXT = 'input, textarea';
// Mouse or trackpad only, and no custom cursor for people who asked for less motion.
const QUERY = '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)';

/**
 * A dot that replaces the pointer and grows into a phosphor ring over anything clickable (the 3D function keys
 * included: the keyboard flags them with a pointer cursor on <body>). Text fields keep the native I-beam,
 * and open dialogs (the top layer, above this dot) keep the native pointer; see globals.css.
 */
export function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const mq = matchMedia(QUERY);
    const sync = () => setOn(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!on) return;
    const el = dot.current!;
    const root = document.documentElement;
    root.dataset.cursor = '';
    let x = 0, y = 0, raf = 0;
    const paint = () => {
      raf = 0;
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };
    const set = (k: string, v: string | null) => {
      if (v === null) delete el.dataset[k];
      else if (el.dataset[k] !== v) el.dataset[k] = v; // no style recalc when nothing changed
    };
    // Bubble phase on window: R3F's listener on <body> has already set the 3D keys' pointer cursor.
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX;
      y = e.clientY;
      const t = e.target instanceof Element ? e.target : null;
      set('state', t?.closest(TEXT) ? 'text' : t?.closest(INTERACTIVE) || document.body.style.cursor === 'pointer' ? 'hover' : '');
      set('visible', '');
      raf ||= requestAnimationFrame(paint);
    };
    const down = (e: PointerEvent) => e.pointerType === 'mouse' && set('down', '');
    const up = () => set('down', null);
    const leave = () => set('visible', null);
    addEventListener('pointermove', move, { passive: true });
    addEventListener('pointerdown', down, { passive: true });
    addEventListener('pointerup', up, { passive: true });
    root.addEventListener('mouseleave', leave);
    return () => {
      cancelAnimationFrame(raf);
      delete root.dataset.cursor;
      removeEventListener('pointermove', move);
      removeEventListener('pointerdown', down);
      removeEventListener('pointerup', up);
      root.removeEventListener('mouseleave', leave);
    };
  }, [on]);

  return on ? (
    <div ref={dot} className={s.cursor} aria-hidden="true">
      <i />
    </div>
  ) : null;
}
