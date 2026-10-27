'use client';

import { KeyCap, NAV } from './Menu';
import s from './nav.module.css';

const ID = 'shortcuts';

export const openShortcuts = () => (document.getElementById(ID) as HTMLDialogElement | null)?.showModal();

/** The key map, opened with "?". Esc or a click outside closes it (native dialog). */
export function Shortcuts() {
  return (
    <dialog id={ID} className={s.shortcuts} aria-labelledby="shortcuts-title" data-lenis-prevent
      onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}>
      <p className={s.kicker}>Phosphor One · keyboard map</p>
      <h2 id="shortcuts-title">The site runs on the keyboard.</h2>
      <dl className={s.map}>
        {NAV.map((n) => (
          <div key={n.id}>
            <dt><KeyCap k={n.key} sr={n.sr} /></dt>
            <dd>{n.label}</dd>
          </div>
        ))}
        <div>
          <dt><KeyCap k="esc" sr="Escape" /></dt>
          <dd>Back to the top</dd>
        </div>
        <div>
          <dt><KeyCap k="?" sr="Question mark" /></dt>
          <dd>This map</dd>
        </div>
      </dl>
      <p className={s.note}>Click a glowing key on the 3D keyboard to do the same. On touch, use the menu.</p>
      <form method="dialog">
        <button className={s.close}>Close</button>
      </form>
    </dialog>
  );
}
