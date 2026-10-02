# ADR 0011: Tool links carry context at activation

- **Status**: Accepted
- **Source**: research R-01, R-12 (spec 008-linked-tools)

## Context

Notes and Triads can hand context to each other: one selected note becomes the Triads root, the
main triad becomes the Notes selection, and a detected triad opens in Triads. A carry must happen
only when the learner activates a link that promises it. Back and Forward, home-screen cards,
typed or reloaded URLs and deep links must never carry (FR-006), and a reload must open a tool in
its initial state (FR-012). Principle IX forbids an unversioned link format.

## Decision

- **Carry at the activating control.** The carry is applied synchronously in the click handler of
  the control the learner activates, before SvelteKit navigates. The controls are the tool links
  of the persistent navigation (plain primary click on a different tool only) and the two Notes
  shortcuts (**View as triad**, **Triads from this note**), which apply the carry and then call
  `goto(resolve('/triads'))`.
- **One orchestrator.** `linkTools(from, to)` in `src/lib/state/links.svelte.ts` mutates the
  destination store, a module singleton, so the destination renders the carried context on its
  first render (FR-017).
- **Never from the URL, history or storage.** No query parameter, history state, session storage
  or pending intent carries context. The only navigation call is the single `goto` of a shortcut.
- **Modified clicks are skipped.** Ctrl/Meta/Shift/Alt, non-primary buttons and prevented events
  open a separate page load with fresh stores, so nothing carries.

## Consequences

- Back, Forward, reload, home-screen cards and "Continue" never carry. Without JavaScript the
  links still navigate and nothing carries, which is the correct degradation.
- Carry adds no history entries; only the screen change does (US5).
- **CAGED links (004-caged/006)** must use the same pattern: a carry function applied in the
  activating control's click handler, never a URL parameter or a read in `onMount`.
- **Share links** stay a separate, versioned format. This decision does not pre-empt them, and a
  shared link opens a tool in the state it encodes, not a carried one.

## Alternatives considered

- **Query parameter** (`/triads?root=A`): rejected. A reload, Back or shared URL would carry
  (violates FR-006 and FR-012), and it creates an unversioned link format (Principle IX).
- **`beforeNavigate` / `afterNavigate` with `navigation.type === 'link'`**: rejected. Home-screen
  cards and nav links are both `type: 'link'`, and it runs after the decision point, which makes
  first-render guarantees harder.
- **Pending intent read in the destination's `onMount`**: rejected. The destination renders once
  without the context (FR-017) and a stale intent survives Back.
