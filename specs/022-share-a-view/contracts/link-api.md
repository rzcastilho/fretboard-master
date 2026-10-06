# Contract: Link, Share and Address Modules (TypeScript API)

Internal module interfaces other slices (006/002 "open a link") and tests depend on. Types
from [data-model.md](../data-model.md).

## 1. `src/lib/link` (pure; ESLint boundary, research R-01)

```ts
// src/lib/link/encode.ts
export const LINK_VERSION = 1;
export function encodeLink(snapshot: ShareSnapshot, origin: string): string;
export function linkPath(tool: ToolId): '/notes' | '/triads' | '/caged';

// src/lib/link/decode.ts
export function decodeLink(url: URL): DecodeResult;          // total, never throws

// src/lib/link/types.ts
export type { ShareSnapshot, LinkInstrument, DecodeResult };
export function musicalOf(c: InstrumentConfig): LinkInstrument;
```

Guarantees:

- E1 Deterministic: `encodeLink(a, o) === encodeLink(b, o)` iff `a` and `b` are equal under the
  tool's `equals*View` + instrument musical equality + `temporary`.
- E2 Round trip: for every valid snapshot `s`, `decodeLink(new URL(encodeLink(s, o)))` is
  `{ kind: 'ok', snapshot: s, fellBack: [] }` (property test with fast-check arbitraries per
  tool, ≥ 500 runs each; plus the v1 fixture table).
- E3 Language-free: output is independent of paraglide locale and notation context (the module
  cannot import them; a test also switches locale/notation and compares).
- E4 Output keys are exactly those of [link-format.md](./link-format.md) §3–§5, in order.
- D1 `decodeLink` never throws for any string input (fast-check `fc.webUrl()` and arbitrary
  query strings).
- D2 Each invalid field falls back alone and appears in `fellBack`.

## 2. `src/lib/state/share.svelte.ts` (store)

```ts
export function currentSnapshot(tool: ToolId): ShareSnapshot;   // reads stores reactively
export function currentLink(tool: ToolId): string;              // encodeLink(currentSnapshot, location.origin)

export const share: {
  readonly busy: boolean;
  readonly notice: { readonly id: number } | null;
  readonly fallback: { readonly href: string } | null;
  /** Runs the FR-003 → FR-004 → FR-005 cascade. Never rejects. */
  share(tool: ToolId, title: string): Promise<void>;
  dismissNotice(): void;
  /** Closes the panel and returns focus to the registered Share button. */
  closeFallback(): void;
  /** Called by ToolLayout's effect; closes the fallback when the link changed. */
  viewChanged(href: string): void;
  registerOpener(el: HTMLElement | null): void;
};

/** Test seams (Vitest only). */
export function useSharePlatformForTests(p: SharePlatform): void;
export function useShareClockForTests(c: { setTimer: typeof setTimeout; clearTimer: typeof clearTimeout }): void;
export function resetShareForTests(): void;
```

Behavior table (unit-tested with a fake platform):

| canShare | coarse | share result | writeText | Outcome |
|---|---|---|---|---|
| yes | yes | resolves | – | nothing shown; `share` called with `{ url, title }` |
| yes | yes | `AbortError` | – | nothing shown; `writeText` not called |
| yes | yes | other error | resolves | notice |
| yes | yes | other error | rejects / null | fallback |
| yes | no | – (not called) | resolves | notice |
| no | any | – | resolves | notice |
| no | any | – | rejects / null | fallback, no notice |

Plus: second `share()` while `busy` is ignored; a second successful copy bumps `notice.id`
(one notice in the DOM); notice clears after 4,000 ms on the injected clock.

## 3. `src/lib/state/address.ts` + `address.svelte.ts`

```ts
// address.ts (plain TS)
export function createAddressSync(opts: {
  write: (href: string) => void;
  delayMs: number;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
}): AddressSync;

// address.svelte.ts (SvelteKit binding)
export const ADDRESS_DEBOUNCE_MS = 150;
export function openToolAddress(tool: ToolId): void;    // onMount: immediate replace with canonical link
export function scheduleAddress(href: string): void;    // from ToolLayout $effect
export function cancelAddress(): void;                  // beforeNavigate, pathname change
```

Guarantees:

- A1 Only `replaceState` from `$app/navigation` is used, with `page.state` preserved; never
  `pushState`/`goto` (FR-014).
- A2 A write whose pathname differs from `location.pathname`, or whose href equals
  `location.href`, is skipped.
- A3 `write` errors are caught in a non-empty `catch` that sets `syncDisabled = true`; later
  writes on the same tool screen are skipped until `openToolAddress` clears the flag. Nothing
  reaches the UI (FR-016).
- A4 With N `schedule` calls inside 150 ms, exactly one write happens, with the last href,
  150 ms after the last call (fake-timer unit test).
- A5 `openToolAddress` is the single place 006/002 inserts "decode received link and apply"
  before the first write (no extra hook API now).
