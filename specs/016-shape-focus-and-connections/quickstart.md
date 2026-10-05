# Quickstart: validate Shape Focus and Connections

How to prove slice 016 works. Interfaces are in [contracts/](./contracts/) and types in
[data-model.md](./data-model.md). The verification tiers follow the constitution and
`CLAUDE.md`.

## Prerequisites

- `mise install` and `pnpm install` have been run.
- Slices 014 and 015 are merged (CAGED shapes and tunings).
- Default instrument: 6-string Standard (AF-1), 22 frets.

## 1. Unit and property tests (per task)

```bash
pnpm vitest run \
  tests/unit/theory/caged.test.ts tests/unit/theory/caged.property.test.ts \
  tests/unit/state/caged-focus.test.ts tests/unit/state/rotate-hint.test.ts \
  tests/unit/state/caged-view.test.ts tests/unit/state/caged-model.test.ts \
  tests/unit/state/caged-store.test.ts tests/unit/state/instrument-store.test.ts \
  tests/unit/state/preferences-store.test.ts tests/unit/prefs/schema.test.ts \
  tests/unit/fretboard/interaction.test.ts tests/unit/fretboard/fretboard.test.ts \
  tests/unit/triads/choice-group.test.ts tests/unit/caged/caged-tool.test.ts
```

Expected:

- **Connections**:
  - The TM-6.3 and TM-7.2 tables pass as exact sets ([contract §1](./contracts/caged-focus-api.md)).
  - On 12 frets there is no E→D pair.
  - Drop D has no string-6 connection.
- **Step window**: with fake timers, the rings are present at t = 0 and 499 ms, gone at
  500 ms, and a second press restarts the window.
- **Re-resolve**:
  - C major with E in focus, switched to G major: E stays the focus (same letter, ordinal 0
    still drawn).
  - C major, 24 → 12 frets with A@15 (ordinal 1) in focus: focus moves to A@3 (same letter,
    nearest start). The store returns `true`, which means a notice.
- **Rotate hint**: `isPhonePortrait(390, 844)` is `true`. `isPhonePortrait(844, 390)` and
  `isPhonePortrait(768, 1024)` are `false`.
- **Prefs**: a record without `rotateHint` parses to `false`. `serializePreferences` output for
  defaults is unchanged.

## 2. End-to-end (per task)

```bash
pnpm build:test
pnpm test:e2e:fast e2e/caged-focus.spec.ts e2e/caged.spec.ts
```

| Scenario | Steps | Expected |
|---|---|---|
| US1 focus | `/caged`, activate tag "E shape · roots on strings 6, 4, 1" | E markers `highlighted`, others `dimmed`; `.region-band` over frets 8–10; tag `aria-pressed=true`; selector **E** checked; board centred within 500 ms |
| US1 leave | Activate E tag again (or **See all**) | All `normal`, no band, **See all** checked |
| US1 selector | Choose **G** | Same as tapping the G tag |
| US1 twice | 22 frets, activate second C tag (fret 12) | Only that occurrence highlighted; choosing **C** again changes nothing |
| US1 12 frets | Instrument → 12 frets | Selector **D** `aria-disabled` |
| US2 next | E focused, connections off, **Next shape** | D focused; s4f10 has `.connection-ring` + `highlighted`; after `page.clock` +500 ms the ring is gone |
| US2 ends | Focus last occurrence | **Next shape** `aria-disabled`; first → **Previous shape** `aria-disabled`; no focus → both disabled |
| US2 repeat | Press **Next shape** twice within 500 ms | Ring only on the second pair |
| US3 rings | **Show connections** on, C major | Exactly the TM-6.3 anchors ringed (A→G: s4f5, s3f5, s2f5) |
| US3 minor | C minor | Exactly the TM-7.2 anchors ringed (Gm→Em includes s2f8) |
| US4 rotate | Viewport 390×844, empty storage, open `/caged` | Rotate notice visible; `localStorage` has `"rotateHint":true`; reload: no notice |
| US4 elsewhere | Viewport 1280×800 | No notice, nothing recorded |
| Reduced motion | `page.emulateMedia({ reducedMotion: 'reduce' })`, focus E | `scrollLeft` at target in the same frame; ring window still 500 ms |
| Persistence | Focus E, connections on, go to Notes and back | Both kept; reload: both reset; stored prefs unchanged |
| a11y | Run axe with focus + connections on | Zero violations |

## 3. Screenshot fixture (TM-9 view 18)

```bash
pnpm playwright test e2e/caged-tm9.spec.ts -g "tm9 view 18" \
  --project=phone --project=phone-touch --project=desktop --update-snapshots
```

- **Fixture**: F♯ minor, five shapes, connections on, AF-1.
- **Check**: the rings sit on the C-minor anchor pattern shifted by 6 frets, modulo 12.

## 4. End of slice (once)

```bash
pnpm verify
```

- **Expect**: check, lint, format, full Vitest with coverage (theory ≥ 95%), build, and the
  bundle-size check all pass, with initial JS ≤ 92 KB gzip.
- **If the bundle check fails**: stop and follow plan Complexity Tracking (amendment, not
  silent trimming).

## 5. Manual smoke (optional)

```bash
pnpm dev
```

- **Steps**: open `/caged`, Tab to the tags, press Enter on E, then press **Next shape**.
- **Watch**: the neck glides to the D region, and string 4 fret 10 briefly shows its ring.
- **Screen reader**: VoiceOver reads "D shape in focus, frets 10 to 13." first.
