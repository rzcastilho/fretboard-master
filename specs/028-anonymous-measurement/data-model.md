# Data Model: Anonymous Usage Measurement and Error Reporting

**Feature**: `028-anonymous-measurement` | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

All entities are in-memory TypeScript shapes for one page load, plus the Analytics Engine data
point they become on the server. Nothing is written to device storage (FR-003). The wire
encoding and server layout are in [contracts/measurement-wire.md](./contracts/measurement-wire.md).

## 1. Enumerations (`src/lib/measure/wire.ts`)

| Name | Values | Source |
|---|---|---|
| `EventType` | `tool-opened`, `first-interaction`, `sound-played`, `link-shared`, `link-opened`, `instrument-changed` | FR-001 |
| `FailureKind` | `calculation`, `drawing`, `audio`, `missing-text` | FR-007 |
| `EventTool` | `notes`, `triads`, `caged` | FR-002 (`ToolId`) |
| `ReportTool` | `EventTool` ∪ `shell` | FR-008 |
| `DeviceClass` | `phone`, `tablet`, `desktop` | Clarification "device class" |
| `Language` | `en`, `pt-BR`, `es` | `LanguageTag` from `$lib/i18n/languages` `LANGUAGES` (values copied; unit test asserts equality) |
| `Handedness` | `right`, `left` | `$lib/instrument/instrument` `HANDEDNESS` (values copied; a unit test asserts equality) |
| `TuningTrait` | every `TuningId` preset id, or `custom` | `$lib/instrument/tunings` `TUNING_PRESETS` (copied list; unit test asserts equality) |

`wire.ts` cannot import `$lib` (R-01), so enum lists that mirror app types are duplicated as
literal arrays and guarded by an equality unit test (`tests/unit/measure/wire.test.ts`).

## 2. InstrumentTraits

| Field | Type | Rule |
|---|---|---|
| `strings` | `6 \| 7` | `config.stringCount` |
| `tuning` | `TuningTrait` | preset id when `config.tuning.kind === 'preset'`, else `'custom'`; offsets/notes never copied |
| `hand` | `Handedness` | `config.handedness` |

Derived by pure `traitsOf(config: InstrumentConfig): InstrumentTraits`. Equality = all three
fields equal (`sameTraits`). Orientation and fret count are not traits.

## 3. InstrumentReport (report-only)

`InstrumentTraits` + `frets: number` (integer 12..24, `config.fretCount`). From
`instrumentOf(config)`.

## 4. UsageEvent

| Field | Type | Presence |
|---|---|---|
| `r` | `'e'` | always (record discriminator) |
| `type` | `EventType` | always |
| `tool` | `EventTool` | always |
| `device` | `DeviceClass` | always |
| `lang` | `Language` | always (active language at the moment of the event) |
| `strings`, `tuning`, `hand` | `InstrumentTraits` fields | always (current traits; for `instrument-changed`, the new traits) |
| `start` | `true` | only on the first `tool-opened` of the page load |
| `secs` | integer 0..3600 | only on `first-interaction`, and only when the page was never hidden before it |

No other field. No timestamp from the client (AE stamps arrival time).

## 5. FailureReport

| Field | Type | Presence |
|---|---|---|
| `r` | `'r'` | always |
| `kind` | `FailureKind` | always |
| `tool` | `ReportTool` | always (`shell` when the failure is outside a tool) |
| `device`, `lang` | as in UsageEvent | always |
| `strings`, `tuning`, `hand`, `frets` | `InstrumentReport` | always |
| `ver` | string `^\d+\.\d+\.\d+([-+][0-9A-Za-z.-]{1,32})?$` | always (`__APP_VERSION__`) |
| `view` | `Record<string,string>` ≤ 24 keys, key `^[a-z][a-z0-9]{0,15}$`, value `^[A-Za-z0-9._-]{0,48}$` | when a tool view exists (`viewParams(currentSnapshot(tool))`); omitted for `shell` |
| `name` | string ≤ 64, `^[A-Za-z_$][\w$]*$` | kinds `calculation`, `drawing`, `audio` |
| `msg` | string ≤ 200 (sanitized) | kinds `calculation`, `drawing`, `audio` |
| `key` | string ≤ 96, `^[a-z0-9_]+$` (a catalog key) | kind `missing-text` only |

Validation: exactly one of (`name`+`msg`) or `key`, matching the kind. Unknown fields are
dropped by the schema (`v.object` strips), invalid items are dropped whole.

## 6. Batch

`{ v: 1, items: (UsageEvent | FailureReport)[] }`, 1..10 items; serialized size ≤ 16 KB.

## 7. PageLoadState (`measure.svelte.ts`, module state, not exported)

| Field | Type | Initial | Transition |
|---|---|---|---|
| `enabled` | boolean | `endpoint !== '' && !trackingRefused()` | fixed for the load |
| `device` | `DeviceClass` | computed at start | fixed |
| `openedTools` | `Set<EventTool>` | ∅ | add on `toolOpened(tool)`; send only if not present |
| `sessionStarted` | boolean | false | true after first `tool-opened` sent (that event carries `start`) |
| `currentTool` | `EventTool \| null` | null | set on every `toolOpened` (also re-entries) |
| `interacted` | boolean | false | true on first `firstInteraction` (sent once) |
| `soundSent` | boolean | false | true on first `soundPlayed` with a `currentTool` (sent once) |
| `hiddenSeen` | boolean | `visibilityState === 'hidden'` | true on any `visibilitychange` → hidden |
| `lastTraits` | `InstrumentTraits` | traits at start (after prefs restore and link open) | updated when `instrument-changed` sent |
| `instrumentTimer` | timer \| null | null | (re)started by `instrumentEdited()`; 1000 ms |

`sound-played` when no tool was opened yet (not reachable in practice: sound requires a tool)
is dropped.

## 8. Queue (`queue.ts`)

| Field | Type | Rule |
|---|---|---|
| `pending` | item[] | push; flush at length 10 |
| `timer` | timer \| null | started by first push into an empty queue; 5000 ms → flush |
| `eventsAccepted` | 0..50 | push of a UsageEvent past 50 → dropped |
| `reportsAccepted` | 0..10 | push of a FailureReport past 10 → dropped |
| `reportKeys` | `Set<string>` | key = `kind|tool|name|msg` or `kind|tool|key`; duplicate → dropped (counts nothing) |

States: `idle` (empty, no timer) → `waiting` (items, timer armed) → flush → `idle`. Flush on
`hidden`/`pagehide` from any state; flushing an empty queue is a no-op. Caps and de-dup keys
never reset within a page load (bfcache restore included).

## 9. Analytics Engine data point (server)

One per valid item; layout in [contracts/measurement-wire.md §4](./contracts/measurement-wire.md).
Retention: AE fixed (3 months). No other store.

## 10. Relationships

```text
InstrumentConfig ──traitsOf──▶ InstrumentTraits ──▶ UsageEvent
         └────────instrumentOf──▶ InstrumentReport ─┐
ShareSnapshot ──viewParams──▶ view ─────────────────┼─▶ FailureReport
Error ──sanitize──▶ name + msg ─────────────────────┘
UsageEvent | FailureReport ──Queue──▶ Batch ──POST /m──▶ wire.ts validate ──▶ AE data point
```

No entity references another page load; there is no identifier field anywhere (FR-003, US1-6).
