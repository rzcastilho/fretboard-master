# Data Model: Desktop-Only Web Application (030)

No new entities. Four existing ones change; two stored/shared formats stay byte-compatible.

## 1. Arrangement (`src/lib/shell/layout.ts`)

```ts
type Arrangement = 'reflow' | 'wide-side' | 'wide-stacked';
const REFLOW_MAX = 1023; // CSS px
arrangementFor(input: { width: number; neckWidth: number; chrome: LayoutChrome }): Arrangement
```

| Rule | |
|---|---|
| `width ≤ REFLOW_MAX` | `reflow` |
| else `neckWidth ≤ wideLeftColumn(width, chrome)` | `wide-side` |
| else | `wide-stacked` |

- Removed: `'narrow' | 'medium' | 'landscape'`, `NARROW_MAX`, `MEDIUM_MAX`,
  `LANDSCAPE_MAX_HEIGHT`, `isPhoneLandscape`, the `height` input.
- `viewport.arrangement` (`src/lib/state/viewport.svelte.ts`) stays `undefined` before mount; it
  still tracks `height` for other readers but no longer passes it to `arrangementFor`.
- Mirrors: `static/theme-boot.js` (provisional), `[data-arrangement]` CSS. Not stored, not in
  links.

## 2. Stored preferences record (`src/lib/prefs/schema.ts`)

| Field | Before | After |
|---|---|---|
| `Preferences.rotateHintShown` | boolean, default false | removed |
| record key `rotateHint` | read (fallback false), written only when true | not read (stripped by `v.object`), not written |
| `PRIVACY_CATEGORIES.hints` | `['rotateHintShown', 'cagedNoteShown']` | `['cagedNoteShown']` |
| format version | 1 | 1 (unchanged) |

Validation and transitions:

- Any record from an earlier version, with `rotateHint` true, false, invalid or absent, parses
  with every other field identical to today's result. Never throws (Principle IX).
- First write after load serializes without `rotateHint`. Key order of the remaining keys is
  unchanged.
- `preferences` store loses `rotateHintShown` and `markRotateHintShown()`; `erase()` and the
  session memory drop the field.

## 3. Share link

Unchanged. No field references arrangement, orientation, fit or the hint. All
link-compatibility fixtures stay and pass (FR-012).

## 4. Fit event (`src/lib/fretboard/types.ts`)

```ts
type FitEvent =
  | { kind: 'overflow'; value: boolean }
  | { kind: 'small-tap'; position: Position };
```

Removed: `{ kind: 'request'; mode: FitMode }` (pinch was its only emitter). `fit.toggle()` from
the fit control is unchanged.

## 5. Reference profile (config, not code)

| | Before | After |
|---|---|---|
| Lighthouse settings | default mobile emulation, simulated throttling | `preset: 'desktop'` |
| Score gate | ≥ 0.70 | ≥ 0.90 |
| `interactive` `/`, `/about` | ≤ 4500 ms | ≤ 3000 ms |
| `interactive` `/notes`, `/triads` | ≤ 5000 ms | ≤ 3500 ms |
| CLS, TBT warning | 0.1, 200 ms | unchanged |

## 6. Constitution amendment record

Version 2.0.0, reason, principles V / VI / VII, sections touched, dependent guidance. Exact text:
`contracts/constitution-amendment.md`.
