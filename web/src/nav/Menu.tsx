'use client';

import { useRef } from 'react';
import type { SectionId } from '@phosphor/shared';
import s from './nav.module.css';

type NavItem = { id: SectionId; key: string; sr?: string; label: string };

/** The sections the keyboard reaches, in page order (the hero is 'top', reached with Esc). */
export const NAV: NavItem[] = [
  { id: 'brand', key: 'P', label: 'Info' },
  { id: 'specs', key: 'S', label: 'Specs' },
  { id: 'sound', key: '␣', sr: 'Space', label: 'Sound' },
  { id: 'build', key: 'B', label: 'Build' },
  { id: 'type', key: 'T', label: 'Type' },
  { id: 'order', key: 'O', label: 'Order' },
];

/** A key chip whose symbol glyph (␣, ?) still has a spoken name. */
export function KeyCap({ k, sr }: { k: string; sr?: string }) {
  return sr ? (
    <kbd>
      <span aria-hidden="true">{k}</span>
      <span className="sr-only">{sr}</span>
    </kbd>
  ) : (
    <kbd>{k}</kbd>
  );
}

/** Mobile menu: a button in the top bar opening a full-screen sheet with every section. */
export function Menu() {
  const sheet = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className={s.menuButton} data-intro aria-haspopup="dialog" onClick={() => sheet.current?.showModal()}>
        <span aria-hidden="true" className={s.burger} />
        <span className="sr-only">Menu</span>
      </button>
      {/* Links close the sheet; the page-wide anchor handler (useKeyNav) then runs the transition. */}
      <dialog ref={sheet} className={s.sheet} aria-label="Menu" data-lenis-prevent onClick={(e) => (e.target as Element).closest('a') && sheet.current?.close()}>
        <form method="dialog" className={s.sheetTop}>
          <a href="#top" className={s.sheetLogo}>Phosphor</a>
          <button className={s.close}>Close</button>
        </form>
        <nav aria-label="Sections">
          <ol className={s.sheetLinks}>
            {NAV.map((n) => (
              <li key={n.id}>
                <a href={`#${n.id}`}>
                  <KeyCap k={n.key} sr={n.sr} />
                  {n.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <a className={s.sheetCta} href="#order">Pre-order — $219</a>
      </dialog>
    </>
  );
}
