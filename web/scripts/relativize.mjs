// Post-build: make the static export loadable from any subfolder (e.g. a published artifact).
// Rewrites root-absolute /_next/ and /fonts/ references to paths relative to the file's own
// directory (CSS and HTML) or to the page root (JS, which resolves against the document).
// Then renames _next/ to assets/ (the artifact host rejects top-level paths starting with "_").
import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = process.argv[2] ?? 'out';
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
process.exit(bad ? 1 : 0);
