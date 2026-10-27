// Post-build: make the static export loadable from any subfolder (e.g. a published artifact).
// Rewrites root-absolute /_next/ and /fonts/ references to paths relative to the file's own
// directory (CSS and HTML) or to the page root (JS, which resolves against the document).
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = process.argv[2] ?? 'out';
// A quote, backtick, "(" or "=" right before the path marks a URL; "." before means already relative.
const ABS = /(?<=["'`(=])\/(_next|fonts)\//g;
const LEFT = /(?<!\.)\/_next\//;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(html|css|js)$/.test(name)) yield p;
  }
}

let bad = 0;
for (const file of walk(root)) {
  const depth = relative(root, file).split(sep).length - 1;
  const prefix = file.endsWith('.js') || depth === 0 ? './' : '../'.repeat(depth);
  const src = readFileSync(file, 'utf8');
  const out = src.replace(ABS, (_, dir) => `${prefix}${dir}/`);
  if (out !== src) writeFileSync(file, out);
  if (LEFT.test(out)) {
    console.error(`relativize: absolute /_next/ left in ${file}`);
    bad++;
  }
}
process.exit(bad ? 1 : 0);
