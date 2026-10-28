import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = join(__dirname, '..', 'scripts', 'relativize.mjs');

function fixture(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'rel-'));
  for (const [p, body] of Object.entries(files)) {
    mkdirSync(join(dir, p, '..'), { recursive: true });
    writeFileSync(join(dir, p), body);
  }
  return dir;
}

describe('relativize', () => {
  it('rewrites absolute _next and fonts paths in html, css (relative to the file) and js', () => {
    const dir = fixture({
      'index.html': '<script src="/_next/static/x.js"></script><link href="/fonts/a.woff2">',
      'a/b.css': '@font-face{src:url(/_next/static/media/f.woff2)}',
      '_next/static/x.js': 'n.p="/_next/";fetch("/fonts/a.woff2")',
    });
    execFileSync('node', [script, dir]);
    expect(readFileSync(join(dir, 'index.html'), 'utf8')).toBe(
      '<script src="./assets/static/x.js"></script><link href="./fonts/a.woff2">',
    );
    expect(readFileSync(join(dir, 'a/b.css'), 'utf8')).toBe('@font-face{src:url(../assets/static/media/f.woff2)}');
    expect(readFileSync(join(dir, 'assets/static/x.js'), 'utf8')).toBe('n.p="./assets/";fetch("./fonts/a.woff2")');
  });

  it('exits non-zero when an absolute /_next/ remains', () => {
    const dir = fixture({ 'index.html': '<a href=" /_next/x">' });
    const r = spawnSync('node', [script, dir]);
    expect(r.status).toBe(1);
  });

  it('exits non-zero when a page exists below the root', () => {
    const dir = fixture({ 'index.html': '<p>', 'sub/page.html': '<p>' });
    const r = spawnSync('node', [script, dir]);
    expect(r.status).toBe(1);
    expect(r.stderr.toString()).toContain('nested page');
  });

  const full = () =>
    fixture({
      'index.html': '<script src="/_next/static/chunks/a.js"></script><script>self.__next_f.push([1,"{\\"href\\":\\"/_next/static/css/z.css\\"}"])</script>',
      'index.txt': '1:{"href":"/_next/static/css/z.css"}\n2:["static/chunks/app/_not-found/page.js","_next/static/chunks/b.js"]',
      '_next/static/css/z.css': '@font-face{src:url(/_next/static/media/f.woff2)}',
      '_next/static/chunks/a.js': 'n.p="/_next/";',
      '_next/static/chunks/app/_not-found/page.js': 'x',
      '_next/static/m_buildManifest.js': 'y',
    });
  const tree = (d: string): string[] =>
    readdirSync(d, { recursive: true, withFileTypes: true }).map((e) => join(e.parentPath, e.name));

  it('renames _next to assets and rewrites every reference', () => {
    const dir = full();
    execFileSync('node', [script, dir]);
    expect(existsSync(join(dir, '_next'))).toBe(false);
    expect(existsSync(join(dir, 'assets/static/chunks/app/_not-found/page.js'))).toBe(true);
    expect(existsSync(join(dir, 'assets/static/m_buildManifest.js'))).toBe(true);
    expect(readdirSync(dir).filter((n) => n.startsWith('_'))).toEqual([]);
    expect(readFileSync(join(dir, 'index.html'), 'utf8')).toContain('"./assets/static/css/z.css');
    expect(readFileSync(join(dir, 'index.txt'), 'utf8')).toContain('"./assets/static/css/z.css"');
    expect(readFileSync(join(dir, 'index.txt'), 'utf8')).toContain('"assets/static/chunks/b.js"');
    expect(readFileSync(join(dir, 'assets/static/css/z.css'), 'utf8')).toBe('@font-face{src:url(../../../assets/static/media/f.woff2)}');
    for (const f of tree(dir)) if (/\.(html|css|js|txt)$/.test(f)) expect(readFileSync(f, 'utf8')).not.toContain('_next/');
  });

  it('is idempotent', () => {
    const dir = full();
    execFileSync('node', [script, dir]);
    const snap = tree(dir).map((f) => f + (/\.\w+$/.test(f) ? readFileSync(f, 'utf8') : ''));
    execFileSync('node', [script, dir]);
    expect(tree(dir).map((f) => f + (/\.\w+$/.test(f) ? readFileSync(f, 'utf8') : ''))).toEqual(snap);
  });

  it('exits non-zero when an unrewritable _next/ string remains', () => {
    const dir = fixture({ 'index.html': '<p>', 'assets/x.js': 'a_next/b' });
    const r = spawnSync('node', [script, dir]);
    expect(r.status).toBe(1);
    expect(r.stderr.toString()).toContain('_next/');
  });

  it('exits non-zero when a top-level entry starts with _', () => {
    const dir = fixture({ 'index.html': '<p>', '_other/x.js': 'ok' });
    const r = spawnSync('node', [script, dir]);
    expect(r.status).toBe(1);
    expect(r.stderr.toString()).toContain('top-level');
  });
});
