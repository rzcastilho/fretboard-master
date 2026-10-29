# Feature Specification: Desktop-Only Web Application

**Feature Branch**: `030-desktop-only-web-app`

**Created**: 2026-10-29

**Status**: Draft

**Input**: User description: "Convert this application to works only as a web/desktop application, eliminating all possible restriction to keep it compatible with small devices, make all necessary ammends including constitution."

## Context

Fretboard Master was built with phone and desktop at equal priority: every function had to work
from 320 to 2560 CSS px wide, in portrait and landscape, with touch-sized targets, a phone
reference device for performance, and dedicated phone behaviors (a rotate hint, a phone-landscape
arrangement, a pinch gesture, narrow and medium arrangements, safe-area handling). The owner now
targets desktop and laptop browsers only. This slice removes the obligations and behaviors that
exist only to serve small devices, and amends the governing documents so later slices are no
longer held to them.

## Clarifications

### Session 2026-10-29

- Q: What is the narrowest desktop browser window the product must fully support? → A: 1024 CSS px.
- Q: When a desktop user zooms the browser far in, so the page is effectively narrower than 1024 px, should the content still rearrange to fit the width without sideways scrolling? → A: Yes. Keep reflow down to 320 CSS px (full WCAG 2.2 AA); only the fretboard may scroll horizontally.
- Q: When speed is measured on a laptop profile instead of a throttled phone, what should happen to the speed targets? → A: Tighten: Home usable ≤ 3 s, tool usable ≤ 3.5 s, performance score ≥ 90; every other budget row unchanged.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Desktop player uses every tool in one wide layout (Priority: P1)

A guitarist on a laptop or desktop browser opens Home, Notes, Triads, CAGED and About. Each
screen uses one desktop arrangement: the fretboard is the protagonist, controls sit beside or
around it, and nothing is rearranged for a phone. Every function works by mouse and keyboard.

**Why this priority**: this is the product's only audience after the change. If the desktop
experience is intact while the phone-only arrangements are gone, the slice has delivered its
value.

**Independent Test**: open each route at the supported desktop window sizes, exercise each tool's
main controls by mouse and by keyboard, and confirm the result matches today's desktop behavior.

**Acceptance Scenarios**:

1. **Given** a desktop browser window at the minimum supported width, **When** the user opens any
   tool, **Then** every control is visible without opening a menu, nothing overlaps or truncates,
   and only the fretboard scrolls horizontally.
2. **Given** a desktop browser window at 2560 px wide, **When** the user opens any tool, **Then**
   the layout uses the desktop arrangement and every function is available.
3. **Given** any tool, **When** the user operates it with the keyboard alone, **Then** every
   function remains reachable, with visible focus and logical order, exactly as before.
4. **Given** the user resizes the window between the minimum supported width and 2560 px,
   **When** the layout adapts, **Then** it switches only between desktop arrangements, never to a
   phone arrangement.

---

### User Story 2 - Phone-only behaviors no longer appear (Priority: P1)

Behaviors that exist only for small or touch-first devices are removed: the rotate-your-phone
hint, the phone-landscape arrangement, the medium arrangement, the two-finger pinch
that switches fretboard sizing, and screen safe-area padding for notches and system bars.

**Why this priority**: removing them is the substance of the request. It also lowers the cost of
every future slice, which no longer has to design, test and screenshot a phone variant.

**Independent Test**: confirm that none of the removed behaviors can be triggered at any window
size, and that no automated check still exercises a phone profile.

**Acceptance Scenarios**:

1. **Given** any window shape, including one taller than wide, **When** a tool opens, **Then** no
   rotate hint appears.
2. **Given** a window shorter than it is wide, **When** a tool opens, **Then** the regular desktop
   arrangement is used, not a phone-landscape arrangement.
3. **Given** a touchscreen laptop, **When** the user pinches on the fretboard, **Then** fretboard
   sizing does not change through that gesture. The on-screen fit control still toggles sizing.
4. **Given** a single tap or click on a fretboard position, **When** the user taps it on a
   touchscreen laptop, **Then** it behaves exactly as a mouse click.

---

### User Story 3 - Governing documents reflect the desktop-only target (Priority: P2)

A contributor starting the next slice reads the constitution and the product specification and
finds a desktop-only target: no phone width range, no phone reference device, no touch-target
size rule beyond the accessibility standard, and no phone profiles in the merge gate.

**Why this priority**: without the amendments, every later plan's compliance check would still
demand phone support, and the removal would be reverted or flagged as a violation.

**Independent Test**: review the amended constitution and product specification. No clause still
requires a phone width, phone orientation, phone performance profile or phone test profile, and
the amendment record explains the change and its version bump.

**Acceptance Scenarios**:

1. **Given** the amended constitution, **When** a reviewer reads the design, accessibility,
   performance and quality-gate sections, **Then** they name a desktop window-width range, a
   desktop reference profile and desktop-only test profiles.
2. **Given** the amended constitution, **When** a reviewer reads its amendment record, **Then** it
   states the version change, the reason, the principles touched, and the dependent guidance
   updated.
3. **Given** the product specification documents, **When** a reviewer searches them for
   requirements that only serve phones (width from 320, portrait and landscape, safe areas,
   reference phone, phone-first personas or journeys), **Then** each is removed or restated for
   desktop, with a note recording the change.
4. **Given** the agent guidance file, **When** a contributor reads the verification table,
   **Then** it no longer instructs them to generate phone screenshot baselines.

---

### User Story 4 - Existing links and preferences keep working (Priority: P2)

Someone who saved preferences or created a share link on a phone before this change later opens
the product on a desktop browser. Their link opens the same view, and their saved preferences
load, without errors or blank screens.

**Why this priority**: the constitution's compatibility promise for released links and stored
preferences is unconditional, and the removal must not break it.

**Independent Test**: open every existing link-compatibility fixture and a set of preference
records saved by earlier versions, including ones that recorded the rotate hint as seen. Each
loads with the expected view.

**Acceptance Scenarios**:

1. **Given** a share link produced by any released version, **When** it opens on a desktop
   browser, **Then** it shows the same view as before the change.
2. **Given** stored preferences that include the now-unused rotate-hint record, **When** the
   product starts, **Then** every other preference loads and the unused record causes no error or
   notice.

---

### User Story 5 - Small screens are not supported, but not blocked (Priority: P3)

A visitor opens the product on a phone or in a very narrow window. The product does not refuse
to load and does not show a blocking screen. It gets the zoom reflow arrangement (FR-011), the
same one a zoomed-in desktop user sees, with no phone-specific tuning and no promise that it is
comfortable to use on a phone.

**Why this priority**: the product stays a public web page, so a phone visit will happen. A
predictable best-effort outcome is enough, and it costs nothing to keep.

**Independent Test**: open each route in a window narrower than the minimum supported width and
confirm the page loads, no content is clipped beyond reach, and no blocking dialog appears.

**Acceptance Scenarios**:

1. **Given** a window narrower than the minimum supported width, **When** any route opens,
   **Then** the page loads in the zoom reflow arrangement and all content is reachable, with only
   the fretboard scrolling horizontally.
2. **Given** a window narrower than the minimum supported width, **When** any route opens,
   **Then** no modal or blocking message prevents use.

### Edge Cases

- **Browser zoom on desktop**: page zoom shrinks the effective CSS width below the minimum
  supported width (for example 400% zoom on a 1280 px window gives 320 CSS px). The product must
  reflow into the single-column zoom arrangement down to 320 CSS px; see FR-011.
- **Text zoom up to 200%**: layouts must still avoid truncation and overlap in English,
  Portuguese and Spanish at the minimum supported width.
- **Touchscreen laptops and tablets with a keyboard**: tap acts as click; no gesture-only
  function exists, so nothing is lost when touch-specific gestures are removed.
- **Window shorter than wide but tall enough** (a wide, short desktop window): uses the desktop
  arrangement; the fretboard remains fully visible or scrolls horizontally only.
- **Print**: the print layout is unaffected; it never depended on phone arrangements.
- **Anonymous measurement**: visits from phones may still arrive. Recording a coarse device class
  stays as it is, so the owner can see how many visitors fall outside the supported target.
- **Shared links that were created while the fretboard was in whole-neck sizing**: sizing is not
  part of a link, so nothing changes.

## Requirements *(mandatory)*

### Functional Requirements

**Layout and interaction**

- **FR-001**: The product MUST present one family of desktop arrangements for every route, at
  every window width from the minimum supported width (FR-010) to 2560 CSS px.
- **FR-002**: The product MUST NOT switch to a phone, medium or phone-landscape arrangement at
  any window size or shape. The only arrangement below 1024 CSS px is the zoom reflow
  arrangement (FR-011).
- **FR-003**: The rotate-your-device hint MUST be removed, along with every rule that decides when
  it appears.
- **FR-004**: The two-finger pinch gesture on the fretboard MUST be removed. The visible fit
  control MUST remain the way to switch between comfortable and whole-neck sizing.
- **FR-005**: Screen safe-area padding for notches, rounded corners and system bars MUST be
  removed.
- **FR-006**: A tap on a touchscreen MUST continue to behave as a mouse click. No function may be
  reachable only by a touch gesture.
- **FR-007**: Interactive targets MUST meet the accessibility standard's minimum target size, and
  the phone-specific 44×44 px requirement for comfortable fretboard mode MUST be dropped.
- **FR-008**: Below the minimum supported width, the product MUST still load every route, keep
  all content reachable, and MUST NOT show a blocking screen or modal.
- **FR-009**: Every function, keyboard operation, screen-reader description, theme, motion,
  contrast and print behavior that exists today on desktop MUST keep working unchanged.
- **FR-010**: The minimum supported window width MUST be 1024 CSS px. From 1024 to 2560 CSS px
  every function MUST work with no truncation or overlap.
- **FR-011**: Whenever the effective width is below 1024 CSS px (browser zoom, or a narrow
  window), the product MUST reflow into one single-column zoom reflow arrangement down to
  320 CSS px, meeting the WCAG 2.2 AA reflow criterion: every function available, no truncation
  or overlap, and no horizontal page scrolling. Only the fretboard may scroll horizontally. This
  arrangement exists for accessibility, not for phones: it gets no orientation handling, safe
  areas, gestures or phone screenshot baselines. It is verified on desktop by zooming a 1280 px
  window to 400% (and 200%).

**Compatibility**

- **FR-012**: Share links produced by any released version MUST keep opening with the same view.
  The link-compatibility fixtures MUST all still pass; none may be removed.
- **FR-013**: Stored preferences written by earlier versions, including the rotate-hint record,
  MUST load without error. Unused fields MUST be ignored silently.
- **FR-014**: The share-link and preference formats MUST NOT lose any field that a desktop view
  still uses.

**Verification**

- **FR-015**: Automated checks MUST stop running phone and phone-touch profiles. Tests,
  screenshot baselines and fixtures that exist only to verify phone behaviors MUST be removed.
- **FR-016**: Automated checks MUST cover the desktop profile at the minimum supported width and
  at a wide width, plus the existing cross-browser smoke and no-script checks.
- **FR-017**: Performance budgets MUST be measured on a desktop reference profile (a mid-range
  laptop on a typical broadband connection) instead of a throttled phone on a mobile network.
  The performance score gate MUST use the desktop scoring profile.
- **FR-018**: On the desktop reference profile the budgets MUST be: Home screen usable after
  opening ≤ 3 s; tool screen usable after opening ≤ 3.5 s; performance score ≥ 90. Every other
  budget (tool open or switch, control change to fretboard update, instrument change, tap to
  sound, initial download size, layout shift) MUST keep its current value. These values MUST be
  recorded in the constitution amendment.

**Governing documents**

- **FR-019**: The constitution MUST be amended so that:
  - the design principle replaces "phone and desktop have equal priority, 320 to 2560 px" with
    the desktop width range (FR-010 to 2560 px);
  - the accessibility principle drops the 44×44 px touch-target rule in favor of the standard's
    target-size criterion, and keeps reflow to 320 CSS px under zoom (FR-011) with no
    accessibility exception;
  - the performance principle names the desktop reference profile and its scoring profile,
    sets the FR-018 values, and its rationale no longer cites phones on amplifiers;
  - the quality gates and verification tiers list desktop-only test profiles;
  - the technology table's browser row covers desktop evergreen browsers only;
  - the amendment record states the version change, which follows the constitution's own
    versioning rule (a redefined principle is a MAJOR change), the reason, the principles
    touched, and the dependent guidance updated.
- **FR-020**: The product specification documents MUST be amended where they require phone
  support: width and orientation ranges, safe areas, the reference phone, touch-only gestures,
  and phone-centered personas, journeys and edge cases. Each change MUST carry a short note
  pointing to this slice.
- **FR-021**: The agent guidance file MUST be updated to remove phone screenshot-baseline
  instructions and any other phone-profile guidance, so it does not contradict the amended
  constitution.
- **FR-022**: Architecture decision records whose decisions exist only to serve phones (for
  example the adaptive phone-landscape arrangement and the pinch gesture) MUST be marked as
  superseded by a new decision record for this slice. Records are superseded, not deleted.
- **FR-023**: The About page MUST not claim phone support. Any user-facing text that refers to
  phones, rotating the device or pinching MUST be removed from every language catalog.

### Key Entities

- **Arrangement**: the way a screen lays out the fretboard and controls for a window size. After
  this slice only desktop arrangements (1024 CSS px and up) and the single-column zoom reflow
  arrangement (below 1024 CSS px) exist.
- **Stored preferences record**: the versioned record kept in the browser. Keeps loading records
  from earlier versions; the rotate-hint field becomes unused.
- **Share link**: the versioned view address. Unchanged in content; must keep opening.
- **Reference profile**: the device and network on which performance budgets are measured.
  Changes from a mid-range phone to a mid-range laptop.
- **Constitution amendment record**: the version change, reason, principles touched, and
  dependent guidance updated.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the current desktop acceptance scenarios across all routes still pass after
  the change.
- **SC-002**: 0 phone-only behaviors (rotate hint, phone-landscape arrangement, medium arrangement,
  pinch sizing, safe-area padding) can be triggered at any window size.
- **SC-003**: 100% of the link-compatibility fixtures, and preference records from every earlier
  format version, open without error.
- **SC-004**: The automated check matrix runs no phone profile, and a full check run takes at
  least 30% less time than before the change.
- **SC-005**: Accessibility checks report zero violations on every route at 1024 px, at 2560 px,
  and on a 1280 px window zoomed to 400%.
- **SC-006**: On the desktop reference profile, Home is usable within 3 s, every tool screen
  within 3.5 s, every route scores at least 90, and every other budget passes at its current
  value.
- **SC-007**: A search of the constitution, the product specification, and the agent guidance
  finds 0 remaining requirements for phone widths, orientations, reference phones, touch-target
  sizes beyond the accessibility standard, or phone test profiles, other than notes recording
  this change.
- **SC-008**: On a 1280 px window zoomed to 400% (320 CSS px effective), every route reflows with
  0 horizontal page scrolling outside the fretboard, 0 truncated or overlapping controls, and no
  blocking message.

## Assumptions

- "Web/desktop application" means a website used in desktop and laptop browsers. It does not
  mean an installable native desktop package; packaging is out of scope.
- Phones and small tablets are not blocked. They are unsupported and get the zoom reflow arrangement on
  a best-effort basis (User Story 5).
- Touchscreen laptops keep working because tap acts as click; only touch-specific gestures go.
- The fit control (comfortable and whole-neck sizing) and the minimap stay, because a desktop
  window can still be narrower than a 24-fret neck.
- The anonymous-measurement device class stays unchanged, so the owner can see visits from
  outside the supported target. Its wire format does not change.
- The initial JavaScript budget stays at its current value; removing phone code should only lower
  the bundle.
- Musical correctness, privacy, internationalization, untrusted-input and simplicity principles
  are untouched.
- Hosting, deployment and the static, on-device architecture are unchanged.
