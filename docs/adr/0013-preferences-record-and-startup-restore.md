# ADR 0013: Preferences record and startup restore

- **Status**: Accepted
- **Source**: spec 010-remembered-preferences (plan R-01, R-04, R-12; contracts/storage-format.md)

## Context

A returning learner should find tuning, fret count, mute, volume, Notes/Triads label type and the
last tool as they left them, with no account and no network. Storage can be blocked, full,
corrupt, from a newer version, or changed by another tab. The app must never fail or flash
defaults because of stored data (FR-005, FR-010, FR-015, FR-021).

## Decision

- **Restore in the client `init` hook.** `src/hooks.client.ts` exports `init`, which calls
  `preferences.start()`. The record is read once, synchronously, before hydration, and pushed
  through non-persisting `restore` methods on the instrument, playback, Notes and Triads stores.
  Storage is never re-read afterwards, and no `storage` event listener exists (last write wins).
- **One versioned record.** A single key, `fretboard-master:prefs`, holds a JSON object:
  `version`, `tuning`, `frets`, `muted`, `volume` (0–1), optional `lastTool`, `labels.notes`,
  `labels.triads`. Volume is stored as 0–1 and shown on the 0–100 control scale in steps of 5.
- **Total, per-field decoding.** `parsePreferences` never throws. Each field has its own
  fallback, so one bad value resets only that item. Null, oversize (> 16 384 chars), non-object
  and unparseable input yield defaults. Unknown or newer versions keep recognizable items and are
  replaced by a v1 record on the next changing write.
- **Explicit, synchronous writes.** Stores call `preferences.remember(patch)` from user-action
  methods only. The session merges, skips writes whose serialization equals the last one, and
  swallows storage errors. There are no effects, debouncing or write-on-unload.
- **Pure core, guarded edge.** `src/lib/prefs/**` has no framework imports (ESLint boundary).
  Only `storage.ts` touches `localStorage`, behind a write/read/remove probe. Empty catches carry
  the fire-and-forget comment. A runes store in `src/lib/state/preferences.svelte.ts` is the only
  bridge to the UI.
- **Valibot dependency.** Valibot (MIT, ~1–2 KB gzip, tree-shaken to the actions used) provides
  the schema and `fallback`. Initial JS measured 82.2 KB gzip with it (78.9 KB before this slice),
  so constitution 1.3.0 raised the initial JS budget to 85 KB. Dropping Valibot alone would
  not have kept the old 80 KB cap (80.7 KB measured).
- **Add-only extension rule.** Later slices add fields and fixtures. They never rename, retype or
  remove existing ones, and fixtures are never deleted. A breaking change needs a version bump
  and a new ADR.
- **Erase.** About offers an inline Erase that removes every `fretboard-master:` key, restores
  defaults, stops sound and goes Home. It writes nothing and never raises the notice.

## Consequences

- First paint already shows restored values, so no control flashes a default.
- Musical state (root, quality, layers, hide names) is never persisted (SC-005).
- Blocked storage shows one dismissible notice per session; failed writes alone show nothing.
- Each new remembered setting needs a schema field, a fixture, a `restore` path and a
  `remember` call.

## Alternatives considered

- **Restore in `+layout.svelte` or `onMount`**: values would appear after first paint.
- **`$effect` auto-persist**: writes on restore, hides which actions persist, and is hard to test.
- **One key per setting**: no atomic read, harder versioning and erase.
- **Hand-written validators**: more code and weaker per-field fallback than Valibot.
- **Listening to `storage` events**: tabs would change under the user (FR-015).
