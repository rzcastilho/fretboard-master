# ADR 0024: Theme pin, boot script and shared board palette

- **Status**: Accepted
- **Source**: spec 026-themes-motion-and-print (research R-01, R-02, R-05, R-06)

## Baseline measurement

Initial-JS gzip before feature 026 (`pnpm build:test && node scripts/check-bundle-size.mjs build`):
**135.0 KB**, limit 136 KB, remaining headroom about **1.0 KB**.

## Context

The app must follow the device theme live, let the user pin light or dark, paint the pinned
theme on the first frame, and keep the fretboard readable and identical in both themes. The CSP
(`script-src 'self'`) forbids inline scripts, the host is static (no server rendering), and the
bundle cap cannot be raised (FR-033).

## Decision

- **One attribute plus `color-scheme` and `light-dark()`.** `:root { color-scheme: light dark }`
  follows the device; `:root[data-theme='light'|'dark']` pins it. Every surface and chrome token
  is written once as `light-dark(<light>, <dark>)`, and the `prefers-color-scheme` block is gone.
  Native controls and scrollbars match the effective theme by construction, and following the
  device is pure CSS, so it is live and works without JavaScript. (R-01)
- **A same-origin boot script prevents the flash.** `static/theme-boot.js` (about 300 B) is a
  parser-blocking classic `<script src>` in `app.html`. It reads `fretboard-master:prefs` inside
  `try` and sets `data-theme` only for exactly `'light'` or `'dark'`. It never writes, and any
  error leaves Follow device. `static/_headers` serves it `no-cache` because the name is not
  hashed. No CSP change and no inline hash. A `node:vm` contract test keeps its key and accepted
  values in lockstep with the prefs codec. (R-02)
- **One shared board palette.** On-board colours are literal `--fb-color-*` tokens in a block
  that is identical in light and dark. The board SVG no longer references surface tokens, so
  every on-board colour computes the same in both themes. The old `--color-root|third|…` names
  were removed, not aliased. A 1-unit edge outline gives the board a 3:1 boundary against the
  dark surface. (R-05)
- **Dimmed markers get more opacity.** `--emph-dim-opacity` rises from 0.4 to 0.6 (0.7 and 0.8
  in the higher-contrast variants). At 0.4 the root marker composited to about 2.2:1, below the
  3:1 floor. Size still shrinks through `--emph-dim-scale`, so dimming stays visible. (R-05)
- **Higher contrast and forced colours** layer on top as `prefers-contrast: more` token
  overrides and `forced-colors: active` system colours. (R-06)

## R-01 risk outcome

The risk was that the CSS minifier would down-level `light-dark()` into its
`--lightningcss-light/dark` toggle, breaking the pin. It was mitigated with the first fallback:
`build.cssTarget` in `vite.config.ts` is set to `chrome123`, `firefox120` and `safari17.5`, the
first versions with native `light-dark()`, so no polyfill is emitted. The duplicated-block
fallback was not needed. The e2e theme spec checks computed colours for pinned dark on a light
device and the reverse against the production build, so a regression fails there.

## Consequences

- Browsers older than Chrome 123, Firefox 120 or Safari 17.5 fall outside the supported range.
- The boot script is one extra request and counts toward the bundle budget
  (`scripts/check-bundle-size.mjs` sums every `<script src>`).
- Adding an on-board colour means adding an `--fb-color-*` token and a contrast check, not
  reading a surface token.
