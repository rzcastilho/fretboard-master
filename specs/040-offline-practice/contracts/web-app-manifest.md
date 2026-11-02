# Contract: web app manifest and install links

## `static/manifest.webmanifest` → served at `/manifest.webmanifest`

```json
{
  "id": "/",
  "name": "Fretboard Master",
  "short_name": "Fretboard Master",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#f3f4f6",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

| Rule | Checked by |
|---|---|
| `name`, `short_name`, `start_url`, `scope`, `display: standalone` exactly as above (C-11, SC-007) | `tests/unit/offline/manifest.test.ts`, e2e manifest test |
| `background_color` equals the light value of `--color-surface`. `theme_color` equals the light value of `--color-surface-raised`. Both are parsed from `src/lib/styles/tokens.css` | unit |
| Each icon file exists under `static/`, is a PNG, and its IHDR width and height match `sizes` | unit |
| Every icon URL returns 200 with `image/png` | e2e |
| No `description`, `shortcuts`, `share_target`, `protocol_handlers` or `related_applications` fields (FR-014, Constitution VIII) | unit (exact key set) |
| The maskable icon keeps its glyph inside the central 80% circle | `scripts/make-icons.mjs` geometry, plus a manual check |
| The icons use no root, third or fifth colour (Constitution VII) | `scripts/make-icons.mjs` takes only the ink and surface token values |

## `src/app.html` head additions

```html
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
```

- `static/icons/apple-touch-icon.png` is 180×180, opaque, on the surface colour.
- Every prerendered page (`/`, `/notes`, `/triads`, `/caged`, `/metronome`, `/about`, `404.html`)
  carries both links. Checked by a unit test on `src/app.html` and an e2e check over every
  prerendered page.

## `static/_headers` additions (C-06)

```text
/service-worker.js
  Cache-Control: no-cache

/manifest.webmanifest
  Cache-Control: no-cache
  Content-Type: application/manifest+json

/icons/*
  Cache-Control: public, max-age=86400

/caged
  Cache-Control: no-cache

/metronome
  Cache-Control: no-cache
```

`scripts/serve-build.mjs` mirrors these:

- content types: `.webmanifest` → `application/manifest+json`, `.png` → `image/png`,
  `.woff2` → `font/woff2`;
- `no-cache` for `service-worker.js` and the manifest.
