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

  describe('host-ready encoding', () => {
    const BOM = String.fromCharCode(0xfeff);
    const u = (...cps: number[]) => String.fromCodePoint(...cps);
    const E = u(0xe9); // e acute
    const DASH = u(0x2014);
    const enc = () =>
      fixture({
        'index.html': `<p>caf${E}</p>`,
        '404.html': `<p>${DASH}</p>`,
        'assets/a.js': `const r="${u(0xfffd)}",e="${u(0x1f600)}",t=\`${E}\${1}\`,re=/${E}/u;/* ${DASH} */`,
        'assets/b.css': `.a::before{content:"${DASH}"}\n.b{font-family:"Caf${E}"}`,
        'assets/bom.js': `${BOM}x="${E}"`,
      });
    const BS = String.fromCharCode(92); // backslash

    it('escapes non-ASCII in JS as uXXXX escapes (astral chars as a surrogate pair) and in CSS as XXXX escapes', () => {
      const dir = enc();
      execFileSync('node', [script, dir]);
      const js = readFileSync(join(dir, 'assets/a.js'), 'utf8');
      expect(js).toBe(
        `const r="${BS}ufffd",e="${BS}ud83d${BS}ude00",t=\`${BS}u00e9\${1}\`,re=/${BS}u00e9/u;/* ${BS}u2014 */`,
      );
      // Same values once evaluated.
      expect(new Function(`${js};return [r,e,t,re.test("${E}")]`)()).toEqual([u(0xfffd), u(0x1f600), `${E}1`, true]);
      expect(readFileSync(join(dir, 'assets/b.css'), 'utf8')).toBe(
        `.a::before{content:"${BS}2014 "}\n.b{font-family:"Caf${BS}e9 "}`,
      );
      expect(readFileSync(join(dir, 'assets/bom.js'), 'utf8')).toBe(`x="${BS}u00e9"`);
      for (const f of ['assets/a.js', 'assets/b.css', 'assets/bom.js'])
        expect([...readFileSync(join(dir, f))].every((b) => b < 128)).toBe(true);
    });

    it('puts a UTF-8 BOM on loose pages but not on the root index.html (the host wraps it)', () => {
      const dir = enc();
      execFileSync('node', [script, dir]);
      expect(readFileSync(join(dir, '404.html'), 'utf8')).toBe(`${BOM}<p>${DASH}</p>`);
      expect(readFileSync(join(dir, 'index.html'), 'utf8')).toBe(`<p>caf${E}</p>`);
    });

    it('is idempotent on encoding', () => {
      const dir = enc();
      execFileSync('node', [script, dir]);
      const snap = tree(dir).map((f) => f + (/\.\w+$/.test(f) ? readFileSync(f, 'utf8') : ''));
      execFileSync('node', [script, dir]);
      expect(tree(dir).map((f) => f + (/\.\w+$/.test(f) ? readFileSync(f, 'utf8') : ''))).toEqual(snap);
    });

    it('writes the build mode marker given as the second argument (default auto)', () => {
      const a = fixture({ 'index.html': '<p>' });
      execFileSync('node', [script, a]);
      expect(readFileSync(join(a, '.phosphor-mode'), 'utf8')).toBe('auto');
      const o = fixture({ 'index.html': '<p>' });
      execFileSync('node', [script, o, 'offline']);
      expect(readFileSync(join(o, '.phosphor-mode'), 'utf8')).toBe('offline');
      expect(spawnSync('node', [script, fixture({ 'index.html': '<p>' }), 'weird']).status).toBe(1);
    });
  });
});
