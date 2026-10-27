'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import type { SectionId } from '@phosphor/shared';
import { KeyCap, NAV } from '../nav/Menu';
import { openShortcuts } from '../nav/Shortcuts';
import s from './Shells.module.css';

// Placeholder sections: Tasks 7–8 replace each body with the real one. `side` is where the copy sits,
// opposite the keyboard's pose for that section (scene/poses.ts).
const SHELLS: { id: Exclude<SectionId, 'top'>; side: 'left' | 'right' | 'top'; title: string; copy: string }[] = [
  { id: 'brand', side: 'left', title: 'Built for people who type all day.', copy: 'Why Phosphor exists, the three rules we design by, and the people behind the board.' },
  { id: 'specs', side: 'right', title: 'Six layers, nothing hidden.', copy: 'Scroll and the board comes apart: caps, switches, plate, PCB, gasket, case.' },
  { id: 'sound', side: 'top', title: 'Hear it before you buy it.', copy: 'Linear, tactile or clicky. Three switches, three voices, one keyboard.' },
  { id: 'build', side: 'left', title: 'Yours, down to the switch.', copy: 'Case finish, keycaps and switches, with the price updating as you choose.' },
  { id: 'type', side: 'top', title: 'Thirty seconds. Go.', copy: 'A real typing test on the board. Your hottest keys light up; your best score stays.' },
  { id: 'order', side: 'right', title: 'Ships in spring.', copy: 'Pre-order the Phosphor One for $219, or join the waitlist and hear first.' },
];

/** Section shells after the hero, with a masked heading reveal on scroll. */
export function Shells() {
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
      {SHELLS.map((sec) => {
        const nav = NAV.find((n) => n.id === sec.id)!;
        return (
          <section key={sec.id} id={sec.id} className={s.section} data-side={sec.side} aria-labelledby={`${sec.id}-title`}>
            <div className={s.body}>
              <p className={s.eyebrow} data-rise>
                <KeyCap k={nav.key} sr={nav.sr} /> {nav.label}
              </p>
              <h2 id={`${sec.id}-title`} className={s.title} data-reveal>
                {sec.title}
              </h2>
              <p className={s.copy} data-rise>
                {sec.copy}
              </p>
              {sec.id === 'order' && (
                // Placeholder: Task 8 wires this to DataClient.joinWaitlist.
                <form className={s.waitlist} data-rise onSubmit={(e) => e.preventDefault()}>
                  <label className="sr-only" htmlFor="waitlist-email">Email</label>
                  <input id="waitlist-email" type="email" name="email" placeholder="you@studio.com" autoComplete="email" />
                  <button type="submit">Join the waitlist</button>
                </form>
              )}
            </div>
          </section>
        );
      })}
      <footer className={s.footer}>
        <p>Phosphor One is a design concept, not a product for sale. © 2026 Phosphor.</p>
        <button type="button" className={s.keys} onClick={openShortcuts}>
          <KeyCap k="?" sr="Question mark" /> Keyboard shortcuts
        </button>
      </footer>
    </div>
  );
}
