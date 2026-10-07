# Contract: Client measurement API

**Feature**: `028-anonymous-measurement` | Module: `src/lib/measure/` | Implements FR-001–FR-011

## 1. Build-time setting

```ts
declare const __FM_MEASURE_ENDPOINT__: string; // src/app.d.ts
```

| Context | Value |
|---|---|
| `pnpm build` (production) | `'/m'` |
| `pnpm build:test`, `build:test:skew` | `'/m'` (Playwright intercepts with `page.route('**/m')`) |
| `vite dev`, any Vitest run (`process.env.VITEST`) | `''` |
| Any build with `FM_MEASURE_ENDPOINT=` set | that value (empty disables) |

Empty endpoint ⇒ facade inert: no queue, timers, or listeners (FR-005a).

## 2. Pure modules (unit-tested in `node`)

```ts
// wire.ts — relative imports + valibot only
export const EVENT_TYPES: readonly EventType[];
export const FAILURE_KINDS: readonly FailureKind[];
export const TUNING_TRAITS: readonly TuningTrait[];
export const HANDS: readonly Handedness[];
export const BatchSchema: v.GenericSchema<unknown, Batch>;
export function parseItems(body: unknown): readonly WireItem[]; // valid items only, stripped
export const MAX_BODY_BYTES = 16_384;
export const MAX_BATCH = 10;

// sanitize.ts
export function sanitizeMessage(raw: string): string;        // <url> masking, then ≤ 200 chars
export function reportKey(r: FailureReport): string;          // de-dup key

// traits.ts
export function traitsOf(c: InstrumentConfig): InstrumentTraits;
export function instrumentOf(c: InstrumentConfig): InstrumentReport;
export function sameTraits(a: InstrumentTraits, b: InstrumentTraits): boolean;

// device.ts
export function deviceClass(input: { coarse: boolean; shortSide: number }): DeviceClass;
export function readDeviceClass(): DeviceClass;               // matchMedia + screen

// queue.ts
export interface QueueDeps {
  send(body: string): void;                                   // never throws (transport swallows)
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
}
export function createQueue(deps: QueueDeps): {
  push(item: WireItem): void;                                 // applies caps + de-dup
  flush(): void;
};

// link/encode.ts (addition)
export function viewParams(snapshot: ShareSnapshot): Record<string, string>; // no v/sc/tu/fr
```

## 3. Transport (`transport.ts`)

```ts
export function createTransport(endpoint: string): (body: string) => void;
export function trackingRefused(): boolean; // GPC === true || doNotTrack === '1'
```

`sendBeacon(endpoint, Blob(text/plain))`; on `false`/absent → `fetch` with `keepalive: true`,
`credentials: 'omit'`, `redirect: 'error'`, `cache: 'no-store'`, result discarded. All inside
`try/catch` with the constitution-required comment.

## 4. Facade (`measure.svelte.ts`)

```ts
export const measure: {
  start(): void;                         // called once from hooks.client init, after opening.start
  toolOpened(tool: ToolId): void;        // ToolLayout on tool mount / tool change
  firstInteraction(): void;              // each tool's Fretboard onactivate handler
  soundPlayed(): void;                   // playback note/chord/sequence/timeline, when sound scheduled
  linkShared(tool: ToolId): void;        // share cascade delivered a link
  linkOpened(tool: ToolId): void;        // opening.start applied a snapshot
  instrumentEdited(): void;              // instrument store panel actions; 1 s quiet period
  report(input: {                        // from recordFailure
    kind: Exclude<FailureKind, 'missing-text'>; tool: ToolId | null; error: unknown;
  }): void;
  missingText(key: string): void;        // language store, inside takeUnreported loop
};

// Test seams (Vitest only), same pattern as resetShareForTests
export function useMeasureForTests(deps: {
  endpoint?: string; send?: (body: string) => void; refused?: boolean;
  device?: DeviceClass; now?: () => number; hidden?: boolean;
  setTimer?: QueueDeps['setTimer']; clearTimer?: QueueDeps['clearTimer'];
}): void;
export function resetMeasureForTests(): void;
```

Rules (all no-ops when inert):

| Call | Sends | Once rule |
|---|---|---|
| `toolOpened(t)` | `tool-opened` (+`start` on first) | once per tool per load |
| `firstInteraction()` | `first-interaction` (+`secs` unless hidden seen) | once per load |
| `soundPlayed()` | `sound-played` with `currentTool` | once per load |
| `linkShared(t)` | `link-shared` | each call (bounded by 50-event cap) |
| `linkOpened(t)` | `link-opened` | at most once (only one received link per load) |
| `instrumentEdited()` | `instrument-changed` after 1 s if traits ≠ `lastTraits` | debounced |
| `report(...)` | failure report | de-dup + 10-report cap |
| `missingText(k)` | `missing-text` report, tool = `currentTool ?? 'shell'` | caller guarantees once per locale+key; de-dup also applies |

Every facade method is wrapped so it can never throw into its caller (FR-004, FR-010).

## 5. Call-site changes (existing files)

| File | Change |
|---|---|
| `src/hooks.client.ts` | `measure.start()` after `opening.start(...)` |
| `src/lib/shell/ToolLayout.svelte` | `$effect` → `measure.toolOpened(tool)` |
| `src/lib/shell/failure.ts` | `recordFailure(tool, error, kind?)` also calls `measure.report`; `markCalculation(fn)` |
| `src/lib/shell/fault.ts` | `maybeFault(tool, phase?)` for `calculation`/`drawing` injection (test/dev only) |
| `src/lib/tools/{notes,triads,caged}/*Tool.svelte` | `onactivate` handler calls `measure.firstInteraction()`; display-model derivation via `markCalculation` |
| `src/lib/state/playback.svelte.ts` | `measure.soundPlayed()`; audio failures → `recordFailure(tool, e, 'audio')` |
| `src/lib/state/share.svelte.ts` | `measure.linkShared(tool)` on delivery |
| `src/lib/state/opening.svelte.ts` | `measure.linkOpened(s.tool)` after applying a snapshot |
| `src/lib/state/instrument.svelte.ts` | panel actions call `measure.instrumentEdited()` |
| `src/lib/state/language.svelte.ts` | `measure.missingText(key)` beside the existing `console.warn` |
| `src/lib/link/encode.ts` | export `viewParams` |
| `vite.config.ts`, `src/app.d.ts` | `__FM_MEASURE_ENDPOINT__` |
| `eslint.config.js` | boundary block for `src/lib/measure/wire.ts`, `sanitize.ts`; lint `functions/**` |
| `scripts/serve-build.mjs` | `POST /m` → 204 |
