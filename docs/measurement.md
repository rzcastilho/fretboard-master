# Anonymous measurement

Spec 028. The app sends small allowlisted events and failure reports to `POST /m`
(`functions/m.ts`), which writes them to Cloudflare Analytics Engine. There are no user
identifiers, cookies, IP addresses or request metadata in the data.

## Fields collected

- **Usage event** (`r: "e"`): `type` (`tool-opened`, `first-interaction`, `sound-played`,
  `link-shared`, `link-opened`, `instrument-changed`), `tool`, `device` class, `lang`, instrument
  traits (`strings`, `tuning` preset id or `custom`, `hand`), and `start` / `secs` where defined.
- **Failure report** (`r: "r"`): `kind`, `tool`, `device`, `lang`, instrument traits and `frets`,
  app `ver`, the tool's view tokens (`view`), and either an error `name` + sanitized `msg`
  (max 200 chars, URLs replaced by `<url>`) or a missing-text `key`.

Authoritative definitions: `src/lib/measure/wire.ts` and
`specs/028-anonymous-measurement/contracts/measurement-wire.md`.

## Retention

Analytics Engine retains data for a fixed 3 months. It is the sole store (FR-018): nothing is
copied elsewhere. Preview deployments write to the same dataset (`fretboard_master_measure`)
as production.

## Data point slots

| Slot         | Event                   | Report                               |
| ------------ | ----------------------- | ------------------------------------ |
| `indexes[0]` | `type`                  | `kind`                               |
| `blob1`      | `event`                 | `report`                             |
| `blob2`      | `type`                  | `kind`                               |
| `blob3`      | `tool`                  | `tool`                               |
| `blob4`      | `device`                | `device`                             |
| `blob5`      | `lang`                  | `lang`                               |
| `blob6`      | `tuning`                | `tuning`                             |
| `blob7`      | `hand`                  | `hand`                               |
| `blob8`      | `''`                    | `ver`                                |
| `blob9`      | `''`                    | `name` or `''`                       |
| `blob10`     | `''`                    | `msg` or `key`                       |
| `blob11`     | `''`                    | `view` as JSON, sorted keys, or `''` |
| `double1`    | `strings`               | `strings`                            |
| `double2`    | `1` if `start` else `0` | `0`                                  |
| `double3`    | `secs` or `-1`          | `-1`                                 |
| `double4`    | `0`                     | `frets`                              |

## Queries

Run these with the Analytics Engine SQL API (Cloudflare account API, `analytics_engine/sql`
endpoint). Always weight by `_sample_interval`. A "session" is a `tool-opened` event with `start`.

### Sessions

```sql
SELECT SUM(_sample_interval) AS sessions
FROM fretboard_master_measure
WHERE blob1 = 'event' AND blob2 = 'tool-opened' AND double2 = 1
  AND timestamp > NOW() - INTERVAL '30' DAY
```

### M-5: median seconds to first interaction (target at most 15)

```sql
SELECT quantileExactWeighted(0.5)(double3, _sample_interval) AS median_secs
FROM fretboard_master_measure
WHERE blob2 = 'first-interaction' AND double3 >= 0
  AND timestamp > NOW() - INTERVAL '30' DAY
```

### M-6: sessions with sound ÷ sessions (target at least 0.5)

```sql
SELECT SUM(IF(blob2 = 'sound-played', _sample_interval, 0)) /
       SUM(IF(blob2 = 'tool-opened' AND double2 = 1, _sample_interval, 0)) AS sound_share
FROM fretboard_master_measure
WHERE blob1 = 'event' AND timestamp > NOW() - INTERVAL '30' DAY
```

### M-7: share of sessions with interaction, per device (phone vs desktop gap at most 10 points)

```sql
SELECT blob4 AS device,
       SUM(IF(blob2 = 'first-interaction', _sample_interval, 0)) /
       SUM(IF(blob2 = 'tool-opened' AND double2 = 1, _sample_interval, 0)) AS share
FROM fretboard_master_measure
WHERE blob1 = 'event' AND timestamp > NOW() - INTERVAL '30' DAY
GROUP BY device
```

`tests/unit/measure/metrics.test.ts` mirrors these queries in TypeScript over a known item set.

## Delivery monitoring

`.github/workflows/uptime.yml` runs `scripts/uptime-check.mjs` every 15 minutes against the
`PRODUCTION_URL` repository variable (home page and one hashed asset, each 200 within 2000 ms).
A failure triggers GitHub's standard failed-workflow notification.
