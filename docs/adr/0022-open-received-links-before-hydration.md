# ADR 0022: Open received links before hydration

- **Status**: Accepted
- **Source**: spec 023-open-a-shared-view (research R-01, R-03, R-04)

## Context

A link made by slice 022 must open the exact view it describes for the person who receives it.
"Opening a link" means a full page load on a tool path with a non-empty query. The first frame
the person sees must already be the shared view, with no flash of the default view and no
side effect inside the 300 ms tool-open budget. The link may carry an instrument that differs
from the receiver's stored one, and opening it must never overwrite what the receiver saved.

## Decision

- **Apply the link in `src/hooks.client.ts` `init`, before hydration.** A new
  `opening.start(location.href)` call runs right after `preferences.start()`. `init` runs once
  per full page load and never on client-side navigation, so AppNav, Back and Forward keep
  today's behaviour without an extra check. `openToolAddress(tool)` in `ToolLayout`'s `onMount`
  then replaces the address with the canonical link of the state actually shown, with no new
  history entry. Applying inside `onMount` or a `+page.ts` `load` was rejected: it flashes the
  default view first, and prerendering forbids reading the query in `load`. (R-01)
- **The session instrument override lives in the instrument store.**
  `src/lib/state/instrument.svelte.ts` gains
  `override: { tool, link, notice } | null` with `receive`, `useMine`, `adopt` and
  `effectiveFor(tool)`. Only the opened tool's store takes the link instrument; the other tools
  keep the stored one. Nothing is written to storage while the override is active. `adopt()`
  reuses the confirm path's persistence through one private `persist(config)` helper, so
  "Adopt this one" writes exactly as the instrument panel does (ADR 0012). A separate override
  store was rejected: it needs an import cycle with the instrument store. (R-03)
- **Any confirmed change ends the override.** `confirm()` with `result.changed`, including a
  presentation-only change (handedness, orientation), and `restore()` (startup, erase) clear the
  override before applying the stored instrument to every tool. Cancel or a no-change Confirm
  keeps it. The panel shows and edits the stored instrument. "Instrument differs" means a
  different string count or a tuning that is not equal after canonicalization (ADR 0014,
  ADR 0015); a fret-count-only difference is a silent override with no notice. (R-04)

## Consequences

- The opened view appears on the first frame, and the receiver's stored instrument and
  preferences are untouched until they choose "Adopt this one" or confirm a change themselves.
- Leaving the tool and coming back keeps the override, because nothing re-applies an instrument
  on navigation.
- The decoder ships in the initial bundle (ADR 0002), which is why constitution 1.9.0 raises the
  initial JavaScript cap to 128 KB.
- The rule "any confirmed change ends the override" is simple and can never leave the opened
  tool on a foreign instrument after the receiver configures their own.

## Alternatives considered

- **Apply inside `openToolAddress` (the slice 022 seam)**: flash of the default view and one more
  reactive pass inside the tool-open budget.
- **`+page.ts` `load` reading `url.searchParams`**: forbidden while prerendering, and `load`
  re-runs on client navigation, which must not re-apply links.
- **Write the link instrument into `instrument.active` and restore it later**: breaks "other
  tools keep the stored instrument" and risks a stray write through any confirm.
- **End the override only on a musical change**: needs a second code path in `confirm` for a rare
  case.
