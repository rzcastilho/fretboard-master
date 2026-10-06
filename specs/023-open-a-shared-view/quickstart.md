# Quickstart: Open a Shared View (023)

How to see and verify the slice locally. Follows the constitution's verification tiers and
`CLAUDE.md`.

## Setup

```bash
mise install
pnpm install
pnpm build:test          # once; again only after changing src/
```

## Try it by hand

Serve the build (`pnpm preview` or the `serve-build` server the e2e config reuses), then open
in a **fresh tab** (opening means a full page load):

| Scenario | Address | Expect |
|---|---|---|
| Round trip (US1) | Share any view, paste the copied link in a new tab | Same view, no notice |
| Drop D CAGED (US2) | `/caged?v=1&rt=2&sp=none&q=major&fc=E.0&ly=10000&cn=0&ts=-&lb=interval&tmp=0&sc=6&tu=AF-4&fr=22` | D major, E shape, "This view uses Drop D", Use mine / Adopt this one / Dismiss |
| Ana (US1/US2) | Set left-handed + Português first, then the Drop D link | Mirrored, Portuguese, notice in Portuguese |
| 7-string link on 6 stored | `/triads?v=1&rt=0&sp=none&q=major&inv=root&ss=7&vw=isolated&oc=0&cmp=0&cq=-&lb=name&sc=7&tu=AF-21&fr=24` | Notice includes "7 strings"; Use mine moves the 7-6-5 set to the nearest set and says so |
| Custom tuning | `/notes?v=1&sel=0.4.7&str=1.2.3&rg=5.9&bg=all&hn=1&cd=2.5&lb=octave&sc=6&tu=c.64.59.55.50.45.38&fr=22` | Notice lists the string notes low → high in your notation |
| Incomplete (US3) | `/caged?v=1&rt=2&q=banana&fr=99` | Valid key kept, quality and frets defaulted, one "This link was incomplete…" notice |
| Newer version | `/notes?v=9&sel=0.4.7` | Notes opens, selection kept, incomplete notice |
| Unknown tool | `/scales?v=1&rt=0` | Home, address `/`, incomplete notice (not "We could not find that page") |
| Not a link | `/scales` | Existing not-found home notice |
| Bare tool | `/caged` | Normal CAGED, no notice |
| Hostile | `/notes?v=1&sel=<script>alert(1)</script>&lb=%22%3E%3Cimg%3E` | No dialog, no markup, notes opens with the incomplete notice |

Check after each: DevTools → Application → Local Storage is unchanged until **Adopt this one**
(only `lastTool` may change, as for any tool visit). The address bar shows the canonical link of
the displayed view; Back once leaves the app.

## Targeted checks while implementing

```bash
pnpm vitest run tests/unit/link/receive.test.ts tests/unit/link/receive.property.test.ts
pnpm vitest run tests/unit/state/instrument-override.test.ts tests/unit/state/opening.test.ts
pnpm vitest run tests/unit/link   # 022 decoder, fixtures and round trip must stay green
pnpm test:e2e:fast e2e/open-link.spec.ts
```

Bundle (R-08), after the decoder task and at slice end:

```bash
pnpm build && node scripts/check-bundle-size.mjs build
```

## End of slice, once

```bash
pnpm verify
```

Do not run `pnpm test:e2e` (full matrix) or `pnpm lhci` locally; CI owns them.
