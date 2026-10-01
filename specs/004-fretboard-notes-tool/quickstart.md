# Quickstart: Validate the Fretboard Notes Tool

**Feature**: `004-fretboard-notes-tool` | Contracts: [notes-ui](./contracts/notes-ui.md), [notes-state-api](./contracts/notes-state-api.md), [fretboard-model](./contracts/fretboard-model.md), [test-hooks](./contracts/test-hooks.md) | Data model: [data-model.md](./data-model.md)

## 1. Prerequisites

```bash
mise install            # Node 24.21.0 + pnpm 10.34.6 (mise.toml)
pnpm install
pnpm exec playwright install --with-deps chromium firefox webkit
```

## 2. Gates (all must pass)

```bash
pnpm check              # paraglide compile + svelte-check (0 warnings)
pnpm lint               # incl. new src/lib/tools/** and notes-view.ts import boundaries
pnpm format:check
pnpm test:unit -- --coverage   # ≥ 95 % theory, ≥ 80 % overall
pnpm build:test && pnpm test:e2e   # phone 360, phone-touch 320, desktop; axe zero violations
pnpm build && node scripts/check-no-fault-hook.mjs && node scripts/check-bundle-size.mjs
pnpm lhci
```

## 3. Unit suites (written first, seen failing, then implemented)

| Suite | Proves |
|---|---|
| `tests/unit/instrument/occurrences.test.ts` | `positionsWithPitchClass` returns the 12 G positions (R-05 list); `unisonsOf(s3f2)` = s4f7, s5f12, s6f17; property: all unisons share pitch and none omitted, across random tunings |
| `tests/unit/notation/notation.test.ts` (extended) | `flatSpelling(1)` = D♭; `noteList` disjunction "C♯ or D"; spoken list "C sharp and E"; `pitchLabel` "A3", "C♯5" |
| `tests/unit/state/notes-view.test.ts` | initial state (FR-001); toggle/add; last-string no-op; push rule both ways; clamp; shortcuts incl. 10–14 at fretCount 12; Clear vs Reset; revalidate (7→6 strings, 24→12 frets); no-ops return same object |
| `tests/unit/state/notes-widen.test.ts` | C♯, string 1, 0–4 → 0–9; ties extend end; property: result ⊇ original, contains every note, minimal |
| `tests/unit/state/notes-model.test.ts` | precedence table (data-model §4) row by row; G → 12 highlighted, tones 2–5, badges; two notes → no tones; Octave label → tones; Hide names → no labels, no tones, `hoverHint:false`; card A3 → 4 highlighted, others dimmed; card on hidden altered position; empty guidance; listen enabled matrix 0/1/3/4/12; listen steps grouped by pitch; description strings |
| `tests/unit/state/notes-store.test.ts` | each action calls `playback.stop('view')` iff state changed; `activate` calls `playback.note`; `listen` calls `sequence(steps, 120)`; state survives remount of the tool |
| `tests/unit/fretboard/fretboard.test.ts` (extended) | `labelMode:'octave'`, `label` override, `tone-N` class, octave badge, region band + scroll, `hoverHint:false`, `description` override, `focusPosition` |
| `tests/unit/notes/*.test.ts` | `NoteSelector`, `StringFilter`, `RegionFilter`, `PositionCard`, `NotesActions`: roles, names, `aria-pressed`/`aria-disabled`, keyboard |
| `tests/unit/reserved-colors.test.ts` (extended) | new highlight/tone tokens differ from root/third/fifth |

## 4. End-to-end scenarios (`e2e/notes.spec.ts`)

Run: `pnpm build:test && pnpm test:e2e -- e2e/notes.spec.ts`

| # | Scenario (spec) | Steps | Expected |
|---|---|---|---|
| 1 | US1-1 | open `/notes` | no selector button pressed; naturals labeled; no altered marker; no band |
| 2 | US1-2 / SC-004 | press "G" | 12 highlighted markers in 4 tone classes, labels with octave badges 2–5; description starts "G selected: 12 positions highlighted" |
| 3 | US1-3 | press "G" again | `aria-pressed=false`; back to initial view |
| 4 | US1-4, US4-4 | press "C", "E"; then Label → Octave | no tone classes; then labels "C3"… and tones on |
| 5 | US1-5 | 320 px | 2 rows × 6 selector; no horizontal page scroll |
| 6 | US1-6 | press all 12 | every position highlighted; Listen disabled |
| 7 | US2-1 / SC-002 | activate s3f2 | audio log `note` pitch 57; card "A", octave 3, unisons s4f7, s5f12, s6f17 highlighted |
| 8 | US2-2 | Escape; reopen and Close | card gone; focus on cell s3f2 |
| 9 | US2-3 | activate s5f4 | card heading "C♯ / D♭" |
| 10 | US2-4 | activate s6f0 (E2) | "This pitch exists only at this position" |
| 11 | US2-5 | card open on A → See every occurrence (twice) | A pressed; card stays; second press no change |
| 12 | US2-6 | arrow to s3f2, press Enter | same as #7 |
| 13 | US3-1 | turn off strings 1–5 | dimmed unlabeled; string 6 toggle `aria-disabled` and stays pressed |
| 14 | US3-2 | 5–9 then Start → 12 | End becomes 12 |
| 15 | US3-3 | each shortcut | steppers show 0/4, 5/9, 10/14, 0/22 |
| 16 | US3-4 / SC-004 | C♯, string 1 only, 0–4 | notice "There is no C♯ in this region"; Widen → 0–9; s1f9 highlighted |
| 17 | US3-5 | region 5–9 | markers outside dimmed without label; band visible; board scrolled |
| 18 | US4-1 | select C♯ | C♯ shown, D♯ hidden |
| 19 | US4-2 | Show all / none | all labeled / only selected |
| 20 | US4-3 / SC-004 | Show none, no selection | "Pick a note or tap a fret"; no markers |
| 21 | US4-5 | No label | no `.marker-label` |
| 22 | US5-1 | A, Listen | audio log `sequence` steps ascending, unisons as chords, 0.5 s apart; pulses in order |
| 23 | US5-2 | 0 and 4 notes | Listen `aria-disabled`, reason announced |
| 24 | US5-3 | Hide names, hover | no labels, no hint; tap → card shows name |
| 25 | US5-4 | set selection, filters, Octave, all → Clear | selection/filters reset; Octave + all kept |
| 26 | US5-5 | change everything → Reset tool | equals scenario 1 |
| 27 | US5-6 | Listen, then toggle a note | audio log `stop` reason `view`; pulses cleared |
| 28 | FR-019 | select G, go to `/triads`, back | G still selected; reload → initial |
| 29 | SC-005 | keyboard only through every control; axe at 320 px and 1280 px | zero violations |
| 30 | SC-001 / perf | `e2e/perf.spec.ts` select → highlighted, 4× CPU | median ≤ 100 ms |

## 5. TM-9 fixtures

`pnpm test:e2e -- e2e/notes-tm9.spec.ts` (views 1–5, see [test-hooks](./contracts/test-hooks.md)).
First run on a new platform: `--update-snapshots`, review images, commit.

## 6. Manual smoke (optional)

`pnpm dev`, open `/notes`, select G, tap string 3 fret 2, set strings/region, press Listen.
Production safety: `pnpm build && grep -r __fmInstrument build/` returns nothing.
