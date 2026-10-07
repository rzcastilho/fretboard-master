# ADR 0027: Anonymous measurement through a Pages Function

- **Status**: Accepted
- **Source**: spec 028-anonymous-measurement (research R-02, R-05)

## Context

The product targets (M-5, M-6, M-7) and failure triage need anonymous counts and reports. The app
is otherwise a static site (ADR 0001), so collection needs a small server-side intake.

## Decision

- **A Pages Function `/m` is the Principle II measurement-service exception.** `functions/m.ts`
  accepts `POST` only, validates with the shared `src/lib/measure/wire.ts` allowlist, writes one
  Analytics Engine data point per valid item, and always answers `204` with `no-store`. It reads
  no `request.cf`, IP or headers other than `content-length`.
- **`MEASURE` binding and data point layout.** Dataset `fretboard_master_measure`; the slot
  layout (`indexes[0]`, `blob1`…`blob11`, `double1`…`double4`) is fixed in
  `contracts/measurement-wire.md` §4 and documented in `docs/measurement.md`.
- **`wrangler.toml` is the source of truth for Pages settings** (output directory, compatibility
  date, bindings).
- **Previews write to the same dataset as production.** Accepted: volume is small and events are
  anonymous; separating them would need a second binding for little gain.
- **Enum lists are duplicated in `wire.ts`** so the Function imports nothing from `$lib`. An
  equality unit test guards each copy against drift from the app's types.

## Consequences

- The deploy now has a runtime component; availability is watched by `uptime.yml` (every 15 min).
- Analytics Engine retention (3 months) is the only retention and the only store.
