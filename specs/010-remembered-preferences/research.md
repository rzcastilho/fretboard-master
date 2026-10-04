# Research: Remembered Preferences, No Account

**Feature**: `010-remembered-preferences` | **Date**: 2026-10-03 | **Plan**: [plan.md](./plan.md)

The spec's two clarification sessions already fix every product-level question (items, defaults,
allowed sets, key names, notice text, Erase flow). Technical Context had no `NEEDS
CLARIFICATION` left; the decisions below resolve the *how*, grounded in the code as it stands on
`feature/010-remembered-preferences` (`src/lib/state/*.svelte.ts`, `src/lib/audio/engine.ts`,
`src/hooks.client.ts`, `src/routes/+layout.svelte`).

---

## R-01 — Validation library: add Valibot as the first runtime dependency

- **Decision**: Add `valibot` (^1.x, MIT) as a runtime `dependency`. The preferences schema is
  built from `object`, `picklist`, `number`, `boolean`, `pipe`, `integer`, `minValue`,
  `maxValue`, `finite`, `transform` and `fallback`, and parsed with `safeParse`.
- **Rationale**: The constitution's stack table mandates "Valibot schemas for share links and
  preferences" and FR-005 names it. This slice is the first that parses untrusted input, so it is
  the first real use. Valibot is modular and tree-shaken: the handful of actions above add about
  1–2 KB gzip, inside the initial-JS gate (80 KB at planning; raised to 85 KB by constitution 1.3.0 after measuring 82.2 KB) (`scripts/check-bundle-size.mjs`). MIT
  licence, actively maintained, no transitive runtime deps.
- **Alternatives considered**:
  - Hand-written type guards: smaller by ~1 KB but contradicts the mandated stack choice (would
    need an ADR + MINOR amendment) and would be redone when 006-sharing needs link schemas.
  - Zod: much larger (not tree-shakable to the same degree); not the mandated choice.

## R-02 — Item-by-item fallback with one schema

- **Decision**: Each field of the v1 schema is wrapped in `v.fallback(fieldSchema, default)`;
  `labels` is a nested `v.object` whose two fields each have their own fallback, and the
  `labels` object itself falls back to both defaults. The top level is `v.object` (strips
  unknown keys) wrapped in `v.fallback(…, DEFAULT_RECORD)` for non-object input (arrays, `null`,
  numbers, strings). `version` is validated (positive integer) but never changes how fields are
  read: v1 is the first format, so an unknown/newer/missing version is read item by item (FR-004).
- **Rationale**: Gives exactly FR-006 / EC-9.2: one bad item never invalidates its neighbours;
  unknown fields (`handedness`, `notices`, `tempo` from a newer build) are dropped and disappear
  on the next write. `fallback` makes parsing total: `safeParse` cannot produce an issue, and the
  outer `try/catch` only covers `JSON.parse`.
- **Alternatives considered**: `v.looseObject` + manual per-key `safeParse` (more code, same
  result); migrating per version (YAGNI: no earlier format exists).

## R-03 — Volume encoding

- **Decision**: In memory the store keeps the control scale (0–100, step 5) exactly as
  `playback.volume` does today. On write: `volume / 100`. On read: finite number in [0, 1] →
  `Math.round(x * 20) * 5`; anything else → 80.
- **Rationale**: DM-14 stores 0–1; the control works in steps of 5; the mapping is lossless for
  all 21 control values and tolerant of hand-edited values (0.33 → 35).
- **Alternatives**: storing the 0–100 control value (contradicts DM-14).

## R-04 — When storage is read: SvelteKit client `init` hook, before hydration

- **Decision**: Export `init` from `src/hooks.client.ts`. It calls
  `startPreferences()` (from `src/lib/state/preferences.svelte.ts`), which runs the probe, reads
  and parses `fretboard-master:prefs` once, and pushes the result into the existing stores
  through new non-persisting `restore…` methods (`instrument.restore`, `playback.restore`,
  `notes.restoreLabelType`, `triads.restoreLabelType`) and the new reactive `preferences`
  state (`lastTool`, `noticeVisible`). SvelteKit awaits `init` before hydrating, so the first
  interactive frame already shows stored values (FR-005). Prerendered HTML and the no-JS build
  keep showing defaults, which the spec accepts.
- **Rationale**: One explicit, testable entry point; no reads scattered across module
  initialisers; state modules stay importable in Vitest without touching storage. `init` is
  available since SvelteKit 2.10 (repo uses ^2.70).
- **Alternatives considered**:
  - Read at module evaluation of each store: hidden side effects at import time, hard to reset
    in tests, read could happen more than once.
  - Read in `+layout.svelte` `onMount`: runs *after* hydration — the first frame would show
    defaults and then jump (violates FR-005 intent, causes visible layout shift on Home).

## R-05 — Availability probe

- **Decision**: `probeStorage(storage)` does `setItem('fretboard-master:probe', '1')`,
  `getItem`, `removeItem` inside one `try/catch`; any throw, or a read-back other than `'1'`,
  → unavailable. Accessing `globalThis.localStorage` itself is inside the guard (Safari with
  blocked cookies throws `SecurityError` on property access). The result is cached for the
  session; when unavailable no further storage access happens (no reads, writes or erases).
- **Rationale**: Matches the clarify-session default; catches both "blocked" and "quota 0"
  private modes; deterministic in tests through an injected `Storage`-like object.

## R-06 — Writes: explicit, synchronous, fire-and-forget, change-detected

- **Decision**: `src/lib/prefs/session.ts` keeps the current `Preferences` in memory. Each
  user-committed change calls `remember(patch)`, which merges, compares with the last written
  serialization, and if different does one `setItem` inside `try { … } catch { /* fire-and-forget
  storage write (FR-010) */ }`. Call sites (the only ones):
  - `instrument.confirm()` when `changed` → `{ tuningId, fretCount }`;
  - `playback.setMuted` / `playback.setVolume` → `{ muted }` / `{ volume }`;
  - `notes.setLabelType` / `triads.setLabelType` → `{ labels }`;
  - tool screen opened (R-08) → `{ lastTool }`.
  No debounce: the record is < 300 chars and `setItem` is sub-millisecond, far inside the
  100 ms control budget (SC-006). Pending panel edits are not written (only `confirm`).
- **Rationale**: Explicit calls keep "first visit writes nothing" and "Erase writes nothing"
  trivially true, which an `$effect` that mirrors state would break (effects run on init and on
  restore). Writing the whole record each time gives last-write-wins across tabs (FR-015).
- **Alternatives considered**: `$effect.root` mirroring stores (writes on startup/erase, needs
  suppression flags); debounced writes (could lose the last change on tab close, buys nothing at
  this size); `storage` event listener (explicitly not wanted: no live cross-tab adoption).

## R-07 — Restoring sound without unlocking audio

- **Decision**: Add `restore(muted, volume)` to `PlaybackEngine` that only assigns the engine's
  internal `muted` / `volume` variables, and ramps the gains only if a context already exists
  (never calls `ensureContext`). `playback.restore({ muted, volume })` sets runes state, calls
  `engine.restore`, and does **not** call `markUnlocked`. Erase uses the same path after
  `playback.stop('stop')`.
- **Rationale**: `engine.setMuted`/`setVolume` call `ensureContext()`, which would create an
  `AudioContext` at startup without a gesture (autoplay warnings; violates "unlocked on the first
  user gesture"). `ensureContext` already builds its gain nodes from the stored `muted`/`volume`
  variables, so restored values take effect on the first unlock.

## R-08 — Recording "last tool used"

- **Decision**: In `src/routes/+layout.svelte`, the existing `afterNavigate` callback (which
  already runs for `enter`, `link`, `goto`, `popstate`) resolves the destination pathname with
  `TOOLS.find((t) => t.path === to.url.pathname)` and, if found, calls
  `preferences.toolOpened(tool.id)`. Home, About and the not-found page match no tool, so they
  never change it (FR-014). Carry navigation from 008 (`goto` in `links.svelte.ts`) and direct
  address are covered by the same callback. Shallow pops keep the same path and are ignored by the
  existing guard only for focus; `toolOpened` is idempotent (no write when unchanged).
- **Rationale**: One place, every route; uses `TOOLS` (not `SCREENS`, whose fallback maps unknown
  paths to `home`).
- **Alternatives**: `onMount` in each tool route (duplicated; misses nothing but grows with
  CAGED).

## R-09 — "Continue" mark on Home

- **Decision**: `ToolCard` gets a `continued: boolean` prop; `HomeScreen` passes
  `tool.id === preferences.lastTool`. When true, the card shows a visible text badge
  (`m.home_continue()` → "Continue") before the name, styled with existing tokens (accent text +
  outline, no new color), and the card's `aria-label` uses a new catalog message
  `card_label_continue` ("Continue: {name}. {question}"). Order stays `TOOLS` order.
- **Rationale**: FR-013, text-not-color, no layout reordering; badge wraps at 200% zoom since the
  card is already `overflow-wrap: anywhere` flex column.

## R-10 — Not-remembered notice placement

- **Decision**: New `src/lib/shell/PrefsNotice.svelte` rendered once in `+layout.svelte`, above
  `{@render children()}`, wrapping the existing `Notice` with
  `message={m.prefs_not_remembered()}` and `ondismiss={preferences.dismissNotice}`. It shows iff
  `preferences.noticeVisible`; `noticeVisible` becomes true only from `startPreferences()` when
  the probe fails and becomes false on dismiss or on the first real screen change
  (`beforeNavigate`, same guard as `instrument.screenChanged`). A module-level `noticeShown` flag
  means it never reappears in the session.
- **Rationale**: Mirrors the existing `playback.noticeVisible` pattern; layout-level placement
  means "whichever screen opens first" without touching each screen. `Notice` is already
  `role="status"`, non-blocking, dismissible, not error red.
- **Alternatives**: rendering inside each screen's `main` (4 call sites; Not-found would need it
  too).

## R-11 — Erase flow

- **Decision**: New `src/lib/shell/ErasePreferences.svelte` on the About page. States: `idle`
  (button **Erase my preferences**) → `confirming` (inline `<p>` question + **Erase** + **Cancel**
  in one flex row; focus to **Cancel** with `tick()`); Escape (keydown on the group) or Cancel →
  `idle`, focus back to the opener. **Erase** calls `preferences.erase()` then
  `goto(resolve('/'))`; the layout's existing `afterNavigate` focuses the home `h1`.
  `preferences.erase()`:
  1. `eraseStored()` — iterate `storage.key(i)` and remove every key starting with
     `fretboard-master:` (skipped when unavailable);
  2. `playback.stop('stop')` and `playback.restore({ muted: false, volume: 80 })`;
  3. `instrument.restore(DEFAULT_CONFIG)` (applies to Notes/Triads views like confirm, without
     the adjusted notice), `notes.restoreLabelType('name')`, `triads.restoreLabelType('interval')`;
  4. session memory reset to defaults with "last written" cleared, `lastTool = null`.
  No `remember()` call, so nothing is written until the next change (FR-017).
- **Rationale**: No modal (Constitution VII); predictable focus (FR-016); a single orchestrator
  in state keeps components thin (Constitution III).

## R-12 — Module boundaries and lint

- **Decision**: `src/lib/prefs` = pure schema/codec (`schema.ts`) + guarded storage adapter
  (`storage.ts`) + in-memory session (`session.ts`). It MUST NOT import Svelte, `$app/*`,
  paraglide, `$lib/state`, `$lib/shell` (add an ESLint `no-restricted-imports` block mirroring
  the existing theory/instrument/notation blocks; type-only imports of `TuningId`, `ToolId`,
  `LabelType`, `TriadsLabelType` are allowed via `import type`). Runes orchestration lives in
  `src/lib/state/preferences.svelte.ts`, the only module that imports `$lib/prefs` besides tests.
- **Rationale**: Constitution III/IV (prefs built test-first as a pure unit), stack row
  "localStorage behind `src/lib/prefs`".

## R-13 — Size cap and untrusted text

- **Decision**: `readRaw()` returns `null` for values longer than 16 384 chars before
  `JSON.parse` (FR-005). Stored strings are only ever compared against picklists; nothing from
  storage reaches `{@html}` or the DOM as markup (FR-008).

## R-14 — Testing strategy

- **Decision**:
  - Vitest, test-first: `tests/unit/prefs/schema.test.ts` (table of every US2 scenario 6 value,
    defaults, unknown fields, versions), a fast-check property (any JSON value / any string ≤ 20 k
    → `parsePreferences` returns a valid `Preferences` and never throws; `parse(serialize(p))`
    round-trips for every valid `p`), `storage.test.ts` (fake `Storage` that throws on access,
    on `setItem`, or returns mismatches), `session.test.ts` (no write on load, one write per
    change, none when unchanged, erase writes nothing), `tests/unit/state/preferences-store.test.ts`
    (restore paths, notice once, lastTool), component tests for `ToolCard`/`HomeScreen`
    Continue, `PrefsNotice`, `ErasePreferences` focus/Escape.
  - Playwright `e2e/preferences.spec.ts` on phone and desktop with axe: seeds via
    `page.addInitScript` (records, garbage, oversize), blocks storage by overriding
    `Storage.prototype` methods to throw, simulates quota by throwing only on `setItem`, two
    contexts/pages for US4, a request listener asserting zero network calls carry prefs
    (SC-007), and the Erase keyboard flow.
  - Existing `e2e/perf.spec.ts` / Lighthouse cover SC-006/SC-008 with a seeded record.
