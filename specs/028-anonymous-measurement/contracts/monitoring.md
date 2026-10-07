# Contract: Delivery monitoring (NFR-8.2)

**Feature**: `028-anonymous-measurement` | Implements FR-012, SC-007

## Workflow `.github/workflows/uptime.yml`

| Property | Value |
|---|---|
| Triggers | `schedule: cron '*/15 * * * *'`, `workflow_dispatch` |
| Permissions | `contents: read` |
| Tooling | `actions/checkout@v4`, `jdx/mise-action@v2` (Node from `mise.toml`); no `pnpm install` needed |
| Step | `node scripts/uptime-check.mjs "${{ vars.PRODUCTION_URL }}"` |
| Alert | GitHub's standard failed-workflow notification to maintainers |

## Script `scripts/uptime-check.mjs`

| Input | Behavior |
|---|---|
| Empty URL argument | Prints `uptime-check: PRODUCTION_URL not set, skipping` and exits 0 |
| `GET <url>/` | Must return 200 within 2000 ms |
| First `/_app/immutable/…` URL found in the HTML (script `src` or `link href`) | Must return 200 within 2000 ms |
| No immutable asset in the HTML | Failure (exit 1) |
| Timeout (`AbortSignal.timeout(2000)`), network error, or status ≠ 200 | Failure (exit 1), one line per failing URL with status/elapsed |
| All pass | One line per URL with status and elapsed ms; exit 0 |

The script exports `checkSite(base, fetchImpl)` for `tests/unit/uptime-check.test.ts`
(fake fetch: healthy, 500, slow, missing asset, empty URL).
