'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import type { TypeTest } from '../type/useTypeTest';
import { sound } from '../content/copy';
import { KeyCap } from '../nav/Menu';
import { openShortcuts } from '../nav/Shortcuts';
import { Brand } from './Brand';
import { Specs } from './Specs';
import { Sound } from './Sound';
import { Build } from './Build';
import { Type } from './Type';
import { Order } from './Order';
import s from './Shells.module.css';

/** Every section after the hero (Brand, Specs, Sound, Build, Type, Order), with a masked heading reveal on scroll. */
export function Shells({ tap, test }: { tap: (code: string) => void; test: TypeTest }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.registerPlugin(ScrollTrigger, SplitText);
    let alive = true;
    const ctx = gsap.context(() => {}, root);
    document.fonts.ready.then(() =>
      ctx.add(() => {
        if (!alive) return;
        gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((h) => {
          const split = SplitText.create(h, { type: 'words', mask: 'words', wordsClass: 'sw' });
          const rest = h.parentElement!.querySelectorAll('[data-rise]');
          const tl = gsap.timeline({ scrollTrigger: { trigger: h, start: 'top 88%', once: true } });
          tl.from(split.words, { yPercent: 115, duration: 1.1, ease: 'expo.out', stagger: 0.05 })
            .from(rest, { y: 16, autoAlpha: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08 }, 0.25);
        });
      }),
    );
    return () => {
      alive = false;
      ctx.revert();
    };
  }, []);

  return (
    <div ref={root}>
      <Brand />
      <Specs />
      <Sound tap={tap} />
      <Build />
      <Type test={test} />
      <Order />
      <footer className={s.footer}>
        <p>
          Phosphor One is a design concept, not a product for sale. © 2026 Phosphor. {sound.credit}
        </p>
        <button type="button" className={s.keys} onClick={openShortcuts}>
          <KeyCap k="?" sr="Question mark" /> Keyboard shortcuts
        </button>
      </footer>
    </div>
  );
}
