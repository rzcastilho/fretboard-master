# Quickstart: validating anonymous measurement

**Feature**: `028-anonymous-measurement` | **Plan**: [plan.md](./plan.md)

Run from the repo root after `mise install && pnpm install`. Local runs follow the constitution's
verification tiers: targeted unit tests, `desktop`-only Playwright, `pnpm verify` once at the end.

## 1. Unit: wire, sanitizer, queue, facade, Function, metrics

```bash
pnpm vitest run tests/unit/measure tests/unit/functions tests/unit/uptime-check.test.ts \
  tests/unit/i18n/about-catalog.test.ts tests/unit/privacy-policy.test.ts tests/unit/failure.test.ts
```

Expected:

- `wire.test.ts`: allowlist accepts the §3 examples of [measurement-wire](./contracts/measurement-wire.md),
  strips unknown keys, rejects `start` on non-`tool-opened`, `secs` > 3600, `key` on a drawing
  report; mirrored enums equal `TUNING_PRESETS` ids + `custom` and `HANDEDNESS`.
- `sanitize.test.ts`: `"failed https://x.y/a?b"` → `"failed <url>"`; `"/triads?rt=c"` → `<url>`;
  500-char input → 200 chars.
- `queue.test.ts` (fake timers): flush at 10, at 5 s, on hidden; 51st event and 11th report
  dropped; duplicate report dropped.
- `measure.test.ts` (jsdom): each facade rule in [client-api §4](./contracts/client-api.md);
  inert when endpoint empty or refused; `instrumentEdited` ×5 within 1 s → one event; back to
  original traits → none; custom-notes edit staying `custom` → none.
- `functions/m.test.ts`: every row of [measurement-wire §5](./contracts/measurement-wire.md)
  with a fake `MEASURE` binding; written points contain only §4 slots.
- `metrics.test.ts`: known item set → M-5 median, M-6 ratio, M-7 phone/desktop gap match
  hand-computed values (SC-005).
- `about-matches-wire.test.ts` + `about-catalog.test.ts`: twelve statements within caps, terms
  match `EVENT_TYPES` (SC-006).

## 2. E2E: real browser flows

```bash
pnpm build:test
pnpm test:e2e:fast e2e/measurement.spec.ts e2e/privacy.spec.ts e2e/about.spec.ts e2e/resilience.spec.ts
```

Expected (`e2e/measurement.spec.ts`, payloads captured with `page.route('**/m')`):

| Scenario | Expected |
|---|---|
| US1-1 open `/triads`, tap a fret, hide page | one batch with `tool-opened` (`start: true`) and `first-interaction` (`secs` integer); only allowlisted keys |
| US1-2 press Listen twice | exactly one `sound-played` |
| US1-3 Share (clipboard path) | `link-shared`; no item value contains `http`, `/triads` or `?` |
| US1-4 open a shared Triads link | `link-opened` with `tool: triads`; broken link → none |
| US1-5 change tuning to a preset, then custom | `instrument-changed` after 1 s with `tuning` id, then `custom`; no note names |
| US1-6 two loads | payload sets differ only in allowed fields; no shared id-like value |
| US2-1 `/m` aborted / 500 / 30 s delay / 302 | identical visible output, no notice, no console error from the app |
| US2-4 GPC or DNT via init script | zero requests to `/m` across every screen (SC-004) |
| US3-1 `__fmFault` drawing fault in Triads | fallback view shown; one `drawing` report with `view` and instrument |
| US3-2 calculation fault / audio failure | one `calculation` / `audio` report each |
| US3-4 same fault twice | one report |
| US3-5 custom tuning + fault | report `tuning: "custom"`, no offsets |

`e2e/privacy.spec.ts`: existing assertions unchanged; same-origin non-GET requests are only
`POST /m`. `e2e/about.spec.ts`: privacy section lists the new statements in each language.

## 3. Performance with the service down (SC-002)

```bash
pnpm test:e2e:fast e2e/perf.spec.ts
```

The perf spec runs once with `/m` fulfilled 204 and once with `/m` aborted; budgets
(tool open ≤ 300 ms, control → update ≤ 100 ms, tap → sound ≤ 100 ms) hold in both.
Bundle: `pnpm build && node scripts/check-bundle-size.mjs build` stays ≤ 150 KB gzip.

## 4. Function locally (optional, manual)

```bash
pnpm build && pnpm exec wrangler pages dev build
curl -i -X POST http://localhost:8788/m --data '{"v":1,"items":[{"r":"e","type":"sound-played","tool":"notes","device":"desktop","lang":"en","strings":6,"tuning":"AF-1","hand":"right"}]}'
curl -i http://localhost:8788/m
```

Expected: `204` with `cache-control: no-store` and no `set-cookie`; `GET` → `405`.

## 5. Monitoring

```bash
node scripts/uptime-check.mjs https://fretboard-master.pages.dev   # exit 0 when healthy
node scripts/uptime-check.mjs ""                                   # skip notice, exit 0
```

After merge: set repository variable `PRODUCTION_URL`, run `uptime.yml` via
`workflow_dispatch` once, confirm green (SC-007).

## 6. Production enablement checklist

1. `wrangler.toml` binding `MEASURE` → dataset `fretboard_master_measure` deployed with the
   next `main` deploy.
2. Run the queries in `docs/measurement.md` from the AE SQL API after a day of traffic.

## 7. End of slice

```bash
pnpm verify
```
