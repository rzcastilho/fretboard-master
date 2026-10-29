# ADR 0029: Desktop-only target

- **Status**: Accepted
- **Source**: spec 030-desktop-only-web-app
- **Supersedes**: ADR 0023 (landscape arrangement and pinch sections)

## Context

On 2026-10-29 the owner decided that the product targets desktop and laptop browsers only.
Phone-specific behavior (rotate hint, phone-landscape and medium arrangements, pinch sizing,
safe-area padding) added code, tests and a three-profile test matrix for an audience the product
no longer serves.

## Decision

- Arrangements collapse to `reflow` (below 1024 CSS px, reached by zoom or a narrow window),
  `wide-side` and `wide-stacked` (1024 CSS px and above), as specified in
  `specs/030-desktop-only-web-app/contracts/ui-arrangements.md`. Height is not an input.
- The pinch gesture, the CAGED rotate hint, the landscape side panels and the safe-area padding
  are removed.
- Lighthouse runs with the `desktop` preset; budgets become Home ≤ 3 s, tool screens ≤ 3.5 s,
  performance score ≥ 90 (constitution 2.0.0, Principle VI).
- Playwright keeps one `desktop` project for the full suite, plus Firefox and WebKit smoke and
  the no-JS run. The phone and phone-touch projects are deleted.

## Consequences

- A smaller test and screenshot matrix, and less layout code to maintain.
- Reflow to 320 CSS px under zoom stays, because WCAG 2.2 SC 1.4.10 still applies.
- Phones are best effort: they are not blocked and nothing is tested for them.
- Stored preferences carrying the old `rotateHint` field still parse (format version stays 1).
