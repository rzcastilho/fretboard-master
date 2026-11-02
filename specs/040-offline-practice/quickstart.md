# Quickstart: validate Practise Offline (040)

Commands follow `CLAUDE.md` verification tiers. The behaviours being checked are defined in
[contracts/service-worker.md](contracts/service-worker.md),
[contracts/web-app-manifest.md](contracts/web-app-manifest.md),
[contracts/registration.md](contracts/registration.md) and [data-model.md](data-model.md).

## Prerequisites

- `mise install && pnpm install`
- Installed Google Chrome (local e2e runs use `pw.local.config.ts`).

## 1. Unit checks (pure logic, manifest, headers)

```bash
pnpm vitest run tests/unit/offline tests/unit/headers.test.ts tests/unit/csp.test.ts
```

Expected: everything passes.

- `precacheList` maps `/__not-found` to `/404.html` and drops `_headers` and
  `service-worker.js`.
- `routeRequest`:
  - `POST /m` → `pass`;
  - `/triads?v=1&…` navigation → `page` with key `/triads`;
  - `/triads/` → `redirect`.
- `cacheName` changes when only the digest changes.
- `registerOffline` waits for `load`, and logs a rejection without throwing.
- The manifest fields and colours match the tokens.
- The CSP test is unchanged and passes.

## 2. Build and stamp

```bash
pnpm build:test
grep -c "__FM_BUILD_DIGEST__" build/service-worker.js   # expected: 0 (stamped)
ls build/manifest.webmanifest build/icons/              # manifest + 4 PNGs
node scripts/check-bundle-size.mjs build                # expected: ≤ 180 KB, about +0.5 KB vs 160.4
```

## 3. Offline behaviour (desktop, Chrome)

```bash
pnpm test:e2e:fast e2e/offline.spec.ts
```

Expected: every scenario passes.

- Cache keys equal the `build/` file set (C-02).
- Offline reload: Home and every tool open in en, pt-BR and es, with no notice (US1, SC-001).
- Offline Ratios Training schedules clicks and the chime, and notes play (US1-AS3/4).
- Share link `/triads?v=1&…` and `/does-not-exist` behave offline exactly as online (C-04).
- In-app navigation makes zero page requests (C-10).
- A never-loaded profile, offline: browser network error (US4-AS1).
- Cleared caches: online recovers and refills, offline gets the network error (US4-AS2/3).
- The manifest and icons load, and every page links the manifest (SC-007).

## 4. Update does not interrupt a session (C-05)

```bash
pnpm build:test:skew                       # build/ = N, build-next/ = N+1
pnpm test:e2e:fast e2e/offline-update.spec.ts e2e/version-skew.spec.ts
```

Expected:

- During the run, the update installs and waits. Clicks keep being scheduled, there are no new
  navigation entries, and About shows N, including after a reload.
- After every page closes, a new page shows N+1.
- A failed (offline) update check leaves N working.
- `version-skew.spec.ts` still passes, because workers are blocked by default.

Rebuild after this step (`pnpm build:test`) before running other specs. The skew script leaves
`build/` at N, so the rebuild is optional, but `build-next/` must not be committed.

## 5. Existing suites unchanged

```bash
pnpm test:e2e:fast e2e/continuity.spec.ts e2e/measurement.spec.ts e2e/privacy.spec.ts
pnpm playwright test -c pw.local.config.ts --project=nojs
```

Expected: all pass unchanged. Workers are blocked by default in `playwright.config.ts`, and the
no-JS path registers nothing (C-16).

## 6. End of slice

```bash
pnpm verify
```

CI then runs Lighthouse (`lhci`). The Constitution VI budgets must pass without a change to
`lighthouserc.cjs` (FR-015, SC-006).

## Manual checks (for `tasks.md` and the PR description)

1. On a real phone, open the PR preview once online and add it to the home screen. Check that
   the icon and the name "Fretboard Master" appear (US2-AS1).
2. Turn on airplane mode and open the icon. Check that Home appears, the app opens in its own
   window, and Ratios Training plays click and chime that you can hear (US2-AS2, SC-002, C-13).
3. On a desktop browser, open the preview offline after one visit and listen to the click,
   chime and notes on each tool.
4. Look at the maskable icon in Chrome DevTools → Application → Manifest with the circle mask on.
   The glyph must not be clipped.
5. On the Cloudflare preview, run `curl -sI <preview>/service-worker.js` and
   `curl -sI <preview>/manifest.webmanifest`. Check that both show `cache-control: no-cache`, and
   that the manifest's content type is `application/manifest+json`. Also check that
   `<preview>/404.html` redirects to `/404` and serves the not-found page (plan.md Assumptions).
