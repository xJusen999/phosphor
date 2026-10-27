import type { SectionId } from './layout';

export const KEYMAP: Record<string, SectionId | 'shortcuts'> = {
  Escape: 'top',
  KeyP: 'brand',
  KeyS: 'specs',
  Space: 'sound',
  KeyB: 'build',
  KeyT: 'type',
  KeyO: 'order',
  Slash: 'shortcuts', // only with Shift ("?")
};

export type KeyEvent = {
  code: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  targetTag: string;
  targetEditable: boolean;
  typeTestActive: boolean;
};

const TEXT_TAGS = ['INPUT', 'TEXTAREA', 'SELECT'];
const ACTIVATABLE_TAGS = ['BUTTON', 'A', 'SUMMARY'];

export function shouldHandleKey(e: KeyEvent): SectionId | 'shortcuts' | null {
  // Escape works everywhere except while the type test handles it itself.
  if (e.code === 'Escape') return e.typeTestActive ? null : 'top';
  if (e.ctrlKey || e.metaKey || e.altKey || e.typeTestActive || e.targetEditable) return null;
  if (TEXT_TAGS.includes(e.targetTag)) return null;
  if (e.code === 'Space' && ACTIVATABLE_TAGS.includes(e.targetTag)) return null;
  if (e.code === 'Slash' && !e.shiftKey) return null;
  return KEYMAP[e.code] ?? null;
}
