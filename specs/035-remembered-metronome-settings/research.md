# Research: Remembered Metronome Settings (035)

All Technical Context unknowns are resolved below. Each entry gives the decision, why it was
chosen, and what else was considered. Code references are from the 034 tree this slice starts
from.

## R-01 Where the values live in `Preferences`

- **Decision**: `Preferences` gains one field, `metronome: { readonly ratios: MetronomeSettings }`.
  It is the same shape the store already uses, so `subdivision` stays the in-memory name of
  Loop 1. The stored JSON uses `loop1`. `DEFAULT_PREFERENCES.metronome` is
  `{ ratios: METRONOME_RATIOS_DEFAULTS }`.
- **Rationale**: the spec fixes the stored key `metronome.ratios` and requires per-mode
  separation (FR-005). Mirroring that nesting in memory gives later modes an obvious slot
  (`metronome.speed`, …) without a speculative "modes" abstraction today (Principle X). Reusing
  `MetronomeSettings` (a type-only import, which the prefs lint rule allows) avoids a second
  near-identical interface.
- **Alternatives**: a flat `metronomeRatios` field. It is simpler today but would break the
  one-to-one mapping between record keys and fields, and the privacy-category test lists
  `Preferences` keys. A separate `StoredRatios` type with a `loop1` field was rejected because
  it would need translating twice (on restore and on write).

## R-02 Defaults and limits inside `src/lib/prefs` (lint boundary)

- **Decision**: `src/lib/prefs/schema.ts` declares its own `METRONOME_RATIOS_DEFAULTS`
  (`satisfies MetronomeSettings`) and `METRONOME_LIMITS` (bpm 30–300, beats 1–16, counts 0–8,
  loops 1–8). A unit test asserts they equal `DEFAULT_SETTINGS`, `MIN_BPM`/`MAX_BPM`,
  `MIN_BEATS`/`MAX_BEATS`, `MIN_COUNT_IN`/`MAX_COUNT_IN` and `SUBDIVISIONS` from
  `$lib/state/metronome-settings` and `$lib/audio/schedule`.
- **Rationale**: `eslint.config.js` allows `src/lib/prefs/**` only *type* imports from
  `$lib/state/*` (010 contract §6). `TOOL_IDS` and the tempo values use the same "mirror and
  check with a test" pattern, so this follows existing practice.
- **Alternatives**: relaxing the lint rule, rejected because it would weaken the plain-TS
  prefs layer for two constants. Moving the metronome constants into `src/lib/prefs` or
  `src/lib/audio`, rejected because it would move the settings maths away from its module for
  a storage concern.

## R-03 Validation on read (FR-007, FR-008)

- **Decision**: a Valibot sub-schema, with each field independently `v.fallback`:
  - `bpm`: `v.pipe(v.number(), v.integer(), v.minValue(30), v.maxValue(300))` → 85
  - `beats`: integer 1–16 → 4
  - `initialCountIn`: integer 0–8 → 4. `repeatCountIn`: integer 0–8 → 2
  - `countIn`, `ratio`: `v.boolean()` → true
  - `loop1`: integer 1–8 → 3. `loop2`: integer 1–8 → 6

  `ratios` is `v.fallback(v.object({...}), defaults)` and `metronome` is
  `v.fallback(v.object({ ratios }), { ratios: defaults })`. Before parsing, the reader checks
  `isPlainObject` on `metronome` and `metronome.ratios`, so an array gives the defaults
  explicitly rather than by accident. `v.object` drops unknown keys, so other mode entries and
  extra fields are ignored and are not written back.
- **Rationale**: this matches every other field in `recordSchema`: per-field fallback, no
  clamping, never throws (Principle IX). `v.integer()` rejects fractions and non-finite numbers,
  and `v.number()` rejects numeric strings and `null`. `JSON.parse` cannot produce `NaN`, but
  the pipe rejects it anyway.
- **Alternatives**: reusing `clampBpm`/`clampCount`, rejected because the spec says
  out-of-range values give the default and are never clamped (900 → 85, not 300). Using
  `toSubdivision` for the loops was rejected because it accepts numeric strings, which the
  spec rules invalid.

## R-04 Serialized form and canonical-record rule (FR-006)

- **Decision**: `serializePreferences` appends `metronome` as the **last** key, after
  `shortcuts`. It is present only when at least one of the eight values differs from the
  defaults, and then holds `{ ratios: { bpm, beats, countIn, initialCountIn, repeatCountIn,
  ratio, loop1, loop2 } }` in that order. `version` stays `1`.
- **Rationale**: a never-touched metronome leaves the record byte-identical to 034 (existing
  fixtures and the session's `lastWritten` canonical check keep working). Writing all eight
  values once any differs keeps the reader simple and the record self-describing. The size
  grows by at most about 140 characters, well under `MAX_RAW_LENGTH` (16,384).
- **Alternatives**: writing only the non-default fields was rejected because the spec chose
  all-or-nothing. Putting `metronome` before `shortcuts` was rejected because appending keeps
  every older canonical record canonical.

## R-05 When values are written (FR-001, FR-005, FR-011)

- **Decision**: every settings mutation in `src/lib/state/metronome.svelte.ts` goes through
  one private `commit(next)` helper. It assigns `state.settings` and calls
  `preferences.remember({ metronome: { ratios: next } })` only when `next !== state.settings`.
  Steppers at their limit already return the same object (`stepSetting`), so they write
  nothing. The session then skips the write if the serialized record is unchanged.
- **Rationale**: this follows the existing "write on change" pattern (`playback.setVolume`,
  `caged.setTempo`, …) and the session's unchanged-skip. Writes are synchronous and tiny, so
  holding a stepper needs no debounce. A typed value is committed by the existing `setBpm`/
  `setBeats`/`setCount` path after clamping, so the clamped value is what is stored.
- **Alternatives**: writing on Start only, rejected by the spec (FR-005). A `$effect` that
  watches `state.settings`, rejected because module-level effects need a root, and the
  explicit call matches the other stores. A debounce, rejected as unnecessary (see the
  clarification).
- **Import cycle**: `metronome.svelte.ts` → `preferences.svelte.ts` → `metronome.svelte.ts`
  is the same cycle `playback.svelte.ts` already has. Each side touches the other only inside
  functions called after module evaluation, so ES module evaluation order is safe.

## R-06 Restore at start, in-visit memory, and leaving the route (FR-002, FR-004)

- **Decision**:
  - The metronome store gains `restoreSettings(s: MetronomeSettings)`. It applies values
    without writing (like `playback.restore`). If a run is active it first halts it, as
    `screenChanged` does, and goes back to the settings phase.
  - `preferences.start()` calls `metronome.restoreSettings(p.metronome.ratios)`.
  - `screenChanged()` no longer resets `state.settings` to `DEFAULT_SETTINGS`. It still halts,
    returns to the `settings` phase and clears the run. The values in memory are therefore the
    last ones set, which covers "leave and return" even without storage.
  - The failure-view reset keeps calling `screenChanged()`, which also keeps the values.
- **Rationale**: the in-memory store already holds the last values set. Removing the
  reset-to-defaults in `screenChanged` is the smallest change that gives FR-002 and keeps
  FR-004: the phase, position, generation and announcement are still cleared. The record is
  read once per load (010 FR-005), so a reload during a run lands on the settings phase with
  the stored values.
- **Alternatives**: a separate `remembered` copy restored on `screenChanged`, rejected because
  it duplicates `state.settings` with no behavioural difference.

## R-07 Erase (FR-010)

- **Decision**: `preferences.erase()` calls
  `metronome.restoreSettings(DEFAULT_PREFERENCES.metronome.ratios)` (through `session.current`
  when it exists, and with the defaults directly when there is no session, like the
  language/theme resets). Erase lives on About, so the route has already been left and the run
  halted. `restoreSettings` halts anyway for safety.
- **Rationale**: every restored store is reset on erase (027). Without this, opening the
  Metronome after Erase would show the old values until a reload, against SC-005.

## R-08 Privacy text and category (FR-012)

- **Decision**: `PRIVACY_CATEGORIES.metronome = ['metronome']`. `about_privacy_stored`
  changes as follows:
  - **en**: "Your settings stay only in this browser on this device: language and notation;
    instrument; sound, volume, tempo; theme; labels, last tool; hints shown; the shortcuts
    switch; and metronome settings. No cookies are used."
  - **pt-BR**: "…; dicas já mostradas; a chave dos atalhos de teclado; e configurações do
    metrônomo. Não usamos cookies."
  - **es**: "…; avisos ya mostrados; el interruptor de atajos de teclado; y ajustes del
    metrónomo. No se usan cookies."
- **Rationale**: `tests/unit/i18n/about-catalog.test.ts` caps the twelve policy statements at
  220 words in English, and the current English total is **exactly 220**. The spec's phrase
  adds a net 2 words ("the shortcuts switch; and metronome settings" replaces "and the
  shortcuts switch"). So two "and"s in the list become commas ("sound, volume, tempo";
  "labels, last tool"). That keeps the spec's wording and every category, and leaves the total
  at 220. pt-BR (240/280) and es (248/280) have room.
- **Alternatives**: raising the 220-word cap, rejected because the cap is a 027 success
  criterion and not this slice's to change. Dropping "No cookies are used", rejected because
  it is a privacy statement in its own right.

## R-09 Tests that encode the superseded 031 FR-017

- **Decision**: these unit tests change from "screenChanged restores the defaults" to
  "screenChanged keeps the last values set and clears the run":
  - `tests/unit/metronome/store.test.ts`: M7 (×2), "Reset keeps the choice; screenChanged
    restores 3" and S11.
  - Any equivalent tests in `count-in-settings.test.ts`, `ratio-settings.test.ts` and
    `panel.test.ts`, found with `grep screenChanged`.

  `e2e/metronome.spec.ts` "FR-017: … comes back at 85/4" still passes as written because it
  never changes BPM or beats. Its title is renamed to say it keeps the settings. The e2e
  helpers `countInOff`/`ratioOff` are already idempotent, so restored switch states do not
  break them. Playwright gives each test a fresh storage context, so no values leak between
  tests.
- **Rationale**: Principle IV requires each acceptance scenario to be tested, and the old
  assertions now contradict FR-002.

## R-10 Performance and bundle

- **Decision**: no measurement task beyond the standard bundle-size check. The change adds
  roughly 0.3–0.5 KB gzip (one Valibot sub-schema, the serializer branch and the store
  helper). Initial JS was 151.2 KB after 032. 033 and 034 added a little, and the cap is
  160 KB.
- **Rationale**: a synchronous `localStorage.setItem` of under 1 KB per control change is far
  below the 100 ms control-response budget (SC-007).

## R-11 Fixtures

- **Decision**: add prefs fixtures to `tests/unit/prefs/fixtures/` (and to its `index.ts`):
  `metronome-ratios.txt` (120 / 2 / Loop 2 = 5, others default), `metronome-full.txt` (all
  eight non-default), `metronome-bad-bpm.txt` (bpm 900), `metronome-wrong-types.txt`
  (`"120"`, 2.5, `null`, `"yes"`, 9 …), `metronome-array.txt`, `metronome-null-ratios.txt`
  and `metronome-other-mode.txt` (a `speed` entry next to `ratios`). Existing fixtures stay
  unchanged and must still parse to `metronome.ratios === defaults`.
- **Rationale**: the existing schema tests are fixture-driven, and Principle IX asks for
  stored-format fixtures to be kept and only ever added to.
