/**
 * A click on a 3D key only counts when the pointer barely moved since pointerdown (R3F's `e.delta`, px)
 * and it did not end a text selection: dragging across the copy over the board must not jump sections.
 */
export const isRealClick = (delta: number, selection: string) => delta <= 2 && selection.trim() === '';
