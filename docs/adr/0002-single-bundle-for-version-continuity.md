# ADR 0002: Single bundle for version continuity

- **Status**: Accepted
- **Source**: research R-04 (spec 001-walking-skeleton)

## Context

A user may keep the app open while a new version is published. Old content-hashed chunks can
disappear from the host, so lazy-loading code mid-session could fail. An open session must never
break or reload itself.

## Decision

- `kit.output.bundleStrategy = 'single'`: one JS file and one CSS file per build, so moving among
  the four screens requests no code after load.
- `kit.inlineStyleThreshold` is set high enough to inline the small CSS, which also removes a
  render-blocking request.
- `kit.version.pollInterval = 0` and no `updated` handling: a session never reloads itself.
- `static/_headers`: HTML is `no-cache` (the next full load gets the newest version);
  `/_app/immutable/*` is `public, max-age=31536000, immutable`.
- No web font is loaded in this slice, so no late font request can fail.
- Verified by `e2e/continuity.spec.ts` (0 requests after load) and `e2e/version-skew.spec.ts`
  (serves version N+1 mid-session with N's chunks missing).

## Consequences

- The About screen keeps showing the loaded version until a reload.
- Initial JS carries all screens; `scripts/check-bundle-size.mjs` caps it at 150 KB gzip
  (80 KB until constitution 1.3.0, 85 KB until 1.4.0, 90 KB until 1.6.0, 92 KB until 1.7.0,
  94 KB until 1.8.0, 120 KB until 1.9.0, 128 KB until 1.10.0, 136 KB until 1.11.0; the 120 → 128 KB raise ships the link decoder, slice 023;
  the 128 → 136 KB raise ships the minimap, fit mode and adaptive layout, slice 025;
  the 136 → 150 KB raise ships themes, motion and print, slice 026, with headroom for later slices).
- Every screen parses and hydrates the whole bundle, which costs time to interactive on the
  reference mobile profile. Constitution 1.12.0 (slice 031) keeps this decision permanently and
  sets the Lighthouse budgets to what it delivers (score ≥ 70, Home ≤ 4.5 s, tools ≤ 5 s)
  instead of code-splitting.

## Alternatives considered

- Default per-route chunks with `pollInterval` and forced reload on update: interrupts the user
  and loses in-progress state.
