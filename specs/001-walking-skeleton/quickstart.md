# Quickstart & Validation: Walking Skeleton

**Feature**: `001-walking-skeleton` | **Plan**: [plan.md](./plan.md)

Runnable scenarios that prove the slice works end to end. Selectors and expected texts come from
[contracts/ui-shell.md](./contracts/ui-shell.md); HTTP expectations from
[contracts/http-delivery.md](./contracts/http-delivery.md); fault hook from
[contracts/test-hooks.md](./contracts/test-hooks.md).

## 1. Prerequisites

- [mise](https://mise.jdx.dev) installed (the only global tool).
- For deploy checks: Cloudflare Pages project `fretboard-master`, GitHub secrets
  `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

## 2. Setup

```bash
mise install                         # exact Node 24.x.y + pnpm 10.x.y pinned in mise.toml
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chromium firefox webkit
```

## 3. Static gates

```bash
pnpm lint            # ESLint (incl. theory import boundary) — expect 0 errors
pnpm format:check    # Prettier — expect clean
pnpm check           # svelte-check + tsc strict — expect 0 errors, 0 warnings
pnpm test:unit       # Vitest + coverage — expect pass, ≥ 80 % lines/branches
```

## 4. Run locally

```bash
pnpm dev             # http://localhost:5173
```

Manual smoke:

| Step | Expected |
|---|---|
| Open `/` | "Fretboard Master" heading; two equal cards "Fretboard Notes / Where is every note?" and "Triads / What is a chord made of?"; empty bottom zone; "About" link |
| Click Triads | URL `/triads`; heading "Triads"; regions Application bar, Main controls, Fretboard, Context panel, Actions; nav marks Triads current; focus on heading |
| Browser Back | Home |
| Open `/nope` | Home with "We could not find that page"; URL becomes `/`; Dismiss removes it |
| About | "Version 0.1.0" (matches `package.json`) |

## 5. End-to-end suite (test build, fault hook enabled)

```bash
pnpm build:test:skew && pnpm test:e2e  # builds N+1 into build-next/, then N into build/; Playwright: phone (360 px) + desktop + firefox/webkit smoke
```

Expected: all pass. Scenarios covered (one spec file per user story under `e2e/`):

- `home.spec.ts` — US1: cards, order, equal size, no spinner, no auth UI, widths 320–2560 no
  horizontal scroll, safe-area insets respected (CDP inset emulation), 200 % text size, axe = 0
  (light + dark).
- `navigation.spec.ts` — US2: card → tool, nav order + `aria-current`, back/forward sequence,
  re-select current creates no entry (`history.length` unchanged), focus on `h1`, deep links and
  reloads of `/notes`, `/triads`, `/about`, `/triads/`.
- `about.spec.ts` — US3: description + "Version X.Y.Z" equals `package.json`; Home link and Back.
- `resilience.spec.ts` — US4: unknown paths matrix (`/nope`, `/caged`, `/triads/x`, `/Triads`)
  → notice + URL `/` + Back does not return to bad path; notice ≤ 2 lines at 320 px and 200 %
  text; Dismiss; failure view via
  `__fmFault = { triads: 1 }` then Reset tool recovers; `{ triads: Infinity }` → failure view
  again after Reset; Go to home; other tool works; console has one `[fretboard-master] failure`
  record; zero requests during failure.
- `continuity.spec.ts` — US5/FR-016/FR-019: after `load`, navigating home → Triads → Notes →
  About → home makes **0** network requests and no reload (`performance.navigation` count = 1).
- `version-skew.spec.ts` — US5 scenario 3: mid-session the served build is swapped to N+1
  (`build-next/`, from `pnpm build:test:skew`); moving among screens makes no reload and no failed
  request, About still shows N; a full reload shows N+1.
- `perf.spec.ts` — tool open/switch ≤ 300 ms (median of 5, 4× CPU throttle, Chromium).

## 6. Production build gates

```bash
pnpm build                               # production mode, writes build/ incl. 404.html
node scripts/check-no-fault-hook.mjs     # expect "OK: no fault hook in build/"
node scripts/check-bundle-size.mjs       # expect "initial JS gzip: NN.N KB ≤ 80 KB"
pnpm test:e2e:nojs                       # Playwright javaScriptEnabled:false — prerendered pages readable, links work, /nope shows home+notice
pnpm lhci                                # Lighthouse CI mobile: perf ≥ 0.90, TTI ≤ 3000 ms on /, /notes, /triads, /about
```

## 7. Delivery smoke (after deploy; CI runs it automatically)

```bash
scripts/smoke-delivery.sh https://<branch>.fretboard-master.pages.dev
```

Expected output lines (each `PASS`):

- `http → https redirect (301/308)`
- `HSTS header present`
- `/ 200`, `/notes 200`, `/triads 200`, `/about 200`
- `/triads/ → /triads`
- `/nope 404 with notice text`, `/caged 404`, `/Triads 404 or home-with-notice`

During the deploy itself CI also runs `node scripts/deploy-availability-probe.mjs <url> --stop-file
<path>` in the background (US5 scenario 2); expected final line
`availability: N requests, 0 failed`.

## 8. Version continuity (optional manual confirmation; automated by §5 `version-skew.spec.ts` and `continuity.spec.ts`)

1. Open production URL in a browser; note About shows version N.
2. Merge a PR bumping `package.json` to N+1; wait for deploy.
3. In the already-open tab, move among Home, Notes, Triads, About: no reload, no failed requests
   (DevTools Network empty), About still shows N.
4. Reload: About shows N+1.
