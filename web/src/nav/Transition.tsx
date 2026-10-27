'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import type { SectionId } from '@phosphor/shared';
import { getLenis } from './lenis';
import { NAV } from './Menu';
import s from './nav.module.css';

type Point = { x: number; y: number };
type Overlay = { cover(from: Point, id: SectionId): Promise<void>; reveal(): Promise<void> };

const INK = '#0d0f0c';
const PHOSPHOR = '#39ff6e';
const GAP = 22; // dot grid pitch, CSS px
const SPREAD = 0.45; // share of the cover each dot spends growing

let overlay: Overlay | null = null;
let busy = false;
const last = { x: -1, y: -1, seen: false };

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Scroll to a section's top at once and hand focus to its heading (keyboard and screen-reader users land there too). */
function jump(id: SectionId, el: HTMLElement) {
  const lenis = getLenis();
  if (lenis) lenis.scrollTo(id === 'top' ? 0 : el, { immediate: true, force: true });
  else scrollTo(0, id === 'top' ? 0 : el.getBoundingClientRect().top + scrollY);
  const h = el.querySelector<HTMLElement>('h1, h2');
  if (h) {
    h.tabIndex = -1;
    h.focus({ preventScroll: true });
  }
}

/** Jump to a section behind the transition (a plain jump with reduced motion). `from` defaults to the last cursor position. */
export async function goTo(id: SectionId, from?: Point) {
  const el = document.getElementById(id);
  if (busy || !el) return;
  const y = id === 'top' ? 0 : el.getBoundingClientRect().top + scrollY;
  if (Math.abs(y - scrollY) < 2 || reduced() || !overlay) return jump(id, el);
  busy = true;
  const lenis = getLenis();
  lenis?.stop();
  try {
    const at = from ?? (last.seen ? last : { x: innerWidth / 2, y: innerHeight / 2 });
    await overlay.cover({ x: at.x, y: at.y }, id);
    jump(id, el);
    await overlay.reveal();
  } finally {
    lenis?.start();
    busy = false;
  }
}

const LABELS: Partial<Record<SectionId, { key: string; label: string }>> = {
  top: { key: 'esc', label: 'Phosphor One' },
  ...Object.fromEntries(NAV.map((n) => [n.id, n])),
};

/**
 * Full-screen cover for section jumps: a dot grid grows out from the cursor (its wave front lit green),
 * the page jumps while covered, then a green-rimmed circle opens on the new section.
 */
export function Transition() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLDivElement>(null);
  const keyEl = useRef<HTMLSpanElement>(null);
  const nameEl = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const c = canvas.current!, g = c.getContext('2d')!;
    let w = 0, h = 0, dots = new Float32Array(0);
    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = innerWidth;
      h = innerHeight;
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cols = Math.ceil(w / GAP) + 1, rows = Math.ceil(h / GAP) + 1;
      dots = new Float32Array(cols * rows * 2);
      for (let j = 0, i = 0; j < rows; j++) for (let k = 0; k < cols; k++, i += 2) [dots[i], dots[i + 1]] = [k * GAP, j * GAP];
    };
    const move = (e: PointerEvent) => Object.assign(last, { x: e.clientX, y: e.clientY, seen: true });
    resize();
    addEventListener('resize', resize);
    addEventListener('pointermove', move, { passive: true });

    let from: Point = { x: 0, y: 0 };
    const far = () => Math.max(Math.hypot(from.x, from.y), Math.hypot(w - from.x, from.y), Math.hypot(from.x, h - from.y), Math.hypot(w - from.x, h - from.y));
    const drawDots = (p: number) => {
      g.clearRect(0, 0, w, h);
      if (p >= 1) {
        g.fillStyle = INK;
        g.fillRect(0, 0, w, h);
        return;
      }
      const max = far(), full = GAP * 0.75; // ≥ GAP/√2: grown dots overlap into a solid sheet
      const ink = new Path2D(), lit = new Path2D();
      for (let i = 0; i < dots.length; i += 2) {
        const x = dots[i], y = dots[i + 1];
        const t = Math.min(Math.max((p - (Math.hypot(x - from.x, y - from.y) / max) * (1 - SPREAD)) / SPREAD, 0), 1);
        if (t <= 0) continue;
        const r = full * (1 - (1 - t) ** 3);
        const path = t < 0.55 ? lit : ink;
        path.moveTo(x + r, y);
        path.arc(x, y, r, 0, Math.PI * 2);
      }
      g.fillStyle = INK;
      g.fill(ink);
      g.fillStyle = PHOSPHOR;
      g.fill(lit);
    };
    const drawHole = (p: number) => {
      const r = far() * p;
      g.clearRect(0, 0, w, h);
      g.fillStyle = INK;
      g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'destination-out';
      g.beginPath();
      g.arc(from.x, from.y, r, 0, Math.PI * 2);
      g.fill();
      g.globalCompositeOperation = 'source-over';
      g.strokeStyle = PHOSPHOR;
      g.lineWidth = 2;
      g.shadowColor = PHOSPHOR;
      g.shadowBlur = 18;
      g.stroke();
      g.shadowBlur = 0;
    };

    const state = { p: 0 };
    overlay = {
      async cover(at, id) {
        from = at;
        const l = LABELS[id];
        if (l) {
          keyEl.current!.textContent = l.key;
          nameEl.current!.textContent = l.label;
        }
        root.current!.dataset.on = '';
        gsap.set(label.current, { autoAlpha: 0, y: 10 });
        state.p = 0;
        await gsap.to(state, { p: 1, duration: 0.62, ease: 'power1.in', onUpdate: () => drawDots(state.p) });
        await gsap.to(label.current, { autoAlpha: 1, y: 0, duration: 0.22, ease: 'power2.out' });
      },
      async reveal() {
        state.p = 0;
        gsap.to(label.current, { autoAlpha: 0, y: -8, duration: 0.2, ease: 'power2.in' });
        await gsap.to(state, { p: 1, duration: 0.78, delay: 0.08, ease: 'expo.inOut', onUpdate: () => drawHole(state.p) });
        g.clearRect(0, 0, w, h);
        delete root.current!.dataset.on;
      },
    };
    return () => {
      overlay = null;
      removeEventListener('resize', resize);
      removeEventListener('pointermove', move);
    };
  }, []);

  return (
    <div ref={root} className={s.transition} aria-hidden="true">
      <canvas ref={canvas} />
      <div ref={label} className={s.label}>
        <kbd ref={keyEl} />
        <span ref={nameEl} />
      </div>
    </div>
  );
}

