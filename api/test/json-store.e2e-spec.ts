import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonStore } from '../src/store/json-store';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'phosphor-store-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe.each([
  ['an empty file', ''],
  ['garbage text', 'not json {{'],
  ['a non-array JSON value', '{}'],
])('JsonStore with %s', (_label, content) => {
  it('quarantines the file and starts from an empty list', async () => {
    const file = join(dir, 'c.json');
    writeFileSync(file, content);
    const store = new JsonStore<number>(file);
    expect(await store.read()).toEqual([]);
    expect((await store.append(1)).items).toEqual([1]);
    expect(await store.read()).toEqual([1]);
    const quarantined = readdirSync(dir).filter((f) => /^c\.corrupt-\d+\.json$/.test(f));
    expect(quarantined).toHaveLength(1);
    expect(existsSync(join(dir, 'c.json'))).toBe(true);
  });
});
