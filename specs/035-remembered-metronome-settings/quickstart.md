# Quickstart: validating Remembered Metronome Settings (035)

Prerequisites: `mise install`, `pnpm install`. Commands follow the `CLAUDE.md` verification
tiers.

## 1. Unit (per task)

```bash
pnpm vitest run tests/unit/prefs/schema.test.ts tests/unit/prefs/session.test.ts \
  tests/unit/metronome/store.test.ts tests/unit/state/preferences-store.test.ts \
  tests/unit/erase-preferences.test.ts tests/unit/i18n/about-catalog.test.ts \
  tests/unit/privacy-policy.test.ts
```

Expected: contract guarantees C1–C8 ([contracts/preferences-record.md](./contracts/preferences-record.md))
and M-R1/M-R2, M-W1–M-W3 ([contracts/metronome-store-api.md](./contracts/metronome-store-api.md))
pass. The updated M7/S11 store tests assert that `screenChanged` keeps the settings.

## 2. E2E (per task)

```bash
pnpm build:test
pnpm test:e2e:fast e2e/metronome-remembered.spec.ts e2e/metronome.spec.ts e2e/preferences.spec.ts e2e/privacy.spec.ts
```

`e2e/metronome-remembered.spec.ts` (new) covers:

| Scenario | Steps | Expected |
|---|---|---|
| US1-1 / SC-001 | Set 120 BPM, 2 beats, Loop 2 Quintuplets, then reload | The settings view shows 120, 2 and Quintuplets, with the rest at the defaults |
| US1-2 | Change all eight (ratio off last, so Loop 2 is hidden), reload, turn the ratio on | All eight are restored, including the hidden Loop 2 |
| US1-3 | Change BPM, go to Notes, come back | BPM is kept |
| US1-4 | Fresh context | 85 / 4 / Count In on 4·2 / ratio on / 8th Triplets / Sextuplets |
| US2-1 | Change settings, Start, Pause, Reset, reload | Settings view with the changed values |
| US2-2 / SC-006 | Start, reload mid-run | `data-phase="settings"`; Start begins at `COUNT IN –/k` |
| US3-1 / SC-003 | Seed `metronome.ratios.bpm = 900` and others valid via `addInitScript` | BPM 85, the other seven as seeded |
| US3-3 | Seed `metronome: []` | Defaults, no notice |
| US3-5 | Block `localStorage` (existing helper in `preferences.spec.ts`), change BPM, leave and return | BPM kept, no new notice |
| US4-1 / SC-005 | Set values, About → Erase → open Metronome, then reload | Defaults both times |
| US5-1 | Seed `metronome: { ratios: {...}, speed: {...} }` | `ratios` values shown |

Also check that the stored record holds `metronome.ratios` in key order after a change, and has
no `metronome` key once every value is set back to its default.

## 3. Manual smoke (optional)

```bash
pnpm dev
```

Open `/metronome`, change the BPM, reload and check that the BPM is kept. In DevTools →
Application → Local Storage, `fretboard-master:prefs` ends with `"metronome":{"ratios":{…}}`.

## 4. End of slice (once)

```bash
pnpm verify
```

Expected: green. The bundle-size check stays under 160 KB gzip.
