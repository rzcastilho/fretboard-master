# Contract: Measurement wire format and `POST /m`

**Feature**: `028-anonymous-measurement` | Implements FR-002–FR-004, FR-008, FR-014, FR-017, FR-018

## 1. Endpoint

| Property | Value |
|---|---|
| Path | `/m` (same origin; Cloudflare Pages Function `functions/m.ts`) |
| Method | `POST` only. Any other method → `405`, empty body, `Allow: POST`, `Cache-Control: no-store` |
| Request body | UTF-8 JSON text, ≤ 16 384 bytes. Sent as `content-type: text/plain` (beacon-friendly); the server ignores the content type |
| Credentials | Client sends none (`credentials: 'omit'` on fetch; no cookie exists for beacons) |
| Response | Always `204`, empty body, `Cache-Control: no-store`. Never `Set-Cookie`, never a redirect |
| Client handling | Response ignored entirely; no retry |

## 2. Batch

```json
{ "v": 1, "items": [ /* 1..10 items, see §3 */ ] }
```

- `v` ≠ 1, missing `items`, non-array, empty, > 10 items, body > 16 KB, or JSON parse error →
  nothing written, `204`.
- Each item validated independently; invalid items dropped, valid ones written.

## 3. Items (allowlist; unknown keys stripped)

### 3.1 Usage event (`r: "e"`)

```json
{ "r": "e", "type": "first-interaction", "tool": "triads", "device": "phone",
  "lang": "pt-BR", "strings": 6, "tuning": "AF-1", "hand": "right", "secs": 9 }
```

| Key | Allowed |
|---|---|
| `type` | `tool-opened` `first-interaction` `sound-played` `link-shared` `link-opened` `instrument-changed` |
| `tool` | `notes` `triads` `caged` |
| `device` | `phone` `tablet` `desktop` |
| `lang` | `en` `pt-BR` `es` |
| `strings` | `6` `7` |
| `tuning` | `AF-1`…`AF-11`, `AF-21`…`AF-23`, `custom` |
| `hand` | `right` `left` |
| `start` | literal `true`; only valid when `type = tool-opened` (else item invalid) |
| `secs` | integer 0..3600; only valid when `type = first-interaction` (else item invalid) |

### 3.2 Failure report (`r: "r"`)

```json
{ "r": "r", "kind": "drawing", "tool": "triads", "device": "desktop", "lang": "en",
  "strings": 6, "tuning": "custom", "hand": "left", "frets": 22, "ver": "0.1.0",
  "view": { "rt": "c", "q": "maj", "inv": "root", "ss": "1", "vw": "one", "lb": "interval" },
  "name": "TypeError", "msg": "Cannot read properties of undefined (reading 'x')" }
```

| Key | Allowed |
|---|---|
| `kind` | `calculation` `drawing` `audio` `missing-text` |
| `tool` | `notes` `triads` `caged` `shell` |
| `device`, `lang`, `strings`, `tuning`, `hand` | as §3.1 |
| `frets` | integer 12..24 |
| `ver` | `^\d+\.\d+\.\d+([-+][0-9A-Za-z.-]{1,32})?$` |
| `view` | optional object, ≤ 24 entries, key `^[a-z][a-z0-9]{0,15}$`, value string `^[A-Za-z0-9._-]{0,48}$`; never keys `v` `sc` `tu` `fr` |
| `name` + `msg` | required for `calculation` `drawing` `audio`; `name` `^[A-Za-z_$][\w$]{0,63}$`; `msg` string ≤ 200 |
| `key` | required for `missing-text` (and forbidden otherwise); `^[a-z0-9_]{1,96}$` |

Values in the examples are illustrative tokens; the real tokens are whatever the link encoder
produces (`src/lib/link/format.ts`).

## 4. Analytics Engine data point (one per valid item)

Binding `MEASURE` (dataset `fretboard_master_measure`, `wrangler.toml`).

| Slot | Event | Report |
|---|---|---|
| `indexes[0]` | `type` | `kind` |
| `blob1` | `event` | `report` |
| `blob2` | `type` | `kind` |
| `blob3` | `tool` | `tool` |
| `blob4` | `device` | `device` |
| `blob5` | `lang` | `lang` |
| `blob6` | `tuning` | `tuning` |
| `blob7` | `hand` | `hand` |
| `blob8` | `''` | `ver` |
| `blob9` | `''` | `name` or `''` |
| `blob10` | `''` | `msg` or `key` |
| `blob11` | `''` | `view` as JSON with sorted keys, or `''` |
| `double1` | `strings` | `strings` |
| `double2` | `1` if `start` else `0` | `0` |
| `double3` | `secs` or `-1` | `-1` |
| `double4` | `0` | `frets` |

Nothing else is written: no IP, user agent, `request.cf` (country, ASN, colo), Ray ID, header,
timestamp from the client, or raw body. AE adds its own `timestamp` and `_sample_interval`.

## 5. Server behavior table (unit-tested with a fake binding, FR-017)

| Input | Writes | Response |
|---|---|---|
| `GET`/`PUT`/`DELETE`/`OPTIONS` | 0 | 405 |
| `POST`, valid batch of n items | n | 204 |
| `POST`, mixed valid/invalid | valid count | 204 |
| `POST`, item with extra key `ip` | 1, without `ip` | 204 |
| `POST`, body 16 385 bytes | 0 | 204 |
| `POST`, invalid JSON | 0 | 204 |
| `POST`, binding `MEASURE` undefined | 0 | 204 |
| `POST`, `writeDataPoint` throws on item 1 of 2 | item 2 still attempted | 204 |
| Any | — | no `Set-Cookie`; `Cache-Control: no-store`; `console` never called |

## 6. Queries (documented in `docs/measurement.md`)

Shape only; the doc holds the runnable SQL against the AE SQL API.

```sql
-- sessions
SELECT SUM(_sample_interval) FROM fretboard_master_measure
WHERE blob1 = 'event' AND blob2 = 'tool-opened' AND double2 = 1 AND timestamp > NOW() - INTERVAL '30' DAY;

-- M-5 median seconds to first interaction (target <= 15)
SELECT quantileExactWeighted(0.5)(double3, _sample_interval) FROM fretboard_master_measure
WHERE blob2 = 'first-interaction' AND double3 >= 0 AND timestamp > NOW() - INTERVAL '30' DAY;

-- M-6 sessions with sound / sessions (target >= 0.5)
SELECT SUM(IF(blob2 = 'sound-played', _sample_interval, 0)) /
       SUM(IF(blob2 = 'tool-opened' AND double2 = 1, _sample_interval, 0))
FROM fretboard_master_measure WHERE blob1 = 'event' AND timestamp > NOW() - INTERVAL '30' DAY;

-- M-7 share of sessions with interaction, per device (phone vs desktop gap <= 10 points)
SELECT blob4 AS device,
       SUM(IF(blob2 = 'first-interaction', _sample_interval, 0)) /
       SUM(IF(blob2 = 'tool-opened' AND double2 = 1, _sample_interval, 0)) AS share
FROM fretboard_master_measure WHERE blob1 = 'event' AND timestamp > NOW() - INTERVAL '30' DAY
GROUP BY device;
```
