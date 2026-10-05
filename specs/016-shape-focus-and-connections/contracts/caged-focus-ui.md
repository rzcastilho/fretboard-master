# Contract: CAGED focus and connections — user interface

Observable contract for users and assistive technology. Playwright and component tests assert
against it. Strings refer to `messages/en.json` keys (Principle VIII).

## Zone B — Shape selector

- **Structure**: a `ChoiceGroup` (`role="radiogroup"`) labelled `caged_group_shape`
  ("Shape"). Six radios, in order: `C`, `A`, `G`, `E`, `D`, then `caged_shape_all`
  ("See all").
- **Checked radio**: the focused letter, or **See all** when nothing is in focus.
- **Undrawn letter**: `aria-disabled="true"`. It stays focusable, arrow keys skip it, and
  activating it does nothing.
- **Already-checked option**: choosing it does nothing.
- **Non-compatible tuning**: the whole group is `aria-disabled`.
- **Layout**: the selector sits below the Quality group and above the key heading.

## Zone C — Fretboard

- **Tags**: buttons with `aria-pressed` and an accessible name equal to the visible tag text,
  e.g. "E shape · roots on strings 6, 4, 1". Pressed means "this occurrence is in focus".
  - DOM and Tab order is neck order (lowest start fret first).
  - Size is at least 44×44 CSS px.
  - Activating the pressed tag leaves focus.
- **Markers** (inside `.markers`): class `highlighted`, `normal` or `dimmed` per the
  data-model §4 rule.
- **Ring**: a ringed marker contains `circle.connection-ring`.
- **Band**: `.region-band` spans the focused occurrence's `start..end` columns, and is absent
  without focus.
- **Scroll**: after a focus change, `scrollLeft` reaches the clamped centre target:
  - within 500 ms (+1 frame) with full motion;
  - in the same frame under `prefers-reduced-motion: reduce`;
  - with no change when the whole board fits.
- **Description**: the polite description (existing `aria-live` region) starts with:
  - `caged_focus_status`: "{shape} shape in focus, frets {lo} to {hi}.", or
  - `caged_focus_none`: "All shapes."

  It ends with one `caged_description_connection` per ringed marker: "String {string}, fret
  {fret}, {interval}, shared by {a} and {b} shapes."

## Zone D — Show connections

- **Control**: `<button role="switch" aria-checked>` with label `caged_show_connections`
  ("Show connections"), placed before **Reset tool**.
- **Default**: off. **Reset tool** turns it off.
- **State cue**: shown as a switch with a visible on/off position, not color alone.
- **Non-compatible tuning**: `aria-disabled`, value kept.

## Zone E — Step and notices

- **Buttons**: `caged_previous_shape` ("Previous shape") and `caged_next_shape` ("Next
  shape"), always rendered, in that order.
  - Disabled state uses `aria-disabled="true"` and the buttons stay in the tab order.
  - Both are disabled with no focus or a non-compatible tuning.
  - **Previous shape** is disabled at index 0, **Next shape** at the last index.
  - "Next" means toward the body (higher frets) in every handedness and orientation, and the
    button labels never flip.
- **Instrument notice**: the existing `Notice` with `instrument_adjusted` appears when
  `instrument.adjustedIn === 'caged'`.
- **Rotate notice**: `Notice` with `caged_rotate_hint` ("Turn your phone sideways to see more
  of the neck."), at most two lines, dismissible and non-modal.
  - It shows only when a portrait phone viewport (width ≤ 599, height > width) opens CAGED and
    the hint was never recorded.
  - It is hidden when the viewport stops being a portrait phone, or when CAGED unmounts.

## Step transition (observable)

- **Window**: from a **Next/Previous shape** activation until 500 ms later (fake clock in
  tests), the shared positions of the departing and arriving occurrences have
  `circle.connection-ring` and class `highlighted`, even with **Show connections** off.
- **Window end**: those rings disappear unless **Show connections** is on.
- **Repeat press**: another press within the window moves the rings to the new pair and
  restarts the window. No stale ring remains.
- **Reduced motion**: the window still applies. The ring itself never animates.

## Persistence (observable)

- **Not persisted**: focus and **Show connections** are never written to `localStorage`. The
  stored `fretboard-master:prefs` value is unchanged by any focus or connections action.
  Both survive Notes → CAGED navigation and reset on reload.
- **Rotate hint**:
  - Showing the rotate notice writes `"rotateHint": true` into the v1 record, `version` stays
    `1`.
  - **Erase my preferences** removes it.
  - **Reset tool** keeps it.
  - With storage blocked, the hint shows at most once per page load.

## Accessibility gates

- **axe**: zero violations at phone, phone-touch and desktop, with and without focus and
  connections on.
- **Keyboard**: every control above is operable from the keyboard alone (Tab, Enter, Space,
  arrows in the radiogroup), with a visible focus indicator.
