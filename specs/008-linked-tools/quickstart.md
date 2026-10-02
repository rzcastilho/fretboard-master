# Quickstart: Validate Linked Tools (008)

This is a run and validation guide. Behavior is defined in
[contracts/links-api.md](./contracts/links-api.md),
[contracts/triad-detect-api.md](./contracts/triad-detect-api.md),
[contracts/notes-ui.md](./contracts/notes-ui.md) and [data-model.md](./data-model.md).

## Prerequisites

```bash
mise install          # node 24.21.0, pnpm 10.34.6 (mise.toml)
pnpm install
```

## Automated checks

```bash
pnpm check                                   # paraglide compile + svelte-check
pnpm lint                                    # includes theory / links purity boundaries
pnpm test:unit -- tests/unit/theory/triad-detect   # D1–D8 + property tests (SC-002)
pnpm test:unit -- tests/unit/state/links           # L1–L11, store carries, reset isolation
pnpm test:unit -- tests/unit/notes                 # DetectedTriad, PositionCard button
pnpm test:unit                                     # full suite; theory coverage ≥ 95 %
pnpm build:test && pnpm test:e2e -- e2e/linked-tools.spec.ts   # flows, history, axe (phone + desktop)
pnpm test:e2e -- e2e/perf.spec.ts                  # carry switch ≤ 300 ms (SC-005)
```

Expected result: everything is green, axe reports 0 violations, and no existing TM-9 snapshot
changes.

## Manual scenarios (`pnpm dev`, open http://localhost:5173)

| # | Steps | Expected |
|---|---|---|
| Q1 | Notes: select C, E, G | "C major" and **View as triad** appear under the selector. Activating the button opens Triads on C major. |
| Q2 | Notes: select G♯, then C, then E → **View as triad** | Triads shows G♯ augmented (G♯–B♯–D𝄪). |
| Q3 | Notes: select C, D, E | No name, no button, no message. |
| Q4 | Triads: 1st inversion, set 4-3-2. Notes: select only A. Use the nav link to Triads | A major, 1st inversion, 4-3-2. |
| Q5 | Triads: E augmented. Use the nav link to Notes | Selection E, G♯, C, and "E augmented" is shown. **View as triad** → E augmented. |
| Q6 | Notes: only G♯ selected, Triads last on augmented. Use the nav link to Triads | A♭ augmented. |
| Q7 | Notes: tap an F♯ position → card → **Triads from this note** | Triads root F♯ (G♭ if the kept quality is augmented). Quality, inversion and set are kept. |
| Q8 | Change both tools, go Home, open each tool from its home card | Each tool is exactly as it was left (no carry). |
| Q9 | **Reset tool** in Triads, switch to Notes and back via Home | Triads is in its initial state, and Notes is unchanged. The instrument is unchanged. |
| Q10 | Home → Notes → (nav) Triads, then make 20 in-tool changes. Press Back twice | Notes, then Home. |
| Q11 | Reload on /triads after a carry | Initial Triads state (session memory is in memory only). |
| Q12 | Keyboard only: Tab to **View as triad** and **Triads from this note**, press Enter | Both work, with visible focus. The screen reader reads "G sharp augmented". |
