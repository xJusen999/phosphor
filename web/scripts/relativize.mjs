// Post-build: make the static export loadable from any subfolder (e.g. a published artifact).
// Rewrites root-absolute /_next/ and /fonts/ references to paths relative to the file's own
// directory (CSS and HTML) or to the page root (JS, which resolves against the document).
// Then renames _next/ to assets/ (the artifact host rejects top-level paths starting with "_"), escapes
// non-ASCII for the host and writes the build mode to .phosphor-mode.
// Usage: node scripts/relativize.mjs [outDir=out] [mode=auto|offline]
import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = process.argv[2] ?? 'out';
const mode = process.argv[3] ?? 'auto';
if (mode !== 'auto' && mode !== 'offline') {
  console.error(`relativize: unknown mode ${mode} (auto or offline)`);
  process.exit(1);
}
// A quote, backtick, "(" or "=" right before the path marks a URL; "." before means already relative.
const ABS = /(?<=["'`(=])\/(_next|fonts)\//g;
const LEFT = /(?<!\.)\/_next\//;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(html|css|js|txt|json)$/.test(name)) yield p;
  }
}

let bad = 0;
for (const file of walk(root)) {
  const depth = relative(root, file).split(sep).length - 1;
  // JS paths are document-relative ("./"), so a page below the root would load chunks from the wrong folder.
  if (depth > 0 && file.endsWith('.html')) {
    console.error(`relativize: nested page ${file}; only root-level pages are supported`);
    bad++;
    continue;
  }
  const prefix = !file.endsWith('.css') || depth === 0 ? './' : '../'.repeat(depth);
  const src = readFileSync(file, 'utf8');
  const out = src.replace(ABS, (_, dir) => `${prefix}${dir}/`);
  if (out !== src) writeFileSync(file, out);
  if (LEFT.test(out)) {
    console.error(`relativize: absolute /_next/ left in ${file}`);
    bad++;
  }
}
if (bad) process.exit(1);

if (existsSync(join(root, '_next'))) renameSync(join(root, '_next'), join(root, 'assets'));
// Not preceded by a word char, so "a_next/" or "__next/" is never touched (and is then reported below).
const OLD = /(?<![A-Za-z0-9_])_next\//g;
for (const file of walk(root)) {
  const src = readFileSync(file, 'utf8');
  const out = src.replace(OLD, 'assets/');
  if (out !== src) writeFileSync(file, out);
  if (out.includes('_next/')) {
    console.error(`relativize: _next/ left in ${file}`);
    bad++;
  }
}
for (const name of readdirSync(root)) {
  if (name.startsWith('_')) {
    console.error(`relativize: top-level entry ${name} starts with "_"`);
    bad++;
  }
}

// Host-ready encoding (was tools/publish/fix_encoding.py): the host may serve loose files without a charset and
// rejects some literal characters (Next's polyfills carry a U+FFFD). JS and CSS become pure ASCII; loose pages get
// a BOM, which beats any charset. The root index.html is the artifact page, which the host serves itself (skipped as
// fix_encoding.py did; a copy nested in Sinapsis gets its BOM from fix_encoding.py galeria).
// shortcut: a non-ASCII char right after a backslash, or inside String.raw, would change meaning; Next's output has
// neither. Revisit if a dependency ships such code.
const BOM = '\uFEFF';
for (const file of walk(root)) {
  const src = readFileSync(file, 'utf8');
  let out = src;
  if (file.endsWith('.js')) {
    // Per UTF-16 unit (no u flag), so an astral char becomes its surrogate pair: valid in strings, regex, templates.
    out = src.replace(/^\uFEFF/, '').replace(/[^\x00-\x7f]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
  } else if (file.endsWith('.css')) {
    out = src.replace(/^\uFEFF/, '').replace(/[^\x00-\x7f]/gu, (c) => `\\${c.codePointAt(0).toString(16)} `);
  } else if (file.endsWith('.html') && relative(root, file) !== 'index.html' && !src.startsWith(BOM)) {
    out = BOM + src;
  }
  if (out !== src) writeFileSync(file, out);
  if (/\.(js|css)$/.test(file) && /[^\x00-\x7f]/.test(out)) {
    console.error(`relativize: non-ASCII left in ${file}`);
    bad++;
  }
}
// Which data mode this export was built for, so a publish can check it ("auto": API or artifact db, "offline": Sinapsis).
writeFileSync(join(root, '.phosphor-mode'), mode);
process.exit(bad ? 1 : 0);
