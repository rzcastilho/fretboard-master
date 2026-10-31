# Implementation Plan: Remembered Metronome Settings

**Branch**: `035-remembered-metronome-settings` | **Date**: 2026-10-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/035-remembered-metronome-settings/spec.md`

## Summary

Remember the eight Ratios Training settings (BPM, # of Beats, Count In on/off, Initial Count
In, Repeat Count In, Subdivision ratio on/off, Loop 1, Loop 2) on the device. They are restored
whenever the Metronome tool opens: after a reload, after Reset, and after leaving the route and
coming back. The running position is never kept. This supersedes the value part of 031 FR-017
("reopening starts at 85 / 4").

Technical approach (see [research.md](./research.md)):

- **Codec** (`src/lib/prefs/schema.ts`): `Preferences` gains
  `metronome: { ratios: MetronomeSettings }`. A Valibot sub-schema validates each of the eight
  stored fields on its own. On failure a field takes its default and is never clamped. A
  non-object `metronome` or `ratios` gives all eight defaults. The serializer appends
  `metronome.ratios` as the last key, with the eight fields in a fixed order and Loop 1 stored as
  `loop1`, and only when a value differs from the defaults. `version` stays 1, and a default
  record stays byte-identical to 034 (R-01, R-03, R-04).
- **Lint boundary**: prefs may import only *types* from `$lib/state`, so the schema mirrors the
  defaults and limits as `METRONOME_RATIOS_DEFAULTS` / `METRONOME_LIMITS`. A parity test guards
  them, as with `TOOL_IDS` (R-02).
- **Store** (`src/lib/state/metronome.svelte.ts`): every settings mutation goes through one
  `commit()` helper. It calls `preferences.remember({ metronome: { ratios } })` when the object
  changed. The new `restoreSettings()` applies values without writing. `screenChanged()` stops
  resetting the values to the defaults but still halts and returns to the settings phase
  (R-05, R-06).
- **Preferences store**: `start()` restores the metronome values, and `erase()` resets them to
  the defaults in memory (R-07).
- **Privacy**: new category `metronome` and an updated `about_privacy_stored` in en, pt-BR and
  es. The English list turns two "and"s into commas to stay within the existing 220-word cap,
  which the current text already reaches exactly (R-08).
- **Tests**: new prefs fixtures and schema, session and store tests. The 031–034 store tests
  that asserted "leaving restores the defaults" are updated, and a new
  `e2e/metronome-remembered.spec.ts` is added (R-09, R-11).

Assumptions where the spec left a technical choice open (the rejected alternatives are in
research.md):

- `metronome` is the last key of the record, after `shortcuts`, so existing canonical records
  stay canonical (R-04).
- `restoreSettings` also halts a live run, although Erase is only reachable from About, where
  the run has already been halted. This costs nothing and guarantees FR-004 (R-06, R-07).
- To fit the 220-word cap, the English list changes "sound, volume and tempo" and "labels and
  last tool" to comma lists, rather than raising the 027 cap (R-08).

## Technical Context

**Language/Version**: TypeScript 5 (`strict: true`), Svelte 5 runes, SvelteKit 2 with `adapter-static`

**Primary Dependencies**: Existing only: Valibot 1 (prefs schema), Paraglide JS (privacy copy).
**No new runtime dependency.**

**Storage**: `localStorage` key `fretboard-master:prefs` through `src/lib/prefs` (existing
v1 record, new optional `metronome` key). No new storage key.

**Testing**: Vitest (+ fast-check for the round-trip property) for the codec, session and
stores. Playwright (`desktop` project) for the user flows, with `addInitScript` seeding of the
stored record as in `e2e/preferences.spec.ts`.

**Target Platform**: Evergreen desktop browsers (last two majors), static hosting on
Cloudflare Pages.

**Project Type**: Static single-page web app (SvelteKit, prerendered).

**Performance Goals**: The control response stays ≤ 100 ms. Each change makes one synchronous
`setItem` of under 1 KB. Opening the tool stays ≤ 300 ms (SC-007).

**Constraints**: Initial JS ≤ 160 KB gzip (about +0.4 KB expected). The record stays well under
16,384 characters (about +140). The English privacy statements stay ≤ 220 words. Storage
failures are tolerated silently.

**Scale/Scope**: One mode (`ratios`), eight fields. About 6 source files and 3 message
catalogs touched, plus 1 new e2e spec and about 7 new fixtures.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design: still passes, no
violations.*

- [x] **I. Musical Correctness**: N/A. No note, interval, shape or pitch logic changes. The
  stored values are tempo and click counts that the 031–034 engine already plays, and
  `src/lib/theory` is untouched.
- [x] **II. On-Device, Static, Private**: the values stay in the existing device-local
  preferences record. There is no network, account or identifier, and Erase clears them
  (FR-010). Not in share links and not synced (FR-014).
- [x] **III. Pure Core, Thin Shell**: the codec stays a pure plain-TS module (only type imports
  from state, which the lint rule enforces). The state lives in the metronome store, and
  `preferences.svelte.ts` is still the only importer of `$lib/prefs/*`.
- [x] **IV. Test-First**: preferences is a test-first module. The schema, session and store
  tests and the fixtures are written before the code. Every acceptance scenario (US1–US5) maps
  to a unit or e2e test (quickstart §2). There is no timing-dependent behaviour.
- [x] **V. Accessible by Default**: no markup or focus changes. The existing settings controls
  only start from different values, and the axe checks in `metronome-a11y.spec.ts` still run.
- [x] **VI. Performance Budgets**: one sub-1 KB synchronous write per change and about
  +0.4 KB gzip of JS. The bundle-size check in `pnpm verify` and CI gates it.
- [x] **VII. Design System Fidelity**: no new UI, notice or modal. The tool still opens on the
  settings view, which is its simplest state, and no new tokens are needed.
- [x] **VIII. International**: the privacy copy is updated in all three catalogs through
  Paraglide, with no hard-coded text, and stays within the per-locale word caps.
- [x] **IX. Untrusted Input, Versioned Formats**: each stored field is checked with Valibot
  against its type and range, invalid fields fall back on their own, and parsing never throws.
  The record keeps `version: 1` with an optional key, and older fixtures are kept and still
  parse.
- [x] **X. Simplicity**: no new abstraction. The per-mode nesting is the storage shape the spec
  requires, not a generic "modes" framework. There is no new dependency, and storage failure
  falls back to in-memory values.
- [x] **Workflow gates**: Conventional Commits, a branch named after the spec, targeted local
  runs, then `pnpm verify` once. No ADR is needed because this extends the existing
  preferences design (010/027) without a new architectural decision.

## Project Structure

### Documentation (this feature)

```text
specs/035-remembered-metronome-settings/
├── plan.md                         # This file
├── research.md                     # Phase 0: R-01…R-11
├── data-model.md                   # Phase 1: Preferences.metronome, record rules, store events
├── quickstart.md                   # Phase 1: validation commands and scenarios
├── contracts/
│   ├── preferences-record.md       # stored format, codec exports, privacy copy (C1–C8)
│   └── metronome-store-api.md      # restoreSettings, screenChanged, write-on-change (M-*)
├── checklists/                     # from /speckit-specify
└── tasks.md                        # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
src/lib/prefs/
└── schema.ts                       # Preferences.metronome, defaults/limits mirror, sub-schema,
                                    # serializer branch, PRIVACY_CATEGORIES.metronome
src/lib/state/
├── metronome.svelte.ts             # commit() + remember, restoreSettings(), screenChanged keeps values
└── preferences.svelte.ts           # start() and erase() push metronome settings
messages/
├── en.json                         # about_privacy_stored
├── pt-BR.json                      # about_privacy_stored
└── es.json                         # about_privacy_stored

tests/unit/prefs/
├── schema.test.ts                  # C1–C7: metronome parse/serialize, parity, property round trip
├── session.test.ts                 # remember({ metronome }) skip-unchanged, erase
└── fixtures/                       # + metronome-*.txt, index.ts entries
tests/unit/metronome/
└── store.test.ts                   # M-R*, M-W*; M7/S11 updated (values kept on leave)
tests/unit/state/
└── preferences-store.test.ts       # start restores, erase resets metronome
tests/unit/
├── erase-preferences.test.ts       # erase → metronome defaults
└── i18n/about-catalog.test.ts      # unchanged; must still pass (category coverage, word caps)

e2e/
├── metronome-remembered.spec.ts    # new: US1–US5 flows
└── metronome.spec.ts               # rename the FR-017 test title (behaviour still holds)
```

**Structure Decision**: a single SvelteKit project, following the constitution's source layout.
The changes go into the existing `src/lib/prefs`, `src/lib/state` and `messages/` directories,
with tests in the existing `tests/unit/{prefs,metronome,state,i18n}` and `e2e/` directories.
No new directories or modules are created. The metronome UI components in
`src/lib/tools/metronome/` do not change, because they already render whatever the store
holds.

## Complexity Tracking

No constitution violations. These design choices are recorded so reviewers can check them:

| Choice | Why needed | Simpler alternative rejected because |
|---|---|---|
| Mirror the metronome defaults and limits in `prefs/schema.ts` with a parity test | The prefs lint rule allows only type imports from `$lib/state` | Relaxing the lint rule would weaken the plain-TS prefs boundary (010 §6) for two constants |
| English privacy list loses two "and"s | The en statements are at exactly the 220-word cap, and the spec's phrase adds 2 words net | Raising the cap changes a 027 success criterion, and dropping "No cookies are used" removes a privacy statement |
| Nested `metronome.ratios` instead of a flat field | Required by FR-005 (per-mode storage) | A flat field would need migrating when the next mode lands |
