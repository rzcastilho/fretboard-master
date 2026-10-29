# Contract: Product Specification, ADR and Guidance Edits (030)

Each edited clause ends with `*[Changed by slice 030: desktop-only target.]*`. Removed clauses
are replaced by that note alone, so IDs stay stable for cross-references.

## Product specification (`specs/autonomous/fretboard-master/`)

| File | Clause | Edit |
|---|---|---|
| `00-overview.md` | M-7 (phone sessions metric) | Remove |
| `00-overview.md` | C-4 | "Desktop and laptop browsers are the target; every function works from 1024 to 2560 CSS px." |
| `01-personas-and-jobs.md` | Persona context "phone propped on the amplifier" | Laptop on a desk or stand beside the instrument |
| `01-personas-and-jobs.md` | Persona context "phone at rehearsal" | Remove the phone clause |
| `01-personas-and-jobs.md` | E-5 (small phone, 320) | Restate: user zoomed to 400 % (320 CSS px); no feature lost, fretboard scrolls horizontally |
| `02-user-journeys.md` | Step "opens the link on a phone" | "opens the link on another computer" |
| `03-functional-requirements.md` | FR-3.19 (rotate to landscape) | Remove |
| `06-non-functional-requirements.md` | Reference phone definition, NFR-1.1, NFR-1.6, NFR-1.7 | Desktop reference profile (Lighthouse desktop preset); NFR-1.1 Home ≤ 3 s; "follow the pointer"; "typical broadband" |
| `06-non-functional-requirements.md` | NFR-2.1 | Desktop browsers only |
| `06-non-functional-requirements.md` | NFR-2.2 | 1024–2560 CSS px; zoom reflow to 320 CSS px; no orientation clause |
| `06-non-functional-requirements.md` | NFR-2.5 (safe areas) | Remove |
| `06-non-functional-requirements.md` | NFR-3.5 (44 × 44) | WCAG 2.2 SC 2.5.8 target size; whole-mode small-target notice kept |
| `08-edge-cases-and-error-handling.md` | EC-3.5 (pinch) | Remove |
| `08-edge-cases-and-error-handling.md` | EC-3.6 (320-wide screen) | "1024-wide window" |
| `09-assumptions-and-open-questions.md` | "Devices" row | Desktop and laptop browsers |
| `09-assumptions-and-open-questions.md` | A-12 reference phone | Desktop reference profile |
| `12-design-and-experience.md` | Marker-label legibility "on a phone" | "at normal viewing distance" |
| `12-design-and-experience.md` | §5.1 breakpoint table | Rows: Reflow (< 1024, zoom only), Wide (≥ 1024, side or stacked) |
| `12-design-and-experience.md` | §5.2 Phone in portrait, §5.3 Phone in landscape | Remove sections (heading kept with the note) |
| `12-design-and-experience.md` | Touch targets "320-wide screen, two rows of six" | Target size per NFR-3.5; note selector wraps in reflow |

Not edited: `04-data-model.md` device-class values (measurement unchanged), microphone lines
(permissions, unrelated), `11-music-theory-reference.md`.

## ADRs (`docs/adr/`)

- New `0029-desktop-only-target.md`: Context (owner decision, 2026-10-29), Decision (arrangements
  per `ui-arrangements.md`, pinch/rotate/safe-area removal, desktop Lighthouse preset, projects),
  Consequences (smaller test matrix, reflow still WCAG; phones best effort), Supersedes: 0023
  (landscape arrangement and pinch sections).
- `0023-fit-mode-and-adaptive-arrangement.md`: status "Partially superseded by 0029 (landscape
  arrangement, pinch)". Body untouched.
- `0001`, `0005`, `0025`: check the phone mentions while editing; add a superseded line only if a
  decision (not just an example) exists for phones.

## Agent guidance (`CLAUDE.md`)

- Screenshot row: `pnpm playwright test <spec> -g "<test name>" --project=desktop --update-snapshots`.
- `test:e2e` warning line: "(full desktop, Firefox, WebKit, no-JS matrix)".

## User-facing catalogs (`messages/{en,pt-BR,es}.json`)

Delete `caged_rotate_hint`, `panels_open`, `panels_close`, `panels_region`. The About page has no
phone claim today; `about_*` strings are unchanged. "tap" / "toque" wording is left: it stays
accurate on touchscreen laptops and is not a phone claim.
