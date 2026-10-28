# Phosphor web

Static export (Next 15). Both builds write to `out/`; run them from the repo root (`npm run build -w web`),
never with a shell sitting inside `web/out` (Windows locks the folder).

| Script | Data mode | Publish to |
|---|---|---|
| `npm run build -w web` | `auto`: artifact db, offline fallback | the Phosphor artifact |
| `npm run build:sinapsis -w web` | `offline`: in-memory only | `galeria/demos/phosphor/` |

`scripts/relativize.mjs` runs after `next build` and leaves `out/` host-ready:

- relative paths, `_next/` renamed to `assets/` (the host rejects top-level `_` paths);
- non-ASCII escaped in JS (`\uXXXX`) and CSS (`\XXXX `), a UTF-8 BOM on loose pages (not the root
  `index.html`); the build fails if any non-ASCII byte is left in JS or CSS;
- `out/.phosphor-mode` holds `auto` or `offline`: check it before publishing, and do not publish the file itself.

No manual `fix_encoding.py` step is needed on `out/`.
