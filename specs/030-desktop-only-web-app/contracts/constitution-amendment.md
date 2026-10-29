# Contract: Constitution Amendment 1.12.0 → 2.0.0 (030)

Target text for `.specify/memory/constitution.md`. Implementation copies these clauses; wording
may be polished, meaning may not change.

## Sync Impact Report (prepend; current report moves into "Prior amendments")

- Version change: 1.12.0 → 2.0.0 (MAJOR: Principle VII redefined from phone-and-desktop equal
  priority to a desktop-only target; Principle V's touch-target rule redefined; Principle VI's
  reference profile redefined).
- Reason: the owner targets desktop and laptop browsers only (slice 030). Phone-only behaviors
  (rotate hint, phone-landscape and medium arrangements, pinch sizing, safe areas) are removed.
- Modified principles: V (touch targets → WCAG 2.2 SC 2.5.8; reflow to 320 CSS px under zoom
  kept), VI (desktop reference profile, Lighthouse desktop preset, Home ≤ 3 s, tool ≤ 3.5 s,
  score ≥ 90; other rows unchanged), VII (window widths 1024–2560 CSS px, zoom reflow below).
- Modified sections: Technology Stack (E2E row, Browsers row), Development Workflow and Quality
  Gates (merge gate, verification tiers).
- Added / removed sections: none.
- Dependent guidance updated: `CLAUDE.md`, `playwright.config.ts`, `pw.local.config.ts`,
  `lighthouserc.cjs`, `.github/workflows/update-snapshots.yml`,
  `specs/autonomous/fretboard-master/{00,01,02,03,06,08,09,12}-*.md`, `docs/adr/0023-*`,
  `docs/adr/0029-desktop-only-target.md` (new).

## Principle V — replace the touch-target bullet

> - Interactive targets MUST meet WCAG 2.2 SC 2.5.8 (Target Size, Minimum).
> - Below 1024 CSS px (browser zoom or a narrow window), content MUST reflow to one column down
>   to 320 CSS px with no horizontal page scrolling; only the fretboard may scroll horizontally
>   (WCAG 2.2 SC 1.4.10).

## Principle VI — replace the opening line, table rows, and rationale

> On the desktop reference profile (mid-range laptop on typical broadband: Lighthouse `desktop`
> preset), CI MUST enforce these budgets:

| Budget | Target |
|---|---|
| Home screen usable after opening | ≤ 3 s |
| Tool screen usable after opening | ≤ 3.5 s |
| Tool open or switch | ≤ 300 ms |
| Control change to fretboard update | ≤ 100 ms |
| Instrument change | ≤ 300 ms |
| Tap to sound, after audio unlock | ≤ 100 ms |
| Initial JavaScript, gzip | ≤ 150 KB |
| Lighthouse desktop performance score | ≥ 90 |
| Cumulative layout shift | ≤ 0.1 |

> Rationale: NFR-1 and NFR-7. Players use this on a laptop beside the instrument; a slow first
> screen loses them before the first note.

## Principle VII — replace the device bullet

> - The product targets desktop and laptop browsers. Every function MUST work in windows from
>   1024 to 2560 CSS px wide, with no truncation or overlap, and only the fretboard may scroll
>   horizontally. Below 1024 CSS px the zoom reflow of Principle V applies. Phones are not
>   supported but MUST NOT be blocked.

## Technology Stack table

| Concern | New text |
|---|---|
| E2E and accessibility | Playwright (desktop profile, plus Firefox and WebKit smoke and no-JS) + @axe-core/playwright |
| Browsers | Last two major versions of the evergreen desktop browsers |

## Merge gate and verification tiers

- Merge gate Playwright bullet: "Playwright on the desktop profile, at 1024 px, 2560 px and the
  zoom reflow sizes, with zero axe violations."
- Screenshot bullet: "Screenshot baselines are generated for the `desktop` project only, and
  only for the snapshot tests a task adds or changes (filtered with `-g`)."
- CI matrix bullet: "CI runs the full matrix (desktop, Firefox and WebKit smoke, no-JS,
  Lighthouse)."

## Footer

`**Version**: 2.0.0 | **Ratified**: 2026-09-30 | **Last Amended**: <merge date>`
