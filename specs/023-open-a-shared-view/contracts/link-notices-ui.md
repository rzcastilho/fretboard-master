# Contract: Link Notices UI

User-visible behaviour of the notices this slice adds. Components: `ToolLayout.svelte`,
`Notice.svelte` (extended), `TuningBadge.svelte`, `src/routes/[...unknown]/+page.svelte`.

## 1. Placement

- Both link notices render in `ToolLayout` between the header and `<main>`, in the same slot
  pattern as the share notice (`.share-notice` wrapper, design-token padding). Order: instrument
  notice first, incomplete-link notice second. Neither covers the fretboard (C-VII).
- On the unknown-tool home, the incomplete-link notice replaces the not-found notice in the
  `HomeScreen` `notice` snippet.

## 2. Instrument notice

| Aspect | Contract |
|---|---|
| Role | `role="status"`, `aria-live="polite"` (existing `Notice`) |
| Text | `link_instrument` / `link_instrument_strings` (data-model §5); ≤ 2 lines at 320 px and 200 % zoom in en, es, pt-BR |
| Actions | Buttons in DOM order: **Use mine**, **Adopt this one**, **Dismiss**; each ≥ `--target-min` (44 px) in both axes |
| Use mine | View recalculated on the stored instrument; notice gone; nearest-equivalent notice if adjusted; focus moves to the tool `h1` |
| Adopt this one | Instrument saved; notice gone; view unchanged; focus moves to the tool `h1` |
| Dismiss | Notice hidden for this visit; override kept; shown again next time the tool is displayed |
| Visibility | No auto-hide; no modal; not colored with error red (notice tokens only) |

`Notice.svelte` change: `action?: {label, onclick}` becomes `actions?: readonly {label,
onclick}[]` (existing single-action callers migrate), rendered before Dismiss.

## 3. Incomplete-link notice

| Aspect | Contract |
|---|---|
| Text | `link_incomplete` |
| Actions | Dismiss only |
| Lifetime | Until dismissed or the user leaves the screen it appeared on; never re-shown in the session |
| Count | Exactly one, however many values were replaced |

## 4. Tuning badge during an override

`TuningBadge` takes the current `tool` and labels `instrument.effectiveFor(tool).tuning`, so
the badge names the tuning actually drawn. Opening the panel from it still shows and edits the
stored instrument (data-model §2).

## 5. Accessibility and layout checks (e2e)

- axe: zero violations with both notices visible, phone and desktop profiles.
- Keyboard: Tab reaches Use mine → Adopt this one → Dismiss in order; Enter/Space activate.
- Screen reader: notice text is announced politely once on load.
- 320 px: no horizontal page scroll; buttons wrap below the text.
- No color-only meaning: actions are labelled buttons.
