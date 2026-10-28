'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { shouldHandleKey, type SectionId } from '@phosphor/shared';
import { SECTION_ORDER } from '../scene/poses';
import { ensureAudio, playSwitch, pressPitch, releaseSwitch, selectedSwitch } from '../audio/switches';
import { goTo } from './Transition';
import { openShortcuts } from './Shortcuts';

// A key press is a user gesture: it unlocks audio on the first one, then plays the selected switch.
function keySound(code: string) {
  void ensureAudio();
  playSwitch(selectedSwitch(), { pitch: pressPitch(), code });
}

/**
 * Every way into a section: real keys (via shouldHandleKey), in-page links and the 3D keys (`pointerPress`).
 * Returns the keys held down, by KeyboardEvent.code, for the 3D keyboard and the smoke, and `pointerPress`
 * for a 3D key held with the pointer (released on pointerup). Every press plays the selected switch sound
 * (silent until the first click or key unlocks audio); `tap` sinks a 3D key briefly without a sound.
 */
export function useKeyNav(typeTestActive = false) {
  const [pressed, setPressed] = useState<Set<string>>(() => new Set());
  const testing = useRef(typeTestActive);
  testing.current = typeTestActive;
  const held = useRef<string | null>(null);

  const press = useCallback(
    (code: string, down: boolean) =>
      setPressed((p) => {
        if (p.has(code) === down) return p;
        const n = new Set(p);
        if (down) n.add(code);
        else n.delete(code);
        return n;
      }),
    [],
  );

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      press(e.code, true);
      const t = e.target as HTMLElement;
      // A switch card plays its own sound when activated from the keyboard.
      if (!e.repeat && !t.closest?.('[data-switch]')) keySound(e.code);
      if (e.repeat || document.querySelector('dialog[open]')) return; // open dialogs own the keys (Esc closes them)
      // "?" by the character it types, not by key position: on a Spanish layout it is Shift+Minus, not Shift+Slash.
      const code = e.key === '?' ? 'Slash' : e.code === 'Slash' ? '' : e.code;
      // Escape leaves a text field even when the jump to the top does not happen (a transition is running).
      if (e.code === 'Escape' && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) t.blur();
      const to = shouldHandleKey({
        code, shiftKey: e.shiftKey || e.key === '?', ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey,
        targetTag: t.tagName ?? '', targetEditable: !!t.isContentEditable, typeTestActive: testing.current,
      });
      if (!to) return;
      e.preventDefault(); // Space would scroll, "?" would open quick find
      if (to === 'shortcuts') openShortcuts();
      else goTo(to);
    };
    const ku = (e: KeyboardEvent) => {
      press(e.code, false);
      if (!(e.target as HTMLElement).closest?.('[data-switch]')) releaseSwitch(selectedSwitch(), e.code);
    };
    const clear = () => setPressed(new Set());
    const unlock = () => void ensureAudio(); // on release: touch only activates the page on pointerup
    const release = () => {
      if (held.current) {
        press(held.current, false);
        releaseSwitch(selectedSwitch(), held.current);
      }
      held.current = null;
    };
    // In-page links (nav, menu sheet, CTAs) take the same transition; modified clicks keep the browser's behaviour.
    const click = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const id = (e.target as Element).closest?.('a[href^="#"]')?.getAttribute('href')?.slice(1) as SectionId | undefined;
      if (!id || !SECTION_ORDER.includes(id)) return;
      e.preventDefault();
      goTo(id, e.detail ? { x: e.clientX, y: e.clientY } : undefined);
    };
    addEventListener('keydown', kd);
    addEventListener('keyup', ku);
    addEventListener('blur', clear);
    addEventListener('pointerup', unlock);
    addEventListener('pointerup', release);
    addEventListener('pointercancel', release);
    document.addEventListener('click', click);
    return () => {
      removeEventListener('keydown', kd);
      removeEventListener('keyup', ku);
      removeEventListener('blur', clear);
      removeEventListener('pointerup', unlock);
      removeEventListener('pointerup', release);
      removeEventListener('pointercancel', release);
      document.removeEventListener('click', click);
    };
  }, [press]);

  const pointerPress = useCallback(
    (code: string) => {
      held.current = code;
      press(code, true);
      keySound(code);
    },
    [press],
  );

  const tap = useCallback(
    (code: string) => {
      press(code, true);
      setTimeout(() => press(code, false), 140);
    },
    [press],
  );

  return { pressed, pointerPress, tap };
}
