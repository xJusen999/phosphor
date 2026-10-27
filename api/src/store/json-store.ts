import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/** One JSON array per file. Writes are serialized so concurrent requests cannot clobber each other. */
export class JsonStore<T> {
  private chain: Promise<unknown> = Promise.resolve();

  constructor(private readonly file: string) {}

  async read(): Promise<T[]> {
    try {
      return JSON.parse(await readFile(this.file, 'utf8')) as T[];
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw e;
    }
  }

  /**
   * Appends `item` unless an existing entry matches `isSame`. Resolves with the list as stored
   * (the existing entry is kept on a duplicate) so callers can derive position or rank atomically.
   */
  append(item: T, isSame?: (x: T) => boolean): Promise<{ items: T[]; added: boolean }> {
    const run = this.chain.then(async () => {
      const items = await this.read();
      if (isSame && items.some(isSame)) return { items, added: false };
      items.push(item);
      await mkdir(dirname(this.file), { recursive: true });
      await writeFile(`${this.file}.tmp`, JSON.stringify(items));
      await rename(`${this.file}.tmp`, this.file); // atomic swap: a crash never leaves a half-written file
      return { items, added: true };
    });
    this.chain = run.catch(() => undefined); // a failed write must not block later ones
    return run;
  }
}

export const dataDir = () => process.env.PHOSPHOR_DATA_DIR || `${__dirname}/../../data`;
