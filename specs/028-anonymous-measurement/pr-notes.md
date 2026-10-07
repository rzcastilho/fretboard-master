# PR description notes — production enablement (T072)

Paste into the PR description.

## Production enablement

- [ ] Set repository variable `PRODUCTION_URL` (Settings → Secrets and variables → Actions → Variables).
- [ ] Run `uptime.yml` once via `workflow_dispatch` and confirm it is green (SC-007).
- Cloudflare Pages deploys the `MEASURE` Analytics Engine binding (dataset
  `fretboard_master_measure`) from `wrangler.toml` with the next `main` deploy; no dashboard setup.
- **Pre-launch gate:** Q-11 legal review remains open. This slice ships no consent flow.
- After a day of traffic, run the queries in `docs/measurement.md` against the Analytics Engine SQL API.
