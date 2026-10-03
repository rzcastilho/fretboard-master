# Quickstart: Validate Remembered Preferences

**Feature**: `010-remembered-preferences` | References: [data-model.md](./data-model.md),
[contracts/storage-format.md](./contracts/storage-format.md),
[contracts/preferences-api.md](./contracts/preferences-api.md),
[contracts/preferences-ui.md](./contracts/preferences-ui.md)

## Prerequisites

```bash
mise install          # Node + pnpm pinned in mise.toml
pnpm install          # pulls the new runtime dependency `valibot`
```

## Automated gates

```bash
pnpm check                             # svelte-check + types
pnpm lint                              # includes the new src/lib/prefs import boundary
pnpm test:unit                         # tests/unit/prefs/**, tests/unit/state/preferences-store.test.ts, component tests
pnpm build && node scripts/check-bundle-size.mjs   # initial JS ≤ 85 KB gzip with valibot
pnpm test:e2e -- e2e/preferences.spec.ts           # phone + desktop, axe
pnpm test:e2e -- e2e/perf.spec.ts                  # budgets with a seeded record
```

Expected: all green; coverage ≥ 80 % overall; `e2e/preferences.spec.ts` covers every acceptance
scenario of US1–US4.

## Manual walkthrough (`pnpm dev`, open http://localhost:5173)

| # | Do | Expect |
|---|---|---|
| 1 | Fresh profile, open `/` | Defaults (Standard, 22 frets, sound on, volume 80); no "Continue"; DevTools → Application → Local Storage has **no** `fretboard-master:prefs` |
| 2 | Instrument panel → Drop D → Confirm; mute; open Triads; switch label type to Name | `fretboard-master:prefs` exists, v1 shape, `lastTool:"triads"` |
| 3 | Pick a root/quality, reload, go Home | Drop D summary, muted, Triads card shows "Continue", order Notes, Triads |
| 4 | Open Triads | Initial view (no root/quality kept), label type Name |
| 5 | DevTools: set the record to `{"tuning":"AF-2","volume":3}`, reload | tuning AF-2 kept, volume 80, no error, no notice |
| 6 | Set the record to `not json{`, reload | All defaults, no notice |
| 7 | Block site data (browser settings → block cookies/site data for localhost), reload | Notice "Preferences won't be remembered on this device." once; navigate → gone, never returns |
| 8 | Unblock; About → Erase my preferences | Inline question, focus on Cancel; Escape → back, focus on the button |
| 9 | Erase → Erase | Home, focus on heading, defaults, no "Continue", no `fretboard-master:*` keys; reload → still defaults |
| 10 | Two tabs: tab A mute, tab B set volume 40 | Neither tab changes live; a third tab shows tab B's whole record (last write wins) |
| 11 | DevTools → Network while doing 2–10 | No request related to preferences |

## Done when

- All quickstart rows behave as listed.
- Plan's Constitution Check still all ✅ after implementation (re-run at PR review).
