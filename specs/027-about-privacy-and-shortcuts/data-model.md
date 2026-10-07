# Data Model: About Page, Privacy, and Keyboard Shortcuts

**Feature**: 027-about-privacy-and-shortcuts | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

## 1. Preferences record — new field `shortcuts`

Additive optional field on the existing v1 record (`src/lib/prefs/schema.ts`); `PREFS_VERSION`
stays `1`.

| Field (`Preferences`) | Stored key | Type | Default | Stored when | Invalid / absent |
|---|---|---|---|---|---|
| `shortcuts` | `shortcuts` | `boolean` | `true` | only when `false` | → `true` |

- Serialisation order: appended last, after `theme` (stable key order is part of the codec
  contract; default records stay byte-identical to slice 026).
- `PreferencesPatch` accepts `{ shortcuts: boolean }` through the existing `Partial`.
- Erase: `session.erase()` removes the record; `preferences.erase()` calls
  `shortcuts.restore(true)`.
- Fixture added: `tests/unit/prefs/fixtures/shortcuts-off.txt` →
  `{"version":1,"tuning":"AF-1","frets":…,"labels":{…},"shortcuts":false}`.

**Known record keys** (used by the FR-019(e) "no identifier" test): `version`, `strings`, `tuning`,
`customTuning`, `frets`, `muted`, `volume`, `lastTool`, `labels`, `handedness`, `orientation`,
`rotateHint`, `tempo`, `language`, `notation`, `accidentals`, `cagedNote`, `theme`, `shortcuts`.

## 2. Shortcut

Static table in `src/lib/state/shortcuts.ts` (pure).

| Key (`KeyboardEvent.key`) | Action id | Screens where it acts | Mirrors control | Enabled when | About label key |
|---|---|---|---|---|---|
| `p` / `P` | `listen` | notes, triads, caged | Listen (`NotesActions`, `TriadsSecondary` main Listen, `CagedListen`) | `<tool>.display.listen.enabled` | `shortcuts_listen` |
| `.` | `next` | triads, caged | Triads inversion group (next, wraps); CAGED **Next shape** | Triads `display.controls.inversion`; CAGED `display.steps.next` | `shortcuts_next` |
| `,` | `previous` | triads, caged | Triads inversion group (previous, wraps); CAGED **Previous shape** | Triads `display.controls.inversion`; CAGED `display.steps.previous` | `shortcuts_previous` |
| `l` / `L` | `labels` | notes, triads, caged | Label-type ChoiceGroup of the tool | always (group never disabled) | `shortcuts_labels` |
| `n` / `N` | `notation` | every screen | `NotationToggle` | always | `shortcuts_notation` |

```ts
type ShortcutAction = 'listen' | 'next' | 'previous' | 'labels' | 'notation';
```

Validation rules (FR-009): no action when Ctrl, Meta, Alt or AltGraph is held; on `repeat`; when
`defaultPrevented`; when `isComposing`; when the target is `textarea`, `select`, contenteditable, or
an `input` whose type is not `checkbox|radio|range|button|submit|reset`. Shift is ignored. Any key
not in the table → no action.

Cycle orders (R-05):

| List | Order | Wrap |
|---|---|---|
| Triads inversions (`INVERSIONS`) | `root → first → second` | yes |
| Notes labels | `name → octave → none` | yes |
| Triads / CAGED labels | `interval → name` | yes (toggle) |
| CAGED occurrences | start-fret order (existing `caged.step`) | no |
| Notation | `letters ↔ solfege` (on `notation.effective`) | toggle |

## 3. Shortcuts switch (runes store)

`src/lib/state/shortcuts.svelte.ts`

| Member | Kind | Behaviour |
|---|---|---|
| `enabled` | getter, `boolean` | `true` by default |
| `start(stored: boolean)` | method | called once from `preferences.start()`; sets `enabled`, no write |
| `choose(on: boolean)` | method | sets `enabled`, then `preferences.remember({ shortcuts: on })` |
| `restore(on: true)` | method | erase path; sets `enabled`, no write |
| `runShortcut(action, screen)` | function | see contracts/pure-api.md §3; returns `true` when a store method ran |
| `resetShortcutsForTests()` | test seam | `enabled = true` |

State transitions:

```text
          choose(false)                 choose(true) / erase
  [on] ─────────────────▶ [off] ─────────────────────────────▶ [on]
   ▲  start(true|absent)    ▲ start(false)
```

While `off`: the layout handler returns before matching; every `aria-keyshortcuts` is absent.

## 4. About catalog keys

New or changed keys in `messages/{en,pt-BR,es}.json`. English drafts below (≤ 220 words for the
policy items combined; pt-BR/es ≤ 280). Wording is subject to the pre-launch legal review (Q-11).

| Key | English draft | Status |
|---|---|---|
| `about_description` | Fretboard Master is a set of interactive fretboard study tools for guitarists. It shows notes, triads and CAGED shapes on your own instrument, and everything runs on your device. | changed |
| `about_intro_heading` | What this app is | new |
| `about_legend_heading` | Marker legend | new |
| `legend_root_name` / `_meaning`, `legend_third_*`, `legend_fifth_*` | (existing) | reused |
| `shortcuts_heading` | Keyboard shortcuts | new |
| `shortcuts_listen` | Listen | new |
| `shortcuts_next` | Next inversion (Triads) or next shape (CAGED) | new |
| `shortcuts_previous` | Previous inversion (Triads) or previous shape (CAGED) | new |
| `shortcuts_labels` | Switch label type | new |
| `shortcuts_notation` | Switch notation (letters or solfège) | new |
| `shortcuts_key_period` | period | new (sr-only) |
| `shortcuts_key_comma` | comma | new (sr-only) |
| `shortcuts_switch` | Keyboard shortcuts | new (switch label) |
| `shortcuts_switch_hint` | Single-key shortcuts work when no text field is focused. Turn them off if they get in the way. | new |
| `about_privacy_heading` | Privacy | new |
| `about_privacy_no_data` (1) | Fretboard Master collects no personal data: no account, no sign-up, no email, no name, no identifier. | new |
| `about_privacy_stored` (2) | Your settings stay only in this browser on this device: language and notation; instrument (strings, tuning, including a custom one, frets, left-handed, orientation); sound, volume and tempo; theme; label choices and the last tool; which one-time hints were shown; and the keyboard shortcuts switch. No cookies are used, and these settings never leave your device. | new |
| `about_privacy_erase` (3) | Clearing your browser data, or Erase my preferences below, removes them. If your browser blocks storage, nothing is kept and the app still works. | new |
| `about_privacy_not_measured` (4) | Nothing is measured. No usage or error data is sent anywhere. | new |
| `about_privacy_no_ads` (5) | There are no ads, no trackers and no content from other companies. | new |
| `about_privacy_no_permissions` (6) | The app never asks for your microphone, camera, location or notifications. | new |
| `about_privacy_hosting` (7a) | The service that delivers the app's files sees what any website sees, such as your IP address, only to deliver them. The app never uses it to identify anyone. | new |
| `about_privacy_share_links` (7b) | A share link holds only view settings (tool, notes, instrument), no personal data, and goes only to whoever you send it to. | new |
| `about_privacy_all_ages` (8) | It is suitable for all ages: there is no contact between users and no content from users. | new |
| `about_version_heading` | Version | new |
| `about_version`, `about_erase*` | (existing) | unchanged |

Draft policy word count (en): ≈ 200.

Statement coverage (spec Clarifications → Privacy text): (1) `no_data`; (2) `stored`;
(3) `erase`; (4) `not_measured`; (5) `no_ads`; (6) `no_permissions`; (7) `hosting` + `share_links`;
(8) `all_ages`. `about_privacy_stored` must list every `Preferences` category; a unit test keeps a
category → field map next to `DEFAULT_PREFERENCES` so a future preference without a policy category
fails the build.

## 5. About page structure (DOM model)

```text
main
├── h1  about_heading                                (tabindex=-1, existing)
├── section[aria-labelledby=about-intro]    h2 about_intro_heading     p about_description
├── section[aria-labelledby=about-legend]   h2 about_legend_heading    ul > li×3 (MarkerSample root|third|fifth + name + meaning)
├── section[aria-labelledby=about-shortcuts] h2 shortcuts_heading      ShortcutList (dl: kbd + action ×5; label > input[type=checkbox][role=switch])
├── section#privacy[aria-labelledby=about-privacy] h2 about_privacy_heading  PrivacyPolicy (ul > li×9) + ErasePreferences
└── section[aria-labelledby=about-version]  h2 about_version_heading   p about_version
```

## 6. Relationships

- `Preferences.shortcuts` ← written by `shortcuts.choose`, read by `preferences.start`, cleared by
  `preferences.erase`.
- `Shortcut.action` → calls the same store method as the mirrored control (`notes`, `triads`,
  `caged`, `notation` stores). No new view state; no share-link field (shortcuts are a device
  setting, not part of a view).
- `aria-keyshortcuts` on mirrored controls ← `shortcuts.enabled`.
