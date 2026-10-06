# Contract: Opening a Received Link (TypeScript API)

Internal module interfaces for slice 023. Types from [data-model.md](../data-model.md). The
external interface (the link format itself) is unchanged and owned by
`specs/022-share-a-view/contracts/link-format.md`; this slice only reads it.

## 1. `src/lib/link/receive.ts` (pure; inside the `src/lib/link` ESLint boundary)

```ts
export type ReceivedLink =
  | { readonly kind: 'none' }
  | { readonly kind: 'unknown-tool' }
  | { readonly kind: 'tool'; readonly snapshot: ShareSnapshot; readonly fellBack: readonly string[]; readonly forcedNotice: boolean };

export function readReceivedLink(url: URL, stored: LinkInstrument): ReceivedLink;
export function isIncomplete(r: ReceivedLink): boolean;
```

`src/lib/link/decode.ts` gains (internal, exported for `receive.ts` and tests only):

```ts
export interface DecodeBase {
  readonly instrument: LinkInstrument;   // default for sc / tu / fr
  readonly pairInstrument: boolean;      // invalid sc or tu ⇒ both from `instrument`
}
export function decodeToolParams(tool: LinkTool, params: URLSearchParams, base: DecodeBase): { snapshot: ShareSnapshot; fellBack: string[] };
```

Guarantees:

- R1 Total: `readReceivedLink` never throws for any `URL` (fast-check over paths and arbitrary
  query strings, ≥ 500 runs).
- R2 Round trip: for every valid snapshot `s` (022 arbitraries),
  `readReceivedLink(new URL(encodeLink(s, o)), s.instrument)` is
  `{ kind: 'tool', snapshot: s, fellBack: [], forcedNotice: false }` (FR-003, SC-001).
- R3 Stored defaults: with `stored ≠ factory`, a link missing `sc`/`tu`/`fr` resolves to the
  stored values; invalid `sc` or `tu` replaces both (keys `sc`, `tu` reported).
- R4 Per-field fallback for view fields exactly as 022 D2; clamps report their key (EC-10.2).
- R5 Version: `v` absent, non-integer, `0`, or `> LINK_VERSION` on a tool path with a non-empty
  query → `kind: 'tool'`, `forcedNotice: true`, fields decoded with v1 rules.
- R6 Bare tool path (`search` empty) → `none`. Non-tool path with `v` → `unknown-tool`; without
  → `none`.
- R7 Unknown keys never appear in `fellBack`; duplicate keys use the first occurrence.
- R8 `decodeLink` output is unchanged for every existing test and fixture (022 E1–E4, D1–D2).
- R9 Purity: no Svelte, DOM, i18n, storage (existing `src/lib/link` lint boundary).

## 2. `src/lib/state/instrument.svelte.ts` (additions)

```ts
export const instrument: {
  // …existing API…
  readonly override: InstrumentOverride | null;
  /** Instrument notice visible for `tool` now. */
  overrideNoticeFor(tool: ToolId): InstrumentOverride | null;
  /** Musical instrument the tool is drawn with (link while overridden, else stored). */
  effectiveFor(tool: ToolId): LinkInstrument;
  receive(tool: ToolId, link: LinkInstrument): void;
  useMine(): void;
  adopt(): void;
  dismissOverrideNotice(): void;
};
```

Guarantees:

- I1 `receive` writes nothing (`preferences.remember` not called), stops no playback, and
  changes only the opened store's instrument.
- I2 `useMine` writes nothing; afterwards every store is on `instrumentOf(active)`; returns the
  view to the stored instrument with EC-2.3 and sets `adjustedIn` only when the opened store
  reports an adjustment.
- I3 `adopt` calls `preferences.remember` exactly once, with only `stringCount`, `tuningId`,
  `customTuning`, `fretCount` changed relative to the stored record (handedness and orientation
  keep their stored values); the opened view is unchanged (`equals*View` before/after).
- I4 `confirm` with a change and `restore` set `override = null` before applying.
- I5 `screenChanged` resets the per-visit dismissal; the override itself survives navigation.
- I6 `effectiveFor` drives `currentSnapshot(tool)` in `share.svelte.ts`, so Share and address
  sync describe what is drawn (022 FR-003 round trip holds during an override).

## 3. Tool stores (additions)

```ts
notes.receive(view: NotesViewState): void;
triads.receive(view: TriadsViewState): void;
caged.receive(view: CagedViewState, temporary: boolean): void;
```

- T1 No `preferences.remember`, no `playback.stop`, `preferredLabel` unchanged.
- T2 After `receive`, `<store>.state` equals the given view (it is already valid for the
  store's instrument); CAGED `temporary` is true iff requested and the tuning in use is
  non-compatible.

## 4. `src/lib/state/opening.svelte.ts`

```ts
export const opening: {
  readonly incomplete: { readonly screen: ToolId | 'home' } | null;
  start(href: string): void;        // idempotent; hooks.client init only
  dismissIncomplete(): void;
  screenChanged(): void;
};
export function resetOpeningForTests(): void;
```

- O1 `start` is called once from `src/hooks.client.ts` `init`, after `preferences.start()`.
  Client-side navigation never calls it (FR-001).
- O2 `start` never throws; any failure leaves the normal tool view plus the incomplete notice.
- O3 Zero storage writes during `start` (asserted with the in-memory `StorageLike`): no
  instrument, label or presentation key changes (FR-006, SC-003). `lastTool` is written later by
  the existing `afterNavigate` handler, as for any tool visit.
- O4 `incomplete` is set iff `isIncomplete(received)`; exactly one notice regardless of how many
  fields fell back (SC-005).

## 5. Address (unchanged API, new precondition)

- `openToolAddress(tool)` (022 A5) now runs after the link has been applied in `init`, so its
  first `replaceState` writes the canonical link of the displayed, repaired state (FR-017). No
  new history entry; Back from a fresh tab leaves the app (US4).

## 6. Messages (`messages/{en,es,pt-BR}.json`)

| Key | en | Params |
|---|---|---|
| `link_instrument` | This view uses {tuning} | `tuning` |
| `link_instrument_strings` | This view uses {count} strings: {tuning} | `count`, `tuning` |
| `link_use_mine` | Use mine | – |
| `link_adopt` | Adopt this one | – |
| `link_incomplete` | This link was incomplete; we show the closest view possible | – |

es / pt-BR translations are added in the same task; the existing catalog-parity test enforces
all three files carry every key.
