<!--
Sync Impact Report
- Version change: template (unversioned) → 1.0.0
- Modified principles: all template placeholders replaced
  - [PRINCIPLE_1..5] → I. Musical Correctness; II. On-Device, Static, Private by Design;
    III. Pure Core, Thin Shell; IV. Test-First for Logic, Tested Behavior for UI;
    V. Accessible by Default
- Added principles: VI. Performance Budgets Are Gates; VII. Design System Fidelity;
  VIII. International From the First Line; IX. Untrusted Input, Versioned Formats;
  X. Simplicity and Incremental Delivery
- Added sections: Technology Stack and Constraints; Development Workflow and Quality Gates;
  Governance (filled)
- Removed sections: none
- Templates: plan-template.md, spec-template.md, tasks-template.md read the constitution at
  runtime; no edits required (✅ not modified per scope guard)
- Deferred TODOs: none. Open product questions (Q-1 measurement, Q-4 sound source) are
  tracked in specs/autonomous/breakdown/README.md, not here.
-->

# Fretboard Master Constitution

## Core Principles

### I. Musical Correctness (NON-NEGOTIABLE)

- Every note, spelling, interval, inversion, and shape the product shows or plays MUST match
  `specs/autonomous/fretboard-master/11-music-theory-reference.md`, which is the single source
  of truth for theory.
- Triad spelling MUST use alternate letters, with whatever accidental reaches the exact
  interval, including double sharps and flats. C augmented is C–E–G♯, never C–E–A♭.
- Shapes (triads, CAGED occurrences, layers) MUST be calculated from the configured tuning,
  string count, and fret count. Hand-drawn or standard-tuning-only diagrams are forbidden.
- A change that touches theory code MUST NOT merge unless it passes:
  - table tests reproducing TM-4.2, TM-4.3, TM-5.5, TM-6, and TM-7;
  - property tests enforcing NFR-9.3 across randomly generated tunings (three adjacent
    strings, strictly rising pitch, span under one octave, correct pitch classes, correct bass
    note).
- Each note MUST sound at its calculated pitch.

Rationale: one enharmonic or shape error makes teachers stop recommending the product, and
correctness is its core promise.

### II. On-Device, Static, Private by Design

- All calculation, rendering, and sound MUST run in the browser. The server's only role is
  delivering static assets.
- Once loaded, no feature may depend on the network.
- The product MUST NOT have accounts, sign-up, or user identifiers, and MUST NOT collect
  personal data.
- The product MUST NOT load third-party trackers, ads, or executable content from other
  origins. The one exception is the anonymous-measurement service, if Q-1 adopts it.
- The product MUST NOT request device permissions (microphone, camera, location,
  notifications).
- Preferences MUST stay in the browser's local storage on the device and MUST be erasable by
  the user.
- Anonymous measurement, if adopted, MUST be cookieless and aggregate, carry no persistent
  identifier, and fail silently.

Rationale: C-2, NFR-1.5, NFR-5, and NFR-6. It also removes per-user cost and suits minors.

### III. Pure Core, Thin Shell

- `src/lib/theory` MUST be pure and deterministic. It MUST NOT import UI framework code, the
  DOM, i18n, storage, audio, or presentation concepts such as handedness and orientation. A
  lint rule MUST enforce this boundary.
- Data MUST flow in one direction: control action → view state → display model →
  fretboard render.
- Tools MUST NOT calculate theory or draw the fretboard directly.
- Handedness and string orientation MUST be applied only inside the fretboard renderer.
- The fretboard MUST report events in musical terms (string, fret), never screen
  coordinates.
- View state MUST live outside tool components, so that share links, context carry-over, and
  a future lesson layer can drive it.

Rationale: ARCH-2 to ARCH-6 and NFR-10. It keeps theory testable in isolation and reusable
for future tools.

### IV. Test-First for Logic, Tested Behavior for UI

- Theory, instrument, link codec, preferences, and notation modules MUST be built
  test-first: write the test, see it fail, implement, then refactor.
- Every acceptance scenario in a feature spec MUST become an automated test. Vitest covers
  units and components. Playwright covers user flows.
- The teacher-review sample views (TM-9) MUST exist as Playwright screenshot fixtures.
- Every bug fix MUST start with a failing test that reproduces the bug.
- Tests MUST be deterministic. Timing-dependent audio behavior MUST be tested through an
  injectable clock or audio context, not real time.

Rationale: correctness and "never blank" behavior can't be verified by hand across 12 roots ×
4 qualities × 3 inversions × every string set, tuning, and instrument.

### V. Accessible by Default (WCAG 2.2 AA)

- Every function MUST be keyboard-operable, including moving around the fretboard with arrow
  keys. Focus MUST be visible, the order logical, and there MUST be no focus traps.
- Information MUST NOT be conveyed by color alone:
  - note function by marker shape plus label;
  - emphasis by opacity plus size;
  - comparison by dashed outline plus arrow.
- Touch targets MUST be at least 44×44 CSS px in comfortable fretboard mode.
- Every fretboard view MUST have an equivalent text description, announced politely to screen
  readers.
- The product MUST honor `prefers-reduced-motion` and `prefers-contrast`.
- Sound MUST NOT be the only carrier of any information.
- Screen readers MUST read accidentals in full ("F sharp").
- Automated axe checks MUST report zero violations in CI.

Rationale: NFR-3 and the edge users E-1 to E-5. Accessibility built in later costs more and
gets done worse.

### VI. Performance Budgets Are Gates

On the reference device profile (throttled mid-range phone, median mobile network), CI MUST
enforce these budgets:

| Budget | Target |
|---|---|
| Home screen usable after opening | ≤ 3 s |
| Tool open or switch | ≤ 300 ms |
| Control change to fretboard update | ≤ 100 ms |
| Instrument change | ≤ 300 ms |
| Tap to sound, after audio unlock | ≤ 100 ms |
| Initial JavaScript, gzip | ≤ 80 KB |
| Lighthouse mobile performance score | ≥ 90 |

- Sound material MUST NOT block the fretboard from becoming interactive.
- Scrolling MUST stay smooth with 7 strings, 24 frets, and every CAGED layer on.
- A budget regression MUST fail the build.
- Raising a budget requires a constitution amendment.

Rationale: NFR-1 and NFR-7. Players use this on phones propped on amplifiers.

### VII. Design System Fidelity

- UI MUST follow `specs/autonomous/fretboard-master/12-design-and-experience.md`:
  - The fretboard is the protagonist. Controls surround it and never cover it.
  - Each tool opens in its simplest state, with advanced options off.
  - Main controls are never behind a menu.
- The note-function code is fixed product-wide:
  - root = filled rounded square;
  - third = filled circle;
  - fifth = filled diamond;
  - scale degree = small outlined circle.
- Root, third, and fifth colors MUST NOT be reused for any other purpose.
- Every visual value (color, spacing, type scale, radius, motion duration) MUST come from CSS
  design tokens. Hard-coded values in components are forbidden.
- Position state MUST be expressed only through the four emphasis levels: highlighted,
  normal, dimmed, hidden.
- Notices MUST be non-blocking, dismissible, and no longer than two lines. Modal dialogs are
  forbidden for normal situations. Error red MUST NOT be used for normal situations.
- The product MUST NOT include reward mechanics, confetti, mascots, overlay tutorials, or a
  photorealistic fretboard.
- Phone and desktop have equal priority. Every function MUST work from 320 to 2560 CSS px,
  and only the fretboard may scroll horizontally.
- Motion MUST explain change (only the note that changes moves) and stay within the
  documented durations.

Rationale: the teaching lives in the tools' design (spec 00 §4). A consistent visual code is
the product's pedagogy.

### VIII. International From the First Line

- Every user-facing string MUST live in the message catalog from the first commit, even while
  only English ships. Hard-coded UI text is forbidden.
- Note names MUST be produced only by `src/lib/notation`, which resolves letters or solfège
  and the accidental policy. Components MUST NOT format note names themselves.
- Accidentals MUST render as ♯ ♭ 𝄪 𝄫, never `#` or `b`, in every language.
- Layouts MUST handle the text-length differences between English, Portuguese, and Spanish,
  and browser text zoom up to 200%, without truncation or overlap.
- Adding a language MUST require only new catalog files, with no changes to logic.

Rationale: C-5 and NFR-4. Retrofitting i18n after 28 slices would touch every screen.

### IX. Untrusted Input, Versioned Formats

- Share links and stored preferences are untrusted. They MUST be parsed with schemas that
  check every field against allowed sets and ranges. Invalid fields fall back to defaults,
  valid fields are kept, and parsing MUST NOT throw into the UI.
- Share links and stored preferences MUST each carry a format version.
- Links produced by any released version MUST keep opening in later versions. A
  link-compatibility fixture suite MUST guard this, and fixtures are only ever added, never
  removed.
- Input-derived content MUST NOT be rendered as HTML or executed.

Rationale: NFR-6.2, NFR-6.3, NFR-10.2, FR-9.6, FR-10.7, and EC-10.1.

### X. Simplicity and Incremental Delivery

- Work MUST follow the wave order in `specs/autonomous/breakdown/` as vertical slices, and
  every wave MUST be shippable when it ends.
- A new abstraction MUST NOT be introduced before it has two real uses. Speculative
  configurability is forbidden (YAGNI).
- Runtime dependencies MUST be minimal. Every new one MUST be justified by size, license, and
  maintenance.
- Every failure MUST have a useful fallback view. When a choice becomes impossible, the
  system adopts the nearest equivalent and states the change in one line ("never blank;
  adjust and tell").

Rationale: small, shippable increments keep feedback fast and the bundle small.

## Technology Stack and Constraints

| Concern | Mandated choice |
|---|---|
| Language | TypeScript with `strict: true`. No `any`. Non-null `!` only with a comment |
| UI framework | Svelte 5 (runes) + SvelteKit with `adapter-static` (prerendered, SPA fallback) |
| Build | Vite, through SvelteKit |
| Fretboard rendering | Inline SVG, one shared component |
| Audio | Web Audio API. Synthesized plucked string (Karplus-Strong or AudioWorklet) in `src/lib/audio`. Unlocked on the first user gesture |
| i18n | Paraglide JS (compiled, tree-shaken message catalogs in `messages/`) |
| Validation | Valibot schemas for share links and preferences |
| State | Svelte runes-based stores in `src/lib/state` |
| Storage | `localStorage` behind `src/lib/prefs`. Every access wrapped, storage failures tolerated |
| Styling | Plain CSS with custom-property design tokens. Media queries for theme, reduced motion, contrast, print |
| Fonts | Self-hosted, tabular numerals, glyph coverage for ♯ ♭ 𝄪 𝄫 |
| Unit and property tests | Vitest + fast-check |
| E2E and accessibility | Playwright (phone and desktop profiles) + @axe-core/playwright |
| Performance | Lighthouse CI with budgets, plus a bundle-size check |
| Lint and format | ESLint (with import-boundary rules) + Prettier + `svelte-check` |
| Package manager | pnpm (lockfile committed) |
| CI | GitHub Actions |
| Hosting | Cloudflare Pages: static, atomic zero-downtime deploys, HTTPS, PR previews |
| Browsers | Last two major versions of the evergreen browsers, desktop and mobile |

- **Source layout:**
  - `src/lib/{theory,instrument,audio,fretboard,state,link,prefs,notation}`
  - `src/routes` (`/`, `/notes`, `/triads`, `/caged`, `/about`)
  - `messages/`, `tests/`, `e2e/`, `docs/adr/`
- **Dependency licenses:** runtime dependencies MUST use MIT-, Apache-2.0-, or BSD-compatible
  licenses.
- **Changing the stack:** replacing a mandated choice requires an ADR and a MINOR
  constitution amendment.

## Development Workflow and Quality Gates

- **Spec Kit flow per slice:** `/speckit.specify` → `/speckit.clarify` (when ambiguity
  remains) → `/speckit.plan` → `/speckit.tasks` → `/speckit.implement`. The plan MUST include
  a Constitution Check against every principle.
- **Branching:** trunk-based. Short-lived feature branches named after the spec (`NNN-slug`)
  merge into `main` through pull requests. Direct pushes to `main` are forbidden.
- **Commits:** MUST follow Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`,
  `refactor:`, `chore:`).
- **Merge gate:** every item MUST pass in CI.
  - Typecheck, `svelte-check`, lint (including import boundaries), format check.
  - Vitest with at least 95% line and branch coverage on `src/lib/theory`, and at least 80%
    overall.
  - Playwright on a phone profile (360 px) and a desktop profile, with zero axe violations.
  - Lighthouse budgets and bundle-size check (Principle VI).
- **Review:** at least one approving review. Reviewers MUST check principle compliance and
  that the change delivers the spec's acceptance scenarios, no more and no less.
- **Code quality:**
  - Small single-purpose modules, and pure functions in the core.
  - Exported functions have explicit return types. Names use the spec's domain vocabulary
    (root, inversion, string set, shape, layer).
  - No dead code or commented-out code.
  - Comments explain *why*, not *what*.
  - The core returns typed results rather than throwing for expected failures. Errors are
    handled at UI boundaries with a fallback view.
  - Empty `catch` blocks are forbidden, except for the fire-and-forget storage and
    measurement writes the spec requires, which MUST carry a comment saying so.
- **Decisions:** architecturally significant decisions MUST be recorded as ADRs in
  `docs/adr/NNNN-title.md`.
- **Releases:** semantic versions tagged on `main`, with the version shown on the About page.
  Every PR gets a preview deployment.
- **Pre-launch gates** (before public launch, not per PR):
  - Two independent guitar teachers review the TM-9 sample (metric M-4).
  - Native-speaker musicians review the Portuguese and Spanish glossaries.
  - Legal review of privacy obligations (Q-11).

## Governance

- **Precedence:** this constitution takes priority over all other practices and guidance.
- **Violations:** a spec, plan, or change that violates a principle MUST either change, or
  record the violation and its justification in the plan's Complexity Tracking table and get
  explicit reviewer approval.
- **Amendments:** made by pull request that edits this file, includes a Sync Impact Report,
  and updates dependent guidance.
- **Versioning:** follows semantic versioning.
  - MAJOR: removing or redefining a principle.
  - MINOR: adding a principle or section, or materially expanding guidance (including stack
    changes).
  - PATCH: clarifications and wording.
- **Compliance review:** checked in every `/speckit.plan` Constitution Check and every PR
  review, plus a full compliance review at the end of each delivery wave.
- **Runtime guidance:** day-to-day development guidance for agents and humans lives in
  `CLAUDE.md` at the repository root. It MUST NOT contradict this constitution.

**Version**: 1.0.0 | **Ratified**: 2026-09-30 | **Last Amended**: 2026-09-30
