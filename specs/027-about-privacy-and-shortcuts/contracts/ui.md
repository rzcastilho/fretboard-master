# Contract: UI, DOM and privacy posture (027)

## §1 About page (`/about`)

Order and roles (FR-001). Every section is a `<section aria-labelledby>` with an `h2`.

| # | Section | `h2` (en) | Content | Ids / hooks |
|---|---|---|---|---|
| 0 | — | `h1` "About Fretboard Master" | — | `tabindex=-1` (existing) |
| 1 | Intro | What this app is | `about_description` | `aria-labelledby="about-intro"` |
| 2 | Legend | Marker legend | `ul` with exactly 3 `li`: `MarkerSample` (`aria-hidden`) + name + meaning, order root, third, fifth | `data-testid` not needed: `getByRole('list', { name: … })` via `aria-labelledby` |
| 3 | Shortcuts | Keyboard shortcuts | `ShortcutList`: `dl` of 5 rows (`dt > kbd`, `dd` action) in order P, `.`, `,`, L, N; then the switch | switch: `input[type=checkbox][role=switch]`, name "Keyboard shortcuts" |
| 4 | Privacy | Privacy | `PrivacyPolicy`: `ul` of 9 `li` (data-model §4), then **Erase my preferences** | `section#privacy` |
| 5 | Version | Version | "Version X.Y.Z" (`__APP_VERSION__`) | — |

- Language switch on About re-renders every string in place (no reload, URL unchanged).
- `/about#privacy` on first load scrolls the Privacy section into view.
- Phone (320 px) and 200 % text: no truncation or horizontal scroll (only the fretboard may scroll;
  About has none).
- axe: zero violations in light, dark, en/pt-BR/es.

`kbd` rendering for punctuation keys:

```html
<kbd><span aria-hidden="true">.</span><span class="sr-only">period</span></kbd>
```

## §2 Shortcuts switch

| State | `checked` | `aria-checked` (implicit) | Stored record | Shortcuts fire | `aria-keyshortcuts` on controls |
|---|---|---|---|---|---|
| on (default) | true | true | no `shortcuts` key | yes | present |
| off | false | false | `"shortcuts":false` | no, on every screen | absent |

Toggle with click or Space. After **Erase my preferences** (confirm) the app is on Home and the
switch is on.

## §3 Keyboard behaviour

| Screen | P | . | , | L | N |
|---|---|---|---|---|---|
| Home | — | — | — | — | notation toggle |
| Notes | Listen (if enabled) | — | — | name → octave → none → name | notation toggle |
| Triads | main Listen (if enabled; also with Compare on) | next inversion, wraps (if inversion control enabled) | previous inversion, wraps | interval ↔ name | notation toggle |
| CAGED | Listen (if enabled) | Next shape (if enabled, no wrap) | Previous shape (if enabled, no wrap) | interval ↔ name | notation toggle |
| About | — | — | — | — | notation toggle |

"—" = nothing happens and the event is not `preventDefault`ed.

Never shortcuts: arrows, Space, Enter, Escape, Tab, Home, End, PageUp, PageDown, F-keys; any key
with Ctrl, Cmd/Meta, Alt or AltGr; key repeat; while focus is in a text-like `input`, `textarea`,
`select` or contenteditable (e.g. the custom-tuning field). Focus never moves. Feedback is exactly
the control's: checked radio, fretboard update and description announcement, playback, stored
preference.

## §4 `aria-keyshortcuts` (only while on)

| Control | Component | Value |
|---|---|---|
| Notes Listen button | `NotesActions.svelte` | `P` |
| Triads Listen button (not Listen comparison) | `TriadsSecondary.svelte` | `P` |
| CAGED Listen button | `CagedListen.svelte` | `P` |
| Triads inversion radiogroup | `TriadsControls.svelte` → `ChoiceGroup keyshortcuts` | `. ,` |
| CAGED Previous shape / Next shape | `CagedTool.svelte` | `,` / `.` |
| Label-type radiogroups (Notes, Triads, CAGED) | `ChoiceGroup keyshortcuts` | `L` |
| Notation toggle group | `NotationToggle.svelte` | `N` |

`ChoiceGroup` new optional prop: `keyshortcuts?: string` → `aria-keyshortcuts` on the
`role="radiogroup"` element; omitted when `undefined`.

## §5 Privacy posture (FR-012 … FR-019)

| Check | Where | Pass condition |
|---|---|---|
| Same-origin requests | `e2e/privacy.spec.ts` | every request URL from the full pass has the app origin (`data:`/`blob:` ignored) |
| No permission APIs | `e2e/privacy.spec.ts` (init-script spies) | `getUserMedia`, `geolocation.getCurrentPosition`/`watchPosition`, `Notification.requestPermission`, `permissions.query`, `requestMIDIAccess` call counts all 0; no `dialog` event |
| No cookies / foreign storage | `e2e/privacy.spec.ts` | `context.cookies()` empty; every `localStorage` key starts with `fretboard-master:` |
| No identity inputs | `e2e/privacy.spec.ts` | no `input[type=email|password|tel]` on `/`, `/notes`, `/triads`, `/caged`, `/about` |
| CSP self-only | `tests/unit/csp.test.ts` | every directive value ∈ {`self`, `none`, `data:`}; `script-src` and `connect-src` exactly `['self']` |
| Stored fields known | `tests/unit/prefs/schema.test.ts` | serialised record keys ⊆ known keys (data-model §1); none identifier-like |
| About text complete | `tests/unit/i18n/about-catalog.test.ts` | no missing/empty `about_*`/`shortcuts_*` keys in pt-BR, es; policy word caps; no jargon |

Unchanged and asserted unchanged: `svelte.config.js` CSP directives, `static/_headers`
`Permissions-Policy` (`tests/unit/headers.test.ts` already covers it). No cookie banner or consent
flow (FR-018).
