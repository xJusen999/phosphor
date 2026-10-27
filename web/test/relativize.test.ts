import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
      '<script src="./_next/static/x.js"></script><link href="./fonts/a.woff2">',
    );
    expect(readFileSync(join(dir, 'a/b.css'), 'utf8')).toBe('@font-face{src:url(../_next/static/media/f.woff2)}');
    expect(readFileSync(join(dir, '_next/static/x.js'), 'utf8')).toBe('n.p="./_next/";fetch("./fonts/a.woff2")');
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
});
