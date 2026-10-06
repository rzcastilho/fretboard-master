# Data Model: Open a Shared View (023)

Phase 1 output for [plan.md](./plan.md). Builds on slice 022's types
(`specs/022-share-a-view/data-model.md`): `LinkTool`, `LinkInstrument`, `ShareSnapshot`,
`DecodeResult`. Nothing here is persisted: every entity below lives in memory for one page load.

## 1. Received link (pure, `src/lib/link/receive.ts`)

```ts
/** What a full page load's address means to the app. */
export type ReceivedLink =
  | { readonly kind: 'none' }                       // not a link: bare tool path, home, about, 404 without `v`
  | { readonly kind: 'unknown-tool' }               // non-tool path whose query has a `v` key
  | {
      readonly kind: 'tool';
      readonly snapshot: ShareSnapshot;             // validated view + resolved link instrument
      /** Param keys that were missing, invalid or clamped and took a default. */
      readonly fellBack: readonly string[];
      /** `v` missing, non-integer or > LINK_VERSION: notice always shows (FR-014). */
      readonly forcedNotice: boolean;
    };

export function readReceivedLink(url: URL, stored: LinkInstrument): ReceivedLink;
export const isIncomplete = (r: ReceivedLink): boolean; // unknown-tool, or tool with fellBack.length > 0 || forcedNotice
```

Rules (validation, in order):

| # | Condition | Result |
|---|---|---|
| 1 | Path (trailing `/` stripped) ∉ `/notes`, `/triads`, `/caged` and `searchParams.has('v')` | `unknown-tool` |
| 2 | Path ∉ tool paths, no `v` | `none` |
| 3 | Tool path and `url.search` is `''` or `'?'` | `none` |
| 4 | Tool path, non-empty query | decode with v1 rules (below); `forcedNotice = parseVersion(v) !== 1` |

v1 decoding against a `DecodeBase = { instrument: stored, pairInstrument: true }`:

- `sc` invalid/missing **or** `tu` invalid/missing/not valid for the decoded count → `stringCount`
  and `tuning` both = `stored`; `sc` and `tu` both appended to `fellBack`.
- `fr` invalid/missing/out of 12..24 → `stored.fretCount`; `fr` appended.
- Every view field: 022 rules, decoded against the resolved instrument; cross-field clamps
  (`ss`, `oc`, region, card, triad set) report their keys (EC-10.2).
- First occurrence of a key wins; unknown keys are ignored and never reported (FR-016).
- Never throws; an unforeseen exception yields `{ kind: 'tool', snapshot: <tool default on
  stored>, fellBack: ['*'], forcedNotice: true }` so the tool still opens (C-X "never blank").

`decodeLink(url)` (022) is unchanged: it calls the same internals with
`{ instrument: FACTORY_LINK_INSTRUMENT, pairInstrument: false }` and its own version handling.

## 2. Session instrument override (`src/lib/state/instrument.svelte.ts`)

```ts
export interface InstrumentOverride {
  readonly tool: ToolId;            // the opened tool; the only store on the link instrument
  readonly link: LinkInstrument;    // CAGED: the preferred instrument (`sc`/`tu`/`fr`), not the temporary one
  /** String count or tuning differs from stored: show the instrument notice. False = fret count only. */
  readonly notice: boolean;
}
```

State on the store: `override: InstrumentOverride | null` (`$state.raw`),
`overrideDismissed: boolean` (hidden for the current visit only).

| Transition | Precondition | Effect |
|---|---|---|
| `receive(tool, link)` | startup only | if `link` musically equals `musicalOf(active)` → nothing. Else `override = { tool, link, notice: differs(sc or tuning) }`; the opened store gets `applyInstrument(tuningInstrument(link…))` (CAGED also the tuning). No write, no playback stop, no `adjustedIn`. |
| `useMine()` | `override !== null` | `playback.stop('instrument')`; opened store `applyInstrument(instrumentOf(active))`; CAGED `endTemporary()` unless stored tuning is non-compatible; `adjustedIn = tool` if adjusted; `override = null`. No write. |
| `adopt()` | `override !== null` | `active = { ...override.link, handedness, orientation from active }`; `persist(active)` (same `preferences.remember` patch as `confirm`); other stores `applyInstrument` (no notice: not on screen); opened store unchanged; `override = null`. |
| `dismissOverrideNotice()` | notice shown | `overrideDismissed = true`; override kept. |
| `screenChanged()` (existing) | — | also `overrideDismissed = false` (notice returns on the next visit). |
| `confirm(screen)` with `result.changed` | — | `override = null` first, then the existing path (saves, applies stored instrument to all stores, `adjustedIn` per EC-2.3). |
| `restore(config)` (startup, erase) | — | `override = null`, existing path. |
| `effectiveFor(tool)` | — | `override?.tool === tool ? override.link : musicalOf(active)` (read by `currentSnapshot`, `TuningBadge`). |

Invariants:

- `override !== null ⇒ the opened store's instrument equals tuningInstrument(override.link)` and
  every other store's instrument equals `instrumentOf(active)`.
- No preference write happens between `receive` and `adopt` (SC-003).
- `active` (and so the instrument panel) always holds the stored instrument.

## 3. Opening store (`src/lib/state/opening.svelte.ts`)

```ts
type OpeningScreen = ToolId | 'home';

interface OpeningState {
  /** Incomplete-link notice target; null when hidden. */
  readonly incomplete: { readonly screen: OpeningScreen } | null;
}

export const opening: {
  readonly incomplete: OpeningState['incomplete'];
  /** Called once from hooks.client `init`, after preferences.start(). Idempotent. */
  start(href: string): void;
  dismissIncomplete(): void;
  /** Real screen change (layout beforeNavigate): drops the incomplete notice. */
  screenChanged(): void;
};
export function resetOpeningForTests(): void;
```

`start(href)` flow:

1. `r = readReceivedLink(new URL(href), musicalOf(instrument.active))` (stored instrument;
   default instrument when nothing is stored).
2. `none` → return. `unknown-tool` → `incomplete = { screen: 'home' }`.
3. `tool` → `instrument.receive(tool, snapshot.instrument)`; then
   `notes.receive(view)` / `triads.receive(view)` / `caged.receive(view, snapshot.temporary)`;
   if `isIncomplete(r)` → `incomplete = { screen: tool }`.
4. Wrapped in `try`/`catch` with a non-empty catch that leaves the tool on its normal state and
   sets the incomplete notice (C-IX: never throw into the UI).

## 4. Tool store additions

| Store | Method | Behaviour |
|---|---|---|
| `notes.svelte.ts` | `receive(view: NotesViewState)` | `view = revalidate(view, instrument)`; no playback stop, no write; `preferredLabel` untouched |
| `triads.svelte.ts` | `receive(view: TriadsViewState)` | same; clears `notice` |
| `caged.svelte.ts` | `receive(view: CagedViewState, temporary: boolean)` | assign view; `temporary = temporary && tuningClass === 'non-compatible'`; clear transients; `settleLayers()` |

`revalidate` is idempotent on an already-valid view (022 decoder output), so this is a guard,
not a second clamp.

## 5. Notices (view model)

| Notice | Shown when | Text | Actions | Lifetime |
|---|---|---|---|---|
| Instrument | `override?.tool === tool && override.notice && !overrideDismissed` | `link_instrument({ tuning })` or, if `link.stringCount !== stored.stringCount`, `link_instrument_strings({ count, tuning })` | Use mine, Adopt this one, Dismiss | persistent; returns each visit while the override lasts |
| Incomplete link | `opening.incomplete?.screen === screen` | `link_incomplete()` | Dismiss | until dismissed or screen change |
| Nearest equivalent | `instrument.adjustedIn === tool` (existing) | `instrument_adjusted()` (existing) | Dismiss (existing) | existing rules |

`{tuning}`: preset → `tuningLabel(tuning)`; custom → `tuningStrings(tuning, count)` (lowest →
highest) mapped through `noteLabel()` and joined with a space. Re-derived from validated
pitches; never link text.

## 6. Entity map to spec

| Spec entity | Model |
|---|---|
| Received link | `URL` → `ReceivedLink` |
| Validated view | `ReceivedLink.snapshot.view` after store `receive` |
| Link instrument | `ReceivedLink.snapshot.instrument` (`LinkInstrument`) |
| Stored instrument | `instrument.active` (from `preferences.start()` or `DEFAULT_CONFIG`) |
| Session instrument override | `InstrumentOverride` |
| Notice | §5 |
