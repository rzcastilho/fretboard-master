# Quickstart: Validate "Share the Current View" (022)

Run guide proving the slice works end to end. Contracts:
[link-format](./contracts/link-format.md), [link-api](./contracts/link-api.md),
[share-ui](./contracts/share-ui.md). Data: [data-model.md](./data-model.md).

## Prerequisites

```bash
mise install          # pinned Node + pnpm
pnpm install
```

## 1. Unit (per task — targeted, constitution "Verification tiers")

```bash
pnpm vitest run tests/unit/link                 # codec: fixtures, round-trip properties, exclusion, never-throws
pnpm vitest run tests/unit/state/share-store.test.ts tests/unit/state/address-sync.test.ts
pnpm vitest run tests/unit/share-title.test.ts tests/unit/share-button.test.ts tests/unit/share-fallback.test.ts
```

Expected:

- Every v1 fixture: `encodeLink(snapshot) === link` and decode gives `{ kind: 'ok', fellBack: [] }`
  with the same snapshot (SC-002, FR-019).
- Changing locale (en/es/pt-BR), notation, accidental policy, handedness or orientation leaves the
  link byte-identical; changing any included field changes it (SC-003).
- 7-string custom tuning + 12 notes + card link length < 1,000 (SC-006).
- Share cascade table in link-api §2 passes with a fake platform; 4 s notice auto-hide on fake
  timers; double activation ignored.
- Address sync: 200 schedules in a burst → 1 write, 150 ms after the last.
- Titles: "A minor — CAGED, E shape", "C major — Triads, root position", "C, E, G — Notes",
  "Notes"; no `undefined`, empty segment or dangling separator across languages × notations.

## 2. End-to-end (desktop project, installed Chrome)

```bash
pnpm build:test                                  # once, and after any src/ change
pnpm test:e2e:fast e2e/share.spec.ts e2e/address-sync.spec.ts e2e/perf.spec.ts
```

Scenarios covered (`e2e/share.spec.ts`):

| Scenario | Setup | Expect |
|---|---|---|
| US1-1 phone sheet | `addInitScript` stubs `navigator.share` recording args; `matchMedia('(pointer: coarse)')` forced true | stub called once with `{ url, title: 'A minor — CAGED, E shape' }`, no notice |
| US1-2 desktop copy | real `navigator.share` stub present, fine pointer; clipboard permission granted | clipboard text equals link; "Link copied" visible with role=status |
| US1-3 all tools | Notes, Triads | Share present, 44×44, title per tool |
| US1-4 cancel | share stub rejects `AbortError` | no notice, no fallback, view unchanged |
| US1-5 es / pt-BR | language switched | button, notice and title translated; link identical to en |
| US2-1/2 fallback | `navigator.clipboard` removed / `writeText` rejects | field "Copy this address" focused, whole value selected, no "copied" |
| US2-3 close | Escape, Dismiss, then a view change | panel gone, focus on Share; axe clean |
| Edge: double tap | two rapid clicks with slow share stub | stub called once |

`e2e/address-sync.spec.ts`:

| Scenario | Expect |
|---|---|
| US4-1 | Home → Triads → change inversion: URL `inv=` updates (`expect.poll`); `goBack()` lands on `/` |
| US4-2 / SC-004 | 10 view changes then one `goBack()` leaves the tool |
| US4-3 | `page.url()` after settle equals the copied Share link |
| US4-4 | Triads → nav to CAGED: URL is `/caged?v=1&…` with no Triads keys |
| Panel | open instrument panel, change frets, confirm (panel uses `history.back()`): URL `fr=` reflects the new fret count |
| First load | open `/triads?v=1&inv=second…`: initial state shown, URL replaced by canonical default link, `history.length` unchanged |

`e2e/perf.spec.ts` adds SC-007: 200 rapid inversion/root changes stay within the 100 ms
control-to-fretboard budget, final URL matches final view within 150 ms, no console error.

New screenshots (only if a task adds one):

```bash
pnpm playwright test e2e/share.spec.ts -g "<test name>" --project=phone --project=phone-touch --project=desktop --update-snapshots
```

## 3. Manual smoke (optional)

```bash
pnpm build && pnpm preview
```

1. Open `/caged`, pick A, minor, focus E shape, turn Pentatonic on. Address shows
   `rt=9&…&q=minor&fc=E.0&ly=10100…`.
2. Click **Share** on desktop → "Link copied". Paste the clipboard into a new tab's address bar
   and compare with the current address: identical.
3. In DevTools device mode (touch), click **Share** → system share UI (Chrome on Android/macOS)
   with title "A minor — CAGED, E shape".
4. Press browser Back once → Home.

## 4. End of slice (once)

```bash
pnpm verify          # check, lint (incl. new src/lib/link boundary), format, Vitest+coverage, build, bundle ≤ 120 KB, e2e desktop
```
