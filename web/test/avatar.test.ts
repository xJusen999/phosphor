import { describe, expect, it } from 'vitest';
import { avatarCells, AVATAR_SIZE } from '../src/content/avatar';

describe('avatarCells', () => {
  it('is deterministic per name', () => {
    expect(avatarCells('Ines Varela')).toEqual(avatarCells('Ines Varela'));
  });

  it('differs between names', () => {
    expect(avatarCells('Ines Varela')).not.toEqual(avatarCells('Tomas Okafor'));
  });

  it('is a mirrored square grid with some cells lit and some dark', () => {
    const cells = avatarCells('Mei Lindqvist');
    expect(cells).toHaveLength(AVATAR_SIZE * AVATAR_SIZE);
    for (let y = 0; y < AVATAR_SIZE; y++)
      for (let x = 0; x < AVATAR_SIZE; x++) expect(cells[y * AVATAR_SIZE + x]).toBe(cells[y * AVATAR_SIZE + AVATAR_SIZE - 1 - x]);
    const on = cells.filter((c) => c > 0).length;
    expect(on).toBeGreaterThan(AVATAR_SIZE * 2);
    expect(on).toBeLessThan(AVATAR_SIZE * AVATAR_SIZE);
  });

  it('lights some cells hot (2) and the rest plain (1)', () => {
    const cells = avatarCells('Tomas Okafor');
    expect(cells.every((c) => c === 0 || c === 1 || c === 2)).toBe(true);
    expect(cells).toContain(2);
  });
});
