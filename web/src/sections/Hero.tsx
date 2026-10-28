'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { fx, GL_LOST_EVENT, GL_READY_EVENT } from '../three/bus';
import { KeyCap, Menu, NAV, SoundToggle } from '../nav/Menu';
import s from './Hero.module.css';

// Paints the split headline onto a canvas, glyph by glyph at the DOM's own positions, so the GL copy
// lines up with the (then transparent) DOM text to the pixel.
function paintHeadline(h1: HTMLElement, chars: Element[]) {
  const box = h1.getBoundingClientRect();
  const pad = Math.ceil(parseFloat(getComputedStyle(h1).fontSize) * 0.4); // room for italic overhang and descenders
  const scale = Math.min(devicePixelRatio || 1, 2);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil((box.width + 2 * pad) * scale);
  canvas.height = Math.ceil((box.height + 2 * pad) * scale);
  const g = canvas.getContext('2d')!;
  g.scale(scale, scale);
  for (const ch of chars) {
    const text = ch.textContent ?? '';
    const cs = getComputedStyle(ch);
    g.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const m = g.measureText(text);
    const r = ch.getBoundingClientRect();
    // CSS centres the font's ascent + descent inside the line box (half-leading).
    const baseline = r.top + (r.height - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent;
    g.fillText(text, r.left - box.left + pad, baseline - box.top + pad);
  }
  return { canvas, pad };
}

/** Top nav and the first screen: the headline rises in through word masks, then hands itself to GL. */
export function Hero() {
  const h1 = useRef<HTMLHeadingElement>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(SplitText);
    const el = h1.current!;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let split: SplitText | null = null;
    let version = 0;
    let alive = true;
    let resizeTimer = 0;
    let introDone = false;

    const paint = () => {
      if (!split) return;
      const { canvas, pad } = paintHeadline(el, split.chars);
      fx.headline = { el, canvas, pad, version: ++version };
    };
    const handOff = () => {
      if (!alive || !introDone || !fx.glReady) return;
      paint();
      fx.headlineGL = 1;
      el.classList.add(s.gl);
    };
    // GL can come and go (context loss, error fallback, remounts): follow it both ways.
    const whenGL = () => {
      introDone = true;
      handOff();
    };
    const takeBack = () => el.classList.remove(s.gl);
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(paint, 120);
    };

    const ctx = gsap.context(() => {}, root);
    // ctx.add: the tweens made after the fonts load still belong to the context (reverted with it,
    // and '[data-intro]' resolves inside the hero only).
    document.fonts.ready.then(() =>
      ctx.add(() => {
        if (!alive) return;
        split = SplitText.create(el, { type: 'words,chars', mask: 'words', wordsClass: 'hw', charsClass: 'hc' });
        el.style.visibility = 'visible';
        if (reduced) return whenGL();
        gsap.from(split.chars, { yPercent: 118, duration: 1.25, ease: 'expo.out', stagger: 0.024, delay: 0.15, onComplete: whenGL });
        gsap.fromTo('[data-intro]', { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.1, ease: 'power3.out', stagger: 0.07, delay: 0.55 });
      }),
    );
    addEventListener('resize', onResize);
    addEventListener(GL_READY_EVENT, handOff);
    addEventListener(GL_LOST_EVENT, takeBack);

    return () => {
      alive = false;
      clearTimeout(resizeTimer);
      removeEventListener('resize', onResize);
      removeEventListener(GL_READY_EVENT, handOff);
      removeEventListener(GL_LOST_EVENT, takeBack);
      fx.headline = null;
      fx.headlineGL = 0;
      split?.revert();
      ctx.revert();
    };
  }, []);

  return (
    <div ref={root} className={s.intro}>
      <header className={s.nav}>
        <a className={s.logo} href="#top" data-intro>
          <span className={s.dot} aria-hidden="true" />
          Phosphor
        </a>
        <nav aria-label="Sections" className={s.links} data-intro>
          {NAV.map((n) => (
            <a key={n.id} href={`#${n.id}`}>
              <KeyCap k={n.key} sr={n.sr} />
              {n.label}
            </a>
          ))}
        </nav>
        <div className={s.end}>
          <SoundToggle />
          <a className={s.cta} href="#order" data-intro>
            Pre-order<span className={s.ctaPrice}> — $219</span>
          </a>
        </div>
        <Menu />
      </header>

      <section id="top" className={s.hero}>
        <p className={s.eyebrow} data-intro>
          Phosphor One · 60% mechanical · per-key light
        </p>
        <h1 ref={h1} className={s.title}>
          A keyboard that <em className="accent">glows</em> back.
        </h1>
        <p className={s.sub} data-intro>
          Phosphor One. Frosted aluminium, hot-swap switches, per-key phosphor light. The whole site runs on it: press a key.
        </p>
        <div className={s.foot}>
          <p className={s.hint} data-intro>
            Press <kbd>P</kbd> to start <span aria-hidden="true">·</span> or just scroll
          </p>
          <p className={s.price} data-intro>
            <span>Pre-order</span> <b>$219</b> <span>· ships in spring</span>
          </p>
        </div>
      </section>
    </div>
  );
}
