export type SectionId = 'top' | 'brand' | 'specs' | 'sound' | 'build' | 'type' | 'order';

export type KeyDef = {
  id: string;
  label: string;
  code: string;
  w: number;
  row: number;
  x: number;
  fn?: SectionId;
};

// [code, label, width in units]
type Spec = [string, string, number];

const letters = (s: string): Spec[] => [...s].map((c) => [`Key${c}`, c, 1]);

const ROWS: Spec[][] = [
  [
    ['Escape', 'esc', 1],
    ...([...'1234567890'].map((c) => [`Digit${c}`, c, 1]) as Spec[]),
    ['Minus', '-', 1], ['Equal', '=', 1], ['Backspace', 'Backspace', 2],
  ],
  [
    ['Tab', 'Tab', 1.5], ...letters('QWERTYUIOP'),
    ['BracketLeft', '[', 1], ['BracketRight', ']', 1], ['Backslash', '\\', 1.5],
  ],
  [
    ['CapsLock', 'Caps', 1.75], ...letters('ASDFGHJKL'),
    ['Semicolon', ';', 1], ['Quote', "'", 1], ['Enter', 'Enter', 2.25],
  ],
  [
    ['ShiftLeft', 'Shift', 2.25], ...letters('ZXCVBNM'),
    ['Comma', ',', 1], ['Period', '.', 1], ['Slash', '/', 1], ['ShiftRight', 'Shift', 2.75],
  ],
  [
    ['ControlLeft', 'Ctrl', 1.25], ['MetaLeft', 'Win', 1.25], ['AltLeft', 'Alt', 1.25],
    ['Space', '', 6.25],
    ['AltRight', 'Alt', 1.25], ['Fn', 'Fn', 1.25], ['ContextMenu', 'Menu', 1.25], ['ControlRight', 'Ctrl', 1.25],
  ],
];

const FN: Record<string, SectionId> = {
  Escape: 'top', KeyP: 'brand', KeyS: 'specs', Space: 'sound', KeyB: 'build', KeyT: 'type', KeyO: 'order',
};

export const LAYOUT_60: KeyDef[] = ROWS.flatMap((specs, row) => {
  let x = 0;
  return specs.map(([code, label, w], i) => {
    const key: KeyDef = { id: `r${row}k${i}`, label, code, w, row, x };
    if (FN[code]) key.fn = FN[code];
    x += w;
    return key;
  });
});
