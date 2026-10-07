<!-- Bundle baseline (spec 027, T001): initial JS gzip 136.9 KB, cap 150 KB (scripts/check-bundle-size.mjs build) -->

# ADR 0026: Character-key shortcuts

- **Status**: Accepted
- **Source**: spec 027-about-privacy-and-shortcuts (research R-13, R-14, R-16)

## Context

Frequent actions (Listen, step inversion or shape, cycle labels, switch notation) need keyboard
shortcuts. Single-character shortcuts can collide with typing, assistive technology and browser
chords, and WCAG 2.1.4 requires a way to turn them off. They must never drift from the on-screen
controls they mirror.

## Decision

- **Match the produced character, not the physical key.** `matchShortcut` compares `event.key`
  (lower-cased, length 1) against the table `P . , L N`, so non-QWERTY layouts get the character
  the user sees on the keycap. `Shift` is allowed; it does not change the lookup.
- **A guard set refuses what others own.** No match when Ctrl, Meta, Alt or AltGraph is held,
  on auto-repeat, when `defaultPrevented`, during IME composition, or when the target is editable
  (text-like `input`, `textarea`, `select`, `contenteditable`). Screen-reader keys (multi-character
  `key` values) never match. The matcher is pure and DOM-free (`src/lib/state/shortcuts.ts`).
- **One window listener, in the root layout.** `+layout.svelte` handles `keydown` once via
  `<svelte:window>`; tools register nothing. The layout checks `shortcuts.enabled`, matches, runs,
  and calls `preventDefault()` only when an action actually ran.
- **State-flag gating instead of DOM clicks.** `runShortcut` calls the store methods the controls
  call (`triads.listen()`, `caged.step()`, `setLabelType`, `notation.choose`) after reading the same
  `display` flags that enable or disable those controls. A shortcut is therefore a no-op exactly
  when its control is absent or disabled, and no code queries or clicks the DOM.
- **Off switch for WCAG 2.1.4.** `shortcuts.enabled` (default on) is set on About, persisted as
  `shortcuts: false` only when off, and reset to on by Erase my preferences. Controls expose
  `aria-keyshortcuts` only while the switch is on.
- **`P` also plays Listen in Notes (R-14).** Notes has a Listen control, so `P` follows the
  rule "same handler as the on-screen control", gated by `notes.display.listen.enabled`. The spec
  text that called it a no-op was corrected.

## Consequences

- Adding a shortcut means one row in `SHORTCUTS`, one case in `runShortcut` and an About string.
- No CSP or header change: `svelte.config.js` and `static/_headers` are untouched.
- **Bundle**: baseline 136.9 KB gzip initial JS (T001). After the slice: **142.0 KB** (T047,
  `pnpm build && node scripts/check-bundle-size.mjs build`), +5.1 KB, under the 150 KB cap. This is
  above the 139–140 KB estimate in R-13 (three-locale privacy and shortcut strings and About
  markup cost more than planned); headroom is now ~8 KB.
